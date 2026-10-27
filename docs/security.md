# Seguridad: qué protege y qué no

ProjectOS está pensado para **una persona en su propio ordenador**. Esto es lo que hay y lo que no.

## No hay inicio de sesión

Cualquiera que pueda abrir la dirección de la aplicación ve y modifica todo, y puede descargar una copia completa de los datos
(`/api/backup`). Los tokens de API protegen solo la API de agentes (`/api/mcp`, `/api/v1/*`), no la interfaz web.

Por eso:

- **Por defecto escucha solo en `127.0.0.1`** (`pnpm start`, `pnpm dev` y el servicio systemd). Solo se llega desde el mismo ordenador.
- Si lo abres a tu red (`-H 0.0.0.0`), cualquiera de esa red tiene acceso total. Hazlo solo en una red de confianza.
- **No lo expongas a internet** (ni con redirección de puertos ni con un túnel público) sin poner delante un proxy con
  autenticación. Hoy no existe un modo multiusuario ni contraseña propia.
- Con Docker Compose el puerto se publica solo en `127.0.0.1`.

## Tokens de API (agentes)

- Se crean en **Tokens de API**; se muestran **una sola vez** y en la base de datos solo se guarda su hash.
- Dos permisos: `read` (solo ve las herramientas de consulta) y `write`.
- Un token por agente o por máquina, con un nombre descriptivo: ese nombre queda en la actividad como `agent:<nombre>`.
- Se pueden revocar en cualquier momento desde la misma pantalla.
- No guardes el token en el repositorio de un proyecto: el prompt de configuración le dice al agente que no lo haga.
- Los tokens **no entran en las copias de seguridad**.

## Qué puede y qué no puede hacer un agente

- **Puede**: crear y editar issues, comentar, registrar avances, planificar (ciclos, módulos, hitos), escribir documentos, crear
  proyectos, estados, etiquetas, propiedades y miembros, y archivar (reversible).
- **No puede** (solo desde la interfaz, por una persona): borrar nada, renombrar o archivar proyectos, renombrar/reordenar/borrar
  estados, editar o borrar propiedades, gestionar tokens, restaurar copias. Un test comprueba que no existe ninguna herramienta
  cuyo nombre sugiera borrado.
- Cada cambio queda en la actividad, y `update_issue` conserva los valores anteriores.

## Tus datos

- Viven en `./data/` (base de datos y copias), que **no se sube a git**.
- Las copias de seguridad contienen todo el contenido de tus proyectos en texto plano: guárdalas con el mismo cuidado que los datos.
- El importador de Plane lee con una clave personal que **no se guarda** ni en el snapshot ni en la base de datos. Revoca esa
  clave en Plane cuando termines de importar.

## Avisar de un problema

Si encuentras una vulnerabilidad, no la publiques en un issue abierto: avisa por privado a quien mantenga el repositorio.
