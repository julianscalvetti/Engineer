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
