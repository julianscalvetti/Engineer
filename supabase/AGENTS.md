# Supabase

- `migrations/` es la fuente ejecutable de base de datos.
- Mantener migraciones incrementales e inmutables una vez aplicadas.
- Preservar RLS, tenant isolation y trazabilidad.
- No aplicar cambios a entornos remotos automaticamente.
- Revisar seeds para evitar datos sensibles.
- No reemplazar migraciones con archivos del modelo conceptual.
