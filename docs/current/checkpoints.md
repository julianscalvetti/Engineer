# Checkpoints

## 2026-07-17 - Motor de Perfilado y Diagnostico v1 congelado

- Commit: `4682511bf43a6ac8988f1edeed02a11f667c4acc`
- Tag: `checkpoint/mp-v1-frozen`
- Alcance:
  - Technical Profiler para archivos `.xlsx` en modo lectura.
  - Semantic Mapping & Diagnosis Engine basado en configuracion YAML.
  - Mapping Execution Preview con diagnostico trazable.
  - Contrato frozen del Motor v1.
  - Configuraciones versionadas por empresa para ROMET y casos multiindustria.
- Validaciones:
  - `npm.cmd test`
  - `git diff --cached --check`
  - Verificacion de que no se stagearon `data/raw/` ni `data/reports/`.
- Pendientes operativos:
  - No aplicar migraciones como parte de este checkpoint.
  - Mantener archivos RAW y reportes fuera de Git.
  - No modificar el Motor v1 salvo brecha generica posterior aprobada.

## 2026-07-17 - DA-00/DA-01 schema listo para DA-02

- Commit: `checkpoint/da-01-schema-ready`
- Tag: `checkpoint/da-01-schema-ready`
- Alcance:
  - DA-00: modelo usuario, empresa, planta y membership por empresa.
  - DA-00: RLS de lectura por membership y bootstrap controlado ROMET.
  - DA-01: tablas de importacion `import_batches`, `import_files` e `import_issues`.
  - DA-01: trazabilidad de lote, archivo, hoja, fila, celda, mapping y estado de registro fuente.
  - DA-01: contrato TypeScript minimo de persistencia sin inserts ni commit operativo.
- Validaciones:
  - Revision estatica de migraciones y tests SQL.
  - `git diff --cached --check`
  - Verificacion de que no se aplicaron migraciones.
  - Verificacion de que no se stagearon `data/raw/` ni `data/reports/`.
- Pendientes operativos:
  - Ejecutar migraciones en entorno Supabase controlado cuando corresponda.
  - Ejecutar `supabase/tests/da_00_rls_access.sql` despues de aplicar DA-00.
  - Ejecutar `supabase/tests/da_01_import_traceability.sql` despues de aplicar DA-01.
  - Resolver `AUTH_USER_ID` real antes del bootstrap ROMET.
  - DA-02 debe partir de los tags `checkpoint/mp-v1-frozen` y `checkpoint/da-01-schema-ready`.

## 2026-07-18 - DA-03 analytics agregados e historial paginado

- Commit: ver tag `checkpoint/da-03-analytics-ready`.
- Tag: `checkpoint/da-03-analytics-ready`.
- Alcance:
  - RPC `da_03_dashboard_summary` para dashboard agregado sin transferir controles individuales.
  - RPC `da_03_control_history_page` para historial paginado server-side.
  - Indices DA-03 sobre `controls` y `control_failures` para filtros por tenant, planta, fecha, operacion y modo de falla.
  - Dashboard conectado a metricas agregadas y series necesarias.
  - Historial con rango por defecto de 14 dias calendario, orden descendente, maximo 200 filas por pagina y filtros server-side por fecha, cliente, pieza, operacion y modo de falla.
  - Contratos TypeScript y componentes relacionados para datos agregados, paginacion y filtros.
- Metricas antes/despues:
  - Antes: la capa web cargaba `19.425` controles completos; medicion previa aproximada `34.896 ms`.
  - Despues dashboard: `419 ms`, `469` filas agregadas transferidas, sin controles individuales.
  - Despues historial default: `1.205 ms`, rango `2026-07-05` a `2026-07-18`, `0` controles transferidos porque no hay controles en ese rango.
  - Cambio de pagina: `1.189 ms`, `0` controles transferidos en el rango default.
  - Filtro sobre rango con datos ROMET `2026-06-18` a `2026-07-01`: `1.366 ms`, `2` controles transferidos.
- Reconciliacion:
  - Controles: `19.425`.
  - Piezas inspeccionadas: `2.225.365`.
  - Defectos: `257.090`.
  - DPU: `0.11552711577651306`.
  - Los indicadores agregados coinciden con los valores actuales.
- Validacion RLS/acceso:
  - Frontend sin `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_DB_URL`.
  - Owner `e7de00f7-8840-48f8-a2b5-ff03447199b4` puede leer ROMET mediante cliente autenticado.
  - Usuario autenticado sin membership `606de970-dab3-4d9b-90bc-16870fcbe0e0` obtiene `0` filas en lectura directa de `controls` y `0` filas en RPC de historial.
  - Las RPC usan cliente autenticado y guard explicito por `company_members`.
- Riesgo menor:
  - El rango default de 14 dias calendario puede abrir vacio si la ultima fecha importada no cae dentro de los ultimos 14 dias reales. Se mantiene como comportamiento correcto para cumplir el requisito; el usuario puede ampliar el rango con filtros server-side.
- Validaciones:
  - `npm.cmd run lint`
  - `npm.cmd exec tsc -- --noEmit --incremental false`
  - `npm.cmd test`
  - `git diff --check`
