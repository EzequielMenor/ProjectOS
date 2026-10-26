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

Las migraciones (`drizzle/`) se aplican solas al arrancar.

## Uso con agentes (API y MCP)

1. Abre **Tokens de API** (`/settings/tokens`), crea un token `write` (o `read`) y cópialo: solo se muestra una vez.
2. Registra el MCP en Claude Code:

   ```bash
   claude mcp add --transport http projectos http://localhost:3000/api/mcp \
     --header "Authorization: Bearer pos_XXXX"
   ```

3. Herramientas disponibles (un token `read` solo ve las de lectura):

   | Lectura | Escritura |
   |---|---|
   | `list_projects`, `get_project`, `list_issues`, `get_issue`, `search`, `next_work`, `list_cycles`, `list_modules`, `list_milestones`, `list_pages`, `get_page`, `search_pages`, `list_page_versions` | `create_issue`, `update_issue`, `set_state`, `complete_issue`, `add_comment`, `log_progress`, `add_link` (commit/PR/evidencia), `add_relation`, `archive_issue`, `create_cycle`, `create_module`, `create_milestone`, `assign_issue`, `create_page`, `update_page`, `append_to_page`, `restore_page_version`, `archive_page` |

**Docs**: las páginas son Markdown (editor con vista previa; sin editor WYSIWYG a propósito: el texto plano es lo que mejor
leen y escriben los agentes). `FICH-12`, `[[FICH-12]]` y `[[Título]]` crean enlaces bidireccionales (el issue muestra «Mencionado
en», la página muestra «Enlazada desde»). Cada edición conserva la versión anterior; `update_page` exige `expectedUpdatedAt`
(leer antes de escribir) y `append_to_page` nunca pisa texto.

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
