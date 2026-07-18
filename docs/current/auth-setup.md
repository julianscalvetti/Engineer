# Autenticacion MVP

Engineer usa Supabase Auth para autenticacion y tablas publicas para datos de usuario y autorizacion.

## Identidad y perfil

```text
auth.users
-> public.profiles
```

`public.profiles` contiene datos basicos del usuario. Su campo `role` se conserva como rol legacy de UI para la shell actual:

- `operativo`
- `ingeniero`

## Autorizacion por empresa

Desde DA-00, la fuente de autorizacion para datos de empresa es:

```text
public.company_members
```

Roles permitidos en `company_members.role`:

- `owner`
- `engineer`
- `operator`

No se usa `user_metadata` como fuente de autorizacion.

## Bootstrap ROMET

1. Crear el usuario en Supabase Auth con email y password desde el panel de Supabase.
2. Copiar el `id` del usuario creado en `auth.users`.
3. Ejecutar el bootstrap controlado desde SQL administrativo:

```sql
select *
from public.bootstrap_romet_owner(
  'AUTH_USER_ID'::uuid,
  'Nombre Usuario'
);
```

El bootstrap crea o reutiliza:

- `public.profiles`;
- empresa `ROMET`;
- planta `Planta Principal`;
- membership `owner`.

Para compatibilidad con la navegacion actual, el bootstrap deja `profiles.role = 'ingeniero'`. La autorizacion por empresa se decide por `company_members`, no por `profiles.role`.

El mismo comando esta disponible en `supabase/bootstrap/da_00_romet_owner.sql` con placeholder `AUTH_USER_ID`.

## Reglas actuales

- Todo usuario autenticado que use la app debe tener un registro en `public.profiles`.
- `profiles.id` debe coincidir con `auth.users.id`.
- Un usuario sin perfil o con rol legacy invalido no puede usar las rutas protegidas actuales.
- RLS permite leer datos de empresas solo cuando existe membership activo.
- Usuarios anonimos no tienen lectura sobre datos protegidos por DA-00.
- Las escrituras de frontend sobre tablas protegidas quedan cerradas por defecto hasta definir politicas explicitas por rol.

## Documentacion relacionada

- `docs/current/da-00-user-company-plant-model.md`
- `docs/current/database-model-mvp.md`
- `supabase/README.md`
