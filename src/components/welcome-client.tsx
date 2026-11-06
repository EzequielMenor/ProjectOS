"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Cloud,
  Copy,
  Database,
  HardDrive,
  Laptop,
  Layers,
  Lock,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Comando copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar automáticamente");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          <span>{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function WelcomeClient({
  defaultProjectKey,
  checkoutUrl,
  contactEmail,
}: {
  defaultProjectKey: string;
  checkoutUrl?: string;
  contactEmail: string;
}) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"cloud" | "team" | null>(null);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const cloudPrice = billing === "monthly" ? "5 €" : "4 €";
  const teamPrice = billing === "monthly" ? "19 €" : "15 €";

  const handleSelectPlan = (plan: "cloud" | "team") => {
    if (checkoutUrl && plan === "cloud") {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setSelectedPlan(plan);
    setSubmitted(false);
  };

  const handleCloudRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const planLabel = selectedPlan === "team" ? `Plan Equipos (${teamPrice}/mes)` : `Plan ProjectOS Cloud (${cloudPrice}/mes)`;
    const subject = encodeURIComponent(`Solicitud de alta en ${planLabel}`);
    const body = encodeURIComponent(
      `Hola Ezequiel,\n\nQuiero activar ${planLabel} (${billing === "yearly" ? "facturación anual" : "facturación mensual"}).\n\nMi correo: ${email}\nNotas / Uso previsto: ${notes || "Uso con agentes MCP (Claude Code / Cursor)"}\n`,
    );
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
    setSubmitted(true);
    toast.success("Solicitud preparada: envíala para activar tu instancia en el servidor");
  };

  return (
    <div className="min-h-full overflow-y-auto bg-background text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              P
            </div>
            <span className="text-sm font-semibold tracking-tight">ProjectOS</span>
            <span className="hidden rounded-full border px-2 py-0.5 font-mono text-[0.6875rem] text-muted-foreground sm:inline-block">
              v0.1.0 · MCP + Local-First
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#caracteristicas" className="transition-colors hover:text-foreground">
              Qué hace
            </a>
            <a href="#instalar" className="transition-colors hover:text-foreground">
              Instalar gratis
            </a>
            <a href="#precios" className="transition-colors hover:text-foreground">
              ProjectOS Cloud
            </a>
            <a
              href="https://github.com/EzequielMenor/ProjectOS"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={`/${defaultProjectKey}/board`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:text-sm"
            >
              <span>Ir al Tablero Demo</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-indigo-500" />
            <span>Pensado desde cero para Claude Code, Cursor y clientes MCP</span>
          </div>

          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Tú ves cómo avanza el proyecto;{" "}
            <span className="text-indigo-500">tu agente de IA hace el 90% de mantenerlo al día.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            ProjectOS es un gestor de proyectos ultrarrápido (al estilo de Linear y Plane) con un servidor{" "}
            <strong className="font-medium text-foreground">MCP integrado de 41 herramientas sin permiso de borrado</strong>.
            El agente consulta qué toca hacer, mueve tareas en el Kanban y adjunta pruebas reales (commits y PRs).
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${defaultProjectKey}/board`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
            >
              <span>Probar Demo Interactiva (con datos de prueba)</span>
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#instalar"
              className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Terminal className="size-4" />
              <span>Instalar gratis en local</span>
            </a>
            <a
              href="#precios"
              className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Cloud className="size-4 text-indigo-500" />
              <span>Ver Plan Cloud ({cloudPrice}/mes)</span>
            </a>
          </div>

          {/* Architecture Pill Diagram */}
          <div className="mx-auto mt-12 grid max-w-3xl gap-3 rounded-xl border bg-card/70 p-4 text-left sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                <Bot className="size-4" />
                <span>1. El Agente pregunta</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Al conectarse por MCP ejecuta <code className="rounded bg-muted px-1 font-mono">next_work</code>, toma la tarea más urgente y la pasa a <em>In Progress</em>.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-500">
                <Lock className="size-4" />
                <span>2. Evidencia sin borrado</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Registra avances con enlaces al commit o PR bajo <code className="rounded bg-muted px-1 font-mono">agent:claude-code</code>. No puede borrar nada.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-500">
                <Zap className="size-4" />
                <span>3. Tú tienes el control</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Supervisas en el tablero Kanban, Épicas, Roadmap o Documentos con enlaces <code className="rounded bg-muted px-1 font-mono">[[POS-2]]</code>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="caracteristicas" className="border-b py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Todo lo que necesitas, sin el ruido de Jira</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Combina la rapidez de teclado de Linear con los módulos, ciclos y documentos de Plane, adaptado a flujos con IA.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <Bot className="size-5 text-indigo-500" />
              <h3 className="mt-3 text-base font-semibold">41 herramientas MCP y REST</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Los agentes crean y actualizan issues, épicas, ciclos, módulos, hitos y páginas en Markdown con control de versiones automático.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <Layers className="size-5 text-indigo-500" />
              <h3 className="mt-3 text-base font-semibold">Kanban, Lista, Tabla y Roadmap</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Propiedades personalizadas (texto, número, fecha, selector), filtros combinables, vistas guardadas y paleta <kbd className="rounded border px-1 font-mono text-xs">Ctrl K</kbd>.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <Database className="size-5 text-indigo-500" />
              <h3 className="mt-3 text-base font-semibold">Cero dependencias externas</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                En local lleva PostgreSQL embebido (PGlite) y guarda tus datos en <code className="rounded bg-muted px-1 font-mono">./data</code> con copias diarias automáticas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Installation Section */}
      <section id="instalar" className="border-b py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">100% Gratis y Open Source (MIT)</span>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Cómo instalarlo en tu ordenador en 1 minuto</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Solo necesitas <strong>Node 24+</strong> y <strong>pnpm</strong>. No hace falta instalar Docker ni configurar ninguna base de datos externa.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-6">
            <CopyBlock
              label="1. Clona el repositorio, compila y arranca (incluye PostgreSQL embebido)"
              code={`git clone https://github.com/EzequielMenor/ProjectOS.git projectos
cd projectos
pnpm install
pnpm build
pnpm start`}
            />

            <CopyBlock
              label="2. Abre http://localhost:3000 → Tokens de API y conecta Claude Code en 1 comando"
              code={`claude mcp add --transport http --scope user projectos http://localhost:3000/api/mcp \\
  --header "Authorization: Bearer pos_TU_TOKEN_GENERADO"`}
            />

            <CopyBlock
              label="3. (Opcional en Linux) Déjalo siempre encendido en segundo plano con systemd"
              code={`mkdir -p ~/.config/systemd/user
cp scripts/projectos.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now projectos`}
            />
          </div>
        </div>
      </section>

      {/* Pricing: Local vs Cloud Monthly Server */}
      <section id="precios" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Elige cómo usarlo</span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">
              Gratis en tu equipo para siempre, o listo en la nube 24/7
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              ¿No quieres mantener un servidor local encendido o quieres usar ProjectOS desde varios ordenadores y el móvil?
              Nosotros alojamos tu instancia privada en <strong>ProjectOS Cloud</strong>.
            </p>

            {/* Billing Toggle */}
            <div className="mt-6 inline-flex items-center rounded-lg border bg-muted/50 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  billing === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pago mensual
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  billing === "yearly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Anual <span className="ml-1 text-emerald-500">(Ahorra 20%)</span>
              </button>
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {/* Tier 1: Local Open Source */}
            <div className="flex flex-col justify-between rounded-2xl border bg-card p-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Local · Self-Hosted</h3>
                  <HardDrive className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Corre en tu propio ordenador sin límites ni cuentas.</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">0 €</span>
                  <span className="text-xs text-muted-foreground">/ para siempre (MIT)</span>
                </div>

                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Proyectos, issues, épicas y documentos ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>41 herramientas MCP y REST en <code className="font-mono text-xs">localhost:3000</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Base de datos PostgreSQL embebida (PGlite) en <code className="font-mono text-xs">./data</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Copias de seguridad diarias en tu propio disco</span>
                  </li>
                </ul>
              </div>

              <a
                href="#instalar"
                className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Ver pasos de instalación
              </a>
            </div>

            {/* Tier 2: ProjectOS Cloud (Highlighted) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-indigo-500 bg-card p-6 shadow-lg">
              <div className="absolute -top-3 right-4 rounded-full bg-indigo-600 px-3 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-white uppercase">
                Más popular
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">ProjectOS Cloud</h3>
                  <Cloud className="size-5 text-indigo-500" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tu servidor privado encendido 24/7 sin instalar ni mantener nada.
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{cloudPrice}</span>
                  <span className="text-xs text-muted-foreground">/ mes {billing === "yearly" ? "(facturado anual)" : ""}</span>
                </div>

                <ul className="mt-6 space-y-2.5 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                    <span><strong>Todo lo de Local</strong>, alojado en un servidor rápido y privado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                    <span><strong>URL MCP remota 24/7</strong> (<code className="font-mono text-xs">https://.../api/mcp</code>) para tus agentes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                    <span>Acceso desde <strong>varios ordenadores y desde el móvil</strong> con contraseña</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                    <span><strong>Backups diarios en la nube</strong> (30 días) y actualizaciones automáticas</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan("cloud")}
                className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Activar ProjectOS Cloud ({cloudPrice}/mes)
              </button>
            </div>

            {/* Tier 3: Equipos / VPS Dedicado */}
            <div className="flex flex-col justify-between rounded-2xl border bg-card p-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Cloud Equipos</h3>
                  <Laptop className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Instancia PostgreSQL dedicada para equipos que colaboran con múltiples agentes.
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{teamPrice}</span>
                  <span className="text-xs text-muted-foreground">/ mes {billing === "yearly" ? "(facturado anual)" : ""}</span>
                </div>

                <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Base de datos PostgreSQL dedicada de alto rendimiento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Miembros humanos y tokens de agentes ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Migración asistida desde Plane o Linear incluida</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>Dominio personalizado y soporte directo</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan("team")}
                className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                Solicitar Cloud Equipos
              </button>
            </div>
          </div>

          {/* Inline Cloud Activation / Waitlist Form */}
          {selectedPlan ? (
            <div
              role="region"
              aria-label="Activar suscripción Cloud"
              className="mx-auto mt-10 max-w-xl rounded-2xl border border-indigo-500/40 bg-card p-6 shadow-md"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {selectedPlan === "team"
                    ? `Activar Cloud Equipos (${teamPrice}/mes)`
                    : `Activar ProjectOS Cloud (${cloudPrice}/mes)`}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cerrar ✕
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Déjanos tu correo y te enviaremos el enlace de pago seguro y las credenciales de tu instancia privada lista con endpoint MCP.
              </p>

              {submitted ? (
                <div role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    ¡Listo! Se ha abierto tu cliente de correo para confirmar el alta.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si prefieres escribir directamente, envía un mensaje a{" "}
                    <a href={`mailto:${contactEmail}`} className="underline">
                      {contactEmail}
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCloudRequest} className="mt-4 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Tu correo electrónico
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    ¿Cómo planeas usarlo? (opcional)
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej. Proyectos personales con Claude Code y acceso desde portátil + PC"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Solicitar acceso y enlace de pago →
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <p>ProjectOS · Creado por Ezequiel Menor · Licencia MIT</p>
          <div className="flex items-center gap-4">
            <Link href={`/${defaultProjectKey}/board`} className="hover:text-foreground">
              Tablero Demo
            </Link>
            <a href="#instalar" className="hover:text-foreground">
              Instalación
            </a>
            <a href="#precios" className="hover:text-foreground">
              Precios Cloud
            </a>
            <a
              href="https://github.com/EzequielMenor/ProjectOS"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
