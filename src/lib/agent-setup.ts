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
  return `Configura ProjectOS (nuestro gestor de proyectos) como servidor MCP en este entorno y deja este repositorio conectado a él.

Datos de conexión
- Servidor MCP (HTTP): ${url}
- Autenticación: cabecera \`Authorization: Bearer ${token}\`
- Permiso del token: ${scope}${write ? "" : " (solo lectura: no puedes crear ni modificar nada)"}
- Nombre con el que registrarlo: ${MCP_SERVER_NAME}

Pasos
1. Registra el servidor en el ámbito de usuario, no en el del repositorio, para que el token no acabe en git:

   ${claudeCodeCommand(i).replace(/\n/g, "\n   ")}

   Si no eres Claude Code, añade el equivalente en la configuración MCP de tu cliente (tipo http, la URL de arriba y la cabecera Authorization).
2. Comprueba la conexión llamando a \`list_projects\` y cuéntame qué proyectos ves. Si falla con un error de autenticación, detente y avísame: no pruebes con otros tokens.
3. Averigua a qué proyecto de ProjectOS corresponde este repositorio (por el nombre del repo y \`list_projects\`). Si dudas entre varios, pregúntame.
4. Añade la siguiente sección al CLAUDE.md de este repositorio (o a AGENTS.md si es el que usa; créalo si no existe), sustituyendo CLAVE por el identificador del proyecto. No dupliques la sección si ya existe:

${REPO_SNIPPET.split("\n").map((l) => `   ${l}`).join("\n")}
${write ? `5. Regístrate como miembro con \`create_member\` (name: tu nombre, por ejemplo el de tu herramienta; kind: agent) para que se te puedan asignar issues. Si ya existe un miembro con ese nombre, no lo repitas.
6.` : "5."} Por seguridad, no escribas el token en ningún fichero del repositorio ni lo incluyas en commits, issues ni comentarios.
${write ? "7." : "6."} Al terminar, dime qué has configurado, a qué proyecto has vinculado el repositorio y el resultado de \`list_projects\`.`;
}
