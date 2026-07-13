# 11 — Decisiones iniciales con Excel real como caso base

## 1. Decisión principal

El primer MVP personal se va a construir usando un Excel real de calidad industrial como caso base.

Este Excel no se va a replicar completo.

La primera versión solo va a usar la base principal de registros como fuente de datos para validar el flujo:

```text
Base real de registros
    ↓
Carga o conversión a CSV
    ↓
Procesamiento simple
    ↓
Aviso / resultado útil
```

---

## 2. Contexto del Excel real

El archivo trabajado previamente corresponde a una empresa real y contiene una estructura más compleja que una simple tabla.

Se identificaron hojas de:

- carga de datos;
- formulario;
- base de registro;
- catálogos;
- análisis;
- indicadores;
- seguimiento.

Hojas relevantes mencionadas:

```text
FORMULARIO
CARGA
BASE DE REGISTRO
Total producido
PRODUCTOS
OPERACIONES
MODO DE FALLA
Seguimiento
Indicador RO
Indicador por Puesto
```

La hoja clave para el MVP es:

```text
BASE DE REGISTRO
```

Esa hoja funciona como la tabla histórica donde quedan guardados los datos cargados.

---

## 3. Columnas relevantes conocidas

Columnas críticas vistas en la base:

```text
FECHA
MES-AÑO
COD PIEZA
DESCRIPCION PZA
CLIENTE
OPERACIÓN
TURNO
OPERADOR
MODO DE FALLA
CANT NO OK
CANT TOTAL
DPU
TOTAL CONTROLADO
TOTAL PRODUCIDO
DETALLE MODO DE FALLA
```

No todas se necesitan para el MVP 0.

---

## 4. Qué parte del Excel se usa ahora

El MVP 0 no debe usar:

- macros;
- formularios;
- dashboards internos;
- tablas dinámicas;
- segmentadores;
- hojas de análisis ya hechas;
- lógica visual del Excel original.

Solo debe usar:

```text
BASE DE REGISTRO
```

Y, dentro de esa hoja, las columnas necesarias para calcular indicadores simples.

---

## 5. Decisión sobre formato de entrada

Aunque el archivo original esté en Excel, para el primer MVP se recomienda exportar la hoja `BASE DE REGISTRO` a CSV.

Motivo:

- simplifica la lectura del archivo;
- evita manejar múltiples hojas;
- evita depender de macros;
- reduce errores de parsing;
- permite construir más rápido;
- mantiene el foco en validar el análisis, no en leer archivos complejos.

Decisión inicial:

```text
Formato inicial del MVP 0: CSV exportado desde BASE DE REGISTRO.
```

Más adelante se puede agregar lectura directa de Excel.

---

## 6. Explicación de “qué representa una fila”

La pregunta sobre “qué representa una fila” apunta a entender la unidad mínima de análisis.

En calidad industrial, una fila puede significar cosas distintas.

---

### Caso A — Una fila = una falla individual

Ejemplo:

```text
El día 10/06 se detectó una fisura en una pieza.
```

La fila representa un defecto puntual.

Esto sirve para contar defectos, pero no siempre permite saber cuántas piezas fueron inspeccionadas.

---

### Caso B — Una fila = resumen de inspección

Ejemplo:

```text
El día 10/06 se inspeccionaron 500 piezas A en la Línea 1 y hubo 18 con fisura.
```

La fila resume una medición o control.

Esto permite calcular:

```text
tasa de falla = cantidad fallada / cantidad inspeccionada
```

---

### Caso C — Una fila = modo de falla dentro de un mismo control

Este caso parece más cercano al Excel real trabajado.

Un mismo control puede tener varias filas si hubo distintos modos de falla.

Ejemplo:

| FECHA | COD PIEZA | OPERACIÓN | TURNO | MODO DE FALLA | CANT NO OK | CANT TOTAL |
|---|---|---|---|---|---:|---:|
| 10/06/2026 | PZA-001 | OP-20 | Mañana | Fisura | 8 | 500 |
| 10/06/2026 | PZA-001 | OP-20 | Mañana | Rebaba | 5 | 500 |
| 10/06/2026 | PZA-001 | OP-20 | Mañana | Golpe | 3 | 500 |

Acá cada fila no representa toda la inspección, sino un modo de falla dentro de un control.

Esto es importante porque si se suman mal los totales, se puede duplicar la cantidad inspeccionada.

---

## 7. Decisión para el MVP 0

Para empezar, el sistema debe interpretar cada fila así:

> Una fila = un registro de modo de falla asociado a una pieza, operación, fecha, turno y cantidad controlada.

No asumimos todavía que cada fila sea una inspección completa independiente.

Esta decisión es importante porque el cálculo de tasa de falla debe hacerse con cuidado.

---

## 8. Indicador inicial recomendado

El primer indicador simple será:

```text
DPU o tasa de falla simple
```

Según las columnas disponibles:

```text
CANT NO OK / CANT TOTAL
```

O, cuando corresponda:

```text
CANT NO OK / TOTAL CONTROLADO
```

La app debe mostrar claramente qué denominador usó.

---

## 9. Riesgo técnico principal

El riesgo principal es contar dos veces el total inspeccionado si un mismo control aparece dividido en varias filas por modo de falla.

Ejemplo:

| MODO DE FALLA | CANT NO OK | CANT TOTAL |
|---|---:|---:|
| Fisura | 8 | 500 |
| Rebaba | 5 | 500 |
| Golpe | 3 | 500 |

Si sumamos `CANT TOTAL`, daría:

```text
500 + 500 + 500 = 1500
```

Pero posiblemente el total real controlado fue:

```text
500
```

Por eso el MVP debe ser prudente.

---

## 10. Estrategia inicial para evitar errores

Para el MVP 0, se recomienda calcular dos niveles:

### Nivel 1 — Métricas directas por fila

Estas son más simples:

- ranking de modos de falla por `CANT NO OK`;
- ranking de piezas por `CANT NO OK`;
- ranking de operaciones por `CANT NO OK`;
- ranking por turno;
- ranking por cliente.

### Nivel 2 — Tasa de falla con aclaración

La tasa se calcula, pero con una advertencia:

```text
La tasa se calculó usando el total informado en la base.
Si existen múltiples modos de falla para el mismo control, el denominador puede requerir agrupación.
```

---

## 11. Primera salida esperada

La salida no será un resumen largo.

Será un aviso breve estilo reporte.

Ejemplo:

```text
Aviso de calidad

La principal concentración de fallas se encuentra en la pieza PZA-001,
operación OP-20, con 124 unidades no OK.

El modo de falla más repetido es "Fisura".
La tasa de falla estimada para este grupo es 3,6%.

Revisar prioridad: pieza PZA-001 / operación OP-20 / modo de falla Fisura.
```

---

## 12. Lo que no se construye todavía

No se construye todavía:

- lectura automática de todas las hojas;
- reconstrucción del formulario de carga;
- dashboard completo;
- análisis histórico sofisticado;
- predicción;
- IA generativa;
- login;
- base de datos;
- envío por email;
- integración con sistemas internos;
- reportes PDF;
- replicación exacta del Excel.

---

## 13. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Fuente inicial | Excel real de calidad industrial |
| Hoja base | BASE DE REGISTRO |
| Formato inicial | CSV exportado desde esa hoja |
| Uso inicial | Personal |
| Infraestructura | Local, gratis |
| Indicador inicial | DPU / tasa simple |
| Salida inicial | Aviso breve + datos clave |
| Foco | Validar utilidad del análisis |
| Exclusión | No replicar todo el Excel |

---

## 14. Próxima decisión

Antes de construir hay que definir exactamente:

```text
Qué columnas del Excel real vamos a mapear a los nombres internos del MVP.
```

Ejemplo:

| Columna Excel | Nombre interno MVP |
|---|---|
| FECHA | fecha |
| COD PIEZA | producto_codigo |
| DESCRIPCION PZA | producto_descripcion |
| OPERACIÓN | operacion |
| TURNO | turno |
| MODO DE FALLA | modo_falla |
| CANT NO OK | cantidad_no_ok |
| CANT TOTAL | cantidad_total |
| TOTAL CONTROLADO | total_controlado |
| TOTAL PRODUCIDO | total_producido |
| DPU | dpu |
