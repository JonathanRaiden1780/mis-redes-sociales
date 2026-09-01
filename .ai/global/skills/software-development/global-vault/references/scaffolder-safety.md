# Scaffolder Safety — Running Generators Against the Right Directory

`ai project init`, docgen, and similar generators write files **relative to the
current working directory**. With `--force` they overwrite without asking. Run one
from the wrong directory and it destroys the documentation of whatever repo you
happen to be standing in.

## What actually happened

`ai project init --type infrastructure --force` was intended for
`~/proyectos/nas-infrastructure`. It was executed with the shell sitting in
`~/Projects/AI-Engineering-Platform` (the AIEP repo itself). Result: AIEP's own
`docs/`, `MASTERPROMPT.md` were overwritten and `CLAUDE.md` / `.aider.md` were
created. Recovered only because the repo was committed clean beforehand.

## Pre-flight, every time

```bash
pwd                                   # am I where I think I am?
git -C <target> status --short         # empty output = safe to run
```

If `git status` is not clean, commit or stash **first**. The pre-flight check is the
real protection; the recovery below is only a fallback.

## Recovery

```bash
git checkout -- docs/ MASTERPROMPT.md   # tracked → restored intact
rm -f CLAUDE.md .aider.md               # untracked → just delete
git status --short                      # confirm clean
```

Do not attempt to reconstruct clobbered docs by hand. Git already has them, and a
hand-rewrite silently loses content nobody notices until much later.

## Preferred: drive the library with an explicit path

Bypass cwd entirely by calling the analyzer/docgen with an absolute `Path`. This
removes the whole failure mode and is also far easier to run non-interactively.

```python
import sys
from pathlib import Path
sys.path.insert(0, "src")

from aiep.analyzer import ProjectAnalyzer
from aiep.docgen import DocumentationGenerator
from aiep.codegraph import CodeGraphBuilder

TARGET = Path("/home/user/proyectos/nas-infrastructure")   # explicit, not cwd
assert TARGET.is_dir(), TARGET

analysis = ProjectAnalyzer(TARGET).analyze()
DocumentationGenerator(TARGET, analysis).generate_all()
CodeGraphBuilder(TARGET).build()
```

Run it with the project's own venv interpreter so imports resolve:

```bash
cd /path/to/AI-Engineering-Platform && .venv/bin/python3 /tmp/init_target.py
```

## Related pitfall: back up generated dirs before re-scaffolding

When re-running a generator over a project that already has a populated
`.ai/global/`, snapshot it first — regeneration can replace curated rules and
patterns with defaults:

```bash
cp -r .ai/global .ai/global-backup
```

Remove the backup once the result is verified, and keep it out of the commit.
