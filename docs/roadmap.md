# Hoja de ruta

Lo que queda, por prioridad. Se trabaja en este orden; cada punto termina con tests y commit, y se avisa antes de pasar al siguiente.
Criterio: primero lo que impide usar la app cada día, después lo que la protege, después lo que amplía el modelo.

| # | Qué | Por qué en este lugar | Estado |
|---|---|---|---|
| 1 | **Móvil y pantallas estrechas**: menú lateral en cajón, paleta accesible, tablero/lista/detalle sin desbordes | Hoy por debajo de `md` no hay navegación: la app es inusable en móvil | **hecho** (cajón, barra superior, sin desbordes a 390 px; `tests/e2e/mobile.spec.ts`) |
| 2 | **Estados de carga/vacío, accesibilidad y modo oscuro**: revisar contraste, foco, etiquetas ARIA, `loading.tsx`, errores | Es parte del criterio de diseño del encargo y se nota en el uso diario | **hecho** (esqueletos de carga, pantalla de error con «Reintentar», 404 con estado HTTP correcto, axe en claro/oscuro, foco visible, enlace para saltar al contenido; `tests/e2e/a11y.spec.ts`) |
| 3 | **Contraseña opcional (`APP_PASSWORD`)** para la interfaz y la API del navegador | Solo hace falta si se expone fuera de la máquina; Docker publica en `127.0.0.1` | **descartado por ahora** (uso personal; decisión del usuario) |
| 4 | **Propiedades personalizadas** por proyecto (texto, número, fecha, selección) en la ficha, en filtros y vía MCP | Requisito del encargo; Plane las tiene | **hecho** |
| 5 | **Miembros y asignados** (personas y agentes), filtro «asignado a» | Los asignados de Plane se descartaron al importar; útil para repartir trabajo con agentes | **hecho** |
| 6 | **Vistas guardadas en la barra lateral** y atajos (tamaño de interfaz, ir a Épicas…) | Pulido; mejora la velocidad estilo Linear | **hecho** |
| 7 | ~~Importador de Linear~~ | No se usa Linear | **descartado** (decisión del usuario) |
| 8 | **Verificar Docker Compose** | No hace falta para el uso diario (se usa `pnpm start` + systemd) | opcional: necesita `sudo usermod -aG docker $USER` |
| 9 | **Uso real con agentes**: copia automática diaria con rotación, instrucciones MCP que reciben los agentes al conectarse, guía `docs/agents.md`, servicio systemd | Lo mínimo para empezar a trabajar en proyectos de verdad | **hecho** |
| 10 | **Ampliar lo que gestionan los agentes**: crear proyectos y estados, editar ciclos, módulos e hitos; respuestas compactas | Que el 90 % del trabajo lo lleve el agente sin gastar tokens de más | **hecho** |
| 11 | **Publicar y documentar** (v0.1.0): documentación por temas, CHANGELOG, escucha solo en `127.0.0.1`, repositorio en GitHub | Poder darle una copia a otra persona | **hecho** |

Decisiones que se quedan con el autor (modifican sus datos): convertir en épicas los issues con subtareas de su proyecto AIES,
importar un proyecto de demostración de Plane y revocar la clave de Plane usada en la migración.
