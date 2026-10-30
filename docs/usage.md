# Guía de uso

Todo lo que se puede hacer desde la interfaz. Para agentes, ver [`agents.md`](agents.md).

## Proyectos, issues y vistas

- Cada proyecto tiene un **identificador** (`FICH`) y sus issues se numeran `FICH-1`, `FICH-2`… para siempre.
- Tres vistas del mismo contenido: **Lista**, **Kanban** (arrastrar para cambiar de estado u ordenar) y **Tabla** (ordenable,
  con celdas editables y columnas para propiedades personalizadas).
- La **ficha** de un issue (clic) tiene estado, prioridad, asignado, etiquetas, fechas, estimación, padre y subtareas,
  relaciones, enlaces (commits, PR, evidencias), comentarios y el historial de cambios. La descripción es Markdown: se ve
  renderizada y se edita al hacer clic.
- **Filtros** (estado, asignado, prioridad, etiqueta, ciclo, módulo, propiedades de selección y texto) sincronizados con la URL,
  así que cualquier filtro se puede guardar como enlace.
- **Vistas guardadas**: «Vistas» en la barra de filtros guarda los filtros actuales con su layout. Cada vista aparece bajo el
  proyecto en la barra lateral y en la paleta.

## Paleta de comandos y atajos

`Ctrl K` (o `/`) abre la paleta: buscar issues y páginas, ir a cualquier pantalla, cambiar de tema o de tamaño. Saltos con `g`
y una letra: `l` Lista, `b` Kanban, `t` Tabla, `e` Épicas, `c` Ciclos, `m` Módulos, `h` Hitos, `r` Roadmap, `d` Docs, `s` Ajustes.

## Épicas, ciclos, módulos e hitos

- **Épica** (`/<PROY>/epics`): un issue de tipo «Épica». Su progreso sale de sus subtareas directas (las canceladas y
  archivadas no cuentan). Se crea desde la página o cambiando el campo *Tipo* de cualquier issue.
- **Ciclos**: sprints con fechas; un issue pertenece como máximo a uno.
- **Módulos**: agrupan issues por funcionalidad o fase (un issue puede estar en varios).
- **Hitos**: metas con fecha objetivo opcional. Abre un hito para consultar su objetivo, progreso, épicas y tickets asignados; desde cada elemento puedes entrar a su ficha y ver los bloqueadores pendientes.
- **Roadmap**: cronograma navegable de hitos, módulos y ciclos con fechas, y tarjetas con objetivo y progreso para los que todavía no tienen fecha. Todos abren su detalle; no necesitas un documento aparte para recorrer el plan.
- **Detalle de planificación**: disponible también desde las listas de ciclos y módulos. Incluye enlaces de vuelta a Roadmap y a la lista correspondiente. El progreso conserva el criterio existente: cuenta los elementos asignados (incluidas las épicas), excluye los archivados y no incluye cancelados en el porcentaje. Los bloqueos se muestran con el mismo criterio que `next_work`; esta vista no añade todavía el bloqueo obligatorio de cambios de estado.

## Documentos

Páginas en Markdown por proyecto, con editor y vista previa (sin editor WYSIWYG a propósito: el texto plano es lo que mejor
leen y escriben los agentes). `FICH-12`, `[[FICH-12]]` y `[[Título]]` crean **enlaces bidireccionales**: el issue muestra
«Mencionado en» y la página «Enlazada desde». Cada edición conserva la versión anterior y se puede restaurar.

## Miembros y asignados

`/settings/members`: personas y agentes del workspace (existe uno inicial, «Yo»). Los nombres son únicos. Se asigna desde la
ficha, desde la tabla o desde el filtro **Asignado** (admite «Sin asignar» y varios a la vez). Borrar un miembro solo se hace
desde la interfaz, con confirmación, y deja sus issues sin asignar. No son cuentas: son etiquetas para repartir trabajo.

## Propiedades personalizadas

Ajustes del proyecto → «Propiedades personalizadas». Campos propios de tipo texto, número, fecha o selección. Aparecen en la
ficha y como columnas ordenables de la tabla; las de selección también como filtro. El tipo no se puede cambiar, y una opción
en uso no se puede quitar. Borrar una propiedad elimina sus valores (solo recuperables desde una copia).

## Ajustes del proyecto

`/<PROY>/settings`: nombre, color y descripción (Markdown) y los **estados** del flujo: crear, renombrar, recolorear, reordenar,
cambiar el estado por defecto y borrar. Un proyecto siempre conserva un estado de tipo «completed» y uno por defecto; al
borrar un estado hay que elegir a cuál se mueven sus issues.

## Apariencia, móvil y accesibilidad

- **Tema** claro u oscuro (sigue al sistema o se fuerza desde la paleta).
- **Tamaño de la interfaz**: control `A−  %  A+` al pie de la barra lateral (14–24 px, por defecto 18) o desde la paleta.
  Se guarda en una cookie.
- **Móvil**: por debajo de 768 px la barra lateral pasa a una barra superior con menú; las vistas se ajustan sin desplazamiento horizontal.
- **Accesibilidad**: pantallas con esqueleto de carga, pantalla de error con «Reintentar», 404 reales, enlace «Saltar al
  contenido» y foco visible. Los tests pasan axe-core (WCAG 2.1 A/AA) en tema claro y oscuro.

## Tokens y copias

- **Tokens de API** (`/settings/tokens`): crear, revocar y «Configurar en el agente».
- **Copias de seguridad** (`/settings/backup`): ver [`install.md`](install.md#copias-de-seguridad).
