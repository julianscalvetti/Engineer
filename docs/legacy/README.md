# Proyecto Calidad — MVP

Versión: `0.1`

## Objetivo

Construir un MVP web para validar si una empresa industrial que ya registra fallas de productos puede obtener análisis de calidad más rápidos, ordenados y accionables a partir de sus datos existentes.

El MVP no busca reemplazar un ERP, MES, QMS ni sistema interno de planta. Busca actuar como una capa liviana de carga, procesamiento e interpretación de datos de fallas.

## Hipótesis principal

> Si una empresa puede cargar datos de fallas en formato Excel/CSV, el sistema puede procesarlos automáticamente y devolver un reporte claro con patrones, indicadores y prioridades de acción.

## Flujo mínimo

```text
Usuario de calidad
  ↓
Carga archivo Excel/CSV
  ↓
Validación de estructura
  ↓
Procesamiento automático
  ↓
Cálculo de indicadores
  ↓
Reporte / dashboard simple
  ↓
Decisión del responsable de calidad
```

## Documentos

| Archivo | Descripción |
|---|---|
| `00_contexto_y_objetivo.md` | Problema, usuario y objetivo del MVP |
| `01_alcance_mvp.md` | Qué incluye y qué no incluye el MVP |
| `02_stack_tecnico.md` | Stack sugerido y responsabilidades de cada herramienta |
| `03_flujo_usuario.md` | Flujo funcional y pantallas mínimas |
| `04_pipeline_datos.md` | Entrada, validación, procesamiento y salida |
| `05_seguridad_it_ot.md` | Restricciones de seguridad y enfoque inicial |
| `06_backlog_codex.md` | Tareas iniciales para empezar a construir |
| `08_croquis_mvp_entorno_gratis.md` | Croquis funcional del MVP y decisión de entorno gratis |

## Stack base sugerido

```text
Next.js + Supabase + Trigger.dev + Vercel
```

Uso esperado:

- `Next.js`: aplicación web, interfaz y APIs internas.
- `Supabase`: autenticación, base de datos Postgres y storage de archivos.
- `Trigger.dev`: procesamiento en segundo plano.
- `Vercel`: hosting, deploy e infraestructura web.

## Principio de diseño

El MVP debe ser simple, demostrable y seguro:

- Sin conexión directa a ERP, MES, SCADA, PLC o sistemas OT.
- Carga inicial mediante archivo exportado.
- Procesamiento trazable.
- Resultados entendibles para usuarios de calidad.
- Base preparada para evolucionar hacia integraciones más robustas.
- `07_vision_y_criterios_del_proyecto.md`: idea general del proyecto, criterios analizados, decisiones tomadas y foco del MVP.

## Documento agregado

- `09_mvp_personal_foco_minimo.md`: define el enfoque de MVP personal, sin sobredimensionamiento ni servicios pagos innecesarios.

## Documento agregado

- `10_guia_decisiones_mvp_personal.md`: guía de preguntas y decisiones para definir el primer MVP personal antes de construir con Codex.
## Documentos agregados

- `11_decisiones_excel_real_mvp0.md`: decisiones del MVP 0 usando el Excel real como fuente base.
- `12_frontend_backend_procesamiento_mvp0.md`: explicación de qué hace cada parte técnica en el MVP 0.
## Documentos agregados

- `13_mapeo_columnas_y_regla_aceptacion.md`: define columnas obligatorias, recomendadas, opcionales y reglas para aceptar el CSV.
- `14_flujo_pantallas_mvp0.md`: define el flujo visual mínimo del MVP 0.
