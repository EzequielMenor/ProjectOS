# Arquitectura

Para quien quiera entender o modificar el código. La idea central: **una única capa de servicios** con la lógica y la
validación, y todo lo demás (interfaz, API, MCP, CLI) son formas de llamarla.

```
 Navegador ──► src/app (rutas, componentes, server actions) ─┐
 Agente ─────► /api/mcp  (MCP, Streamable HTTP, sin estado) ─┤
 Script ─────► /api/v1/tools (REST) ────────────────────────┤──► src/server/services ──► src/db (Drizzle)
 Terminal ───► src/cli/projectos.ts ────────────────────────┘                                  │
                                                                                     PGlite  o  PostgreSQL
```

## Stack

Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Tailwind + shadcn/base-ui · Drizzle ORM · Zod ·
SDK oficial de MCP · Vitest · Playwright.

> Esta versión de Next tiene cambios incompatibles con lo habitual: la documentación a consultar está en
> `node_modules/next/dist/docs/` (ver `AGENTS.md`).

## Carpetas

| Ruta | Qué hay |
|---|---|
| `src/db/schema.ts`, `client.ts` | Esquema Drizzle y driver doble: PGlite (un proceso por carpeta de datos) o `DATABASE_URL` (PostgreSQL). Las migraciones de `drizzle/` se aplican al arrancar |
| `src/server/services/*` | La lógica: issues, proyectos, estados, planificación, propiedades, miembros, páginas, vistas, tokens, copias. Valida con Zod y lanza `ServiceError` (`not_found`, `invalid`, `conflict`, `forbidden`) |
| `src/server/agent/tools.ts` | **Catálogo único de herramientas** (nombre, permiso, esquema, función). Genera tanto el MCP como el REST, así que permisos y validación no pueden divergir |
| `src/server/agent/mcp.ts` | Servidor MCP por petición (sin estado) y las instrucciones que reciben los agentes al conectarse |
| `src/server/import` | Importador de Plane (solo lectura) |
| `src/app` | Rutas: `(app)/[project]/…` (vistas, épicas, ciclos, módulos, hitos, docs, ajustes), `(app)/settings/…`, `api/…` |
| `src/app/actions.ts` | Server actions de la interfaz (llaman a los servicios) |
| `src/components` | Interfaz: espacio de trabajo de issues, ficha, paleta, barra lateral, ajustes |
| `src/instrumentation.ts` | Tarea al arrancar el servidor: copia automática diaria |
| `src/cli/projectos.ts` | CLI: `backup`, `restore`, `import plane` |

## Decisiones que conviene conocer

- **Seguridad de los agentes por diseño**: el catálogo no contiene herramientas de borrado y un test lo garantiza. Las
  acciones destructivas o estructurales solo existen como server actions de la interfaz.
- **Actor en cada cambio**: los servicios reciben un `actor` (`user` o `agent:<token>`) y lo guardan en la actividad.
- **Copias**: formato JSON `projectos-backup` v1, tablas en orden de dependencias; restaurar hace `TRUNCATE … CASCADE` en una
  transacción. Las tablas añadidas después son opcionales para poder restaurar copias antiguas.
- **Filtros**: viven en la URL (`src/lib/issue-filters.ts`) y las vistas guardadas guardan esa misma cadena.
- **Respuestas del agente baratas en tokens**: JSON compacto y los listados omiten los campos vacíos.
- **Sin login**: decisión de producto para uso personal. Ver [`security.md`](security.md).
