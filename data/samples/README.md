# Datasets ficticios de prueba

Todos los archivos de esta carpeta contienen datos inventados y no sensibles. No representan clientes, piezas, operadores ni procesos reales.

## Orden recomendado

Comenzar por `sample_basico_robusto.csv` para comprobar el flujo completo. Luego usar los casos específicos para revisar advertencias y limitaciones.

| Archivo | Qué prueba | Resultado esperado | Limitación observable |
|---|---|---|---|
| `sample_basico_robusto.csv` | Flujo completo con piezas, operaciones, turnos, impactos bajos y críticos | Archivo válido; rankings, aviso y tasa estimada usando `TOTAL CONTROLADO` | La suma del denominador puede repetir controles y la tasa debe tratarse como estimada |
| `sample_columnas_faltantes.csv` | Solo columnas obligatorias más contexto mínimo | Archivo válido con advertencias; procesamiento habilitado; sin operación, turno ni tasa estimada | Menor capacidad de segmentación por ausencia de columnas recomendadas |
| `sample_prioridad_combinada.csv` | Diferencia entre rankings globales y prioridad conjunta | Pieza global: `COMB-FICT-A` (75); operación global: `OP-C` (85); modo global: `POROSIDAD` (85); prioridad real: `CONJUNTO ALFA DEMO (COMB-FICT-A) / OP-A / FISURA` (40) | Combinar top 1 independientes produciría una combinación inexistente |
| `sample_variaciones_redaccion.csv` | Mayúsculas, singular/plural, abreviaturas y variantes de turno u operación | Archivo válido con advertencias; tasa estimada usando `CANT TOTAL`; variantes aparecen separadas | La versión actual no consolida términos semánticamente equivalentes |
| `sample_otro_concepto_medicion.csv` | Lotes, control final, retrabajo, control en proceso, auditoría y rechazo interno | Archivo válido con advertencias; rankings por contexto y tasa estimada usando `TOTAL PRODUCIDO` | Mezclar conceptos operativos distintos exige interpretar la tasa con cautela |

## Uso

1. Cargar un CSV desde la pantalla principal.
2. Revisar columnas detectadas y advertencias.
3. Continuar al procesamiento.
4. Comparar métricas, top 5 y aviso con el resultado esperado de esta tabla.

Los archivos usan coma como separador, codificación UTF-8 con BOM y encabezados compatibles con el MVP 0.1.
