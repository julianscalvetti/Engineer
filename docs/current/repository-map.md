# Repository Map

## Arbol resumido

```text
app/                         Aplicacion Next.js activa
components/                  Componentes de la aplicacion activa
lib/                         Logica compartida de web, Supabase, tenant, assistant y Engineer
src/ingestion/               Pipeline generico de profiler, mapping y persistencia
config/ingestion/            Configuraciones versionadas por empresa
supabase/                    Migraciones, seeds y pruebas SQL
database/domain-model/       Modelo industrial conceptual
mcp/                         Servidor MCP Engineer y bundle metadata
product/                     Alcance, decisiones, flujos e inventario de producto
docs/current/                Documentacion tecnica vigente
docs/legacy/                 Documentacion historica
design/                      Referencias visuales y screenshots
data/                        Datos locales ignorados; no fuente de producto
archive/                     Respaldos locales o material archivado
```

## Responsabilidad por carpeta

- `app/`, `components/`, `lib/` y el `package.json` de la raiz definen la aplicacion web activa.
- `src/ingestion/` contiene codigo generico y reutilizable del pipeline.
- `config/ingestion/companies/romet/` contiene configuracion especifica del piloto ROMET.
- `supabase/migrations/` define la evolucion ejecutable de la base.
- `database/domain-model/` documenta el modelo conceptual industrial.
- `mcp/` y `lib/engineer/` exponen analitica controlada read-only.
- `design/references/template-v0/` es referencia visual, no aplicacion activa.

## Fuentes de verdad

- Producto: `product/`.
- Estado tecnico vigente: `docs/current/`.
- Historial: `docs/legacy/`.
- Schema ejecutable: `supabase/migrations/`.
- Modelo conceptual: `database/domain-model/`.
- Ingestion generica: `src/ingestion/`.
- Configuracion ROMET: `config/ingestion/companies/romet/`.
- MCP y analitica controlada: `mcp/` y `lib/engineer/`.

## Schema ejecutable vs modelo conceptual

`supabase/migrations/` es la fuente ejecutable. `database/domain-model/` es una referencia conceptual y no debe ejecutarse como migracion ni sincronizarse automaticamente con Supabase.

## Codigo generico vs configuracion ROMET

El motor compartido vive en `src/ingestion/`. Las decisiones, aliases, seleccion de fuentes y mapeos de ROMET viven en `config/ingestion/companies/romet/`. Una regla ROMET no debe moverse al motor salvo que se convierta en una capacidad generica, configurable y validada.

## Aplicacion activa vs template visual

La aplicacion activa esta en la raiz Next.js. `design/references/template-v0/` es una referencia visual excluida del tooling raiz y no debe aportar rutas, dependencias ni configuracion de producto.

## Validaciones principales

- General: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Ingestion: tests de profiler y semantic mapping.
- Supabase: revisar migraciones, seeds y tests SQL disponibles sin aplicar cambios remotos automaticamente.
- MCP: tests de primitives, typecheck y bundle MCP.

## Contenido local o ignorado

Nunca versionar ni usar como fuente de producto:

- `.env.local`
- `.next/`
- `dist/`
- `mcp/bundle/server/`
- `tsconfig.tsbuildinfo`
- `data/raw/`
- `data/reports/`
- archivos XLSX, XLSM o CSV reales
- `archive/git-broken-backup/`
