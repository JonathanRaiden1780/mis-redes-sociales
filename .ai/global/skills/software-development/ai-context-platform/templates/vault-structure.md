# Vault Directory Templates

## Standard Vault Structure

```
.ai/global/
├── rules/
│   ├── team-rules.md           # Team-wide rules (behavior, coding style)
│   ├── project-rules.md        # Project-specific rules
│   └── security-rules.md      # Security requirements
├── skills/
│   ├── pytest.yaml             # Example: pytest skill
│   ├── docker.yaml             # Example: docker skill
│   └── custom-tools.yaml       # Custom team tools
├── patterns/
│   ├── clean-arch.yaml         # Clean Architecture
│   ├── microservices.yaml      # Microservices pattern
│   └── event-driven.yaml       # Event-driven architecture
├── projects/
│   ├── project-a.yaml          # Index entry for Project A
│   └── project-b.yaml          # Index entry for Project B
├── index.yaml                  # Auto-generated search index
└── vault.yaml                  # Vault configuration
```

## Skill YAML Template

```yaml
name: pytest
description: Python testing framework with fixtures and parametrization
added_at: "2026-08-15T10:00:00Z"
metadata:
  category: testing
  url: https://docs.pytest.org
  install: pip install pytest
```

## Pattern YAML Template

```yaml
name: clean-arch
description: Clean Architecture pattern with domain/application/infrastructure layers
template: |
  Domain Layer (entities, use cases)
  ↓
  Application Layer (services, DTOs)
  ↓
  Infrastructure Layer (repositories, external APIs)
  ↓
  Presentation Layer (CLI, API, UI)
added_at: "2026-08-15T10:00:00Z"
```

## Project Index Template

```yaml
name: my-project
path: /home/user/projects/my-project
description: Main web application
added_at: "2026-08-15T10:00:00Z"
updated_at: "2026-08-15T10:00:00Z"
```
