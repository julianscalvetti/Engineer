# 09 — MVP personal: foco mínimo y criterio de no sobredimensionamiento

## 1. Decisión principal

En esta etapa el proyecto no se va a construir como SaaS, ERP, QMS, plataforma empresarial ni sistema multiempresa.

La etapa actual se define como:

> Un MVP personal para validar si tiene sentido cargar datos de fallas, procesarlos automáticamente y obtener un resultado útil para análisis de calidad.

El objetivo no es vender todavía.  
El objetivo no es escalar todavía.  
El objetivo no es integrar con sistemas industriales todavía.  
El objetivo es comprobar si el flujo básico genera valor.

---

## 2. Pregunta que debe responder este MVP

La pregunta central es:

> Si yo cargo datos reales o simulados de fallas de productos, ¿el sistema puede procesarlos y devolverme un análisis claro, útil y accionable?

Si la respuesta es sí, entonces tiene sentido pensar en usuarios externos, empresas, seguridad avanzada, integraciones, reportes más formales y una interfaz más robusta.

Si la respuesta es no, no tiene sentido construir capas más complejas.

---

## 3. Flujo mínimo que hay que probar

El MVP personal debe probar únicamente este flujo:

```text
Cargo datos
    ↓
El sistema valida que tengan una estructura mínima
    ↓
El sistema procesa los datos
    ↓
El sistema calcula indicadores básicos
    ↓
El sistema muestra resultados claros
    ↓
Yo evalúo si el resultado sirve
```

No hace falta nada más para esta etapa.

---

## 4. Qué sí debe hacer el MVP personal

### 4.1 Cargar datos

Debe permitir cargar un archivo simple.

Prioridad inicial:

1. CSV
2. Excel más adelante

El CSV es suficiente para empezar porque es más simple de procesar, más liviano y evita complejidad técnica innecesaria.

Ejemplo de campos mínimos:

| Campo | Descripción |
|---|---|
| fecha | Fecha del registro |
| producto | Producto, pieza o referencia |
| lote | Lote o partida |
| linea | Línea, celda o sector |
| turno | Turno de producción |
| tipo_falla | Categoría de falla |
| cantidad_inspeccionada | Total inspeccionado |
| cantidad_fallada | Total fallado |

---

### 4.2 Validar estructura

El sistema debe revisar si el archivo tiene las columnas necesarias.

Validaciones iniciales:

- Columnas obligatorias presentes.
- Cantidades numéricas válidas.
- Fechas reconocibles.
- Registros vacíos o incompletos.
- Nombres de fallas no normalizados.

Ejemplo:

```text
Error: falta la columna "tipo_falla"
Advertencia: 12 registros no tienen lote informado
Advertencia: existen valores distintos para la misma falla: "fisura", "Fisura", "FISURAS"
```

---

### 4.3 Procesar datos

El procesamiento inicial debe ser simple, explicable y auditable.

No se necesita machine learning todavía.

Procesamientos mínimos:

- Agrupar fallas por tipo.
- Agrupar fallas por producto.
- Agrupar fallas por lote.
- Agrupar fallas por línea.
- Calcular tasa de falla.
- Detectar el principal contributor.
- Ordenar problemas por impacto.
- Comparar contra promedio general del archivo.

Ejemplo:

```text
Tasa de falla = cantidad_fallada / cantidad_inspeccionada
```

---

### 4.4 Mostrar resultados

El sistema debe mostrar una salida clara.

Resultados mínimos:

- Total inspeccionado.
- Total fallado.
- Tasa de falla general.
- Top 5 tipos de falla.
- Top 5 productos con mayor falla.
- Top 5 lotes críticos.
- Fallas por línea o turno.
- Hallazgos automáticos escritos en lenguaje simple.

Ejemplo de salida:

```text
La falla más frecuente fue "Fisura", con 124 casos.
Representa el 38% del total de fallas detectadas.
El lote L-204 concentró el mayor nivel de rechazo.
La línea 2 tuvo una tasa de falla superior al promedio general.
```

---

## 5. Qué NO debe hacer todavía

Para evitar sobredimensionar, quedan excluidos de esta etapa:

| Elemento | Motivo |
|---|---|
| Resend | No hacen falta emails para validar el flujo principal |
| Trigger.dev | No hacen falta background jobs si lo usa una sola persona |
| Multiusuario | No hace falta porque el uso es personal |
| Roles y permisos complejos | No hay usuarios empresariales todavía |
| Integración con ERP/MES/QMS | Agrega complejidad IT sin validar valor |
| Integración con SCADA/PLC | No corresponde para esta etapa |
| PDF automático | Puede hacerse después; primero validar dashboard |
| Machine learning | Antes hay que validar análisis estadístico básico |
| IA generativa | Puede agregarse luego para explicar resultados |
| Dominio propio | No hace falta para uso personal |
| Pagos/subscripciones | No corresponde todavía |
| Auditoría avanzada | Relevante más adelante, no ahora |

---

## 6. Qué herramientas sí tienen sentido ahora

### 6.1 Next.js

Sirve para construir la aplicación web.

En esta etapa Next.js puede cubrir:

- Pantalla de carga de archivo.
- Lectura del CSV.
- Validación de datos.
- Procesamiento simple.
- Pantalla de resultados.
- Componentes visuales.
- Lógica backend mínima.

Uso esperado:

```text
Next.js = interfaz + lógica básica del MVP
```

---

### 6.2 GitHub

Sirve para guardar el código y trabajar con Codex.

Uso esperado:

```text
GitHub = repositorio del proyecto
```

Ahí se guarda:

- Código.
- Documentación.
- Issues.
- Historial de cambios.
- README.
- Archivos Markdown de planificación.

---

### 6.3 Vercel

Sirve para publicar la app gratis si se quiere probar online.

Uso esperado:

```text
Vercel = hosting gratuito para demo personal
```

No es obligatorio al principio.  
Primero puede correr localmente.

Orden recomendado:

```text
Localhost primero
Vercel después
```

---

### 6.4 Supabase

Supabase puede servir, pero no es obligatorio en el primer día.

Para un MVP personal hay dos opciones:

#### Opción A — Sin base de datos inicial

El archivo se carga, se procesa y se muestran resultados en pantalla.

Ventajas:

- Más simple.
- Más rápido.
- Menos configuración.
- Ideal para validar el flujo.

Limitación:

- No guarda históricos.

#### Opción B — Con Supabase Free

Se guardan archivos, registros y resultados.

Ventajas:

- Permite guardar históricos.
- Permite comparar análisis anteriores.
- Se parece más a un producto real.

Limitación:

- Agrega configuración.

Recomendación inicial:

```text
Primero sin Supabase.
Después agregar Supabase si el análisis básico funciona.
```

---

## 7. Arquitectura mínima recomendada

### Etapa 0 — Local y sin base de datos

```text
Archivo CSV
    ↓
Next.js local
    ↓
Parser CSV
    ↓
Validación
    ↓
Procesamiento
    ↓
Resultados en pantalla
```

Esta es la versión más mínima y correcta para empezar.

---

### Etapa 1 — Local + persistencia simple

```text
Archivo CSV
    ↓
Next.js local
    ↓
Procesamiento
    ↓
Resultado
    ↓
Guardado en archivo JSON local o localStorage
```

Sirve para guardar pruebas sin meter base de datos.

---

### Etapa 2 — App publicada + Supabase Free

```text
Usuario
    ↓
Vercel / Next.js
    ↓
Carga CSV
    ↓
Supabase Storage
    ↓
Procesamiento
    ↓
Supabase Postgres
    ↓
Dashboard
```

Esta etapa se justifica solo si la etapa 0 demuestra valor.

---

## 8. Criterio técnico rector

Cada nueva herramienta se agrega solamente si resuelve un problema real.

Regla:

```text
No sumar servicios antes de necesitar servicios.
```

Ejemplos:

| Necesidad real | Herramienta posible |
|---|---|
| Quiero guardar análisis históricos | Supabase |
| Quiero correr procesos pesados | Trigger.dev |
| Quiero enviar reportes por mail | Resend |
| Quiero publicar una demo online | Vercel |
| Quiero usuarios con login | Supabase Auth |
| Quiero análisis estadístico avanzado | Python o librerías específicas |
| Quiero reportes ejecutivos automáticos | IA generativa |

---

## 9. Criterio de validación

El MVP personal se considera útil si permite responder preguntas como:

- ¿Cuál fue la tasa de falla general?
- ¿Cuál fue la falla más frecuente?
- ¿Qué producto concentró más defectos?
- ¿Qué lote parece más problemático?
- ¿Qué línea o turno tuvo peor desempeño?
- ¿Hay datos incompletos o mal cargados?
- ¿El resultado es más rápido que analizar el Excel manualmente?
- ¿La salida ayuda a tomar una decisión de calidad?

---

## 10. Resultado esperado de esta etapa

El resultado esperado no es una plataforma final.

El resultado esperado es una prueba funcional:

```text
Subo un CSV de fallas
    ↓
El sistema lo entiende
    ↓
Calcula indicadores
    ↓
Detecta problemas principales
    ↓
Me muestra una lectura útil
```

Eso alcanza para decidir si el proyecto tiene sentido.

---

## 11. Definición corta de esta etapa

> MVP personal de análisis de fallas: una herramienta web simple para cargar datos de calidad, procesarlos automáticamente y obtener indicadores y hallazgos básicos sin depender todavía de infraestructura paga, integraciones industriales ni usuarios externos.

---

## 12. Próximo paso recomendado

El siguiente paso no es elegir más servicios.

El siguiente paso es diseñar la primera pantalla funcional:

```text
Pantalla 1: carga de CSV + validación de columnas
```

Una vez que esa pantalla funcione, se avanza al procesamiento y recién después a la visualización de resultados.
