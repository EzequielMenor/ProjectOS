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
    expect(prompt).toContain(REPO_SNIPPET.split("\n")[0]);
  });

  it("use a visible placeholder before any token exists", () => {
    expect(claudeCodeCommand({ origin: "http://x" })).toContain(`Bearer ${TOKEN_PLACEHOLDER}`);
    expect(agentPrompt({ origin: "http://x" })).toContain(TOKEN_PLACEHOLDER);
  });

  it("a read-only token never asks the agent to create a member, and steps stay numbered", () => {
    const ro = agentPrompt({ ...base, scope: "read" });
    expect(ro).not.toContain("create_member");
    expect(ro).toContain("solo lectura");
    expect(ro).toMatch(/\n5\. Por seguridad/);
    expect(ro).toMatch(/\n6\. Al terminar/);
    const rw = agentPrompt(base);
    expect(rw).toContain("create_member");
    expect(rw).toMatch(/\n6\. Por seguridad/);
    expect(rw).toMatch(/\n7\. Al terminar/);
  });
});
