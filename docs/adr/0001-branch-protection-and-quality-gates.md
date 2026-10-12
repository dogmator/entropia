# ADR-0001: Branch Protection and Quality Gates

## Status

Accepted (2026-10-12)

## Context

Проект разрабатывается с участием облачных агентов (Codex, Claude).
Локальные husky-хуки ненадёжны: агенты работают в чистых контейнерах, где хуки
могут быть не установлены, а также могут быть обойдены (`--no-verify`). Нужен
технически непреодолимый гейт для merge в `main`.

## Decision

Использовать Branch Protection на GitHub для ветки `main`:

- `required_checks`: `["Verification"]`
- `required_approvals`: 0
- `required_conversation_resolution`: true
- `enforce_admins`: false (admin bypass с аудитом)
- `allow_force_pushes`: false
- `allow_deletions`: false
- `required_linear_history`: false (сохраняем merge-коммиты)

Husky используется как быстрый локальный фидбэк, но не как гейт:
`pre-commit` — `lint-staged`, `pre-push` — `pnpm run check`.

## Consequences

- Merge в `main` без зелёных required-checks технически невозможен.
- Облачные агенты обязаны открывать PR (через API) — прямой push в `main` блокируется.
- История PR сохраняется (merge commit), granular-коммиты PR остаются в истории.
- `enforce_admins: false` оставляет аварийный обход для владельца, но он аудируется GitHub.
- `check:strict` пока не является required-check (существующий долг); после вычистки
  он повышается до required (см. `docs/reports/2026-10-12-quality-gates.md`).
