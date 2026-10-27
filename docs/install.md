# Instalación y operación

## Requisitos

- **Node 24+** y **pnpm 9**.
- Linux probado. macOS y Windows deberían funcionar con los mismos comandos pero **no se han probado**.
- No hace falta base de datos: por defecto usa PostgreSQL embebido (PGlite) y guarda todo en `./data/pg`.

## Instalar y arrancar

```bash
git clone https://github.com/EzequielMenor/ProjectOS.git projectos && cd projectos
pnpm install
pnpm build
pnpm start          # http://localhost:3000, solo accesible desde este ordenador
```

Las migraciones de base de datos se aplican solas al arrancar. La primera vez se crea un workspace vacío con un miembro
inicial («Yo»); crea tu primer proyecto desde la aplicación.

`pnpm dev` arranca el modo desarrollo (más lento, con recarga). **Solo un proceso puede usar `./data/pg` a la vez**: si tienes
el servidor de producción en marcha, párlo antes de lanzar `pnpm dev`, los tests de CLI o `pnpm backup`.

## Dejarlo siempre encendido (Linux, systemd)

Un servicio de **usuario** (no necesita root) que reinicia la app si se cae:

```bash
pnpm build
mkdir -p ~/.config/systemd/user && cp scripts/projectos.service ~/.config/systemd/user/
# Edita WorkingDirectory si el proyecto no está en ~/Proyectos/ProjectOS, y la ruta de node si no es /usr/bin/node
#   (systemd no carga fnm/mise: usa la ruta de `readlink -f $(which node)`)
systemctl --user daemon-reload
systemctl --user enable --now projectos
loginctl enable-linger $USER      # opcional: que arranque al encender el PC sin iniciar sesión
```

Comandos útiles:

```bash
systemctl --user status projectos
journalctl --user -u projectos -f
pnpm build && systemctl --user restart projectos     # tras actualizar el código
```

En macOS o Windows no hay unidad equivalente incluida: lanza `pnpm start` a mano o crea tu propio arranque automático.

## Actualizar

```bash
git pull
pnpm install
pnpm build
systemctl --user restart projectos        # o reinicia `pnpm start`
```

Las migraciones nuevas se aplican al arrancar. Antes de actualizar, haz una copia (ver más abajo) si tus datos importan.

## Copias de seguridad

- **Automática**: el servidor guarda una copia al día en `data/backups/auto-*.json` y conserva las últimas 14
  (solo si hay datos). Se desactiva con `AUTO_BACKUP=off`. Las copias manuales y las previas a restaurar o importar no se borran.
- **Desde la interfaz**: **Copias de seguridad** (`/settings/backup`): descargar, guardar en el servidor y restaurar
  (primero *Simular*; para confirmar hay que escribir `RESTAURAR`).
- **Por línea de comandos** (con PGlite, parando antes la app):

  ```bash
  pnpm backup                                       # data/backups/backup-<fecha>.json
  pnpm projectos restore copia.json --dry-run       # valida sin escribir
  pnpm projectos restore copia.json                 # solo en base vacía
  pnpm projectos restore copia.json --replace       # reemplaza (guarda antes una copia pre-restore)
  ```

- **Mientras la app corre**: `curl localhost:3000/api/backup -o copia.json`.

La restauración es atómica (una transacción) y valida la copia antes de tocar nada. **Los tokens de API no van en la copia**
y se conservan al restaurar. Las copias automáticas viven en la misma carpeta que los datos: para protegerte de un fallo
de disco, copia `data/backups` a otro sitio (disco externo, `rclone`…).

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `DATABASE_URL` | _(vacío)_ | Si se define, usa PostgreSQL; si no, PGlite en disco |
| `PGLITE_DIR` | `./data/pg` | Directorio de datos de PGlite |
| `BACKUP_DIR` | `./data/backups` | Dónde se guardan las copias del servidor |
| `AUTO_BACKUP` | _(activa)_ | `off` desactiva la copia automática diaria |
| `PORT` | `3000` | Puerto del servidor |

Se pueden poner en un `.env` (no se sube al repositorio).

## Escuchar solo en este ordenador (por defecto) y abrirlo a la red

`pnpm start` y `pnpm dev` escuchan en `127.0.0.1`. Si quieres entrar desde el móvil u otro equipo de tu red, arranca con
`pnpm exec next start -H 0.0.0.0` (o cambia `-H` en la unidad de systemd). **Cualquiera en esa red podrá ver y modificar todo
y descargar una copia completa de los datos**: no hay login. Lee [`security.md`](security.md) antes.

## Docker Compose (PostgreSQL)

```bash
docker compose up -d --build     # http://127.0.0.1:3000
```

Variables opcionales (`.env`): `POSTGRES_PASSWORD`, `PORT`. El puerto se publica solo en `127.0.0.1`.

> El `Dockerfile` y `docker-compose.yml` están escritos pero **nunca se han ejecutado** en el entorno de desarrollo (sin acceso
> al daemon de Docker). Se verificó el build de producción y el servidor `standalone` que usa la imagen, no la imagen en sí.
> Trátalo como no probado.
