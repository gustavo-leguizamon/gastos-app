# Cerrar work item

Argumento: $ARGUMENTS (ID del work item en Azure DevOps)

## Instrucciones

### Paso 1: Validación del work item
Verifica que el work item existe y pertenece al proyecto correcto:

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

NO continúes si alguna validación falla.

### Paso 2: Actualizar estado a Done
Cambia el estado del work item a **Done** (o **Closed** según el proceso del proyecto):

```bash
az boards work-item update --id $ARGUMENTS --state "Done"
```

Si el estado "Done" no es válido para este tipo de work item, intenta con "Closed":
```bash
az boards work-item update --id $ARGUMENTS --state "Closed"
```

Informa al usuario que el work item #$ARGUMENTS fue movido a **Done** en Azure DevOps.
