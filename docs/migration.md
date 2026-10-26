# Migración desde Plane

Principios: **Plane solo se lee** (el cliente solo emite `GET`), todo pasa primero por una simulación, y nada se escribe
sin una copia de seguridad previa. La clave de API no se guarda ni en el snapshot ni en la base de datos.

## Flujo

```bash
PLANE_API_KEY=... pnpm projectos import plane --workspace=<slug> --only=FICH,AIES,COREOS --expect=FICH:31,AIES:38 --dry-run
```

1. **Descarga** (`src/server/import/plane-fetch.ts`): proyectos, estados, etiquetas, work items (paginación por cursor, 100 por
   página), ciclos y módulos con sus work items, y por work item comentarios, enlaces y relaciones. Espacia las peticiones
   (~55/min, el límite de Plane es 60) y respeta `Retry-After` en 429. Los endpoints opcionales que respondan 403/404 se
   registran y se saltan.
2. **Snapshot crudo**: se guarda tal cual en `data/imports/plane-<slug>-<fecha>.json` (permisos 0600). Se puede repetir la
   importación sin volver a llamar a Plane con `--from=<snapshot.json>`.
3. **Plan y validación** (`planPlaneProject`): convierte y comprueba sin escribir. Errores que bloquean: identificador
   inválido, `sequence_id` duplicado, estado desconocido, grupo de estado desconocido, nombres de ciclo/módulo duplicados, y que
   el número de work items descargados coincida con el total que declara Plane y con `--expect`.
4. **Copia previa** (`data/backups/pre-import-plane-*.json`) y **escritura**: una transacción por proyecto.

Si ya existe un proyecto con el mismo identificador **no se toca** (se informa como `skipped`). Por eso repetir el comando
es seguro, pero tampoco hace fusiones: para reimportar un proyecto hay que restaurar la copia previa o archivarlo antes.

## Qué se conserva

| Plane | ProjectOS |
|---|---|
| `sequence_id` | `seq` (FICH-12 sigue siendo FICH-12); el contador del proyecto continúa tras el máximo |
| Estados propios (Review, Blocked…) | estados del proyecto con su grupo, color y orden |
| `description_html`, comentarios | Markdown (turndown + GFM) |
| prioridad, fechas inicio/objetivo, `sort_order`, creado/actualizado/completado/archivado | igual |
| `parent` | subtarea (`parentId`), si el padre está en el mismo proyecto |
| etiquetas | etiquetas del proyecto |
| ciclos, módulos (estado y fechas) y su pertenencia | ciclos y módulos |
| enlaces | enlaces de tipo `url` |
| relaciones `blocking`/`blocked_by`/`duplicate`/`relates_to` | `blocks`/`duplicates`/`relates` (sin duplicar aristas) |

Los elementos importados llevan `createdBy = plane-import` y un evento `project.imported` en la actividad.

## Lo que NO se importa (todavía) y se avisa

- **Páginas** de Plane: se guardan en el snapshot; el módulo de documentos llega en otra fase.
- **Asignados** (no hay usuarios en ProjectOS local), estimaciones (`estimate_point` es un id de escala), adjuntos y
  relaciones de calendario (`start_after`, `finish_before`…).
- Hitos/milestones y vistas guardadas de Plane.

## Estado de verificación

El conversor, la validación, la idempotencia, el viaje backup→restore y el cliente REST (paginación, 429, solo GET, la clave no
aparece en el snapshot) están cubiertos por `tests/unit/plane-import.test.ts` con un `fetch` simulado y un snapshot sintético
que sigue la forma real de la API (comprobada contra un work item real de FICH). **El cliente REST no se ha ejecutado contra
Plane con una clave real**; ese es el primer paso antes de importar de verdad (`--dry-run`).

# Migración desde Linear

Pendiente. Requiere una clave de API de Linear (o un export CSV/JSON) y se implementará con el mismo esquema: snapshot crudo,
plan, validación, copia previa y escritura transaccional.
