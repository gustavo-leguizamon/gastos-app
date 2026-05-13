# Release a entornos

Argumento: $ARGUMENTS (formato: {rama_origen} {rama_destino})
Ejemplo: /release develop staging
Ejemplo: /release staging main

## Instrucciones

### FASE 0: Validación de argumentos
1. Parsea los argumentos:
   - ORIGEN = primera palabra de $ARGUMENTS
   - DESTINO = segunda palabra de $ARGUMENTS
2. Si faltan argumentos, DETENTE y pide al usuario el formato correcto:
   `/release {rama_origen} {rama_destino}`
3. Verifica que ambas ramas existen:
```
   git ls-remote --heads origin $ORIGEN
   git ls-remote --heads origin $DESTINO
```
4. Si alguna no existe, DETENTE e informa al usuario.

### FASE 1: Análisis de cambios
1. Obtén la lista de commits que se van a incluir:
```
   git fetch origin $ORIGEN $DESTINO
   git log origin/$DESTINO..origin/$ORIGEN --oneline --no-merges
```
2. Si no hay commits nuevos, DETENTE: "No hay cambios pendientes de $ORIGEN a $DESTINO."
3. Obtén el diff resumido:
```
   git diff origin/$DESTINO..origin/$ORIGEN --stat
```
4. Obtén los PRs completados que componen este release:
```bash
az repos pr list --target-branch $ORIGEN --status completed --output json
```

### FASE 2: Changelog
1. Lee el skill de changelog:
```
   cat [Proyect]/skills/changelog-generator/SKILL.md
```
2. Sigue las instrucciones del skill para generar el changelog.
3. El changelog DEBE incluir como mínimo:
   - Fecha del release en formato ISO: $(date +%Y-%m-%d)
   - Versión (si el proyecto usa versionado semántico, incrementa según los cambios)
   - Sección de cambios agrupados por tipo (features, fixes, breaking changes, etc.)
   - Referencias a PRs y work items relacionados
   - Autores de los cambios
4. Actualiza el archivo de changelog según lo que indique el skill.
5. Haz commit del changelog en la rama ORIGEN:
```
   git checkout $ORIGEN
   git pull origin $ORIGEN
   git add {archivo_changelog}
   git commit -m "docs: update changelog for release $(date +%Y-%m-%d)"
   git push origin $ORIGEN
```

### FASE 3: Crear PR de release
1. Genera el body del PR con este formato:
```
   ## 🚀 Release: $ORIGEN → $DESTINO
   **Fecha:** $(date +%Y-%m-%d)

   ### Commits incluidos
   {lista de commits de la Fase 1}

   ### PRs incluidos
   {lista de PRs completados de la Fase 1}

   ### Changelog
   {contenido del changelog generado en la Fase 2}
```
2. Crea el PR:
```bash
az repos pr create \
  --source-branch $ORIGEN \
  --target-branch $DESTINO \
  --title "🚀 Release $(date +%Y-%m-%d): $ORIGEN → $DESTINO" \
  --description "{body generado arriba}"
```
3. Captura el ID del PR creado.

### FASE 4: Code Review
1. Ejecuta el proceso de /code-review sobre el PR recién creado.
   Sigue TODAS las fases del command /code-review, incluyendo la publicación
   del review como comentario en el PR.
2. El review en un release debe prestar especial atención a:
   - Breaking changes no documentados
   - Migraciones de base de datos pendientes
   - Variables de entorno nuevas que requieran configuración en el entorno destino
   - Dependencias nuevas que requieran instalación

### FASE 5: Resumen al usuario
Informa en el chat de forma concisa:
- Link al PR creado
- Cantidad de commits y PRs incluidos
- Veredicto del code review (✅ / ⚠️ / ❌)
- Si hay bloqueantes del review, listarlos brevemente
- Recordar si hay acciones manuales necesarias (migraciones, env vars, etc.)

NO repitas el changelog ni el review completo en el chat. Todo está en el PR.

---

## Lo que necesitas tener

El skill de changelog debe existir en tu proyecto. Crea la estructura si no la tienes:
```
[Proyect]/skills/changelog-generator/
└── SKILL.md
```
