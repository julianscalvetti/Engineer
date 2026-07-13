# 13 — Mapeo de columnas y regla de aceptación del archivo

## 1. Objetivo

Este documento define qué columnas del Excel real se van a usar en el MVP 0 y cómo se traducen a nombres internos del sistema.

El objetivo no es copiar todo el Excel original.

El objetivo es que la app pueda:

```text
leer la base de registro
validar columnas mínimas
procesar datos críticos
generar un aviso breve de calidad
```

---

## 2. Hoja fuente

La hoja fuente del Excel real es:

```text
BASE DE REGISTRO
```

Para el MVP 0 se recomienda exportar esta hoja como CSV.

El sistema no debe intentar leer todas las hojas del Excel en esta etapa.

---

## 3. Mapeo de columnas

| Columna Excel | Nombre interno MVP | Uso |
|---|---|---|
| FECHA | fecha | Ubicación temporal del registro |
| MES-AÑO | mes_anio | Agrupación mensual, opcional |
| COD PIEZA | producto_codigo | Identificación de pieza/producto |
| DESCRIPCION PZA | producto_descripcion | Nombre legible de pieza/producto |
| CLIENTE | cliente | Segmentación por cliente |
| OPERACIÓN | operacion | Etapa, proceso o puesto operativo |
| TURNO | turno | Segmentación operativa |
| OPERADOR | operador | Contexto humano/operativo |
| MODO DE FALLA | modo_falla | Clasificación principal del defecto |
| CANT NO OK | cantidad_no_ok | Cantidad defectuosa/no conforme |
| CANT TOTAL | cantidad_total | Total informado para el registro |
| DPU | dpu | Indicador ya calculado en Excel |
| TOTAL CONTROLADO | total_controlado | Total controlado/inspeccionado |
| TOTAL PRODUCIDO | total_producido | Total producido |
| DETALLE MODO DE FALLA | detalle_modo_falla | Descripción adicional del defecto |

---

## 4. Columnas obligatorias para el MVP 0

Para que el archivo sea aceptado, deben existir estas columnas:

```text
FECHA
COD PIEZA
MODO DE FALLA
CANT NO OK
```

Estas columnas permiten hacer el análisis mínimo:

- detectar cuándo ocurrió;
- identificar qué pieza/producto tuvo problemas;
- clasificar el modo de falla;
- medir cantidad de unidades no OK.

---

## 5. Columnas recomendadas

Estas columnas no bloquean el análisis, pero mejoran mucho la utilidad:

```text
DESCRIPCION PZA
OPERACIÓN
TURNO
CANT TOTAL
TOTAL CONTROLADO
DPU
```

Con estas columnas se puede:

- leer mejor el producto;
- detectar operación crítica;
- comparar turnos;
- estimar tasas;
- mostrar un indicador más industrial.

---

## 6. Columnas opcionales

Estas columnas aportan contexto, pero no son necesarias para el primer MVP:

```text
MES-AÑO
CLIENTE
OPERADOR
TOTAL PRODUCIDO
DETALLE MODO DE FALLA
```

No deben bloquear la carga del archivo.

---

## 7. Regla de aceptación del archivo

El MVP 0 debe aceptar el archivo si cumple esta regla:

```text
El CSV contiene FECHA, COD PIEZA, MODO DE FALLA y CANT NO OK.
```

Si falta alguna de esas columnas, el sistema debe detener el procesamiento y mostrar un error claro.

Ejemplo:

```text
No se puede procesar el archivo.
Falta la columna obligatoria: MODO DE FALLA.
```

---

## 8. Regla de advertencias

Si faltan columnas recomendadas, el sistema no debe bloquear el análisis.

Debe mostrar advertencias.

Ejemplo:

```text
Advertencia:
No se encontró la columna CANT TOTAL.
El sistema podrá mostrar rankings por cantidad no OK, pero no calculará tasa de falla estimada.
```

Ejemplo:

```text
Advertencia:
No se encontró la columna OPERACIÓN.
El sistema no podrá detectar operaciones críticas.
```

---

## 9. Lógica de denominador para tasa de falla

La tasa de falla se debe calcular solo si existe un denominador válido.

Orden recomendado para elegir denominador:

```text
1. TOTAL CONTROLADO
2. CANT TOTAL
3. TOTAL PRODUCIDO
```

La app debe informar cuál usó.

Ejemplo:

```text
Tasa estimada calculada usando TOTAL CONTROLADO.
```

Si no existe ningún denominador válido:

```text
No se calcula tasa de falla.
Solo se muestran cantidades no OK y rankings.
```

---

## 10. Fórmula inicial

La fórmula inicial será:

```text
tasa_falla_estimada = cantidad_no_ok / denominador
```

Donde denominador puede ser:

```text
TOTAL CONTROLADO
CANT TOTAL
TOTAL PRODUCIDO
```

según disponibilidad.

---

## 11. Precaución sobre duplicación de totales

Como la base puede tener varias filas para distintos modos de falla de un mismo control, existe riesgo de duplicar el total inspeccionado.

Ejemplo:

| COD PIEZA | OPERACIÓN | MODO DE FALLA | CANT NO OK | CANT TOTAL |
|---|---|---|---:|---:|
| PZA-001 | OP-10 | Fisura | 8 | 500 |
| PZA-001 | OP-10 | Rebaba | 5 | 500 |
| PZA-001 | OP-10 | Golpe | 3 | 500 |

Si se suma `CANT TOTAL`, el sistema puede contar:

```text
500 + 500 + 500 = 1500
```

cuando tal vez el total real controlado era:

```text
500
```

Por eso, para el MVP 0:

```text
Las tasas deben mostrarse como estimadas.
Los rankings por CANT NO OK son más confiables inicialmente.
```

---

## 12. Métricas seguras para el MVP 0

Estas métricas se pueden calcular con menor riesgo:

```text
Total de unidades no OK
Ranking de modos de falla por CANT NO OK
Ranking de piezas por CANT NO OK
Ranking de operaciones por CANT NO OK
Ranking de turnos por CANT NO OK
```

---

## 13. Métricas con advertencia

Estas métricas se pueden calcular, pero deben llevar aclaración:

```text
Tasa de falla estimada
DPU estimado
Comparación entre grupos usando denominador informado
```

---

## 14. Primer aviso esperado

El MVP debe poder generar un aviso corto de este estilo:

```text
Aviso de calidad

El mayor volumen de unidades no OK se concentra en la pieza [COD PIEZA],
con [X] unidades no conformes.

El modo de falla principal es [MODO DE FALLA],
representando [Y]% del total de unidades no OK registradas.

Si se usa [DENOMINADOR], la tasa estimada para este grupo es [Z]%.

Prioridad sugerida:
revisar pieza [COD PIEZA] / operación [OPERACIÓN] / modo de falla [MODO DE FALLA].
```

---

## 15. Comportamiento si faltan datos

### Si falta `OPERACIÓN`

El aviso no debe mencionar operación.

```text
Prioridad sugerida:
revisar pieza [COD PIEZA] / modo de falla [MODO DE FALLA].
```

### Si falta denominador

El aviso no debe mostrar tasa.

```text
No se calculó tasa de falla porque no se encontró denominador válido.
```

### Si falta `DESCRIPCION PZA`

El sistema usa `COD PIEZA`.

---

## 16. Validaciones mínimas de datos

El sistema debe revisar:

```text
CANT NO OK es numérico
CANT NO OK no es negativo
FECHA existe
MODO DE FALLA no está vacío
COD PIEZA no está vacío
```

Si hay errores en algunas filas, el sistema puede:

```text
ignorar filas inválidas
mostrar cantidad de filas descartadas
seguir con las filas válidas
```

---

## 17. Decisión de producto

Para el MVP 0, la prioridad no es exactitud estadística perfecta.

La prioridad es:

```text
detectar concentraciones evidentes de fallas
mostrar avisos útiles
validar si el análisis automático tiene sentido
```

---

## 18. Próximo paso

El siguiente paso es definir el primer flujo de pantalla:

```text
Pantalla 1: carga CSV
Pantalla 2: validación de columnas
Pantalla 3: aviso de calidad
```

Ese flujo será la base para el primer prompt técnico a Codex.
