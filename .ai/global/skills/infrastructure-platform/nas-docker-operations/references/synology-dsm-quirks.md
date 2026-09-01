# Synology DSM Quirks

## No `nano` on DSM

Synology DSM doesn't include `nano`. Use these alternatives:

```bash
# Method 1: heredoc with cat
cat > /path/to/file << 'EOF'
content here
EOF

# Method 2: echo with sudo tee
echo 'content' | sudo tee /path/to/file

# Method 3: sudo sh -c with heredoc
sudo sh -c 'cat > /path/to/file << EOF
content
EOF'
```

## No `synoacltool` on all DSM versions

`synoacltool` doesn't exist on DSM 7 or some DSM 6 builds. Use POSIX ACLs:

```bash
# Recursive permission on existing files
sudo setfacl -R -m u:username:rwx /path

# Default ACL (inherited by new files)
sudo setfacl -R -d -m u:username:rwx /path

# Verify
getfacl /path
```

Or use group + setgid:

```bash
sudo chgrp -R users /path
sudo find /path -type d -exec chmod 2775 {} \;  # dirs inherit group
sudo find /path -type f -exec chmod 664 {} \;   # files readable by group
```

## `chmod 600` breaks directories

The `x` bit on a directory means "enter/search". Without it, the directory is inaccessible even to the owner:

```bash
# WRONG - breaks the directory
sudo chmod 600 /volume1/Docker    # becomes drw-------

# CORRECT
sudo chmod 755 /volume1/Docker    # drwxr-xr-x
sudo chmod 600 /volume1/Docker/secrets/service-account.json  # files only
```

## Docker socket permissions

Containers reading logs via `/var/run/docker.sock:ro` need appropriate permissions:

```bash
# Option 1: Add user to docker group
sudo synogroup --member docker username

# Option 2: ACL on the socket
sudo setfacl -m u:username:r /var/run/docker.sock
```

## Frigate SHM size

Frigate warns when `/dev/shm` < 178MB. Fix:

```bash
# In docker-compose.yml, add to the frigate service:
shm_size: '256m'

# Or mount host /dev/shm:
volumes:
  - /dev/shm:/dev/shm
```

## MQTT host naming

Always use Docker service names for inter-container communication:

```yaml
# CORRECT
mqtt:
  host: nas-mqtt

# WRONG
mqtt:
  host: localhost    # localhost inside the container is the container itself
  host: homeassistant # HA is not on the same Docker network
```

## Volume mount overwrites CWD

If a container's working directory is `/double-take/` and you mount a volume there, the code disappears:

```yaml
# WRONG - overwrites the app code
volumes:
  - /volume1/Docker/double-take:/double-take

# CORRECT - mount to a subdir
volumes:
  - /volume1/Docker/double-take:/double-take/data

# OR use a named volume (preserves image content)
volumes:
  - double-take-data:/double-take
```

## Symlinks inside containers

Some images use symlinks (e.g., Scrypted has `.storage -> /.storage`). The app creates `./.storage/config` which resolves to `/.storage/config`. Mount at the symlink target:

```yaml
# WRONG - .storage is a symlink, mount disappears
volumes:
  - /volume1/Docker/scrypted/.storage:/.double-take/.storage

# CORRECT - mount at the symlink target
volumes:
  - /volume1/Docker/scrypted-storage:/.storage
```
