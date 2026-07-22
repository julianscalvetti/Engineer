# Engineer Repository Operating Contract

## Identidad del repositorio

Engineer es una plataforma industrial que transforma fuentes heterogeneas en contexto industrial estructurado, analitica controlada e interfaces seguras.

## Aplicacion activa

La aplicacion Next.js activa esta en:

- `app/`
- `components/`
- `lib/`
- `package.json` de la raiz

`design/references/template-v0/` no es una segunda aplicacion activa. Es exclusivamente una referencia visual y no debe utilizarse como fuente de arquitectura, rutas, dependencias o configuracion del producto.

## Fuentes de verdad

- `product/`: alcance, decisiones, flujos e inventario de pantallas.
- `docs/current/`: estado tecnico vigente, arquitectura y checkpoints actuales.
- `docs/legacy/`: documentacion historica; no usar para tomar decisiones actuales salvo pedido explicito.
- `supabase/migrations/`: schema ejecutable y evolucion real de base de datos.
- `database/domain-model/`: modelo conceptual; no ejecutar como migracion.
- `src/ingestion/`: codigo generico del pipeline de ingestion, profiler, mapping y persistencia.
- `config/ingestion/companies/romet/`: configuracion especifica del piloto ROMET; no convertir en logica generica.
- `mcp/` y `lib/engineer/`: servidor MCP y primitivas controladas.
- `design/`: documentacion y referencias visuales; no es codigo de produccion salvo que una tarea lo indique expresamente.

## Seguridad

- No acceder ni modificar `.env.local`.
- No versionar secretos.
- No versionar `data/raw/`.
- No conectar migraciones automaticamente contra bases remotas.
- Mantener separacion multi-tenant, RLS y minimo privilegio.
- MCP y agente deben permanecer read-only salvo decision explicita documentada.

## Restricciones de trabajo

- No mover o eliminar archivos historicos sin autorizacion.
- No convertir codigo ROMET en reglas universales.
- No reemplazar el schema ejecutable con el modelo conceptual.
- No tratar el template visual como aplicacion activa.
- No realizar refactors fuera del alcance de la tarea.
- Antes de cambiar arquitectura, revisar `product/` y `docs/current/`.
- Informar contradicciones entre documentacion y codigo en lugar de elegir silenciosamente una version.

## Validaciones generales

Cuando corresponda ejecutar:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Usar tests especificos adicionales para ingestion, Supabase y MCP segun el dominio modificado.
