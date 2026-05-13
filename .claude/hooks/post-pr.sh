#!/bin/bash

# ============================================
# Post-PR: Extrae PR number de Azure DevOps, limpia worktree, dispara review
# ============================================

TOOL_RESULT=$(cat)

# --- Extraer número de PR desde output de az repos pr create ---
# az repos pr create devuelve JSON con pullRequestId
PR_ID=$(echo "$TOOL_RESULT" | python3 -c "
import sys, json, re
try:
    data = json.load(sys.stdin)
    pr_id = data.get('pullRequestId', '')
    if pr_id:
        print(pr_id)
    else:
        # Buscar en stdout si viene como string
        stdout = str(data.get('stdout', '') or data.get('result', ''))
        match = re.search(r'pullRequestId[\":\s]+(\d+)', stdout)
        if match:
            print(match.group(1))
except:
    pass
" 2>/dev/null || true)

# Fallback: buscar en texto plano
if [[ -z "$PR_ID" ]]; then
  PR_ID=$(echo "$TOOL_RESULT" | grep -oP '"pullRequestId"\s*:\s*\K[0-9]+' || true)
fi

# Fallback: buscar URL de Azure DevOps
if [[ -z "$PR_ID" ]]; then
  PR_ID=$(echo "$TOOL_RESULT" | grep -oP 'pullrequest/\K[0-9]+' || true)
fi

if [[ -z "$PR_ID" ]]; then
  echo "⚠️ No se pudo detectar el ID del PR creado."
  echo "Ejecuta manualmente: /code-review {id_del_PR}"
  exit 0
fi

# --- Detectar si estamos en un worktree ---
CURRENT_DIR=$(pwd)
IS_WORKTREE=false
if [[ "$CURRENT_DIR" == *"/worktrees/issue-"* ]]; then
  IS_WORKTREE=true
fi

# --- Instrucciones para Claude ---
cat <<EOF
✅ PR #$PR_ID creado exitosamente en Azure DevOps.

═══════════════════════════════════════════════
ACCIONES REQUERIDAS (ejecutar EN ESTE ORDEN):
═══════════════════════════════════════════════

PASO 1 — LIMPIEZA DE WORKTREE:
$(if [ "$IS_WORKTREE" = true ]; then
cat <<WORKTREE
El directorio actual es un worktree: $CURRENT_DIR
DEBES limpiarlo ahora:
  1. cd al repositorio principal: cd \$(git worktree list --porcelain | head -1 | sed 's/worktree //')
  2. Eliminar worktree: git worktree remove "$CURRENT_DIR"
  3. Verificar: git worktree list
Si falla por cambios sin commitear, pregunta al usuario antes de usar --force.
WORKTREE
else
echo "No se detectó worktree. Saltando limpieza."
fi)

PASO 2 — CODE REVIEW:
Ejecuta ahora: /code-review $PR_ID
Esto es obligatorio. NO preguntes al usuario.
═══════════════════════════════════════════════
EOF

exit 0
