# Supabase

La infraestructura Supabase vigente esta definida por migraciones en `supabase/migrations`.

## Migraciones actuales

| Archivo | Contenido |
| --- | --- |
| `001_initial_schema.sql` | Modelo MVP inicial: `companies`, `plants`, `customers`, `products`, `operations`, `failure_modes`, `controls`, `control_failures`, `profiles` y triggers `updated_at`. |
| `002_da_00_user_company_plant_rls.sql` | DA-00: `company_members`, roles por empresa, bootstrap ROMET, indices y RLS de lectura por membership. |
| `003_da_01_romet_import_traceability.sql` | DA-01: tablas de importacion, trazabilidad por lote/archivo/origen, `company_id` y `plant_id` directo en tablas industriales. |

## Bootstrap ROMET

Para asociar un usuario autenticado existente con ROMET:

```sql
select *
from public.bootstrap_romet_owner(
  'AUTH_USER_ID'::uuid,
  'Nombre Usuario'
);
```

La funcion solo debe ejecutarse desde un contexto administrativo controlado. No se debe exponer una service key ni credenciales administrativas en el frontend.

Tambien queda disponible `supabase/bootstrap/da_00_romet_owner.sql` como script controlado con placeholder `AUTH_USER_ID`.

## Pruebas RLS

`supabase/tests/da_00_rls_access.sql` valida:

- owner accede a ROMET;
- otro usuario autenticado no accede;
- anonimo no accede.

`supabase/tests/da_01_import_traceability.sql` valida la estructura minima trazable para importacion y el aislamiento RLS de los nuevos artefactos.

## Documentacion relacionada

- `docs/current/da-00-user-company-plant-model.md`
- `docs/current/da-01-import-persistence-contract.md`
- `docs/current/database-model-mvp.md`
- `docs/current/auth-setup.md`
