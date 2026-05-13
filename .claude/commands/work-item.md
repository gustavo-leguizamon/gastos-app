# Proceso estándar de trabajo

Argumento: $ARGUMENTS (ID del work item en Azure DevOps)

## Instrucciones

Sigue este proceso EXACTO, paso por paso. NO te saltes ningún paso.
NO comiences a codificar hasta que el usuario confirme explícitamente.

### FASE 0: Validación del work item
Antes de cualquier otra acción, valida que el work item existe y pertenece al proyecto correcto:

1. Obtén el proyecto configurado por defecto en Azure CLI:
```bash
az devops configure --list
```
Extrae el valor de `project` de la salida (ej: `project = ArchitectureTemplate` → el proyecto es `ArchitectureTemplate`).

2. Obtén la información del work item:
```bash
az boards work-item show --id $ARGUMENTS --output json
```

3. **Validaciones (DETENTE si alguna falla):**

   - Si el comando falla o el work item no existe:
   > ⛔ **Error de work item**
   > El work item #$ARGUMENTS no existe o no tienes acceso.
   > Verifica el ID del work item e intenta de nuevo.

   - Compara el campo `fields.System.TeamProject` del work item con el proyecto por defecto. Si NO coinciden:
   > ⛔ **Error de proyecto**
   > El work item #$ARGUMENTS pertenece al proyecto **{TeamProject del work item}**, pero el proyecto configurado por defecto es **{proyecto por defecto}**.
   > Este command solo trabaja con work items del proyecto actual.

NO continúes con ninguna fase si alguna validación falla.

**IMPORTANTE:**
- Antes de seguir con el siguiente paso, hacer un fetch y pull sobre la rama en la que está parado el usuario

### FASE 1: Lectura
1. Ejecuta:
```bash
az boards work-item show --id $ARGUMENTS --output json
az boards work-item relation show --id $ARGUMENTS --output json
```
2. Lee el contenido completo del work item (título, descripción, estado, asignado, relaciones)
3. Identifica el repositorio y rama actual con `git branch --show-current`

### FASE 2: Análisis técnico y Plan

**CRITICAL**: You MUST use extended thinking (ultrathink) for this phase.  Do NOT use any file-writing or code-editing tools until FASE 5.

1. Think deeply and carefully about the technical approach before proceeding. Read the project structure relevant to the work item.
2. Lee los archivos que probablemente se verán afectados
3. Realiza un **análisis de impacto técnico** en el codebase:
   - **Impacto en código existente:** Buscar en el código las áreas que podrían verse afectadas directa e indirectamente. Usar exploración de archivos y búsqueda para identificar dependencias.
   - **Reglas de negocio en código:** Identificar si el cambio toca lógica existente (validaciones, cálculos, flujos de estado, permisos). Marcar cualquier regla que podría alterarse como riesgo.
   - **Duplicación técnica:** Verificar si ya existe funcionalidad similar en el código que podría reutilizarse o que entraría en conflicto.
   - **Seguridad y calidad:** Evaluar si el cambio podría introducir vulnerabilidades (exposición de datos, cambios en permisos, inputs no validados) o degradar la calidad del sistema (performance, mantenibilidad).
4. Genera un PLAN con este formato:

   **Objetivo:** (1 línea)
   **Análisis de impacto técnico:** (resumen de hallazgos del punto 3)
   **Archivos a modificar:** (lista)
   **Archivos a crear:** (lista)
   **Enfoque técnico:** (descripción concisa)
   **Preguntas abiertas:** (lista numerada de dudas)
   **Riesgos técnicos:** (lo que podría salir mal, incluyendo impactos identificados)
   **Estimación:** (pequeño/mediano/grande)
   **Tests:** (los tests a crear para validar el desarrollo)

5. Presenta el plan al usuario y las preguntas
6. ESPERA respuestas del usuario. Itera hasta que no haya preguntas pendientes.
7. Agrega el plan como comentario en el work item:
```bash
az boards work-item update --id $ARGUMENTS --discussion "## 🤖 Plan de implementación

{plan}"
```

### FASE 3: Confirmación
1. Pregunta explícitamente: "¿Confirmas que proceda con la implementación?"
2. NO continúes sin un "sí" explícito.
3. Cambia el estado del work item a "Active":
```bash
az boards work-item update --id $ARGUMENTS --state "Active"
```

### FASE 4: Preparación del entorno
1. Captura la rama actual: `RAMA_BASE=$(git branch --show-current)`
2. Crea worktree + rama:
```
   git worktree add ../worktrees/issue-$ARGUMENTS -b feature/issue-$ARGUMENTS
   cd ../worktrees/issue-$ARGUMENTS
```
3. Confirma que estás en el worktree correcto antes de hacer cualquier cambio.

### FASE 5: Implementación
1. Realiza los cambios según el plan aprobado
2. Haz commits atómicos y descriptivos (conventional commits)
3. Ejecuta tests si existen
4. Ejecuta linters si existen

### FASE 6: Entrega
1. Push de la rama: `git push -u origin feature/issue-$ARGUMENTS`
2. Crea PR asociado al work item:
```bash
az repos pr create \
  --source-branch feature/issue-$ARGUMENTS \
  --target-branch $RAMA_BASE \
  --title "feat: {título}" \
  --description "Work Item #$ARGUMENTS

## Cambios
{resumen}" \
  --work-items $ARGUMENTS
```
3. Agrega un comentario al work item con link al PR
4. Informa al usuario que el PR está listo
5. Analiza si es necesario actualizar la descripción del work item en base a los cambios realizados y al plan

### FASE 7: Limpieza del worktree
1. Guarda el path del worktree actual:
```
   WORKTREE_PATH=$(pwd)
```
2. Vuelve al repositorio principal:
```
   cd $(git worktree list --porcelain | head -1 | sed 's/worktree //')
```
3. Elimina el worktree:
```
   git worktree remove "$WORKTREE_PATH"
```
4. Si falla por archivos sin commitear, DETENTE y pregunta al usuario.
   NO uses --force sin confirmación.
5. Confirma la limpieza:
```
   git worktree list
```
