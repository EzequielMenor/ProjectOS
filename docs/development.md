# Desarrollo

```bash
pnpm install
pnpm dev                 # http://127.0.0.1:3000 (para antes el servidor de producción)
pnpm typecheck && pnpm lint
pnpm test                # Vitest
pnpm test:e2e            # Playwright
```

## Tests

- **Unitarios** (`tests/unit`, Vitest): usan una base PGlite **en memoria**, con `BACKUP_DIR` temporal y `AUTO_BACKUP=off`, así
  que no tocan tus datos. Cubren servicios, copias, importador y el catálogo de herramientas del agente.
- **E2E** (`tests/e2e`, Playwright): arrancan su propio servidor de desarrollo en el puerto 3101, con una carpeta de build
  aparte (`.next-e2e`) y una base temporal que se borra en cada ejecución. Un solo worker, porque comparten base de datos.
  Incluyen accesibilidad (axe) en tema claro y oscuro, móvil emulado y un cliente MCP real.

Consejos para no pelearse con los tests:

- Un spec que crea proyectos no se puede repetir con `--repeat-each` (la base se comparte durante toda la ejecución).
- Tras cerrar un popover, espera a que desaparezca (`[data-slot=popover-content]` con cuenta 0) antes de buscar opciones.
- `waitForURL(/issues\/\d+/)` coincide también con la URL de partida: usa una URL concreta.

## Migraciones

1. Cambia `src/db/schema.ts`.
2. `pnpm db:generate` crea el SQL en `drizzle/`.
3. Se aplica al arrancar el proceso: **reinicia el servidor** para que lo recoja.
4. Si añades una tabla, añádela a `src/server/services/backup.ts` (como opcional) para que entre en las copias.

## Añadir una herramienta para agentes

Una sola entrada en `TOOLS` (`src/server/agent/tools.ts`) con `scope` `read` o `write`. Aparece sola en MCP y REST.
Reglas: nada que borre; resolver nombres (estados, miembros, propiedades) en el servidor y, si no existen, listar los válidos
en el error; devolver lo mínimo (`compact`). Añade pruebas en `tests/unit` y, si cambia el contrato, en `tests/e2e/mcp.spec.ts`.

## Estilo

Los mensajes de la interfaz y de los errores están en español. El código y los nombres, en inglés. Los commits explican el
porqué en una línea clara.
