import { getTableName, sql } from "drizzle-orm";
import { getDb, isDemoMode, type Db } from "@/db/client";
import * as s from "@/db/schema";
import { ServiceError } from "../errors";
import { resetWorkspaceCache } from "./workspace";

export { isDemoMode };

const ALL_TABLES = [
  s.workspace,
  s.member,
  s.apiToken,
  s.project,
  s.state,
  s.cycle,
  s.module,
  s.milestone,
  s.issue,
  s.issueModule,
  s.propertyDef,
  s.issuePropertyValue,
  s.label,
  s.issueLabel,
  s.issueRelation,
  s.comment,
  s.issueLink,
  s.savedView,
  s.page,
  s.pageVersion,
  s.pageIssueLink,
  s.pagePageLink,
  s.activity,
] as const;

/**
 * Seeds the database with a rich, realistic demo workspace (projects, epics, Kanban issues,
 * agent evidence links, comments, custom properties, cycles, modules, milestones, and linked docs)
 * if no projects exist yet. Safe to call during DB initialization because it uses `db` directly.
 */
export async function seedDemoData(db: Db, opts: { force?: boolean } = {}) {
  if (!opts.force) {
    const existing = await db.select({ n: sql<number>`count(*)::int` }).from(s.project);
    if (existing[0]?.n > 0) return { seeded: false };
  }

  await db.transaction(async (tx) => {
    if (opts.force) {
      await tx.execute(
        sql`TRUNCATE ${sql.join(
          ALL_TABLES.map((t) => sql.identifier(getTableName(t))),
          sql`, `,
        )} CASCADE`,
      );
    }

    const [ws] = await tx
      .insert(s.workspace)
      .values({ slug: "default", name: "ProjectOS Demo Workspace" })
      .onConflictDoUpdate({ target: s.workspace.slug, set: { name: "ProjectOS Demo Workspace" } })
      .returning();

    const [humanEze, agentClaude, agentCursor] = await tx
      .insert(s.member)
      .values([
        { workspaceId: ws.id, name: "Ezequiel Menor", email: "ezequiel@projectos.dev", kind: "human" },
        { workspaceId: ws.id, name: "claude-code", kind: "agent" },
        { workspaceId: ws.id, name: "cursor-agent", kind: "agent" },
      ])
      .returning();

    const [projPos, projWeb] = await tx
      .insert(s.project)
      .values([
        {
          id: "00000000-0000-4000-8000-000000000001",
          workspaceId: ws.id,
          identifier: "POS",
          name: "ProjectOS Core",
          description: "Motor local-first, servidor MCP con 41 herramientas sin borrado y tablero de alta velocidad para agentes de IA.",
          color: "#6366f1",
          status: "active",
          issueCounter: 10,
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          workspaceId: ws.id,
          identifier: "WEB",
          name: "Landing & ProjectOS Cloud",
          description: "Sitio público de demostración en Vercel, guía de instalación en 1 minuto y plataforma gestionada ProjectOS Cloud.",
          color: "#10b981",
          status: "active",
          issueCounter: 4,
        },
      ])
      .returning();

    const stateDefs: { name: string; group: s.StateGroup; color: string; isDefault?: boolean }[] = [
      { name: "Backlog", group: "backlog", color: "#94a3b8" },
      { name: "Todo", group: "unstarted", color: "#64748b", isDefault: true },
      { name: "In Progress", group: "started", color: "#f59e0b" },
      { name: "Done", group: "completed", color: "#22c55e" },
      { name: "Cancelled", group: "cancelled", color: "#ef4444" },
    ];

    const posStates = await tx
      .insert(s.state)
      .values(
        stateDefs.map((st, idx) => ({
          projectId: projPos.id,
          name: st.name,
          group: st.group,
          color: st.color,
          position: idx * 1000,
          isDefault: st.isDefault ? 1 : 0,
        })),
      )
      .returning();

    const webStates = await tx
      .insert(s.state)
      .values(
        stateDefs.map((st, idx) => ({
          projectId: projWeb.id,
          name: st.name,
          group: st.group,
          color: st.color,
          position: idx * 1000,
          isDefault: st.isDefault ? 1 : 0,
        })),
      )
      .returning();

    const posStateByGroup = Object.fromEntries(posStates.map((st) => [st.group, st])) as Record<s.StateGroup, (typeof posStates)[number]>;
    const webStateByGroup = Object.fromEntries(webStates.map((st) => [st.group, st])) as Record<s.StateGroup, (typeof webStates)[number]>;

    // Labels for POS
    const [lblMcp, lblUi, lblSec, lblPerf, lblDocs] = await tx
      .insert(s.label)
      .values([
        { projectId: projPos.id, name: "mcp", color: "#8b5cf6" },
        { projectId: projPos.id, name: "interfaz", color: "#3b82f6" },
        { projectId: projPos.id, name: "seguridad", color: "#ef4444" },
        { projectId: projPos.id, name: "rendimiento", color: "#10b981" },
        { projectId: projPos.id, name: "docs", color: "#f59e0b" },
      ])
      .returning();

    // Custom properties for POS
    const [propEnv, propImpact, propAgentMins] = await tx
      .insert(s.propertyDef)
      .values([
        {
          projectId: projPos.id,
          name: "Entorno",
          type: "select",
          options: ["Local", "Vercel Demo", "ProjectOS Cloud"],
          position: 1000,
        },
        {
          projectId: projPos.id,
          name: "Impacto",
          type: "select",
          options: ["Crítico", "Alto", "Medio"],
          position: 2000,
        },
        {
          projectId: projPos.id,
          name: "Tiempo Agente (min)",
          type: "number",
          options: [],
          position: 3000,
        },
      ])
      .returning();

    // Cycles, Modules & Milestones for POS
    const [cycleCurrent, cyclePrev] = await tx
      .insert(s.cycle)
      .values([
        {
          projectId: projPos.id,
          name: "Ciclo 4 · Demo Interactiva & Cloud",
          description: "Preparar experiencia sandbox en Vercel, guía de instalación rápida y arquitectura multi-instancia para Cloud.",
          startDate: "2026-11-01",
          endDate: "2026-11-15",
        },
        {
          projectId: projPos.id,
          name: "Ciclo 3 · Gobernanza de Agentes MCP",
          description: "Acuerdo de trabajo automático, evidencias de commit/PR y permisos read/write sin borrado.",
          startDate: "2026-10-15",
          endDate: "2026-10-31",
        },
      ])
      .returning();

    const [modMcp, modUi, modCloud] = await tx
      .insert(s.module)
      .values([
        {
          projectId: projPos.id,
          name: "Motor MCP & Herramientas IA",
          description: "41 herramientas expuestas vía HTTP MCP y REST para Claude Code y clientes compatibles.",
          status: "in_progress",
          startDate: "2026-10-10",
          targetDate: "2026-11-10",
        },
        {
          projectId: projPos.id,
          name: "Tablero & Experiencia Linear",
          description: "Vistas Lista, Kanban y Tabla con filtros combinados, vistas guardadas y paleta Ctrl+K.",
          status: "completed",
          startDate: "2026-10-01",
          targetDate: "2026-10-28",
        },
        {
          projectId: projPos.id,
          name: "ProjectOS Cloud (SaaS)",
          description: "Instancias gestionadas 24/7 en servidor con endpoint MCP remoto y copias en la nube.",
          status: "planned",
          startDate: "2026-11-05",
          targetDate: "2026-12-01",
        },
      ])
      .returning();

    const [msV1, msV2] = await tx
      .insert(s.milestone)
      .values([
        {
          projectId: projPos.id,
          name: "v0.1.0 · Lanzamiento Open Source",
          description: "Primera versión pública estable 100% local con PGlite y servicio systemd.",
          targetDate: "2026-10-28",
        },
        {
          projectId: projPos.id,
          name: "v0.2.0 · Demo en Vercel & Plan Cloud",
          description: "Sandbox interactivo para portfolio y apertura del plan mensual ProjectOS Cloud.",
          targetDate: "2026-11-20",
        },
      ])
      .returning();

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

    // Epics in POS (inserted first so child issues can reference parentId)
    const [epicMcp, epicUx] = await tx
      .insert(s.issue)
      .values([
        {
          projectId: projPos.id,
          seq: 1,
          type: "epic",
          title: "Gobernanza autónoma de agentes IA por MCP",
          description:
            "Permitir que **Claude Code** y otros agentes consulten `next_work`, tomen tareas por prioridad, registren avances con pruebas verificables (commits, PR, tests) y cierren issues sin tener herramientas destructivas de borrado.",
          stateId: posStateByGroup.started.id,
          priority: "urgent",
          assigneeId: agentClaude.id,
          cycleId: cycleCurrent.id,
          milestoneId: msV2.id,
          startDate: "2026-10-15",
          dueDate: "2026-11-15",
          sortOrder: 1000,
          createdBy: "user",
          createdAt: daysAgo(12),
        },
        {
          projectId: projPos.id,
          seq: 6,
          type: "epic",
          title: "Interfaz ultrarrápida estilo Linear y Demo en vivo",
          description:
            "Experiencia fluida con teclado (`C` para crear, `Ctrl K` para saltar a cualquier issue o documento), vistas Kanban/Lista/Tabla y modo sandbox en memoria para probar desde el navegador.",
          stateId: posStateByGroup.started.id,
          priority: "high",
          assigneeId: humanEze.id,
          cycleId: cycleCurrent.id,
          milestoneId: msV2.id,
          startDate: "2026-10-20",
          dueDate: "2026-11-18",
          sortOrder: 2000,
          createdBy: "user",
          createdAt: daysAgo(10),
        },
      ])
      .returning();

    // Child & standalone issues in POS
    const [iss2, iss3, iss4, iss5, iss7, iss8] = await tx
      .insert(s.issue)
      .values([
        {
          projectId: projPos.id,
          seq: 2,
          type: "issue",
          title: "Servidor HTTP MCP en /api/mcp con 41 herramientas y scopes read/write",
          description:
            "Exponer todas las operaciones de proyectos, issues, estados, comentarios, enlaces de evidencia y planificación sin incluir ninguna herramienta de borrado (`delete_*`).\n\n### Criterios verificados\n- Autenticación por token Bearer (`pos_...`) con hash SHA-256.\n- Registro de auditoría automático con `agent:<nombre>`.",
          stateId: posStateByGroup.completed.id,
          priority: "urgent",
          parentId: epicMcp.id,
          assigneeId: agentClaude.id,
          cycleId: cyclePrev.id,
          milestoneId: msV1.id,
          estimate: 5,
          sortOrder: 1000,
          completedAt: daysAgo(5),
          createdBy: "agent:claude-code",
          createdAt: daysAgo(9),
        },
        {
          projectId: projPos.id,
          seq: 3,
          type: "issue",
          title: "Herramienta next_work para priorización inteligente del agente",
          description:
            "Cuando un agente se conecta sin contexto, `next_work` devuelve las tareas en curso asignadas a él y las siguientes urgentes desbloqueadas para que empiece sin preguntar qué toca hacer.",
          stateId: posStateByGroup.completed.id,
          priority: "high",
          parentId: epicMcp.id,
          assigneeId: agentClaude.id,
          cycleId: cyclePrev.id,
          milestoneId: msV1.id,
          estimate: 3,
          sortOrder: 2000,
          completedAt: daysAgo(3),
          createdBy: "agent:claude-code",
          createdAt: daysAgo(7),
        },
        {
          projectId: projPos.id,
          seq: 4,
          type: "issue",
          title: "Modo Demo Sandbox con PGlite en memoria para despliegue gratuito en Vercel",
          description:
            "Permitir que cualquier visitante del portfolio pruebe el tablero Kanban, mueva tarjetas, filtre issues y explore la documentación interactiva sin necesidad de base de datos externa.\n\n- Incluye botón **Reiniciar datos** en la barra superior.\n- Acceso directo a la guía de instalación y planes de **ProjectOS Cloud**.",
          stateId: posStateByGroup.started.id,
          priority: "urgent",
          parentId: epicUx.id,
          assigneeId: agentClaude.id,
          cycleId: cycleCurrent.id,
          milestoneId: msV2.id,
          estimate: 3,
          sortOrder: 500,
          createdBy: "user",
          createdAt: daysAgo(2),
        },
        {
          projectId: projPos.id,
          seq: 5,
          type: "issue",
          title: "Endpoint MCP remoto multi-workspace para suscriptores de ProjectOS Cloud",
          description:
            "Aislar cada instancia de cliente en el servidor gestionado para que los usuarios del plan mensual puedan conectar Claude Code y Cursor desde cualquier equipo sin abrir puertos ni mantener un proceso local.",
          stateId: posStateByGroup.unstarted.id,
          priority: "high",
          parentId: epicMcp.id,
          assigneeId: humanEze.id,
          cycleId: cycleCurrent.id,
          milestoneId: msV2.id,
          estimate: 8,
          sortOrder: 1000,
          createdBy: "user",
          createdAt: daysAgo(2),
        },
        {
          projectId: projPos.id,
          seq: 7,
          type: "issue",
          title: "Paleta de comandos (Ctrl+K) con búsqueda instantánea de issues y páginas",
          description:
            "Saltar en milisegundos a cualquier issue por clave (`POS-2`), cambiar de vista, alternar tema claro/oscuro o abrir documentos vinculados.",
          stateId: posStateByGroup.completed.id,
          priority: "high",
          parentId: epicUx.id,
          assigneeId: humanEze.id,
          cycleId: cyclePrev.id,
          milestoneId: msV1.id,
          estimate: 3,
          sortOrder: 3000,
          completedAt: daysAgo(4),
          createdBy: "user",
          createdAt: daysAgo(8),
        },
        {
          projectId: projPos.id,
          seq: 8,
          type: "issue",
          title: "Documentos Markdown con backlinks [[POS-2]] e historial de versiones no destructivo",
          description:
            "Cada edición de un documento guarda la versión anterior en `page_version`. Las menciones `[[POS-2]]` crean referencias bidireccionales visibles desde la ficha del issue.",
          stateId: posStateByGroup.started.id,
          priority: "medium",
          parentId: epicUx.id,
          assigneeId: agentCursor.id,
          cycleId: cycleCurrent.id,
          milestoneId: msV1.id,
          estimate: 5,
          sortOrder: 1500,
          createdBy: "agent:cursor-agent",
          createdAt: daysAgo(4),
        },
        {
          projectId: projPos.id,
          seq: 9,
          type: "issue",
          title: "Webhook de notificaciones cuando un agente completa una épica",
          description:
            "Enviar un resumen opcional por Telegram/Discord o correo cuando el agente marque todas las subtareas de una épica como completadas.",
          stateId: posStateByGroup.unstarted.id,
          priority: "medium",
          parentId: epicMcp.id,
          assigneeId: agentCursor.id,
          cycleId: cycleCurrent.id,
          milestoneId: msV2.id,
          estimate: 2,
          sortOrder: 2000,
          createdBy: "user",
          createdAt: daysAgo(1),
        },
        {
          projectId: projPos.id,
          seq: 10,
          type: "issue",
          title: "Sincronización bidireccional opcional con GitHub Issues y Pull Requests",
          description:
            "Vincular automáticamente un PR de GitHub cuando en la descripción o rama aparezca el identificador `POS-X`.",
          stateId: posStateByGroup.backlog.id,
          priority: "low",
          assigneeId: null,
          estimate: 5,
          sortOrder: 1000,
          createdBy: "user",
          createdAt: daysAgo(1),
        },
      ])
      .returning();

    // Issues in second project (WEB)
    await tx.insert(s.issue).values([
      {
        projectId: projWeb.id,
        seq: 1,
        type: "issue",
        title: "Publicar demo interactiva conectada desde el portfolio personal",
        description: "Enlace directo al tablero con datos precargados para que reclutadores, clientes y desarrolladores puedan probar ProjectOS al instante.",
        stateId: webStateByGroup.completed.id,
        priority: "urgent",
        assigneeId: humanEze.id,
        completedAt: daysAgo(1),
        sortOrder: 1000,
        createdBy: "user",
      },
      {
        projectId: projWeb.id,
        seq: 2,
        type: "issue",
        title: "Guía interactiva de instalación local y conexión con Claude Code en 1 minuto",
        description: "Página `/welcome` con comandos listos para copiar y pegar tanto para uso local gratuito como para configurar el cliente MCP.",
        stateId: webStateByGroup.started.id,
        priority: "high",
        assigneeId: agentClaude.id,
        sortOrder: 1000,
        createdBy: "agent:claude-code",
      },
      {
        projectId: projWeb.id,
        seq: 3,
        type: "issue",
        title: "Pasarela de suscripción mensual para ProjectOS Cloud (Servidor 24/7)",
        description: "Ofrecer plan Cloud gestionado para usuarios que prefieren no instalar nada en local y tener su endpoint MCP siempre disponible en internet.",
        stateId: webStateByGroup.unstarted.id,
        priority: "high",
        assigneeId: humanEze.id,
        sortOrder: 1000,
        createdBy: "user",
      },
      {
        projectId: projWeb.id,
        seq: 4,
        type: "issue",
        title: "Comparativa visual: ProjectOS vs Linear / Plane para flujos con agentes IA",
        description: "Explicar por qué un modelo de permisos sin borrado y con evidencia obligatoria es más seguro para agentes autónomos.",
        stateId: webStateByGroup.backlog.id,
        priority: "medium",
        assigneeId: agentCursor.id,
        sortOrder: 1000,
        createdBy: "user",
      },
    ]);

    // Module links
    await tx.insert(s.issueModule).values([
      { issueId: epicMcp.id, moduleId: modMcp.id },
      { issueId: iss2.id, moduleId: modMcp.id },
      { issueId: iss3.id, moduleId: modMcp.id },
      { issueId: iss5.id, moduleId: modCloud.id },
      { issueId: epicUx.id, moduleId: modUi.id },
      { issueId: iss4.id, moduleId: modUi.id },
      { issueId: iss7.id, moduleId: modUi.id },
      { issueId: iss8.id, moduleId: modUi.id },
    ]);

    // Labels on POS issues
    await tx.insert(s.issueLabel).values([
      { issueId: epicMcp.id, labelId: lblMcp.id },
      { issueId: iss2.id, labelId: lblMcp.id },
      { issueId: iss2.id, labelId: lblSec.id },
      { issueId: iss3.id, labelId: lblMcp.id },
      { issueId: iss4.id, labelId: lblUi.id },
      { issueId: iss4.id, labelId: lblPerf.id },
      { issueId: iss5.id, labelId: lblMcp.id },
      { issueId: iss5.id, labelId: lblSec.id },
      { issueId: iss7.id, labelId: lblUi.id },
      { issueId: iss8.id, labelId: lblDocs.id },
    ]);

    // Custom property values
    await tx.insert(s.issuePropertyValue).values([
      { issueId: iss2.id, propertyId: propEnv.id, value: "Local" },
      { issueId: iss2.id, propertyId: propImpact.id, value: "Crítico" },
      { issueId: iss2.id, propertyId: propAgentMins.id, value: 18 },
      { issueId: iss3.id, propertyId: propEnv.id, value: "Local" },
      { issueId: iss3.id, propertyId: propImpact.id, value: "Alto" },
      { issueId: iss3.id, propertyId: propAgentMins.id, value: 11 },
      { issueId: iss4.id, propertyId: propEnv.id, value: "Vercel Demo" },
      { issueId: iss4.id, propertyId: propImpact.id, value: "Crítico" },
      { issueId: iss4.id, propertyId: propAgentMins.id, value: 9 },
      { issueId: iss5.id, propertyId: propEnv.id, value: "ProjectOS Cloud" },
      { issueId: iss5.id, propertyId: propImpact.id, value: "Alto" },
    ]);

    // Issue relations
    await tx.insert(s.issueRelation).values([
      { issueId: iss4.id, relatedIssueId: iss5.id, type: "blocks" },
      { issueId: iss2.id, relatedIssueId: iss3.id, type: "relates" },
    ]);

    // Evidence links added by agents
    await tx.insert(s.issueLink).values([
      {
        issueId: iss2.id,
        kind: "commit",
        url: "https://github.com/EzequielMenor/ProjectOS/commit/a4f92c1",
        title: "feat(mcp): expose 41 non-destructive tools over HTTP transport",
        actor: "agent:claude-code",
      },
      {
        issueId: iss2.id,
        kind: "evidence",
        url: "https://github.com/EzequielMenor/ProjectOS/actions/runs/10042",
        title: "Vitest + Playwright E2E: 100% passing (mcp.spec.ts)",
        actor: "agent:claude-code",
      },
      {
        issueId: iss3.id,
        kind: "commit",
        url: "https://github.com/EzequielMenor/ProjectOS/commit/c81e4b9",
        title: "feat(work): rank in-progress and unblocked urgent issues in next_work",
        actor: "agent:claude-code",
      },
      {
        issueId: iss4.id,
        kind: "pr",
        url: "https://github.com/EzequielMenor/ProjectOS/pull/12",
        title: "feat(demo): in-memory PGlite sandbox & installation/cloud guide",
        actor: "agent:claude-code",
      },
    ]);

    // Comments showing human + AI agent collaboration
    await tx.insert(s.comment).values([
      {
        issueId: iss2.id,
        actor: "agent:claude-code",
        body: "He implementado el transporte HTTP MCP en `/api/mcp` y verificado que ningún endpoint exponga borrado físico de issues ni proyectos. Adjunto el commit `a4f92c1` y la ejecución de `tests/e2e/mcp.spec.ts` en verde.",
        createdAt: daysAgo(6),
      },
      {
        issueId: iss2.id,
        actor: "Ezequiel Menor",
        body: "Revisado. El panel de **Tokens de API** genera directamente el bloque de configuración para Claude Code. Cierro la tarea.",
        createdAt: daysAgo(5),
      },
      {
        issueId: iss4.id,
        actor: "agent:claude-code",
        body: "Tomada vía `next_work`. Configurado `PGLITE_DIR=memory://` automático en modo demo para que funcione en Vercel gratis sin base de datos externa y con reinicio instantáneo.",
        createdAt: daysAgo(1),
      },
      {
        issueId: iss8.id,
        actor: "agent:cursor-agent",
        body: "Añadido el analizador de referencias `[[POS-2]]` para enlazar documentos e issues automáticamente.",
        createdAt: daysAgo(2),
      },
    ]);

    // Saved views in sidebar
    await tx.insert(s.savedView).values([
      {
        projectId: projPos.id,
        name: "Urgentes y Críticos",
        layout: "board",
        query: "priority=urgent",
      },
      {
        projectId: projPos.id,
        name: "En curso (Agentes)",
        layout: "list",
        query: `state=${posStateByGroup.started.id}`,
      },
    ]);

    // Markdown documentation pages with bidirectional links
    const [pageGuide, pageArch] = await tx
      .insert(s.page)
      .values([
        {
          projectId: projPos.id,
          title: "Guía de la Demo Interactiva",
          content: `# Bienvenido a la Demo de ProjectOS

Estás usando **ProjectOS** en vivo. Esta instancia corre con **PostgreSQL embebido en memoria (PGlite)**, así que puedes probar todo sin miedo a romper nada:

1. **Mueve tarjetas en el Kanban**: ve a la vista **Kanban** y arrastra [[POS-4]] o [[POS-5]] entre columnas.
2. **Inspecciona cómo trabaja un agente**: abre [[POS-2]] para ver cómo \`agent:claude-code\` deja commits, pruebas y comentarios de avance.
3. **Usa la paleta rápida**: pulsa \`Ctrl K\` (o \`Cmd K\`) desde cualquier pantalla para buscar issues o documentos al instante.
4. **Crea un issue nuevo**: pulsa el botón **Nuevo issue** y asígnalo a \`claude-code\` o \`cursor-agent\`.

¿Quieres conocer cómo se conectan los agentes por dentro? Lee [[Arquitectura MCP y Gobernanza de Agentes]].

---

### ¿Te gusta cómo funciona?
Puedes **instalarlo gratis en tu ordenador en 1 minuto** o apuntarte a **ProjectOS Cloud** (servidor encendido 24/7 listo para conectar tus agentes desde cualquier lugar) desde el botón superior **«Cómo instalar / Cloud»**.`,
          createdBy: "Ezequiel Menor",
          createdAt: daysAgo(3),
          updatedAt: daysAgo(1),
        },
        {
          projectId: projPos.id,
          title: "Arquitectura MCP y Gobernanza de Agentes",
          content: `# Arquitectura MCP y Gobernanza de Agentes

ProjectOS parte de una idea sencilla: **los humanos planifican y supervisan; los agentes de IA ejecutan y mantienen el tablero al día**.

## Principios de seguridad (épica [[POS-1]])

- **Sin herramientas de borrado**: a través de \`/api/mcp\` (implementado en [[POS-2]]), un agente con permiso \`write\` puede crear tareas, mover estados, documentar en páginas y añadir evidencias, pero **nunca puede borrar issues, proyectos ni copias de seguridad**.
- **Flujo autónomo con \`next_work\`**: como se detalla en [[POS-3]], el agente consulta qué tareas tiene en curso o desbloqueadas y trabaja con contexto real.
- **Trazabilidad total**: cada cambio queda registrado en el historial como \`agent:claude-code\` junto con el enlace al commit o PR.

Volver a [[Guía de la Demo Interactiva]].`,
          createdBy: "agent:claude-code",
          createdAt: daysAgo(5),
          updatedAt: daysAgo(2),
        },
      ])
      .returning();

    await tx.insert(s.pageVersion).values({
      pageId: pageArch.id,
      title: "Arquitectura MCP y Gobernanza de Agentes",
      content: "# Arquitectura MCP\n\nVersión inicial redactada por el agente tras completar [[POS-2]].",
      actor: "agent:claude-code",
      createdAt: daysAgo(5),
    });

    await tx.insert(s.pageIssueLink).values([
      { pageId: pageGuide.id, issueId: iss4.id },
      { pageId: pageGuide.id, issueId: iss5.id },
      { pageId: pageGuide.id, issueId: iss2.id },
      { pageId: pageArch.id, issueId: epicMcp.id },
      { pageId: pageArch.id, issueId: iss2.id },
      { pageId: pageArch.id, issueId: iss3.id },
    ]);

    await tx.insert(s.pagePageLink).values([
      { pageId: pageGuide.id, targetPageId: pageArch.id },
      { pageId: pageArch.id, targetPageId: pageGuide.id },
    ]);

    // Activity entries for rich audit trail on issues
    await tx.insert(s.activity).values([
      {
        projectId: projPos.id,
        issueId: iss2.id,
        actor: "agent:claude-code",
        action: "issue.created",
        data: { key: "POS-2", title: iss2.title },
        createdAt: daysAgo(9),
      },
      {
        projectId: projPos.id,
        issueId: iss2.id,
        actor: "agent:claude-code",
        action: "link.added",
        data: { kind: "commit", url: "https://github.com/EzequielMenor/ProjectOS/commit/a4f92c1" },
        createdAt: daysAgo(6),
      },
      {
        projectId: projPos.id,
        issueId: iss2.id,
        actor: "Ezequiel Menor",
        action: "issue.updated",
        data: { changes: { stateId: { from: posStateByGroup.started.id, to: posStateByGroup.completed.id } } },
        createdAt: daysAgo(5),
      },
      {
        projectId: projPos.id,
        issueId: iss4.id,
        actor: "agent:claude-code",
        action: "issue.updated",
        data: { changes: { assignee: { from: null, to: "claude-code" } } },
        createdAt: daysAgo(1),
      },
    ]);
  });

  resetWorkspaceCache();
  return { seeded: true };
}

/** Resets all demo data back to the clean initial state. Only allowed when Demo Mode is active. */
export async function resetDemoData() {
  if (!isDemoMode()) {
    throw new ServiceError("forbidden", "El reinicio de datos de demostración solo está disponible en el modo demo");
  }
  const db = await getDb();
  return seedDemoData(db, { force: true });
}
