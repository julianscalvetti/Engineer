# 10 — Guía de decisiones para construir el primer MVP personal

## 1. Objetivo de este documento

Este documento no lista tareas técnicas.

Su objetivo es guiar las decisiones que hay que tomar antes de construir el primer MVP personal del sistema de análisis de fallas.

El foco actual es validar una sola cosa:

> Si una persona carga datos de fallas en una herramienta simple, el sistema puede procesarlos y devolver un resultado útil para análisis de calidad.

No se busca todavía construir una plataforma comercial, un SaaS, un QMS, un ERP ni una solución multiempresa.

---

## 2. Regla de trabajo

Cada decisión debe responderse de forma simple.

No se avanza a desarrollo técnico si no está claro:

1. Qué datos se cargan.
2. Qué estructura mínima deben tener.
3. Qué procesamiento se espera.
4. Qué salida se considera útil.
5. Cómo se decide si el MVP funcionó o no.

---

# Ronda 1 — Decisión principal del MVP

## Pregunta clave

¿Qué quiero comprobar con este primer MVP?

Opciones posibles:

### Opción A — Análisis básico de fallas

> Quiero cargar datos de fallas y saber cuáles son los principales problemas.

Esta opción sirve para validar rápidamente si el sistema ordena datos y entrega indicadores útiles.

### Opción B — Detección de patrones

> Quiero cargar datos y detectar si las fallas se concentran en producto, lote, línea o turno.

Esta opción ya apunta más a diagnóstico.

### Opción C — Reporte automático

> Quiero cargar datos y que el sistema me devuelva un resumen tipo informe.

Esta opción valida la salida ejecutiva, pero depende de que el análisis básico esté bien.

## Recomendación inicial

Para el primer MVP personal, conviene elegir:

> Opción A + una parte simple de Opción B.

Es decir:

```text
Cargar datos
    ↓
Calcular indicadores básicos
    ↓
Detectar principales concentraciones
    ↓
Mostrar hallazgos simples
```

---

# Ronda 2 — Dataset inicial

## Preguntas que hay que responder

1. ¿Voy a usar datos reales, simulados o una mezcla?
2. ¿Los datos vienen de Excel, CSV o los voy a crear manualmente?
3. ¿Cuántas filas aproximadas quiero probar al principio?
4. ¿Qué representa cada fila?
5. ¿Qué nivel de detalle necesito para que el análisis tenga sentido?

---

## Decisión importante: unidad de análisis

Antes de programar, hay que definir qué representa cada fila del archivo.

### Opción A — Una fila = una falla detectada

Ejemplo:

| fecha | producto | lote | linea | turno | tipo_falla |
|---|---|---|---|---|---|
| 2026-06-20 | Pieza A | L-001 | Línea 1 | Mañana | Fisura |

Ventaja:

- Simple para contar fallas.
- Fácil para ranking de defectos.

Limitación:

- No permite calcular tasa de falla real si no sabemos cuántas unidades se inspeccionaron.

---

### Opción B — Una fila = resumen de inspección

Ejemplo:

| fecha | producto | lote | linea | turno | tipo_falla | cantidad_inspeccionada | cantidad_fallada |
|---|---|---|---|---|---|---|---|
| 2026-06-20 | Pieza A | L-001 | Línea 1 | Mañana | Fisura | 500 | 18 |

Ventaja:

- Permite calcular tasa de falla.
- Es más útil para calidad industrial.

Limitación:

- Requiere que el dato venga más ordenado.

---

## Recomendación inicial

Para este proyecto conviene usar:

> Una fila = resumen de inspección.

Porque permite calcular:

```text
tasa de falla = cantidad_fallada / cantidad_inspeccionada
```

Este indicador es más útil que contar fallas absolutas sin contexto.

---

# Ronda 3 — Columnas mínimas

## Pregunta clave

¿Qué columnas son obligatorias para que el MVP pueda analizar algo útil?

## Propuesta mínima

| Columna | Obligatoria | Motivo |
|---|---:|---|
| fecha | Sí | Permite ordenar temporalmente |
| producto | Sí | Permite saber qué producto falla |
| tipo_falla | Sí | Permite clasificar problemas |
| cantidad_inspeccionada | Sí | Permite calcular tasa |
| cantidad_fallada | Sí | Permite calcular defectos |
| lote | Recomendado | Permite detectar partidas críticas |
| linea | Recomendado | Permite detectar origen operativo |
| turno | Opcional inicial | Útil, pero puede faltar |
| observaciones | Opcional | Sirve para contexto cualitativo |

## Decisión recomendada

Para no trabar el MVP:

### Obligatorias

```text
fecha
producto
tipo_falla
cantidad_inspeccionada
cantidad_fallada
```

### Recomendadas

```text
lote
linea
turno
```

### Opcionales

```text
observaciones
proveedor
cliente
orden_produccion
maquina
operario
```

---

# Ronda 4 — Validaciones mínimas

## Pregunta clave

¿Qué tiene que revisar el sistema antes de procesar?

## Validaciones obligatorias

1. Que existan las columnas mínimas.
2. Que las cantidades sean números.
3. Que `cantidad_inspeccionada` sea mayor que cero.
4. Que `cantidad_fallada` no sea mayor que `cantidad_inspeccionada`.
5. Que existan valores en producto y tipo_falla.
6. Que la fecha sea interpretable.

## Validaciones útiles pero no bloqueantes

1. Detectar campos vacíos.
2. Detectar nombres duplicados con variantes:
   - Fisura
   - fisura
   - FISURAS
3. Detectar lotes faltantes.
4. Detectar líneas o turnos sin completar.
5. Detectar registros con tasas demasiado altas.

---

# Ronda 5 — Procesamiento mínimo

## Pregunta clave

¿Qué debe calcular el sistema en la primera versión?

## Indicadores mínimos

1. Total inspeccionado.
2. Total fallado.
3. Tasa de falla general.
4. Ranking de tipos de falla.
5. Ranking de productos con mayor cantidad fallada.
6. Ranking de productos con mayor tasa de falla.
7. Ranking de lotes críticos.
8. Ranking de líneas críticas.

## Hallazgos automáticos mínimos

El sistema debería generar frases simples como:

```text
La tasa de falla general fue 3,6%.
La falla más frecuente fue "Fisura".
El producto con mayor tasa de falla fue "Pieza A".
El lote L-001 concentró el mayor porcentaje de defectos.
La Línea 2 tuvo una tasa de falla superior al promedio general.
```

---

# Ronda 6 — Salida esperada

## Pregunta clave

¿Qué resultado me haría decir "esto sirve"?

## Salida mínima recomendada

La pantalla de resultado debería tener:

1. Tarjetas con indicadores generales.
2. Tabla de fallas principales.
3. Tabla de productos críticos.
4. Tabla de lotes críticos.
5. Tabla de líneas críticas.
6. Resumen automático en texto.
7. Advertencias de calidad de datos.

## No hace falta todavía

- PDF.
- Envío por mail.
- Dashboard complejo.
- Filtros avanzados.
- Gráficos sofisticados.
- Login.
- Base de datos.
- Comparación histórica.

---

# Ronda 7 — Criterio de éxito

## Pregunta clave

¿Cómo sé si este MVP personal funcionó?

## Criterios de éxito sugeridos

El MVP funciona si:

1. Puedo cargar un CSV sin tocar código.
2. El sistema detecta errores básicos del archivo.
3. El sistema calcula tasa de falla correctamente.
4. El sistema muestra rankings útiles.
5. El sistema genera al menos 3 hallazgos interpretables.
6. El resultado me ahorra tiempo frente a mirar el Excel manualmente.
7. El resultado me permite detectar al menos un problema relevante.

## Criterio de fracaso

El MVP no funciona si:

1. Necesito preparar demasiado el archivo para que lo entienda.
2. Los resultados son obvios o inútiles.
3. La interfaz confunde más de lo que ayuda.
4. El procesamiento no aporta nada frente a una tabla dinámica.
5. No queda claro qué decisión tomar después del análisis.

---

# Ronda 8 — Decisiones que quedan fuera

Estas decisiones no se toman ahora:

| Decisión | Por qué se posterga |
|---|---|
| SaaS multiempresa | No se validó valor todavía |
| Usuarios y permisos | El uso es personal |
| Supabase | Primero se puede procesar en memoria |
| Vercel | Primero puede correr local |
| Trigger.dev | No hay procesos pesados |
| Resend | No hay emails necesarios |
| IA generativa | Primero se valida análisis estructurado |
| Machine learning | Primero se valida estadística básica |
| Integración ERP/MES/QMS | Requiere validación empresarial posterior |

---

# 9. Decisiones concretas recomendadas para avanzar

Para iniciar Codex, la definición recomendada es:

```text
Tipo de MVP:
Herramienta local web para análisis personal de fallas.

Formato inicial:
CSV.

Unidad de análisis:
Una fila = resumen de inspección.

Columnas obligatorias:
fecha, producto, tipo_falla, cantidad_inspeccionada, cantidad_fallada.

Columnas recomendadas:
lote, linea, turno.

Procesamiento:
Indicadores básicos + rankings + hallazgos automáticos.

Salida:
Pantalla simple con métricas, tablas y resumen textual.

Infraestructura:
Sin base de datos al inicio.
Sin login.
Sin emails.
Sin background jobs.
Sin integración externa.

Tecnología:
Next.js local.
```

---

# 10. Preguntas para responder antes de construir

Estas son las preguntas que hay que responder ahora:

## A. Sobre los datos

1. ¿Vamos a empezar con datos simulados o reales?
2. ¿Una fila representa una inspección resumida?
3. ¿Qué columnas mínimas aceptamos?
4. ¿Qué campos pueden faltar sin romper el análisis?

## B. Sobre el análisis

5. ¿Qué ranking importa más: falla, producto, lote, línea o turno?
6. ¿Queremos priorizar por cantidad fallada o por tasa de falla?
7. ¿Qué consideramos un dato sospechoso?
8. ¿Qué advertencias queremos mostrar?

## C. Sobre la salida

9. ¿Qué resultado te haría decir "esto sirve"?
10. ¿Preferís primero tablas o gráficos?
11. ¿Querés un resumen textual simple o solo indicadores?
12. ¿Qué decisión debería poder tomar alguien después de ver el resultado?

## D. Sobre el alcance técnico

13. ¿Debe correr solo local por ahora?
14. ¿Guardamos históricos o no?
15. ¿Necesitamos subir Excel o empezamos solo con CSV?
16. ¿Hay alguna función que parezca tentadora pero debemos excluir para no sobredimensionar?

---

# 11. Próximo paso

El próximo paso es responder estas decisiones en forma de ficha corta.

Una vez respondidas, se puede convertir directamente en instrucciones para Codex.
