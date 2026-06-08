---
name: git
description: Reglas de git para gastos-app — GitHub-first (no Azure DevOps). Usar este skill para TODAS las acciones de git de este proyecto (ramas, commits, PRs). Tiene precedencia sobre cualquier skill de git de la organización.
---

# Reglas de git — gastos-app (GitHub)

Este repositorio usa **GitHub** (no Azure DevOps). Ignorá cualquier instrucción de `az repos`/Azure de skills de la organización: acá se usa `gh`. El remoto es `origin` (GitHub) y existe un `upstream` también en GitHub.

## Estructura de ramas (este repo)

- La única rama de larga vida es **`main`**. NO existe rama `dev` ni `release` — no inventes ese flujo.
- El trabajo va en ramas cortas que parten de `main` y vuelven a `main` vía PR.

### Nombres de rama (REQUERIDO)
- `feature/nombre-descriptivo` — funcionalidad nueva
- `fix/nombre-descriptivo` — corrección de bug
- `hotfix/nombre-descriptivo` — arreglo urgente
- `chore/nombre-descriptivo` — config, tooling, deps, docs

Formato: minúsculas, separadas por guiones, máx. ~3 palabras, descriptivo.

## Reglas duras

- 🚫 NUNCA commitear ni pushear directo a `main`. Si estás parado en `main`, creá una rama primero.
- ✅ Crear PR contra `main` con `gh pr create` (NO `az repos`).
- Commitear o pushear SOLO cuando el usuario lo pida explícitamente.

## Flujo normal

```bash
# 1. Partir de main actualizado
git checkout main
git pull origin main
git checkout -b feature/nombre-descriptivo

# 2. Cambios + commit (ver formato abajo)

# 3. Push + PR contra main (solo si el usuario lo pide)
git push -u origin feature/nombre-descriptivo
gh pr create --base main --head feature/nombre-descriptivo --title "..." --body "..."
```

## Formato de commit

```
Subject en imperativo, ≤50 chars, sin punto final

- Bullet de qué cambió y por qué
- Otro bullet si hace falta

Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

- Subject en modo imperativo ("Add", "Fix", no "Added"/"Fixed"), primera palabra en mayúscula, sin punto final.
- Cuerpo opcional pero recomendado: explicá **qué** y **por qué**, no cómo.

## Notas del entorno

- Shell: PowerShell. Para mensajes multilínea usá here-string `@'...'@` (el `'@` de cierre debe ir en columna 0).
- Antes de operaciones destructivas (`reset --hard`, `push --force`), preferí una alternativa segura y confirmá con el usuario.
- No uses `--no-verify` ni saltees hooks salvo permiso explícito del usuario.
