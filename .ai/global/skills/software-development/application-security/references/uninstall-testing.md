# Uninstall Testing for AIEP

How to test install/uninstall cycles during development.

## Full Cycle Test

```bash
# 1. Run uninstall (soft mode preserves data)
bash uninstall.sh

# 2. Verify components removed
ls -la ~/.local/bin/ai              # should not exist
ls -la ~/.local/share/aiep/venv     # should not exist
crontab -l | grep "ai project sync" # should be empty

# 3. Verify preserved data
ls ~/.config/aiep/                  # should still exist
ls ~/.local/share/aiep/             # should still exist

# 4. Re-run installer
bash install.sh

# 5. Verify restoration
which ai                            # should exist
ai --version                        # should work
ls ~/.local/share/aiep/venv         # should exist
```

## Purge Mode Test

```bash
# Full removal including user data
bash uninstall.sh --purge

# Verify everything gone
ls ~/.config/aiep/                  # should not exist
ls ~/.local/share/aiep/             # should not exist
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `~/.local/bin/ai` remains after uninstall | Not an aiep symlink (manually created) | Manual removal |
| PATH still has aiep entries | Shell RC not sourced in new terminal | Open new terminal or `source ~/.bashrc` |
| cron entry persists | `crontab` not available during uninstall | Manually run `crontab -e` |

## Installer vs Uninstaller Symmetry

| Component | Install | Uninstall |
|-----------|---------|-----------|
| Symlink | `ln -sf venv/ai ~/.local/bin/ai` | `rm -f ~/.local/bin/ai` (only if aiep symlink) |
| venv | `uv venv ...` then `pip install` | `rm -rf venv/` |
| Shell RC | Add PATH block | Remove PATH block via sed |
| Cron | Add `ai project sync` entry | Remove matching entries |
| Config | From bundle or heredoc | Removed only with `--purge` |
| Data | Created by `ai project sync` | Removed only with `--purge` |
