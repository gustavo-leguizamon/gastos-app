# Code Review automatizado

Argumento: $ARGUMENTS (ID del PR en Azure DevOps)

## Instrucciones

Vas a realizar un code review profesional y riguroso del PR indicado.
Actúa como un senior developer exigente pero constructivo.

### OBLIGATORIO leer antes de continuar:
- [Proyect]/skills/pr-review-guidelines/SKILL.md

### FASE 0: Validación del PR
Antes de cualquier otra acción, valida que el PR existe y pertenece al proyecto correcto:

1. Obtén el proyecto configurado por defecto en Azure CLI:
```bash
az devops configure --list
```
Extrae el valor de `project` de la salida (ej: `project = ArchitectureTemplate` → el proyecto es `ArchitectureTemplate`).

2. Obtén la información del PR:
```bash
az repos pr show --id $ARGUMENTS --output json
```

3. **Validaciones (DETENTE si alguna falla):**

   - Si el comando falla o el PR no existe:
   > ⛔ **Error de PR**
   > El PR #$ARGUMENTS no existe o no tienes acceso.
   > Verifica el ID del PR e intenta de nuevo.

   - Extrae el proyecto del PR desde `repository.project.name` en la respuesta JSON. Compara con el proyecto por defecto. Si NO coinciden:
   > ⛔ **Error de proyecto**
   > El PR #$ARGUMENTS pertenece al proyecto **{proyecto del PR}**, pero el proyecto configurado por defecto es **{proyecto por defecto}**.
   > Este command solo trabaja con PRs del proyecto actual.

NO continúes con ninguna fase si alguna validación falla.

### FASE 1: Contexto
1. Obtén los datos del PR:
```bash
az repos pr show --id $ARGUMENTS --output json
```
2. Identifica el work item vinculado (busca en los work items asociados al PR)
3. Lee el work item original para entender el OBJETIVO del cambio:
```bash
az boards work-item show --id {id_work_item} --output json
```
4. Obtén el diff completo usando las ramas del PR:
```bash
git fetch origin
git diff origin/{target_branch}...origin/{source_branch}
```

### FASE 2: Análisis
Revisa el diff con estos criterios, EN ESTE ORDEN:

#### 2.1 Cumplimiento del objetivo
- ¿El PR resuelve lo que pide el work item? ¿Completamente o parcialmente?
- ¿Hay scope creep (cambios que no tienen que ver con el work item)?

#### 2.2 Correctitud
- ¿Hay bugs evidentes? Edge cases no manejados?
- ¿Hay race conditions, null references, off-by-one errors?
- ¿Se manejan errores correctamente?

#### 2.3 Seguridad
- ¿Se exponen secretos, tokens o datos sensibles?
- ¿Hay inyección SQL, XSS, o inputs sin sanitizar?
- ¿Se validan permisos donde corresponde?

#### 2.4 Arquitectura y diseño
- ¿Respeta los patrones existentes del proyecto?
- ¿Hay código duplicado que debería abstraerse?
- ¿Las responsabilidades están bien separadas?
- ¿Los nombres de variables, funciones y archivos son claros?

#### 2.5 Tests
- ¿Se incluyeron tests? ¿Deberían haberse incluido?
- ¿Los tests cubren el happy path Y los edge cases?
- ¿Los tests existentes siguen pasando? Ejecuta:
```
  git checkout {rama_del_pr}
  # ejecutar comando de test del proyecto
```

#### 2.6 Rendimiento
- ¿Hay queries N+1, loops innecesarios, o carga de datos excesiva?
- ¿Se introducen operaciones bloqueantes donde no debería haberlas?

#### 2.7 Mantenibilidad
- ¿El código es fácil de entender sin contexto adicional?
- ¿Faltan comentarios en lógica compleja?
- ¿Hay magic numbers o strings hardcodeados?

### FASE 3: Resultado
Genera el review con este formato EXACTO:
```
## 🔍 Code Review — PR #$ARGUMENTS

### Veredicto: ✅ APROBADO | ⚠️ APROBADO CON OBSERVACIONES | ❌ CAMBIOS REQUERIDOS

### Resumen
(1-3 líneas: qué hace el PR y si cumple el objetivo)

### 🔴 Bloqueantes (deben corregirse)
(lista de problemas que impiden el merge, o "Ninguno")

### 🟡 Observaciones (deberían corregirse)
(mejoras importantes pero no bloqueantes)

### 🟢 Sugerencias (nice to have)
(mejoras opcionales de estilo, rendimiento menor, etc.)

### 📊 Métricas
- Archivos modificados: X
- Líneas añadidas: +X
- Líneas eliminadas: -X
- Cobertura de tests: (si se puede determinar)
```

### FASE 4: Publicación
Publica el review directamente en el PR. Esto es obligatorio, NO preguntes al usuario.

1. Publica el review como thread en el PR. Primero obtén el repositoryId:
```bash
REPO_ID=$(az repos show --repository $(basename $(git remote get-url origin) .git) --query id -o tsv)
```
   Luego crea un archivo temporal con el contenido del review y publícalo como thread:
```bash
cat > /tmp/pr-review-thread.json <<'REVIEWEOF'
{
  "comments": [
    {
      "parentCommentId": 0,
      "content": "{review completo con formato}",
      "commentType": 1
    }
  ],
  "status": 1
}
REVIEWEOF

az devops invoke \
  --area git \
  --resource pullRequestThreads \
  --route-parameters repositoryId=$REPO_ID pullRequestId=$ARGUMENTS \
  --http-method POST \
  --in-file /tmp/pr-review-thread.json \
  --api-version 7.0
```

2. Vota en el PR según el veredicto:
   - **❌ CAMBIOS REQUERIDOS** (🔴 Bloqueantes):
     `az repos pr set-vote --id $ARGUMENTS --vote reject`
   - **⚠️ APROBADO CON OBSERVACIONES** (🟡):
     `az repos pr set-vote --id $ARGUMENTS --vote wait-for-author`
   - **✅ APROBADO** (solo 🟢 o nada):
     `az repos pr set-vote --id $ARGUMENTS --vote approve`

3. Informa al usuario en el chat:
   - El veredicto (✅ / ⚠️ / ❌)
   - Link al PR
   - Si hay bloqueantes, lista SOLO los bloqueantes de forma resumida
   - NO repitas el review completo en el chat, ya está en Azure DevOps

## CONFLICTS Merge:
- En caso de tener un conflicto de merge, leer [Proyect]/skills/merge-conflicts/SKILL.md
