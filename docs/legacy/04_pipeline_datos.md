# 04 — Pipeline de datos

## Objetivo

Definir cómo el sistema transforma un archivo crudo de fallas en resultados útiles para calidad.

## Flujo general

```text
Archivo cargado
  ↓
Lectura del archivo
  ↓
Validación de estructura
  ↓
Normalización
  ↓
Cálculo de métricas
  ↓
Detección de patrones
  ↓
Generación de resultado
  ↓
Guardado en base de datos
```

## Entrada esperada

Formato inicial:

- `.csv`
- `.xlsx`

## Campos mínimos sugeridos

| Campo | Tipo | Obligatorio |
|---|---|---|
| fecha | date | Sí |
| producto | text | Sí |
| tipo_falla | text | Sí |
| cantidad_inspeccionada | number | Sí |
| cantidad_fallada | number | Sí |
| lote | text | No |
| linea | text | No |
| turno | text | No |
| maquina | text | No |
| proveedor | text | No |
| observaciones | text | No |

## Validaciones iniciales

- El archivo no está vacío.
- El archivo tiene columnas reconocibles.
- Existen campos mínimos.
- Las cantidades son numéricas.
- Las fechas son interpretables.
- `cantidad_fallada` no supera `cantidad_inspeccionada` cuando ambas existen en la misma fila.
- No hay tasas imposibles.

## Normalización básica

- Convertir nombres de columnas a formato estándar.
- Eliminar espacios innecesarios.
- Unificar mayúsculas/minúsculas.
- Normalizar nombres de fallas similares cuando sea posible.
- Detectar valores vacíos.

Ejemplo:

```text
"Fisura", "fisura", "FISURA", "fisuras" → "Fisura"
```

## Métricas mínimas

- Total inspeccionado.
- Total fallado.
- Tasa de falla general.
- Tasa de falla por producto.
- Tasa de falla por tipo de falla.
- Cantidad de fallas por período.
- Top 5 fallas más frecuentes.
- Top 5 productos con mayor tasa de falla.

## Salida esperada

El procesamiento debe generar un objeto de resultado con:

```text
summary
metrics
top_failures
failures_by_product
failures_over_time
warnings
recommendations_basic
```

## Importante

La primera versión no debe prometer causa raíz automática.

Debe hablar de:

- patrones detectados;
- concentraciones;
- desvíos;
- puntos a revisar.

No debe afirmar causalidad sin evidencia adicional.
