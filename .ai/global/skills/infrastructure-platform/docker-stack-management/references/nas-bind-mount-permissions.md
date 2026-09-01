# Editing bind-mounted config on the NAS (permissions)

Containers write their config as `root`, so the human who needs to hand-edit
`config.yaml` on the NAS hits `EACCES`. Granting that access has two traps: one
that silently breaks every container, and one where the tool you reach for
doesn't exist.

## Never `chmod 600` a directory

On a directory the `x` bit means *may traverse*. Without it the contents are
unreachable **even for the owner**, and every container with a bind mount under
it starts failing.

Reproduced to confirm, not assumed:

```bash
mkdir -p /tmp/t/sub && echo hi > /tmp/t/sub/f.txt
chmod 600 /tmp/t                  # drw-------
cat /tmp/t/sub/f.txt              # Permission denied  ← owner, still denied
chmod 755 /tmp/t                  # drwxr-xr-x
cat /tmp/t/sub/f.txt              # hi
```

So when someone reaches for `600` to "lock down" a config tree, that is the
wrong instrument. The rule:

| Target | Mode |
|---|---|
| Directories | `755` (or `2775` with setgid) |
| Ordinary files | `644` |
| Secrets (`auth.json`, `.env`, service accounts) | `600`, in a `700` dir |

Recovery, if it already happened:

```bash
sudo chmod 755 /volume1/Docker
ls -ld /volume1/Docker            # expect drwxr-xr-x
```

Treat a recursive `chmod`/`chown` over a config tree as a destructive action:
say what it will touch before running it, and re-tighten secrets afterwards.

## Know what is editable in place vs what must go through git

Answer this before granting any permission, or the user will edit a file that
the next redeploy silently discards.

| Path | Nature | Edit via |
|---|---|---|
| `/volume1/Docker/<service>/` | live bind-mounted config | directly on the NAS |
| `/volume1/services/` | mounted data and scripts | directly on the NAS |
| the stack repo | code, Dockerfiles, compose | git → push → Pull and redeploy |

Portainer builds from the **git remote**, not from the NAS disk, so anything a
`Dockerfile` `COPY`s must be committed. Conversely a redeploy does not touch
`/volume1/Docker/...`, which is exactly why those files are the ones to hand-edit.

Typical live-edit targets: NVR camera definitions, broker config, an agent's
`config.yaml`, media-server settings.

## ACL tooling is not portable — probe before prescribing

Synology's `synoacltool` is absent from some DSM builds and, when present, is
often not on the user's `PATH`:

```
sudo: synoacltool: command not found
```

Do not hand over an ACL command without first establishing what exists:

```bash
which synoacltool || ls /usr/syno/bin/synoacltool 2>/dev/null
which setfacl
```

Then pick, in this order:

**1. `synoacltool` by absolute path** — the `fd--` suffix is the inheritance flag
(file-inherit + directory-inherit):

```bash
sudo /usr/syno/bin/synoacltool -add /volume1/Docker \
  "user:USERNAME:allow:rwxpdDaARWc--:fd--"
```

**2. POSIX `setfacl`** (DSM 7) — portable and equivalent. `-d` sets the *default*
ACL, the analogue of `fd--`:

```bash
sudo setfacl -R    -m u:USERNAME:rwx /volume1/Docker   # what exists now
sudo setfacl -R -d -m u:USERNAME:rwx /volume1/Docker   # what gets created later
getfacl /volume1/Docker | head -12                     # verify: look for default:
```

**3. Group + setgid**, when neither ACL tool is available. The leading `2` makes
new files inherit the group rather than the creating process's group:

```bash
sudo chgrp -R users /volume1/Docker
sudo find /volume1/Docker -type d -exec chmod 2775 {} \;
sudo find /volume1/Docker -type f -exec chmod 664 {} \;
```

There is also a pure-GUI route (Panel de control → Carpeta compartida → the
share → Permisos, then Avanzado → apply to subfolders and files) which is the
least error-prone when nothing is urgent.

### Inheritance is not retroactive

Both `fd--` and `setfacl -d` govern only entries created *afterwards*.
Directories that already exist keep their old permissions, which is why the
grant appears to have done nothing. Apply to each existing subtree too:

```bash
sudo find /volume1/Docker -maxdepth 1 -mindepth 1 -type d ! -name secrets \
  -exec setfacl -R    -m u:USERNAME:rwx {} \; \
  -exec setfacl -R -d -m u:USERNAME:rwx {} \;
```

Excluding the secrets directory here is deliberate.

## Read the EACCES message: file or directory?

The path named in the error tells you which problem you have.

```
EACCES: permission denied, open '/volume1/Docker/frigate/config/config.yaml'
```
→ traversal is fine; the **file** is root-owned. Fix the file or the ACL.

```
EACCES: permission denied, stat '/volume1/Docker/hermes'
```
→ you cannot enter the **directory** at all. Either the `x` bit is missing or the
ACL was never applied to this pre-existing dir:

```bash
sudo mkdir -p /volume1/Docker/hermes        # no-op if present, and pre-creates
sudo chmod 755 /volume1/Docker/hermes       # before the container populates it
sudo setfacl -m u:USERNAME:rwx /volume1/Docker/hermes
```

Diagnostic set worth requesting in one go:

```bash
ls -ld /volume1/Docker /volume1/Docker/<service>
ls -la /volume1/Docker/<service>/config/
getfacl /volume1/Docker 2>/dev/null | head -12
id
```

A third cause looks identical and is worth ruling out early: **the filename is
not what you think**. One service's real file was `config.yaml` while every
instruction said `config.yml`.

## `scp` cannot elevate at the destination

Copying into a root-owned directory fails no matter how the local side is
invoked, because `scp` runs as the login user remotely. Stage through a
writable path:

```bash
scp ~/.hermes/auth.json user@NAS:/tmp/auth.json
ssh user@NAS 'sudo mkdir -p /volume1/Docker/hermes && \
  sudo mv /tmp/auth.json /volume1/Docker/hermes/auth.json && \
  sudo chmod 600 /volume1/Docker/hermes/auth.json'
```

Often the better move is to sidestep the file copy entirely — many services can
generate the credential themselves from inside the container, where they already
write as root.

## Re-tighten secrets after any broad grant

A recursive `chown`/`setfacl` over the config tree exposes credentials to every
account on the box. Close them again as the last step:

```bash
sudo chmod 700 /volume1/Docker/secrets
sudo chmod 600 /volume1/Docker/secrets/*.json
sudo chmod 600 /volume1/Docker/hermes/auth.json /volume1/Docker/hermes/.env
```

These files carry OAuth refresh tokens and cloud service accounts — a refresh
token is a long-lived credential, so an over-permissive mode is a real exposure
rather than a tidiness issue.
