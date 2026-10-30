/** Texts shown next to a freshly created API token: how to connect an agent, and a prompt that lets the agent do it itself. */

export const TOKEN_PLACEHOLDER = "pos_XXXX";
export const MCP_SERVER_NAME = "projectos";

type Input = { origin: string; token?: string | null; scope?: "read" | "write" };

const norm = ({ origin, token, scope }: Input) => ({
  url: `${origin.replace(/\/$/, "")}/api/mcp`,
  token: token || TOKEN_PLACEHOLDER,
  scope: scope ?? "write",
});

/** Registers the server for every project of this user, so the token never lands in a repository. */
export function claudeCodeCommand(i: Input) {
  const { url, token } = norm(i);
  return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${url} \\\n  --header "Authorization: Bearer ${token}"`;
}

export function mcpJsonConfig(i: Input) {
  const { url, token } = norm(i);
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
}

/** Goes into the CLAUDE.md / AGENTS.md of each repository; the generic workflow already travels with the MCP connection. */
export const REPO_SNIPPET = `## Gestión de tareas
Este repositorio se gestiona en ProjectOS (servidor MCP \`projectos\`), proyecto **CLAVE**.
Antes de empezar trabajo nuevo, usa \`next_work\` con \`project: "CLAVE"\`. Referencia los issues por clave (CLAVE-12) en
commits y PRs, y registra los commits como evidencia con \`log_progress\` / \`complete_issue\`.`;

export function agentPrompt(i: Input) {
  const { url, token, scope } = norm(i);
  const write = scope === "write";
  return `Configúrate a ti mismo, el agente que está leyendo este mensaje (Claude Code, Codex, Pi u otro cliente), para usar ProjectOS como servidor MCP. La configuración es para tu propio cliente, no para la aplicación ni para el proyecto del directorio actual.

No modifiques el repositorio actual: no implementes un servidor MCP, no instales dependencias del proyecto ni edites CLAUDE.md, AGENTS.md o archivos de configuración locales del repo. Vincular un repositorio a un proyecto de ProjectOS es una tarea separada y no forma parte de este pedido.

Datos de conexión
- Servidor MCP (HTTP): ${url}
- Autenticación: cabecera \`Authorization: Bearer ${token}\`
- Permiso del token: ${scope}${write ? "" : " (solo lectura: no puedes crear ni modificar nada)"}
- Nombre con el que registrarlo: ${MCP_SERVER_NAME}

Pasos
1. Identifica qué cliente eres y registra el servidor en la configuración de usuario de tu propio cliente, no en la del repositorio. Conserva los otros servidores ya configurados. Si eres Claude Code, ejecuta:

   ${claudeCodeCommand(i).replace(/\n/g, "\n   ")}

   Si eres Codex, Pi u otro cliente, usa el mecanismo MCP compatible con ese cliente y su formato de configuración de usuario (HTTP, la URL de arriba y la cabecera Authorization). No ejecutes el comando de Claude Code si no eres Claude Code. Si no puedes identificar o modificar tu configuración, detente y explica qué dato o permiso falta; no inventes rutas ni uses el repositorio como alternativa.
2. Si necesitas reiniciar o recargar el cliente para cargar el servidor, indícamelo y deja la comprobación pendiente; no afirmes que la conexión funciona sin haberla comprobado. Cuando las herramientas estén disponibles, comprueba la conexión llamando a \`list_projects\` y cuéntame qué proyectos ves. Si falla con un error de autenticación, detente y avísame: no pruebes con otros tokens.
${write ? `3. Regístrate como miembro con \`create_member\` (name: tu nombre, por ejemplo el de tu herramienta; kind: agent) para que se te puedan asignar issues. Si ya existe un miembro con ese nombre, no lo repitas.
4.` : "3."} Por seguridad, no escribas el token en ningún fichero del repositorio ni lo incluyas en commits, issues ni comentarios.
${write ? "5." : "4."} Al terminar, dime qué cliente has configurado, en qué ámbito, y el resultado de \`list_projects\` o qué comprobación queda pendiente. No muestres el token en el resumen.`;
}
