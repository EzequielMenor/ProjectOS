# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico mientras sea 0.x: puede haber
cambios entre versiones menores.

## [0.1.0] — 2026-10-27

Primera versión publicada. Todo lo que hay se desarrolló y probó entre el 26 y el 27 de octubre de 2026.

### Trabajo diario
- Proyectos con identificador propio (`FICH-12`), estados por proyecto (crear, renombrar, recolorear, reordenar, borrar con migración de issues) y descripción en Markdown.
- Issues con prioridad, etiquetas, subtareas, relaciones (bloquea, duplica, relaciona), enlaces (commits, PR, evidencias), comentarios e historial de cambios con valores anteriores.
- Vistas Lista, Kanban (arrastrar y soltar) y Tabla (ordenable, celdas editables), filtros sincronizados con la URL y vistas guardadas visibles en la barra lateral.
- Paleta de comandos (`Ctrl K`, `/`) con saltos `g` + letra, búsqueda de issues y páginas.
- Épicas con progreso, ciclos, módulos, hitos y roadmap.
- Miembros y asignados (personas y agentes) con filtro «Sin asignar».
- Propiedades personalizadas por proyecto (texto, número, fecha, selección).
- Documentos en Markdown con enlaces bidireccionales e historial de versiones.
- Tema claro/oscuro, tamaño de interfaz ajustable, diseño móvil, esqueletos de carga, pantallas de error y 404, accesibilidad auditada con axe.

### Agentes
- Servidor MCP (`/api/mcp`) y API REST (`/api/v1/tools`) generados desde un único catálogo de 41 herramientas (16 de lectura, 25 de escritura).
- Tokens `read` / `write` guardados como hash; cada cambio se registra como `agent:<token>`.
- Sin herramientas de borrado. Los agentes pueden crear proyectos, estados, ciclos, módulos, hitos, etiquetas, propiedades y miembros, y editar ciclos, módulos e hitos.
- Instrucciones de trabajo que el agente recibe al conectarse; respuestas compactas para gastar pocos tokens.
- Pantalla «Configurar en el agente» al crear un token: comando de Claude Code, JSON MCP y un prompt de autoconfiguración.

### Datos
- Copias de seguridad en JSON: descarga, guardado en el servidor, restauración atómica con simulación previa y CLI.
- Copia automática diaria con rotación de 14 (`AUTO_BACKUP=off` la desactiva).
- Importador de Plane de solo lectura, con simulación, validación y copia previa.
- Base de datos PGlite embebida por defecto, o PostgreSQL con `DATABASE_URL`.

### Operación
- Servicio de usuario systemd (`scripts/projectos.service`) con reinicio automático.
- `pnpm dev`, `pnpm start` y el servicio escuchan **solo en `127.0.0.1`** por defecto.
- `Dockerfile` y `docker-compose.yml` incluidos (**sin ejecutar**).

### Conocido
- Sin inicio de sesión: pensado para una persona en su propio equipo (ver `docs/security.md`).
- Sin verificar: Docker, Windows/macOS, móvil real, sesiones largas con agentes reales.
- El importador de Plane no trae propiedades personalizadas ni asignados originales.
- No hay botones en la interfaz para editar ciclos, módulos o hitos ya creados (solo los agentes pueden).
