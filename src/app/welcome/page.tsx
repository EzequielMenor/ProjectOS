import type { Metadata } from "next";
import { WelcomeClient } from "@/components/welcome-client";
import { listProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ProjectOS — Instalar Gratis o Usar en la Nube (MCP + Agentes IA)",
  description:
    "Gestor de proyectos local-first diseñado para trabajar con agentes de IA (Claude Code, Cursor, MCP). Instálalo gratis en local o usa ProjectOS Cloud 24/7.",
};

export default async function WelcomePage() {
  const projects = await listProjects().catch(() => []);
  const defaultProjectKey = projects[0]?.identifier ?? "POS";
  const checkoutUrl = process.env.NEXT_PUBLIC_CLOUD_CHECKOUT_URL;
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ezequiel@projectos.dev";

  return (
    <WelcomeClient
      defaultProjectKey={defaultProjectKey}
      checkoutUrl={checkoutUrl}
      contactEmail={contactEmail}
    />
  );
}
