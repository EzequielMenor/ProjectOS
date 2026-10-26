import { TokensPanel } from "@/components/tokens-panel";
import { listTokens } from "@/server/services/tokens";

export const metadata = { title: "Tokens de API" };
export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const tokens = await listTokens();
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Tokens de API</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dan acceso a la API REST y al servidor MCP. Un token <b>read</b> solo consulta; uno <b>write</b> puede crear y actualizar, pero ninguno puede borrar datos.
      </p>
      <TokensPanel
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          scope: t.scope,
          createdAt: t.createdAt.toISOString(),
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          revoked: Boolean(t.revokedAt),
        }))}
      />
    </div>
  );
}
