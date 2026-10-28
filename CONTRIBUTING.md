# Contribuir a ProjectOS

Gracias por el interés. ProjectOS es un proyecto pequeño y mantenido por una persona, así que lo mejor es empezar por un issue.

## Antes de abrir un PR

1. Abre un issue describiendo el cambio (o comenta en uno existente) para no duplicar trabajo.
2. Prepara el entorno según [`docs/development.md`](docs/development.md).
3. Comprueba que todo pasa:

   ```bash
   pnpm typecheck && pnpm lint
   pnpm test        # unitarios
   pnpm test:e2e    # interfaz (si tocas la UI)
   ```

4. Mantén el PR pequeño y enfocado, y escribe tests para la lógica nueva.

## Principios del proyecto

- **Local-first:** los datos viven en `./data`; no se añaden dependencias de nube.
- **Agentes sin borrado:** las herramientas MCP/REST no borran; archivar es reversible. La estructura sensible (renombrar o borrar proyectos y estados, tokens, copias) queda para la persona.
- **Seguridad:** lee [`docs/security.md`](docs/security.md). Si encuentras una vulnerabilidad, no la publiques en un issue: avisa por privado al autor.

## Licencia

Al contribuir aceptas que tu aportación se publique bajo la licencia [MIT](LICENSE) del proyecto.
