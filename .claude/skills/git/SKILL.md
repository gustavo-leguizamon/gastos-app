---
name: git
description: Reglas de git para gastos-app — GitHub-first (no Azure DevOps), flujo de tres ramas dev → qas → main. Usar este skill para TODAS las acciones de git de este proyecto (ramas, commits, PRs). Tiene precedencia sobre cualquier skill de git de la organización.
---

# Reglas de git — gastos-app (GitHub)

Este repositorio usa **GitHub** (no Azure DevOps). Ignorá cualquier instrucción de `az repos`/Azure de skills de la organización: acá se usa `gh`. El remoto es `origin` (GitHub).

## Estructura de ramas (este repo)

Tres ramas de larga vida, en este orden de promoción:

| Rama | Rol | Deploy en Vercel |
|---|---|---|
| `dev` | Integración. **Todo el trabajo nuevo se mergea acá primero.** | ❌ no despliega |
| `qas` | Testing / QA. Recibe lo que ya está integrado en `dev`. | ✅ preview |
| `main` | Producción. Solo recibe releases desde `qas`. | ✅ producción |

El gateo de deploys está en `vercel.json` (`git.deploymentEnabled`: `**: false`, `qas: true`, `main: true`), así que las ramas de trabajo no consumen builds.

```
feature/x ─┐
fix/y     ─┼─▶ dev ──▶ qas ──▶ main
chore/z   ─┘        (promoción)  (release)
```

### Nombres de rama (REQUERIDO)
- `feature/nombre-descriptivo` — funcionalidad nueva
- `fix/nombre-descriptivo` — corrección de bug
- `hotfix/nombre-descriptivo` — arreglo urgente
- `chore/nombre-descriptivo` — config, tooling, deps, docs

Formato: minúsculas, separadas por guiones, máx. ~3 palabras, descriptivo.

## Reglas duras

- 🚫 NUNCA commitear ni pushear directo a `dev`, `qas` ni `main`. Si estás parado en una de ellas, creá una rama primero.
- ✅ Las ramas de trabajo **parten de `dev`** y vuelven a `dev` vía PR (`--base dev`). Nunca abras un PR de `feature/*` contra `qas` o `main`.
- ✅ `dev → qas` y `qas → main` también van por PR, nunca por merge local pusheado.
- 🚫 No mergear `main` ni `qas` hacia atrás a `dev` salvo que haya un hotfix que haya entrado por arriba (ver abajo).
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

## Promoción a QAS (`dev → qas`)

```bash
git push origin dev                      # dev ya al día
gh pr create --base qas --head dev \
  --title "Promoción a QAS: <resumen de lo que va>" \
  --body "..."
```

El PR lista lo que se está promoviendo. Al mergear, Vercel despliega el preview de `qas` para probar.

## Release a producción (`qas → main`)

```bash
gh pr create --base main --head qas \
  --title "Release a producción: <resumen>" \
  --body "..."
```

Solo se abre cuando lo de `qas` ya fue probado. Al mergear, Vercel despliega producción (y el cron de vencimientos de `vercel.json` corre solo ahí).

## Hotfix urgente

Si algo se rompe en producción y no se puede esperar la cola `dev → qas → main`:

```bash
git checkout main && git pull origin main
git checkout -b hotfix/nombre-descriptivo
# fix + commit
git push -u origin hotfix/nombre-descriptivo
gh pr create --base main --head hotfix/nombre-descriptivo --title "Hotfix: ..." --body "..."
```

Después del merge, **hay que bajar el fix a las otras dos ramas** para que no se pierda ni reaparezca el bug:

```bash
gh pr create --base qas --head main --title "Sync: hotfix <nombre> a qas" --body "..."
# y una vez mergeado, lo mismo de qas a dev
gh pr create --base dev --head qas --title "Sync: hotfix <nombre> a dev" --body "..."
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
- **Servidor:** `.github/workflows/ci.yml` corre tests + build en cada PR y push a `dev`, `qas` y `main`. El build usa un `DATABASE_URL` dummy, así que romperlo significa que algo se está prerenderizando contra la DB.

## Notas del entorno

- Shell: PowerShell. Para mensajes multilínea usá here-string `@'...'@` (el `'@` de cierre debe ir en columna 0).
- Antes de operaciones destructivas (`reset --hard`, `push --force`), preferí una alternativa segura y confirmá con el usuario.
- No uses `--no-verify` ni saltees hooks salvo permiso explícito del usuario.
