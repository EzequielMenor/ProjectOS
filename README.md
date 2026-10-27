# ProjectOS

Gestor de proyectos **local-first y self-hosted** (issues, Kanban, listas, tabla, épicas, ciclos, módulos, hitos y documentos)
pensado para que **lo manejen agentes de IA** mediante un servidor MCP y una API, y para que tú entres a ver cómo va.
Sin cuentas, sin suscripciones, sin nube: tus datos viven en tu máquina.

> **Versión 0.1.0** · ver [`CHANGELOG.md`](CHANGELOG.md). Uso personal: una sola persona, **sin inicio de sesión**
> (lee [`docs/security.md`](docs/security.md) antes de abrirlo a una red).

## Qué incluye

- **Trabajo**: issues con estados propios por proyecto, prioridad, etiquetas, subtareas, relaciones (bloquea / duplica / relaciona),
  asignados (personas y agentes), propiedades personalizadas, fechas y estimaciones. Vistas Lista, Kanban y Tabla con filtros,
  vistas guardadas y paleta de comandos (`Ctrl K`).
- **Planificación**: épicas con progreso, ciclos, módulos, hitos y roadmap.
- **Documentos**: páginas en Markdown con enlaces bidireccionales (`[[FICH-12]]`) e historial de versiones.
- **Para agentes**: 41 herramientas (16 de lectura, 25 de escritura) por MCP y REST, con permisos `read` / `write`, sin herramientas de borrado y con cada
  cambio registrado como `agent:<nombre>`. La pantalla de tokens genera el comando, el JSON y un prompt para configurar al agente.
- **Datos a salvo**: copia automática diaria con rotación, copias manuales, restauración con simulación previa.
- **Interfaz**: tema claro/oscuro, tamaño de interfaz ajustable, responsive (móvil), accesibilidad comprobada con axe.

## Empezar (5 minutos)

Requisitos: **Node 24+** y **pnpm 9**. No necesitas Docker ni base de datos: usa PostgreSQL embebido (PGlite) en `./data/pg`.

```bash
git clone https://github.com/EzequielMenor/ProjectOS.git projectos && cd projectos
pnpm install
pnpm build && pnpm start        # http://localhost:3000
```

Se abre vacío: crea tu primer proyecto desde la propia aplicación. Por defecto **solo escucha en `127.0.0.1`**
(accesible desde tu propio ordenador y desde ningún otro).

Para dejarlo siempre encendido, ver [`docs/install.md`](docs/install.md) (servicio systemd en Linux, actualizaciones, Docker).

## Conectar un agente

1. En la aplicación: **Tokens de API** → crea un token (`write` para que pueda trabajar, `read` para que solo consulte).
2. Debajo aparece **«Configurar en el agente»** con tres opciones ya rellenas con tu token: el comando de Claude Code, el JSON
   para otros clientes MCP y un prompt para que el propio agente se configure.

```bash
claude mcp add --transport http --scope user projectos http://localhost:3000/api/mcp \
  --header "Authorization: Bearer pos_XXXX"
```

Guía completa (qué poner en el `CLAUDE.md` de cada repo, garantías, copias): [`docs/agents.md`](docs/agents.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/install.md`](docs/install.md) | Instalación, arranque permanente, actualizar, copias de seguridad, Docker, variables de entorno |
| [`docs/usage.md`](docs/usage.md) | Guía de funciones: vistas, épicas, atajos, miembros, propiedades, documentos… |
| [`docs/agents.md`](docs/agents.md) | Trabajar con agentes: conectar, herramientas, garantías |
| [`docs/security.md`](docs/security.md) | Qué protege y qué no: sin login, red local, tokens, datos |
| [`docs/architecture.md`](docs/architecture.md) | Cómo está construido, para quien quiera tocar el código |
| [`docs/development.md`](docs/development.md) | Tests, migraciones, convenciones |
| [`docs/migration.md`](docs/migration.md) | Importar desde Plane |
| [`docs/roadmap.md`](docs/roadmap.md) | Qué está hecho y qué queda |
| [`docs/research.md`](docs/research.md) | Patrones de Linear y Plane que inspiraron el diseño |

## Estado y límites (sin maquillar)

- Verificado: servicios, herramientas del agente, copias y restauración (tests unitarios); flujos de interfaz, móvil y
  accesibilidad (Playwright); un cliente MCP real conectándose con la configuración que muestra la pantalla; un Claude Code real
  completando un ciclo `next_work → set_state → log_progress → create_page`; el servidor de producción y el servicio systemd en Linux.
- **Sin verificar**: Docker Compose (escrito, no ejecutado), Windows y macOS, un dispositivo móvil real (solo emulación) y
  sesiones largas de agentes reales.
- **Una sola persona**: no hay cuentas ni permisos por usuario. Los «miembros» son etiquetas para repartir trabajo.
- Sin licencia publicada todavía: todos los derechos reservados hasta que se decida una.

## Comandos habituales

```bash
pnpm dev            # desarrollo (para antes el servidor de producción: PGlite admite un solo proceso)
pnpm test           # tests unitarios (Vitest)
pnpm test:e2e       # tests de interfaz (Playwright, base de datos temporal aparte)
pnpm typecheck && pnpm lint
pnpm backup         # copia de seguridad por línea de comandos
```
