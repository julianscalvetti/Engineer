# 02 — Stack técnico

## Stack base sugerido

```text
Next.js + Supabase + Trigger.dev + Vercel
```

Este stack permite construir una aplicación SaaS liviana con buena velocidad de desarrollo.

## Responsabilidades por herramienta

| Herramienta | Responsabilidad |
|---|---|
| Next.js | Frontend, backend liviano, rutas, APIs internas |
| Supabase Auth | Autenticación de usuarios |
| Supabase Postgres | Base de datos principal |
| Supabase Storage | Almacenamiento de archivos cargados |
| Trigger.dev | Jobs de procesamiento en segundo plano |
| Vercel | Hosting, deploy, dominio, infraestructura web |
| Resend | Emails transaccionales, opcional en etapas posteriores |

## Arquitectura lógica inicial

```text
Usuario
  ↓
Next.js App
  ↓
Supabase Auth
  ↓
Supabase Storage ← archivo cargado
  ↓
Trigger.dev job
  ↓
Procesamiento de datos
  ↓
Supabase Postgres ← resultados
  ↓
Next.js Dashboard
```

## Por qué este stack sirve para el MVP

- Permite construir rápido.
- Reduce infraestructura propia.
- Tiene autenticación y base de datos integradas.
- Permite guardar archivos sin montar storage propio.
- Permite ejecutar procesamiento asincrónico.
- Facilita deploy continuo.

## Riesgo técnico principal

El procesamiento de archivos puede crecer en complejidad.

Si el análisis se vuelve más pesado, se puede sumar una capa Python en una segunda etapa:

```text
Trigger.dev
  ↓
Microservicio Python
  ↓
Pandas / Polars / Scikit-learn
  ↓
Resultados en Postgres
```

## Decisión para la primera versión

No sumar microservicio Python todavía salvo que sea necesario.

Primera versión:

```text
Next.js + Supabase + Trigger.dev
```

Segunda versión posible:

```text
Next.js + Supabase + Trigger.dev + Python worker
```
