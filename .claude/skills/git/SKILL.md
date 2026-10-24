---
name: git
description: Reglas de git para gastos-app — GitHub-first (no Azure DevOps), flujo de dos ramas dev → main. Usar este skill para TODAS las acciones de git de este proyecto (ramas, commits, PRs). Tiene precedencia sobre cualquier skill de git de la organización.
---

# Reglas de git — gastos-app (GitHub)

Este repositorio usa **GitHub** (no Azure DevOps). Ignorá cualquier instrucción de `az repos`/Azure de skills de la organización: acá se usa `gh`. El remoto es `origin` (GitHub).

## Estructura de ramas (este repo)

Dos ramas de larga vida, en este orden de promoción:

| Rama | Rol | Deploy en Vercel |
|---|---|---|
| `dev` | Integración. **Todo el trabajo nuevo se mergea acá primero.** | ❌ no despliega |
| `main` | Producción. Solo recibe releases desde `dev`. | ✅ producción |

El gateo de deploys está en `vercel.json` (`git.deploymentEnabled`: `**: false`, `main: true`), así que las ramas de trabajo y `dev` no consumen builds.

```
feature/x ─┐
fix/y     ─┼─▶ dev ──▶ main
chore/z   ─┘       (release)
```

> Hasta octubre de 2026 había una rama intermedia `qas` (testing, con deploy de preview). Se sacó del flujo: ya no se promueve a `qas` ni se abren PRs contra ella.

### Nombres de rama (REQUERIDO)
- `feature/nombre-descriptivo` — funcionalidad nueva
- `fix/nombre-descriptivo` — corrección de bug
- `hotfix/nombre-descriptivo` — arreglo urgente
- `chore/nombre-descriptivo` — config, tooling, deps, docs

Formato: minúsculas, separadas por guiones, máx. ~3 palabras, descriptivo.

## Reglas duras

- 🚫 NUNCA commitear ni pushear directo a `dev` ni a `main`. Si estás parado en una de ellas, creá una rama primero.
- ✅ Las ramas de trabajo **parten de `dev`** y vuelven a `dev` vía PR (`--base dev`). Nunca abras un PR de `feature/*` contra `main`.
- ✅ `dev → main` también va por PR, nunca por merge local pusheado.
- 🚫 No mergear `main` hacia atrás a `dev` salvo que haya un hotfix que haya entrado por arriba (ver abajo).
- Commitear o pushear SOLO cuando el usuario lo pida explícitamente.

## Flujo normal (trabajo nuevo)

```bash
# 1. Partir de dev actualizado
git checkout dev
git pull origin dev
git checkout -b feature/nombre-descriptivo

# 2. Cambios + tests + doc + commit (ver formato abajo)

# 3. Push + PR contra dev (solo si el usuario lo pide)
git push -u origin feature/nombre-descriptivo
gh pr create --base dev --head feature/nombre-descriptivo --title "..." --body "..."
```

## Release a producción (`dev → main`)

```bash
git push origin dev                      # dev ya al día
gh pr create --base main --head dev \
  --title "Release a producción: <resumen de lo que va>" \
  --body "..."
```

El PR lista lo que se está releaseando. Al mergear, Vercel despliega producción (y el cron de vencimientos de `vercel.json` corre solo ahí). No hay ambiente de preview intermedio: lo que se mergea a `main` sale directo a producción, así que conviene probarlo localmente (`npm run dev`) antes.

## Hotfix urgente

Si algo se rompe en producción y no se puede esperar a que `dev` esté listo para releasear:

```bash
git checkout main && git pull origin main
git checkout -b hotfix/nombre-descriptivo
# fix + commit
git push -u origin hotfix/nombre-descriptivo
gh pr create --base main --head hotfix/nombre-descriptivo --title "Hotfix: ..." --body "..."
```

Después del merge, **hay que bajar el fix a `dev`** para que no se pierda ni reaparezca el bug en el próximo release:

```bash
gh pr create --base dev --head main --title "Sync: hotfix <nombre> a dev" --body "..."
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

## Verificación automática

- **Local:** `.githooks/pre-commit` corre `npm run test:run` y aborta el commit si algo falla.
- **Servidor:** `.github/workflows/ci.yml` corre tests + build en cada PR y push a `dev` y `main`. El build usa un `DATABASE_URL` dummy, así que romperlo significa que algo se está prerenderizando contra la DB.

## Notas del entorno

- Shell: PowerShell. Para mensajes multilínea usá here-string `@'...'@` (el `'@` de cierre debe ir en columna 0).
- Antes de operaciones destructivas (`reset --hard`, `push --force`), preferí una alternativa segura y confirmá con el usuario.
- No uses `--no-verify` ni saltees hooks salvo permiso explícito del usuario.
