import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ZodError } from "zod";
import { ServiceError } from "../errors";
import type { AuthContext } from "../services/tokens";
import { TOOLS, callTool } from "./tools";

export function errorMessage(e: unknown): { message: string; status: number } {
  if (e instanceof ServiceError) {
    const status = { not_found: 404, invalid: 400, conflict: 409, forbidden: 403 }[e.code];
    return { message: e.message, status };
  }
  if (e instanceof ZodError) return { message: e.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; "), status: 400 };
  console.error(e);
  return { message: "Error interno", status: 500 };
}

/** Sent to every agent on connect (MCP `instructions`): the working agreement, so each project's CLAUDE.md can stay short. */
export const MCP_INSTRUCTIONS = `ProjectOS is the project tracker for this work. Issues have keys like FICH-12; names (states, labels, members, properties) are matched case-insensitively.

Workflow:
1. next_work (optionally with project / assignee) tells you what to do next. Read the issue with get_issue before touching it (description, relations, comments, children).
2. When you start: set_state to the started state (see get_project for state names) and, if you are a registered member, update_issue with assignee set to your name (list_members / create_member).
3. While working: log_progress for notable steps, attaching evidence (commit SHA, PR URL, file path, test output) instead of claims. Use add_comment for questions or decisions.
4. When it is truly done and verified: complete_issue with the evidence. If you are blocked, say so with add_comment and add_relation (the blocker 'blocks' this issue), do not mark it done.
5. Found extra work? create_issue (with parent for sub-tasks) instead of widening the current one.

Rules: never invent issue keys, states or property values: read them first (get_project, list_properties, list_members). Docs pages (get_page / update_page / append_to_page): read before you write; update_page needs the expectedUpdatedAt you read, append_to_page never overwrites. There are no delete tools by design: archive_issue / archive_page are reversible. Your writes are recorded in the activity log as your token's name.`;

/** Builds a per-request MCP server exposing only the tools this token's scope allows. */
export function buildMcpServer(ctx: AuthContext) {
  const server = new McpServer({ name: "projectos", version: "0.1.0" }, { instructions: MCP_INSTRUCTIONS });
  for (const t of TOOLS) {
    if (t.scope === "write" && ctx.scope !== "write") continue;
    server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: t.shape,
        annotations: { readOnlyHint: t.scope === "read", destructiveHint: false, openWorldHint: false },
      },
      async (args: unknown) => {
        try {
          const result = await callTool(t.name, args, ctx);
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
          return { isError: true, content: [{ type: "text" as const, text: errorMessage(e).message }] };
        }
      },
    );
  }
  return server;
}

/** Stateless Streamable HTTP: one server + transport per request. */
export async function handleMcpRequest(req: Request, ctx: AuthContext) {
  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
