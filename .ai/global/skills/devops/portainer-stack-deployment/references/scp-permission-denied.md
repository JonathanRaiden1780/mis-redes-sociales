# SCP + SSH to NAS — permission denied

## What happened

Attempting to copy a Docker image tarball to the NAS:

```bash
scp /tmp/playscore.tar.gz JonathanRaiden@192.168.0.129:/tmp/
```

Resulted in:

```
JonathanRaiden@192.168.0.129's password:
scp: dest open "/tmp/": Permission denied
scp: failed to upload file /tmp/familiaapp.tar.gz to /tmp/
```

And SSH:

```
ssh JonathanRaiden@192.168.0.129 echo OK
Permission denied, please try again.
Permission denied (publickey,password).
```

Verbose SSH (`ssh -v`):

```
debug1: Offering public key: /home/jonathanh/.ssh/id_ed25519 ...
debug1: Authentications that can continue: publickey,password
debug1: Next authentication method: password
debug1: read_passphrase: can't open /dev/tty: No such device or address
Permission denied (publickey,password).
```

## Why it happens — two separate issues

### Issue 1 — SCP destination was a directory, not a file

SCP requires a **full destination file path**. Giving a directory as destination:

```bash
# WRONG
scp file.tar.gz user@host:/tmp/
```

makes SCP try to open `/tmp/` as a file → `Permission denied`.

**Fix**: specify the full file path:

```bash
scp file.tar.gz user@host:/tmp/file.tar.gz
```

### Issue 2 — SSH key not authorized on NAS

The local key (`~/.ssh/id_ed25519`) is not present in the NAS user's
`authorized_keys`. SSH offers the key, the NAS rejects it, then falls back to
password — which fails because there is no TTY to prompt for the password.

**Fix**: add the public key to the NAS user's `authorized_keys`:

```bash
# Get the local public key
cat ~/.ssh/id_ed25519.pub

# On the NAS (via any working SSH session, or DSM Terminal):
mkdir -p /home/JonathanRaiden/.ssh
echo "ssh-ed25519 AAAA..." >> /home/JonathanRaiden/.ssh/authorized_keys
chmod 600 /home/JonathanRaiden/.ssh/authorized_keys
chown -R JonathanRaiden:JonathanRaiden /home/JonathanRaiden/.ssh
```

Or via DSM web UI: **Control Panel > Security > Terminal & SNMP > SSH**.

## When SSH is not available — alternative transfer methods

If you cannot fix SSH right now, transfer the `.tar.gz` by other means:

| Method | How |
|---|---|
| **USB physical** | Copy `.tar.gz` to USB stick → plug into NAS → `docker load` |
| **Synology File Station** | Open http://192.168.0.129:5000 → File Station → upload to `/tmp/` |
| **SMB mount** | Mount NAS share locally → `cp` files there |
| **Synology Drive** | Copy to synced folder on machine → appears on NAS |

After transfer, on the NAS:

```bash
docker load -i /tmp/playscore.tar.gz
docker load -i /tmp/familiaapp.tar.gz
docker images | grep -E "playscore|familiaapp"
```
