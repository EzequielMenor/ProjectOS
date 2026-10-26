# ProjectOS

Gestión de proyectos local-first y self-hosted (issues, Kanban, listas) pensada para trabajar con agentes de IA
mediante una API y un servidor MCP. Sin cuentas, suscripciones ni límites artificiales.

## Arranque rápido (sin Docker)

Requisitos: Node 24+, pnpm 9.

```bash
pnpm install
pnpm dev            # http://localhost:3000   (desarrollo)
# o producción local:
pnpm build && pnpm start
```

**Uso diario**: `pnpm build` y déjalo corriendo con systemd (`scripts/projectos.service`, instrucciones dentro: unidad de
usuario, reinicio automático, arranque con la sesión). Solo un proceso puede usar `./data/pg` a la vez: para el servidor de
desarrollo antes de arrancar el de producción. Para conectar agentes, ver [`docs/agents.md`](docs/agents.md).

Sin configuración, los datos viven en `./data/pg` (PostgreSQL embebido con PGlite). Cierra y reabre la app: todo persiste.

## Docker Compose (PostgreSQL)

```bash
docker compose up -d --build     # http://127.0.0.1:3000
```

Variables opcionales (`.env`): `POSTGRES_PASSWORD`, `PORT`. El puerto se publica solo en `127.0.0.1`: **la app no tiene
login** (uso personal/local). Si la expones, ponla detrás de un proxy con autenticación.

> Nota: el `Dockerfile` y `docker-compose.yml` están escritos pero **no se han podido ejecutar** en el entorno de desarrollo
> (sin acceso al daemon de Docker). Se verificó el build de producción y el servidor `standalone` que usa la imagen.

## Configuración

| Variable | Por defecto | Descripción |
|---|---|---|
| `DATABASE_URL` | _(vacío)_ | Si se define, usa PostgreSQL; si no, PGlite en disco |
| `PGLITE_DIR` | `./data/pg` | Directorio de datos de PGlite |
| `BACKUP_DIR` | `./data/backups` | Dónde se guardan las copias "en el servidor" |
| `AUTO_BACKUP` | _(activa)_ | `off` desactiva la copia automática diaria (se guardan las últimas 14 como `auto-*.json`) |

Las migraciones (`drizzle/`) se aplican solas al arrancar.

## Uso con agentes (API y MCP)

1. Abre **Tokens de API** (`/settings/tokens`), crea un token `write` (o `read`) y cópialo: solo se muestra una vez. Debajo, «Configurar en el agente» ofrece el comando de Claude Code, el JSON para otros clientes y un prompt para que el propio agente se configure, ya con el token puesto.
2. Registra el MCP en Claude Code:

   ```bash
   claude mcp add --transport http projectos http://localhost:3000/api/mcp \
     --header "Authorization: Bearer pos_XXXX"
   ```

3. Herramientas disponibles (un token `read` solo ve las de lectura):

   | Lectura | Escritura |
   |---|---|
   | `list_projects`, `get_project`, `list_issues`, `get_issue`, `search`, `next_work`, `list_cycles`, `list_modules`, `list_milestones`, `list_epics`, `list_properties`, `list_members`, `list_pages`, `get_page`, `search_pages`, `list_page_versions` | `create_issue`, `update_issue`, `set_state`, `complete_issue`, `add_comment`, `log_progress`, `add_link` (commit/PR/evidencia), `add_relation`, `archive_issue`, `create_project`, `create_state`, `create_cycle`, `update_cycle`, `create_module`, `update_module`, `create_milestone`, `update_milestone`, `create_property`, `create_member`, `assign_issue`, `create_page`, `update_page`, `append_to_page`, `restore_page_version`, `archive_page` |

**Docs**: las páginas son Markdown (editor con vista previa; sin editor WYSIWYG a propósito: el texto plano es lo que mejor
leen y escriben los agentes). `FICH-12`, `[[FICH-12]]` y `[[Título]]` crean enlaces bidireccionales (el issue muestra «Mencionado
en», la página muestra «Enlazada desde»). Cada edición conserva la versión anterior; `update_page` exige `expectedUpdatedAt`
(leer antes de escribir) y `append_to_page` nunca pisa texto.

**Verificado con Claude Code real**: con un servidor de producción (`next start`) y un token `write`, `claude -p` con este
MCP ejecutó `next_work` → `set_state` → `log_progress` (con evidencia de commit) → `create_page` (con `[[CCT-2]]`); después se
comprobó por REST que el issue quedó En progreso con comentario y enlace, y que la página enlaza al otro issue, todo con
actor `agent:<token>`.

**Épicas** (`/<PROY>/epics`): una épica es un issue de tipo «Épica» y su progreso sale de sus subtareas directas (las
canceladas y archivadas no cuentan). Se crean desde la página, o se convierte cualquier issue desde su ficha (campo Tipo).
Para agentes: `create_issue` con `type: "epic"`, `parent` para añadir trabajo, `list_epics` para ver el progreso y
`get_issue` devuelve `childProgress`. `next_work` nunca propone épicas, solo el trabajo concreto.

**Vistas guardadas y atajos**: «Vistas» en la barra de filtros guarda los filtros actuales (estado, asignado, prioridad,
etiqueta, ciclo, módulo, propiedades de selección y texto) con su layout; cada vista aparece bajo el proyecto en la barra
lateral y en la paleta (se marca como actual solo mientras sus filtros están aplicados). Paleta: `Ctrl K` o `/`. Saltos con
`g` y una letra: `l` Lista, `b` Kanban, `t` Tabla, `e` Épicas, `c` Ciclos, `m` Módulos, `h` Hitos, `r` Roadmap, `d` Docs,
`s` Ajustes. En la paleta también hay Aumentar/Reducir/Restablecer tamaño de la interfaz, tema, miembros y tokens.

**Miembros y asignados** (`/settings/members`, enlace «Miembros» en la barra lateral): personas y agentes del workspace
(existe uno inicial, «Yo»). Se asigna desde la ficha, la tabla (editable en la celda) y se ve como avatar en lista y
Kanban; el filtro «Asignado» admite «Sin asignar» y varios miembros a la vez (`assignee=<id>,none` en la URL). Los
nombres son únicos. Borrar un miembro solo se hace desde la interfaz, con confirmación, y deja sus issues sin asignar.
Para agentes: `list_members`, `create_member` (un agente puede darse de alta para asignarse trabajo), `assignee` por
nombre en `create_issue`/`update_issue` (`null` desasigna), `assignee` en `list_issues` y `next_work`. Los cambios quedan
en la actividad con el nombre. El importador de Plane descartó los asignados originales.

**Propiedades personalizadas** (Ajustes → «Propiedades personalizadas»): campos propios por proyecto de tipo texto,
número, fecha o selección. Aparecen en la ficha y como columnas de la tabla (ordenables); las de selección también como
filtro (`p.<id>=a,b` en la URL). El nombre es único por proyecto y el tipo no se puede
cambiar; una opción en uso no se puede quitar. Borrar una propiedad solo se hace desde la interfaz, con confirmación, y
elimina sus valores (solo recuperables desde una copia de seguridad). Para agentes: `list_properties`, `create_property`,
`properties: {"Severidad": "Alta"}` en `create_issue`/`update_issue` (por nombre; `null` borra) y
`property` + `propertyValue` en `list_issues`. Los cambios quedan en la actividad del issue. El importador de Plane
todavía no trae propiedades personalizadas.

**Tamaño de la interfaz**: control `A−  %  A+` al pie de la barra lateral (14–24 px, por defecto 18). Se guarda en una
cookie del navegador y el servidor lo aplica en el primer pintado; `Restablecer` vuelve al valor por defecto.

**Móvil**: por debajo de 768 px la barra lateral pasa a una barra superior con botón de menú (cajón con la misma navegación,
tamaño de interfaz incluido) y botón de búsqueda; las vistas y la ficha se ajustan al ancho sin desplazamiento horizontal.

**Accesibilidad y estados**: las pantallas de listado muestran un esqueleto mientras cargan; un error de render enseña «Algo ha fallado»
con «Reintentar» (sin perder la barra lateral) y un proyecto, issue o página inexistente devuelve un 404 real. Los tests
(`tests/e2e/a11y.spec.ts`) pasan axe-core (WCAG 2.1 A/AA) en tema claro y oscuro sobre todas las pantallas, la paleta y los
desplegables, y comprueban el enlace «Saltar al contenido» y el anillo de foco con teclado.

**Ajustes del proyecto** (`/<PROY>/settings`): nombre, color y descripción (Markdown), y los estados del flujo: crear,
renombrar, recolorear, reordenar, cambiar el estado por defecto y borrar. Un proyecto siempre conserva un estado «completed»
y uno por defecto; borrar un estado obliga a elegir a cuál se mueven sus issues. Es solo para humanos (los agentes no tienen
herramientas de gestión de estados) y los agentes siguen usando `set_state` con los nombres que existan.

**Seguridad**: no existe ninguna herramienta de borrado (borrar y restaurar son acciones humanas). Archivar es reversible.
Cada cambio queda en el historial con el actor `agent:<nombre del token>`, y `update_issue` conserva los valores anteriores
(p. ej. la descripción previa) en la actividad.

La misma lista está disponible por REST: `GET /api/v1/tools` (catálogo con JSON Schema) y
`POST /api/v1/tools/<nombre>` con el cuerpo JSON de los argumentos. Ambos exigen `Authorization: Bearer <token>`.

## Copias de seguridad y restauración

- **UI**: `/settings/backup` — descargar, guardar en el servidor, y restaurar (primero *Simular*, luego confirmar escribiendo `RESTAURAR`).
- **CLI** (con PGlite hay que parar la app antes: un solo proceso puede abrir el directorio de datos):

  ```bash
  pnpm backup                              # escribe data/backups/backup-<fecha>.json
  pnpm backup mi-copia.json
  pnpm projectos restore mi-copia.json --dry-run   # valida sin escribir
  pnpm projectos restore mi-copia.json             # solo en base vacía
  pnpm projectos restore mi-copia.json --replace   # reemplaza (guarda antes una copia pre-restore)
  ```

La restauración es atómica (una transacción) y valida la copia antes de tocar nada. Los tokens de API no van en la copia y
se conservan al restaurar. Con PostgreSQL también puedes usar `pg_dump`.

## Migración desde Plane / Linear

Plane está implementado (solo lectura sobre Plane; con simulación, validación y copia previa). Linear está pendiente.
Detalle y límites en [`docs/migration.md`](docs/migration.md).

```bash
export PLANE_API_KEY=...        # Plane → Perfil → Tokens de acceso personal
pnpm projectos import plane --workspace=<slug> --only=FICH,AIES --expect=FICH:31,AIES:38 --dry-run
pnpm projectos import plane --workspace=<slug> --only=FICH,AIES --expect=FICH:31,AIES:38
```

## Desarrollo

```bash
pnpm test          # Vitest (servicios, backup, herramientas del agente)
pnpm test:e2e      # Playwright (flujos reales en navegador, BD temporal aparte)
pnpm typecheck
pnpm db:generate   # tras cambiar src/db/schema.ts
```

Estructura: `src/db` (esquema Drizzle + driver dual), `src/server/services` (lógica y validación, única fuente de verdad),
`src/server/agent` (catálogo de herramientas → MCP y REST), `src/app` (UI y rutas), `docs/research.md` (patrones estudiados de Linear y Plane).
