-- DA-00 controlled bootstrap for an existing Supabase Auth user.
-- Replace AUTH_USER_ID before running from an administrative SQL context.
-- Do not run this from frontend code and do not expose service credentials.

select *
from public.bootstrap_romet_owner(
  'AUTH_USER_ID'::uuid,
  'ROMET Owner'
);
