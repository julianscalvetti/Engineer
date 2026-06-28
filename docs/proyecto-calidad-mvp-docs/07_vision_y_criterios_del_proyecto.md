# Visión general y criterios del proyecto

## 1. Idea general

El proyecto busca construir una plataforma liviana para análisis de calidad ingenieril en empresas industriales.

La idea central no es crear un ERP (Enterprise Resource Planning / Sistema de Planificación de Recursos Empresariales), ni un QMS (Quality Management System / Sistema de Gestión de Calidad) completo, ni un dashboard genérico de BI (Business Intelligence / Inteligencia de Negocios).

El foco es construir una capa de inteligencia operativa que tome datos existentes de fallas, defectos, rechazos o no conformidades, los ordene, los procese y los convierta en información útil para tomar decisiones de calidad.

En términos simples:

```text
Datos crudos de calidad → Curado → Procesamiento → Análisis → Reporte → Acción
```

El producto apunta a empresas que ya registran información, pero que todavía dependen mucho de análisis manual, planillas dispersas, criterios tácitos o dashboards poco accionables.

---

## 2. Problema que se quiere resolver

Muchas empresas industriales, especialmente PyMEs (Pequeñas y Medianas Empresas) o plantas con bajo nivel de madurez analítica, tienen datos de calidad pero no siempre logran convertirlos en decisiones rápidas.

Problemas típicos:

- Datos registrados en Excel, CSV (Comma-Separated Values / Valores Separados por Comas), formularios o sistemas internos.
- Datos incompletos, sucios o con criterios no estandarizados.
- Mucho trabajo manual para limpiar, ordenar y analizar.
- Falta de trazabilidad clara entre producto, lote, línea, turno, falla y acción correctiva.
- Dificultad para detectar patrones repetitivos.
- Reportes hechos manualmente y con baja frecuencia.
- Dependencia de personas específicas que conocen “cómo leer” los datos.

El dolor principal no es solamente cargar datos, sino **transformar datos dispersos en diagnóstico operativo**.

---

## 3. Hipótesis del proyecto

La hipótesis inicial es:

> Si una empresa industrial puede cargar datos de fallas de forma simple y recibir un análisis automático, claro y accionable, entonces puede reducir carga manual, mejorar la detección de problemas y acelerar decisiones de calidad.

El MVP (Minimum Viable Product / Producto Mínimo Viable) debe validar esa hipótesis con el menor alcance posible.

---

## 4. Enfoque del MVP

El MVP no debe arrancar como una plataforma completa.

Debe empezar como una herramienta liviana que permita:

1. Cargar datos de calidad.
2. Validar y ordenar esos datos.
3. Procesarlos automáticamente.
4. Detectar indicadores, patrones y problemas prioritarios.
5. Mostrar resultados de forma clara.
6. Generar un reporte interpretable.

Definición resumida:

```text
MVP = carga de archivo + procesamiento automático + reporte de calidad interpretable
```

El objetivo del MVP no es demostrar que existe una aplicación visualmente terminada, sino probar que el sistema puede generar valor real sobre datos de fallas.

---

## 5. Experiencia deseada

Se tomó como referencia conceptual el caso de LA PYME, no como competidor directo, sino como benchmark de producto.

LA PYME es interesante por su enfoque de ERP liviano, amigable y pensado para empresas que necesitan una herramienta simple, accesible y práctica.

La inspiración para este proyecto es similar en experiencia, pero diferente en función:

| Referencia | Qué hace | Qué se toma como aprendizaje |
|---|---|---|
| LA PYME | ERP liviano para gestión operativa y administrativa | Simplicidad, claridad, experiencia amigable, foco en PyMEs |
| Proyecto Calidad | Plataforma liviana para análisis de fallas y calidad industrial | Inteligencia sobre datos técnicos de calidad |

La idea sería construir una experiencia “tipo ERP liviano”, pero aplicada a análisis de calidad ingenieril.

No se busca competir con un ERP tradicional. Se busca resolver un dolor más específico: **análisis técnico de calidad sobre datos industriales existentes**.

---

## 6. Criterios analizados hasta ahora

### 6.1 No empezar por una app completa

Se decidió no arrancar por una plataforma grande, porque eso aumenta complejidad y retrasa la validación.

Evitar inicialmente:

- ERP completo.
- QMS completo.
- Integraciones profundas con sistemas internos.
- Agentes de IA (Inteligencia Artificial) autónomos.
- Automatización total.
- Múltiples módulos de negocio al mismo tiempo.

Primero hay que validar el flujo mínimo de valor.

---

### 6.2 Separar carga, procesamiento y resultado

La estructura base del producto queda separada en tres partes:

```text
Interfaz de carga → Procesamiento controlado → Interfaz de resultado
```

Cada parte tiene una función distinta:

| Parte | Función |
|---|---|
| Interfaz de carga | Permitir que la empresa suba datos de calidad de forma simple |
| Procesamiento | Limpiar, validar, normalizar y analizar los datos |
| Interfaz de resultado | Mostrar hallazgos, indicadores, reportes y recomendaciones |

Esta separación evita mezclar experiencia de usuario, lógica de datos y salida analítica.

---

### 6.3 Distinguir tipos de usuarios

Se identificaron al menos dos capas de usuarios:

| Usuario | Uso principal |
|---|---|
| Usuario operativo | Carga, corrige o valida datos |
| Usuario de resultado | Consulta indicadores, reportes y hallazgos |

No necesariamente son la misma persona.

Ejemplos:

- Operario o analista: carga datos.
- Responsable de calidad: revisa resultados.
- Jefe de planta o gerencia: toma decisiones.

Esto es clave para diseñar pantallas simples y evitar que todos los usuarios vean la misma información.

---

### 6.4 Curado humano inicial

Se considera importante mantener una etapa de curado humano al inicio del proceso.

Motivo: los datos industriales suelen tener contexto tácito que no aparece en la planilla.

Ejemplos:

- Códigos internos de fallas.
- Cambios de criterio entre turnos.
- Columnas mal nombradas.
- Datos de retrabajo mezclados con producción normal.
- Observaciones escritas con lenguaje informal.
- Diferencias entre lo que se registra y lo que realmente ocurre en planta.

Por eso, en la primera etapa no conviene prometer automatización completa.

El enfoque correcto es:

```text
Automatización progresiva + criterio humano + plantillas reutilizables
```

A futuro, ese curado puede reducirse con:

- Checklists.
- Plantillas de carga.
- Diccionarios de fallas.
- Scripts de profiling de datos.
- Reglas de normalización.
- Aprendizajes reutilizables por cliente o industria.

---

### 6.5 No tratar la IA como magia

La IA debe pensarse como una capa posterior, no como el corazón inicial del sistema.

Primero debe existir una base sólida de datos y análisis.

Orden recomendado:

```text
Datos confiables → Indicadores → Patrones → Explicación asistida → Recomendaciones
```

La IA generativa puede servir para:

- Explicar resultados.
- Redactar reportes.
- Resumir hallazgos.
- Sugerir hipótesis de causa raíz.
- Ayudar a consultar datos en lenguaje natural.

Pero no debe reemplazar:

- Validación de datos.
- Cálculo estadístico.
- Reglas de calidad.
- Trazabilidad.
- Decisión técnica humana.

---

### 6.6 Evitar integración IT/OT al principio

Para el MVP, se decidió no conectar directamente con sistemas internos industriales.

No conectar inicialmente con:

- ERP (Enterprise Resource Planning / Sistema de Planificación de Recursos Empresariales).
- MES (Manufacturing Execution System / Sistema de Ejecución de Manufactura).
- SCADA (Supervisory Control and Data Acquisition / Supervisión, Control y Adquisición de Datos).
- PLC (Programmable Logic Controller / Controlador Lógico Programable).
- Bases internas críticas.

Primera estrategia recomendada:

```text
Exportación manual segura → Excel/CSV anonimizado → Carga en plataforma → Análisis
```

Esto reduce fricción comercial, técnica y de ciberseguridad.

Más adelante se puede evaluar:

- APIs (Application Programming Interfaces / Interfaces de Programación de Aplicaciones) controladas.
- Vistas de solo lectura.
- Bases intermedias.
- Roles y permisos.
- Logs de acceso.
- Separación IT/OT (Information Technology / Operational Technology).
- Gobierno de datos.

---

## 7. Stack técnico tomado como referencia

Se analizó una arquitectura moderna similar a la compartida por el creador de LA PYME.

Stack de referencia:

| Herramienta | Rol |
|---|---|
| Next.js | Frontend y backend liviano |
| Supabase | Autenticación, base de datos y almacenamiento |
| Trigger.dev | Tareas en segundo plano |
| Vercel | Hosting, infraestructura, dominio, firewall y observabilidad |
| Resend | Emails transaccionales y marketing |
| Ultracite | Linter y formateador |

Adaptación recomendada para el MVP:

```text
Next.js + Supabase + Trigger.dev + Vercel
```

Complementos posteriores:

- Resend para reportes por email.
- Ultracite, Biome o herramienta similar para mantener consistencia de código.
- Python si el análisis estadístico o predictivo supera lo conveniente en TypeScript.

---

## 8. Flujo mínimo del software

Flujo inicial esperado:

```text
Login
↓
Crear empresa o proyecto
↓
Subir archivo Excel/CSV
↓
Validar columnas
↓
Corregir errores básicos
↓
Procesar datos
↓
Guardar resultados
↓
Mostrar dashboard/reporte
↓
Descargar informe
```

Este flujo permite construir una primera versión sin integración directa con sistemas industriales.

---

## 9. Qué datos debería aceptar al principio

Campos mínimos posibles:

| Campo | Ejemplo |
|---|---|
| Fecha | 2026-06-20 |
| Producto | Pieza A |
| Lote | L2026-044 |
| Línea | Línea 2 |
| Turno | Noche |
| Tipo de falla | Fisura |
| Cantidad inspeccionada | 500 |
| Cantidad fallada | 18 |
| Sector | Control final |
| Observaciones | Falla concentrada en borde superior |

No todos los clientes van a tener estos campos desde el inicio. Por eso el sistema debe contemplar validación, mapeo y limpieza.

---

## 10. Resultados esperados del MVP

El MVP debería entregar resultados como:

- Ranking de fallas principales.
- Productos con mayor tasa de falla.
- Lotes problemáticos.
- Líneas o turnos con mayor concentración de defectos.
- Tendencias temporales.
- Alertas por aumentos anormales.
- Pareto de defectos.
- Reporte automático de calidad.
- Observaciones sobre calidad del dato.

Ejemplo de salida:

```text
La falla “Fisura” representa el 42% de los defectos del período. Se concentra principalmente en Línea 2, turno noche, y muestra un aumento respecto del promedio histórico. Se recomienda revisar parámetros de proceso, lote de materia prima y criterios de inspección.
```

---

## 11. Diferenciación del producto

El proyecto se ubica entre varias categorías, pero no encaja por completo en una sola.

| Categoría | Relación con el proyecto |
|---|---|
| ERP | No es ERP, pero puede adoptar una experiencia simple similar |
| QMS | No reemplaza un QMS, pero analiza datos de calidad |
| BI | Usa visualización e indicadores, pero busca ser más accionable |
| Data engineering | Ordena, limpia y estructura datos industriales |
| IA aplicada | Puede incorporar explicación, reportes y consulta inteligente |
| Consultoría de calidad | Captura criterio técnico y lo convierte en sistema repetible |

La propuesta se puede entender como:

> Una capa liviana de inteligencia de calidad para empresas industriales con datos dispersos y baja capacidad analítica interna.

---

## 12. Principios de diseño

Principios que deberían guiar el desarrollo:

1. Simplicidad antes que completitud.
2. Validar valor antes que escalar arquitectura.
3. Carga de datos rápida y poco pesada para el usuario.
4. Procesamiento transparente y trazable.
5. Resultados accionables, no solo gráficos.
6. Seguridad y bajo riesgo para sistemas industriales.
7. Curado humano inicial cuando el contexto lo requiera.
8. Automatización progresiva.
9. Experiencia liviana tipo SaaS (Software as a Service / Software como Servicio).
10. Foco inicial en fallas, defectos, rechazos y no conformidades.

---

## 13. Criterios para no desviarse

El proyecto debe evitar caer en tres errores:

### Error 1: construir una app demasiado grande

No hace falta resolver todos los módulos de calidad desde el principio.

### Error 2: vender IA sin base de datos sólida

La IA solo es útil si los datos están bien estructurados y el análisis base es confiable.

### Error 3: integrarse demasiado pronto con sistemas críticos

Las integraciones IT/OT deben quedar para una etapa posterior, cuando ya haya validación de valor.

---

## 14. Próxima decisión pendiente

Antes de buildear, falta definir con precisión el primer caso de uso.

Opciones posibles:

1. Análisis de fallas por producto.
2. Análisis de defectos por lote.
3. Análisis de rechazos por línea o turno.
4. Reporte automático mensual/semanal de calidad.
5. Pareto automático de no conformidades.

Recomendación inicial:

```text
Primer caso de uso = análisis de fallas desde Excel/CSV con reporte automático
```

Es el caso más generalizable y permite validar el núcleo del producto.

---

## 15. Definición corta del proyecto

Versión resumida:

> Plataforma liviana para empresas industriales que permite cargar datos de fallas, procesarlos automáticamente y convertirlos en reportes de calidad accionables, reduciendo análisis manual y respetando restricciones de seguridad IT/OT.

Versión orientada a producto:

> Un sistema tipo SaaS para transformar planillas y exportaciones de calidad en diagnóstico técnico, indicadores, alertas y reportes interpretables.

Versión orientada a MVP:

> Una app web donde el usuario sube un Excel o CSV de fallas, el sistema valida y procesa los datos, y devuelve un dashboard/reporte con los principales problemas de calidad.
