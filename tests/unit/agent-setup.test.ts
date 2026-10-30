import { describe, expect, it } from "vitest";
import { REPO_SNIPPET, TOKEN_PLACEHOLDER, agentPrompt, claudeCodeCommand, mcpJsonConfig } from "@/lib/agent-setup";

const base = { origin: "http://localhost:3000/", token: "pos_abc123", scope: "write" as const };

describe("agent setup texts", () => {
  it("fill the MCP url (no double slash) and the token everywhere", () => {
    expect(claudeCodeCommand(base)).toBe(
      'claude mcp add --transport http --scope user projectos http://localhost:3000/api/mcp \\\n  --header "Authorization: Bearer pos_abc123"',
    );
    const cfg = JSON.parse(mcpJsonConfig(base));
    expect(cfg.mcpServers.projectos).toEqual({ type: "http", url: "http://localhost:3000/api/mcp", headers: { Authorization: "Bearer pos_abc123" } });
    const prompt = agentPrompt(base);
    expect(prompt).toContain("http://localhost:3000/api/mcp");
    expect(prompt.split("pos_abc123").length - 1).toBe(2); // header line + the command, nothing else
    expect(REPO_SNIPPET).toContain("proyecto **CLAVE**");
  });

  it("targets the running agent rather than the current repository", () => {
    const prompt = agentPrompt(base);
    expect(prompt).toContain("Configúrate a ti mismo");
    expect(prompt).toContain("Claude Code, Codex, Pi");
    expect(prompt).toContain("configuración de usuario de tu propio cliente");
    expect(prompt).toContain("No modifiques el repositorio actual");
    expect(prompt).not.toContain("deja este repositorio conectado");
    expect(prompt).not.toContain(REPO_SNIPPET);
    expect(prompt).not.toContain("Averigua a qué proyecto");
    expect(prompt).toContain("no pruebes con otros tokens");
    expect(prompt).toContain("no escribas el token en ningún fichero del repositorio");
    expect(prompt).toContain("reiniciar o recargar");
    expect(prompt).toContain("no afirmes que la conexión funciona sin haberla comprobado");
  });

  it("use a visible placeholder before any token exists", () => {
    expect(claudeCodeCommand({ origin: "http://x" })).toContain(`Bearer ${TOKEN_PLACEHOLDER}`);
    expect(agentPrompt({ origin: "http://x" })).toContain(TOKEN_PLACEHOLDER);
  });

  it("a read-only token never asks the agent to create a member, and steps stay numbered", () => {
    const ro = agentPrompt({ ...base, scope: "read" });
    expect(ro).not.toContain("create_member");
    expect(ro).toContain("solo lectura");
    expect(ro).toMatch(/\n3\. Por seguridad/);
    expect(ro).toMatch(/\n4\. Al terminar/);
    const rw = agentPrompt(base);
    expect(rw).toContain("create_member");
    expect(rw).toMatch(/\n4\. Por seguridad/);
    expect(rw).toMatch(/\n5\. Al terminar/);
  });
});
