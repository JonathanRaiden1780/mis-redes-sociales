# Portainer Web Editor — build context error

## What happened

When deploying a stack via Portainer **Web Editor** with a compose that includes
`build: .`, the build context is the directory where Portainer stored the
compose file — **not** the project source tree. The `COPY package.json
pnpm-lock.yaml ./` step then fails because those files are not in the context.

## Error transcript

```
failed to deploy a stack: compose build operation failed:
  failed to solve: process "/bin/sh -c pnpm install --no-frozen-lockfile"
  did not complete successfully: exit code: 1
```

Inside the build container:

```
ERR_PNPM_NO_PKG_MANIFEST  No package.json found in /app
```

## Why it happens

Portainer Web Editor (and Upload) store **only the compose file** in the stack
storage. When `build: .` is used, Docker's build context is that single-file
directory. No `package.json`, no source tree, no lockfile.

Even if you upload a `.zip` with the whole project, Portainer extracts it into
the stack's own directory — but the `build: .` context is still relative to
where Portainer put the compose, which may not be the project root.

## Fix

Do **not** use `build: .` with Web Editor. Instead:

1. Build the image on the dev machine: `docker build -t playscore:latest .`
2. Export: `docker save playscore:latest | gzip > /tmp/playscore.tar.gz`
3. Transfer to NAS (SCP, USB, File Station, SMB mount)
4. Load on NAS: `docker load -i /tmp/playscore.tar.gz`
5. Compose uses `image: playscore:latest` — no `build:` at all

The compose pasted in Web Editor is self-contained; the image already carries
everything.
