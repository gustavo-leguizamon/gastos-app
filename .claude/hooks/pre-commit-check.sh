#!/bin/bash
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
  echo "❌ BLOQUEADO: No se permite commit en $BRANCH"
  echo "Debes trabajar en un worktree con rama feature/*"
  exit 1
fi