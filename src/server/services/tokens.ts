import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiToken, TOKEN_SCOPES, type TokenScope } from "@/db/schema";
import { z } from "zod";
import { ServiceError, notFound } from "../errors";
import { getDefaultWorkspace } from "./workspace";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export const createTokenInput = z.object({
  name: z.string().trim().min(1).max(60),
  scope: z.enum(TOKEN_SCOPES),
});

export type AuthContext = { tokenId: string; name: string; scope: TokenScope; actor: string };

/** Returns the plaintext exactly once; afterwards only the hash exists. */
export async function createToken(raw: unknown) {
  const input = createTokenInput.parse(raw);
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  const token = `pos_${randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(apiToken)
    .values({ workspaceId: ws.id, name: input.name, scope: input.scope, tokenHash: hash(token) })
    .returning({ id: apiToken.id, name: apiToken.name, scope: apiToken.scope, createdAt: apiToken.createdAt });
  return { ...row, token };
}

export async function listTokens() {
  const db = await getDb();
  return db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      scope: apiToken.scope,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
      revokedAt: apiToken.revokedAt,
    })
    .from(apiToken)
    .orderBy(desc(apiToken.createdAt));
}

export async function revokeToken(id: string) {
  const db = await getDb();
  const [row] = await db
    .update(apiToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiToken.id, id), isNull(apiToken.revokedAt)))
    .returning({ id: apiToken.id });
  if (!row) throw notFound("Token");
}

/** Resolves an `Authorization: Bearer ...` header; throws `forbidden` for anything invalid or revoked. */
export async function authenticate(header: string | null | undefined): Promise<AuthContext> {
  const m = /^Bearer\s+(pos_[A-Za-z0-9_-]+)$/.exec(header ?? "");
  if (!m) throw new ServiceError("forbidden", "Falta un token Bearer válido");
  const db = await getDb();
  const row = await db.query.apiToken.findFirst({
    where: and(eq(apiToken.tokenHash, hash(m[1])), isNull(apiToken.revokedAt)),
  });
  if (!row) throw new ServiceError("forbidden", "Token inválido o revocado");
  await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id));
  return { tokenId: row.id, name: row.name, scope: row.scope, actor: `agent:${row.name}` };
}
