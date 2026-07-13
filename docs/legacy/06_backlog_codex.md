# 06 — Backlog inicial para Codex

## Objetivo

Crear la primera base funcional de la aplicación.

## Épica 1 — Setup del proyecto

### Tareas

- Crear proyecto Next.js con TypeScript.
- Configurar estructura de carpetas.
- Configurar linting/formato.
- Configurar variables de entorno.
- Crear README técnico.

### Resultado esperado

Aplicación Next.js corriendo localmente.

---

## Épica 2 — Supabase

### Tareas

- Crear cliente Supabase.
- Configurar Auth.
- Crear tablas iniciales.
- Crear bucket privado para archivos.
- Definir políticas básicas de acceso.

### Tablas iniciales sugeridas

```text
companies
users_profiles
quality_projects
uploaded_files
processing_jobs
analysis_results
```

---

## Épica 3 — Interfaz base

### Tareas

- Crear pantalla de login.
- Crear dashboard principal.
- Crear pantalla de nuevo análisis.
- Crear componente de carga de archivo.
- Crear pantalla de estado de procesamiento.
- Crear pantalla de resultados mockeada.

---

## Épica 4 — Carga de archivos

### Tareas

- Permitir subir `.csv` y `.xlsx`.
- Guardar archivo en Supabase Storage.
- Registrar metadata del archivo en `uploaded_files`.
- Mostrar estado inicial `uploaded`.

---

## Épica 5 — Procesamiento inicial

### Tareas

- Crear job de procesamiento.
- Leer archivo cargado.
- Validar columnas mínimas.
- Calcular métricas básicas.
- Guardar resultados en `analysis_results`.
- Actualizar estado del job.

---

## Épica 6 — Resultados

### Tareas

- Mostrar resumen ejecutivo.
- Mostrar métricas principales.
- Mostrar top fallas.
- Mostrar fallas por producto.
- Mostrar advertencias de datos.

---

## Primera meta de build

Lograr este flujo completo:

```text
Login → Dashboard → Subir archivo → Procesar → Ver resultado básico
```

## No hacer todavía

- No integrar ERP/MES.
- No crear multi-tenant avanzado.
- No crear IA generativa todavía.
- No crear predicción automática.
- No crear mobile app.
- No crear sistema de permisos complejo.
