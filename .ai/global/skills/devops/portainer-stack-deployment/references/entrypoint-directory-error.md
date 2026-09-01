# Entrypoint treated as directory — "is a directory: permission denied"

## What happened

A Portainer stack failed to start with:

```
failed to deploy a stack: compose up operation failed:
  Error response from daemon: failed to create task for container:
  failed to create shim task: OCI runtime create failed:
  runc create failed: unable to start container process:
  error during container init: exec: "/usr/local/bin/entrypoint.sh":
  is a directory: permission denied
```

## Why it happens

The `docker-compose.yml` mounted an external file:

```yaml
volumes:
  - ./docker/entrypoint.sh:/usr/local/bin/entrypoint.sh:ro
entrypoint: ["/usr/local/bin/entrypoint.sh"]
```

Portainer Web Editor **does not upload** `./docker/entrypoint.sh` — only the
compose file itself was pasted. Docker, not finding the source file on the host,
**created an empty directory** at `/usr/local/bin/entrypoint.sh`. When the
runtime tried to `exec` it, it failed with `is a directory`.

## Fix

Remove the external-file dependency. Put the startup logic inline:

```yaml
services:
  app:
    image: node:22-alpine
    command: >
      sh -c "
        set -e;
        cd /app;
        # install pnpm, deps, compile natives, start processes
      "
    # NO volumes entry for ./docker/entrypoint.sh
    # NO entrypoint: mount
```

Avoid deeply nested `if/fi` in the inline script — it can arrive truncated:

```
sh: line 11: syntax error: unexpected end of file (expecting "fi")
```

If logic is complex, bake it into the Dockerfile `CMD` instead.
