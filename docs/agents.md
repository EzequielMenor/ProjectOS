# Trabajar con agentes

ProjectOS expone un servidor MCP (`/api/mcp`) y una API REST con las mismas herramientas (`/api/v1/tools`). Al conectarse,
cada agente recibe por MCP el «acuerdo de trabajo» (`MCP_INSTRUCTIONS` en `src/server/agent/mcp.ts`): empezar con
`next_work`, leer antes de tocar, registrar progreso con evidencia, cerrar solo lo verificado, no inventar claves ni estados.

## Conectar un agente (Claude Code)

> En la propia aplicación: al crear un token, **Tokens de API → «Configurar en el agente»** rellena con el token nuevo el
> comando de Claude Code, el JSON para otros clientes MCP y un prompt para que el agente se configure él mismo (registra el
> servidor, comprueba la conexión, vincula el repositorio a su proyecto, añade la sección al `CLAUDE.md` y se da de alta como miembro).
> Lo que sigue es lo mismo explicado a mano.

1. Un token por agente (o por máquina): **Tokens de API** → nombre descriptivo (`claude-code-fichaje`) y permiso `write`.
   El nombre sale en la actividad como `agent:<nombre>`, así que distingue de quién es cada cambio. Usa `read` para un
   agente que solo debe consultar. El token se muestra una sola vez.
2. Regístralo, para todos tus proyectos (`--scope user`) o solo para el repo actual (por defecto):

   ```bash
   claude mcp add --transport http --scope user projectos http://localhost:3000/api/mcp \
     --header "Authorization: Bearer pos_XXXX"
   ```

3. (Recomendado) Date de alta como miembro para poder asignarte trabajo: en **Miembros**, o pídele al agente que llame a
   `create_member` con su nombre (tipo `agent`).

## Qué poner en el `CLAUDE.md` / `AGENTS.md` de cada repositorio

Lo genérico ya viaja con el MCP; en el repo solo hace falta decir a qué proyecto pertenece:

```md
## Gestión de tareas
Este repositorio se gestiona en ProjectOS (servidor MCP `projectos`), proyecto **FICH**.
Antes de empezar trabajo nuevo, usa `next_work` con `project: "FICH"`. Referencia los issues por clave (FICH-12) en
commits y PRs, y registra los commits como evidencia con `log_progress` / `complete_issue`.
```

## Garantías

- Sin herramientas de borrado: lo máximo es **archivar** (reversible). Borrar proyectos, estados, propiedades o miembros
  solo se puede hacer desde la interfaz, con confirmación.
- Un token `read` no ve las herramientas de escritura.
- Cada cambio guarda el valor anterior en la actividad del issue.
- `update_page` exige leer antes (`expectedUpdatedAt`); `append_to_page` nunca pisa texto.

## Copias de seguridad

El servidor guarda solo una copia al día en `data/backups/auto-*.json` (las últimas 14; las manuales y las previas a
restaurar o importar no se tocan). Desactívalo con `AUTO_BACKUP=off`. Restaurar: **Copias de seguridad** en la interfaz,
con simulación previa. Fuera de la máquina: copia la carpeta `data/backups` donde quieras (disco externo, `rclone`…).
