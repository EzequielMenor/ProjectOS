# Investigación de patrones (Linear y Plane)

Fuente: páginas públicas de linear.app y plane.so inspeccionadas con REA (capturas del viewport, sin evaluar JS ni
autenticarse) y el MCP oficial de Plane sobre el propio workspace del autor. No se copia código, marca ni recursos:
solo se anotan patrones de interacción que ProjectOS reimplementa con diseño propio.

## Patrones que adoptamos

| Origen | Patrón | Decisión en ProjectOS |
|---|---|---|
| Linear | Sidebar sobria y fija: acceso rápido (Inbox/My issues) + Workspace + Proyectos | Sidebar con "Mis issues", proyectos y secciones por proyecto |
| Linear | Clave de issue visible junto al icono de estado (`DRV-8852`); navegación anterior/siguiente `1 / 84` | Cabecera de issue con `PROJ-123`, estado y flechas j/k |
| Linear | Panel de propiedades lateral (estado, prioridad, asignado) con edición inline | Panel derecho en la vista de issue; edición sin modales |
| Linear | Actividad y comentarios en el mismo hilo bajo la descripción | Timeline unificado de actividad + comentarios |
| Linear | Tema oscuro como protagonista, tipografía sans compacta, bordes sutiles | Tokens de color propios, oscuro/claro, densidad compacta |
| Plane | Breadcrumb `Proyecto > Work items (N)` + selector de vista (lista, tablero, calendario, timeline) | Barra de vista con conmutador Lista / Kanban / Tabla |
| Plane | Columnas Kanban con contador y botón `+` por columna | Mismo concepto; creación rápida inline por columna |
| Plane | Tarjetas con chips de propiedades (prioridad, fechas, etiquetas, nº subtareas) | Tarjetas compactas con chips |
| Plane | Módulos, ciclos, páginas (Wiki), epics y tipos de work item por proyecto | Fases 5–6 del plan |
| Plane | Búsqueda global en la barra superior | Ctrl+K (command menu) |
| Ambos | Mensaje de producto "para equipos y agentes": API/MCP de primera clase | API REST + MCP desde la Fase 3 |

## Lo que evitamos
Exceso de modales, paywalls por función (Plane Business), dashboards genéricos, navegación profunda.
