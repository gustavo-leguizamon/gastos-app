# ProSuite - Guía de Orquestación para Agentes AI

## Descripción General

ProSuite es una aplicación empresarial SPA construida con **Next.js 13+**, **React 18**, **TypeScript** y **Material-UI v5**. Usa **Zustand** para state management, **MUI X Data Grid Pro** para tablas, y sigue una arquitectura orientada a dominios con separación clara entre funcionalidad core, componentes compartidos, y módulos específicos por funcionalidad.

**Stack principal:**
- Next.js 13.3.2 + React 18.2.0 + TypeScript
- Material-UI v5 (MUI) + Emotion styling
- Zustand (state management con persistencia IndexedDB)
- MUI X Data Grid Pro
- React Hook Form + Yup validation
- Axios con interceptors por dominio

## Proceso obligatorio
- NUNCA hagas cambios directos en `main` o `UAT` o `desarrollo`
- SIEMPRE trabaja en worktrees para aislar cambios
- SIEMPRE sigue conventional commits: feat|fix|chore|docs(scope): descripción
- SIEMPRE ejecuta tests/lints antes de crear un PR
- NUNCA empieces a codificar sin un plan aprobado por el usuario

## Cómo Usar Esta Guía

Este archivo actúa como **punto de entrada y orquestador** para agentes AI trabajando en el proyecto. NO duplica contenido de los skills - en su lugar, **referencia los skills apropiados** para tareas específicas.

**Flujo de trabajo:**
1. Leer este archivo primero para entender arquitectura general y ubicación de skills
2. Consultar el skill correspondiente para patrones detallados e implementación
3. Seguir el self-improvement loop (actualizar lessons.md después de correcciones)
4. Proponer actualizaciones a skills cuando se aprenden nuevos patrones

## Modo Planning por Defecto

**Cuándo entrar en modo planning (antes de implementar):**
- Solicitudes con 3+ pasos que requieren coordinación entre capas
- Decisiones arquitectónicas (nuevo módulo, nuevo patrón, cambio de estructura)
- Cambios que afectan múltiples archivos o skills
- Solicitudes ambiguas que requieren clarificación de alcance

**Cuándo implementar directamente (sin planning):**
- Agregar componente usando patrones existentes
- Fixes de bugs en código existente con contexto claro
- Actualizaciones de configuración
- Tareas de un solo paso con skill correspondiente claro

## Ciclo de Auto-Mejora

**Después de CADA corrección del usuario**, actualizar [tasks/lessons.md](tasks/lessons.md):

```markdown
### [FECHA] - [Título del Error]
**Mistake**: [Descripción específica del error cometido]
**Correction**: [Qué debería haberse hecho]
**Rule**: [Regla general extraída para prevenir futuras ocurrencias]
```

**Consultar lessons.md ANTES de:**
- Crear nuevos componentes, stores, services
- Definir estructura de módulos
- Tomar decisiones arquitectónicas

## Estructura de Directorios

```
ProSuite/
 src/
    @core/              # Foundation layer: base components, theme, layouts
    @proSuite/          # ProSuite-specific reusable components
       shared/         # Shared components (grids, drawers, forms, etc.)
       resources/      # Static resources
    pages/              # Next.js pages by feature domain
    components/         # App-specific components
    store/              # Zustand stores
    services/           # API service layer
    middlewares/        # Axios interceptors by domain
    hooks/              # Custom React hooks
    context/            # React Context providers
    types/              # TypeScript type definitions
    utilities/          # Helper functions, constants, claims
 tasks/
    lessons.md         # Self-improvement tracking
 skills/                # Agent Skills
 .claude/
    commands/          # Command definitions for CLI
```

## Architecture Details

### Component Organization

**@core/** — Foundation components and theme
- Base components inherited by rest of app
- Theme configuration and styling
- Global layouts and wrappers

**@proSuite/shared/** — Reusable ProSuite components
- ProSuiteGridGenerica (MUI X Data Grid Pro wrapper)
- DrawerContainerPropato (drawer with toolbar)
- BarraSuperior (top navigation bar)
- TextFieldPropato, NumericFieldPropato (custom inputs)
- Otros componentes compartidos

**pages/** — Next.js pages organized by domain
- pages/cotizador/ (Quotation module)
- pages/crm/ (CRM module)
- pages/backorders/ (Back orders module)
- Each domain has its own folder

### State Management (Zustand)

- **Location:** src/store/ (organized by domain or feature)
- **Pattern:** Selective subscriptions to prevent re-renders
- **Persistence:** IndexedDB for browser state persistence
- **Examples:** cotizadorStore, crmStore, drawerStore

### API Services

- **Location:** src/services/ (organized by domain)
- **Pattern:** Axios with domain-specific interceptors
- **Interceptors:** src/middlewares/ (axiosCotizador, axiosCRM, etc.)
- **Auth:** Basic auth, token management per service

### Form Validation

- **Library:** React Hook Form + Yup
- **Location:** Forms typically in feature pages/modules
- **Pattern:** Custom input components (TextFieldPropato, etc.)
- **Validation:** Yup schemas defined inline or in utilities

### Data Grids

- **Library:** MUI X Data Grid Pro
- **Wrapper:** ProSuiteGridGenerica
- **Location:** Typically in tables/list views within modules
- **Customization:** Columns, toolbars, sorting, filtering

## Skills Disponibles

### State Management

| Skill | Cuándo Usar | Archivo |
|-------|-------------|------|
| `prosuite-stores` | Crear Zustand stores para features, drawers, o grids con persistencia | [SKILL.md](../skills/prosuite-stores/SKILL.md) |

### Componentes UI

| Skill | Cuándo Usar | Archivo |
|-------|-------------|------|
| `prosuite-components` | Usar componentes reusables (DrawerContainerPropato, BarraSuperior, etc.) | [SKILL.md](../skills/prosuite-components/SKILL.md) |
| `prosuite-grids` | Implementar data grids con ProSuiteGridGenerica (MUI X Data Grid Pro) | [SKILL.md](../skills/prosuite-grids/SKILL.md) |
| `prosuite-forms` | Crear formularios con React Hook Form + Yup validation | [SKILL.md](../skills/prosuite-forms/SKILL.md) |

### Servicios y Módulos

| Skill | Cuándo Usar | Archivo |
|-------|-------------|------|
| `prosuite-services` | Configurar servicios API con axios interceptors por dominio | [SKILL.md](../skills/prosuite-services/SKILL.md) |
| `prosuite-modules` | Crear nuevos módulos de funcionalidad (cotizador, CRM, backorders, etc.) | [SKILL.md](../skills/prosuite-modules/SKILL.md) |

### Documentación

| Skill | Cuándo Usar | Archivo |
|-------|-------------|------|
| `prosuite-doc-tecnico` | Consultar documentación técnica de arquitectura y patrones | [SKILL.md](../skills/prosuite-doc-tecnico/SKILL.md) |
| `prosuite-doc-funcional` | Consultar documentación funcional de módulos de negocio | [SKILL.md](../skills/prosuite-doc-funcional/SKILL.md) |

### Herramientas

| Skill | Cuándo Usar | Archivo |
|-------|-------------|------|
| `commit-message-generator` | Crear commits convencionales en español | [SKILL.md](../skills/commit-message-generator/SKILL.md) |
| `frontend-development` | Arquitectura general y patrones frontend | [SKILL.md](../skills/frontend-development/SKILL.md) |

## Auto-invocar Skills

**SIEMPRE consultar el skill correspondiente ANTES de realizar estas acciones:**

| Acción/Pregunta | Skill a Consultar |
|-----------------|------------------|
| Crear stores para features, drawers o grids | `prosuite-stores` |
| Usar componentes compartidos (Drawer, BarraSuperior, etc.) | `prosuite-components` |
| Implementar data grids, definir columnas, toolbars | `prosuite-grids` |
| Crear formularios con validación | `prosuite-forms` |
| Configurar servicios API, axios interceptors | `prosuite-services` |
| Crear nuevo módulo de funcionalidad | `prosuite-modules` |
| Consultar patrones de arquitectura | `prosuite-doc-tecnico` |
| Entender lógica de negocio de módulos | `prosuite-doc-funcional` |
| Crear mensajes de commit desde cambios git | `commit-message-generator` |

## Reglas Críticas

### HACER:

1. **Siempre consultar skills PRIMERO** - Nunca implementar de memoria, siempre verificar con el skill
2. **Siempre usar selective subscriptions en Zustand** - `const items = useStore(state => state.items)`
3. **Siempre lazy load drawers** - Usar patrón `XxxLazy.tsx` para code splitting
4. **Siempre usar componentes ProSuite** - Preferir componentes de `@proSuite/shared` sobre crear nuevos
5. **Siempre verificar claims** - Antes de renderizar UI protegida o llamar endpoints
6. **Siempre actualizar lessons.md** - Después de cada corrección del usuario
7. **Siempre usar TypeScript estricto** - Evitar `any`, tipar todo
8. **Siempre usar interceptors por dominio** - axiosCotizador, axiosCRM, etc.
9. **Siempre incluir breadcrumbs en drawers** - Para navegación contextual
10. **Siempre seguir convenciones de naming** - Propato suffix, Grilla prefix, drawer stores pattern

### NO HACER:

1. **No destructurar stores completos** - Causa re-renders innecesarios
2. **No crear componentes en `@core`** - Usar `@proSuite/shared`
3. **No saltear lazy loading en drawers** - Afecta performance
4. **No hardcodear URLs de APIs** - Usar configuración en interceptors
5. **No omitir validación de claims** - Security critical
6. **No crear drawers sin BarraSuperior** - Inconsistencia UX
7. **No mezclar lógica de dominios** - Separar cotizador, CRM, backorders, etc.
8. **No olvidar loading states** - Siempre mostrar/ocultar loading
9. **No omitir error handling** - Try/catch + toast notifications
10. **No repetir errores** - Verificar lessons.md antes de implementar patterns similares

## Componentes y Utilities Clave

### Componentes Principales
- **ProSuiteGridGenerica**: Grid con MUI X Data Grid Pro ([prosuite-grids](../skills/prosuite-grids/SKILL.md))
- **DrawerContainerPropato**: Drawer container con BarraSuperior ([prosuite-components](../skills/prosuite-components/SKILL.md))
- **TextFieldPropato, NumericFieldPropato**: Inputs custom ([prosuite-forms](../skills/prosuite-forms/SKILL.md))

### Utilities Comunes
- **Claims**: `src/utilities/claims.ts` - Sistema de permisos
- **Date Utils**: `src/utilities/dateUtils.ts` - Formato y normalización de fechas
- **Toast**: `react-hot-toast + EstiloToastSuccess/Error` - Notificaciones
- **Alerts**: `ConfirmAlertSwal, AcceptAlertSwal` - SweetAlert confirmaciones

### Hooks Esenciales
- **useAuth**: Autenticación y verificación de claims
- **useLoadingStore**: Loading state global
- **useDrawerZIndex**: Z-index management para drawers anidados

## Branches y Entornos

- **main** — Production environment (protected)
- **UAT** — Pre-production / UAT environment (protected)
- **desarrollo** — Development integration branch (protected)

**Flujo de deployment:**
1. Feature branches from `desarrollo`
2. PR to `desarrollo` (code review + tests)
3. Release PR from `desarrollo` to `UAT`
4. Testing in UAT environment
5. Release PR from `UAT` to `main`
6. Production deployment

## Releases
- Los releases SIEMPRE se hacen via el command /release
- El flujo de entornos es: desarrollo → UAT → main
- NUNCA se hace merge directo entre ramas de entorno sin PR
- Todo release incluye changelog actualizado y code review
- El changelog se commitea en la rama origen ANTES de crear el PR

## Recursos

- **Skills Documentation**: [skills/README.md](../skills/README.md)
- **Self-Improvement Tracking**: [tasks/lessons.md](../tasks/lessons.md)
- **Main README**: [README.md](../README.md)

---

**Versión**: 2.1
**Última Actualización**: 16 de marzo de 2026
**Stack**: Next.js 13+ + React 18 + TypeScript + MUI v5 + Zustand
