# DA-00 - Usuario, empresa y planta

## Objetivo

DA-00 establece la estructura real de autorizacion para cargar datos ROMET en Supabase sin importar todavia datos industriales.

La cadena autorizada queda:

```text
auth.users
-> profiles
-> company_members
-> companies
-> plants
```

## Entidades reutilizadas

| Tabla | Estado | Uso |
| --- | --- | --- |
| `auth.users` | Existente en Supabase Auth | Identidad autenticada. |
| `public.profiles` | Reutilizada | Datos basicos del usuario y rol legacy de UI. |
| `public.companies` | Reutilizada | Empresa industrial. |
| `public.plants` | Reutilizada | Planta perteneciente a empresa. |

## Entidad creada

| Tabla | Campos clave | Uso |
| --- | --- | --- |
| `public.company_members` | `company_id`, `user_id`, `role`, `active` | Fuente de autorizacion por empresa. |

`company_members.role` usa el enum `public.company_member_role` con valores:

- `owner`
- `engineer`
- `operator`

## Reglas de autorizacion

- La autorizacion por empresa sale de `public.company_members`.
- `user_metadata` no se usa como fuente de autorizacion.
- `profiles.role` queda como rol legacy de navegacion de la app actual.
- El bootstrap DA-00 asigna `profiles.role = 'ingeniero'` para mantener compatibilidad con la shell actual, pero el acceso a datos de empresa se decide por membership.
- Usuarios anonimos no tienen politicas RLS de lectura.
- Usuarios autenticados solo pueden leer empresas donde tienen membership activo.

## Alcance industrial

Las tablas industriales actuales quedan protegidas por RLS siguiendo la cadena vigente:

```text
companies
-> plants
-> customers
-> products
-> operations
-> controls
-> control_failures

operations
-> failure_modes
```

Las futuras tablas industriales deben incluir:

- `company_id`, siempre que representen datos o configuracion de una empresa.
- `plant_id`, cuando el dato pertenezca o aplique a una planta concreta.

Si una tabla no guarda `company_id` directo por normalizacion, debe tener una ruta relacional obligatoria y eficiente hacia `companies.id`.

## Bootstrap controlado ROMET

La migracion `supabase/migrations/002_da_00_user_company_plant_rls.sql` agrega la funcion:

```sql
select *
from public.bootstrap_romet_owner(
  'AUTH_USER_ID'::uuid,
  'Nombre Usuario'
);
```

La funcion:

- exige que el usuario exista previamente en `auth.users`;
- crea o actualiza el `profile`;
- crea o reutiliza la empresa `ROMET`;
- crea o reutiliza la planta `Planta Principal`;
- crea o actualiza el membership como `owner`;
- no es ejecutable por roles `anon` ni `authenticated`.

Debe ejecutarse desde un contexto administrativo controlado, por ejemplo SQL editor o migracion operada por backend. No requiere exponer credenciales administrativas al frontend.

El archivo `supabase/bootstrap/da_00_romet_owner.sql` deja el comando listo con placeholder `AUTH_USER_ID`.

## RLS

La migracion habilita RLS y agrega politicas `select` para:

- `profiles`
- `companies`
- `company_members`
- `plants`
- `customers`
- `products`
- `operations`
- `failure_modes`
- `controls`
- `control_failures`

Las politicas usan funciones SQL `security definer` que verifican membership activo contra `auth.uid()`.

DA-00 no agrega politicas de escritura para frontend. Las escrituras quedan cerradas por defecto bajo RLS hasta definir permisos explicitos por rol.

## Pruebas

El archivo `supabase/tests/da_00_rls_access.sql` valida:

- un usuario owner accede a `ROMET`;
- otro usuario autenticado sin membership no accede;
- un usuario anonimo no accede.

## Documentacion relacionada

- `docs/current/database-model-mvp.md`
- `docs/current/domain-model-mvp.md`
- `docs/current/auth-setup.md`
- `docs/current/ingestion-pipeline-v2.1.md`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_da_00_user_company_plant_rls.sql`
- `supabase/bootstrap/da_00_romet_owner.sql`
