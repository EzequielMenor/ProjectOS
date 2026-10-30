"use client";

import { Check, Copy } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { REPO_SNIPPET, TOKEN_PLACEHOLDER, agentPrompt, claudeCodeCommand, mcpJsonConfig } from "@/lib/agent-setup";

type Tab = "claude" | "json" | "prompt";
const TABS: { id: Tab; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: "json", label: "Otros clientes MCP" },
  { id: "prompt", label: "Prompt para el agente" },
];

/** «Configurar en el agente»: filled with the real token right after creating it, with a placeholder otherwise. */
export function AgentSetup({ token, scope }: { token: string | null; scope: "read" | "write" }) {
  const base = useId();
  const [tab, setTab] = useState<Tab>("claude");
  // window.location is not known on the server render; the snapshot swap after hydration is not a mismatch
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "http://localhost:3000",
  );
  const input = { origin, token, scope };

  return (
    <section aria-label="Configurar en el agente" className="rounded-lg border p-4">
      <h2 className="text-sm font-medium">Configurar en el agente</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {token
          ? "Ya incluye tu token nuevo: cópialo ahora, no se volverá a mostrar."
          : `Crea un token y esta sección se rellena con él. Mientras tanto verás ${TOKEN_PLACEHOLDER} en su lugar.`}
      </p>
      <div role="tablist" aria-label="Cómo configurarlo" className="mt-3 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : null;
              if (next) {
                e.preventDefault();
                setTab(next.id);
                document.getElementById(`${base}-tab-${next.id}`)?.focus();
              }
            }}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
              tab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel-${tab}`} aria-labelledby={`${base}-tab-${tab}`} className="mt-3 flex flex-col gap-3">
        {tab === "claude" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Ejecútalo una vez en cualquier terminal. Con <code className="font-mono text-xs">--scope user</code> queda disponible en todos tus proyectos y el token no se guarda en ningún repositorio. Comprueba con <code className="font-mono text-xs">claude mcp list</code>.
            </p>
            <Block label="Comando de Claude Code" text={claudeCodeCommand(input)} />
            <p className="text-sm text-muted-foreground">Y en el <code className="font-mono text-xs">CLAUDE.md</code> o <code className="font-mono text-xs">AGENTS.md</code> de cada repositorio (cambia CLAVE por el identificador del proyecto):</p>
            <Block label="Sección para el CLAUDE.md del repositorio" text={REPO_SNIPPET} />
          </>
        ) : null}
        {tab === "json" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Para Cursor, VS Code, Windsurf y otros clientes que leen un JSON de servidores MCP. Los nombres exactos de los campos (<code className="font-mono text-xs">type</code>, <code className="font-mono text-xs">url</code>, <code className="font-mono text-xs">headers</code>) pueden variar un poco según el cliente.
            </p>
            <Block label="Configuración JSON" text={mcpJsonConfig(input)} />
          </>
        ) : null}
        {tab === "prompt" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Pégalo en una sesión de Claude Code, Codex, Pi u otro agente para que configure su propia conexión MCP de usuario. No modifica el repositorio actual. Comprueba la conexión y, con permiso de escritura, se da de alta como miembro.
            </p>
            <Block label="Prompt para el agente" text={agentPrompt(input)} />
          </>
        ) : null}
        {token ? <p className="text-xs text-muted-foreground">Estos textos contienen el token: trátalos como una contraseña.</p> : null}
      </div>
    </section>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre tabIndex={0} aria-label={label} data-testid="setup-text" className="max-h-80 overflow-auto rounded-md bg-muted p-3 pr-20 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </pre>
      <button
        type="button"
        aria-label={`Copiar: ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // clipboard blocked: the text is selectable above
          }
        }}
        className="absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-accent"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
