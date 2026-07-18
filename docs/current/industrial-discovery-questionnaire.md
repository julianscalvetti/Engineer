# Relevamiento industrial

## Objetivo

Documentar el cuestionario utilizado para relevar nuevas empresas industriales.

Este cuestionario es genérico y reutilizable. No define una estructura fija. Sirve para descubrir cómo funciona cada empresa y adaptar el modelo de Engineer.

## 1. Estructura de negocio

### Clientes

- ¿Qué clientes deben representarse?
- ¿Cómo se identifica cada cliente?
- ¿Existen clientes activos e inactivos?
- ¿Qué historial debe conservarse por cliente?

### Plantas

- ¿La empresa opera en una o varias plantas?
- ¿Las plantas comparten procesos, piezas o criterios de calidad?
- ¿Qué datos son necesarios para identificar una planta?
- ¿El análisis debe poder filtrarse por planta?

### Productos/piezas

- ¿Qué productos o piezas se fabrican?
- ¿Cómo se identifica oficialmente cada producto o pieza?
- ¿Una pieza pertenece a un cliente específico?
- ¿Existen piezas activas e inactivas?
- ¿Qué historial debe conservarse por pieza?

## 2. Proceso productivo

### Operaciones

- ¿Qué operaciones forman parte del proceso productivo?
- ¿Cómo se identifica cada operación?
- ¿Las operaciones tienen código operativo, nombre o ambos?
- ¿El orden de las operaciones es relevante para el análisis?

### Relaciones entre piezas y operaciones

- ¿Cada pieza tiene operaciones propias?
- ¿Hay operaciones que se repiten entre piezas?
- ¿Una misma operación tiene distinto significado según la pieza?
- ¿Qué cambios históricos del proceso deben conservarse?

### Configuración del proceso

- ¿Quién define o modifica la configuración del proceso?
- ¿Qué información mínima se necesita para configurar una pieza?
- ¿Qué información mínima se necesita para configurar una operación?
- ¿Qué elementos pueden quedar inactivos sin perder historial?

## 3. Calidad

### Qué representa un control

- ¿Qué evento o actividad se considera un control de calidad?
- ¿En qué momento del proceso se registra?
- ¿El control se asocia a una pieza y operación específica?
- ¿Puede existir un control sin fallas detectadas?

### Qué datos se registran

- ¿Qué fecha debe registrarse?
- ¿Qué turno debe registrarse?
- ¿Se registra operario, equipo o responsable?
- ¿Qué cantidad controlada se informa?
- ¿Se registran observaciones?

### Cómo se registran fallas

- ¿Qué modos de falla pueden aparecer en cada operación?
- ¿Cómo se identifica cada modo de falla?
- ¿Puede una falla repetirse dentro del mismo control?
- ¿Cada falla requiere cantidad detectada?
- ¿Los modos de falla se reutilizan entre operaciones?

### Qué análisis se esperan

- ¿Qué indicadores de calidad son necesarios?
- ¿Qué comparaciones son importantes?
- ¿Qué rankings o prioridades se esperan?
- ¿Qué preguntas debe responder el análisis?

## 4. Datos

### Identificadores principales

- ¿Cuáles son los identificadores oficiales de clientes?
- ¿Cuáles son los identificadores oficiales de piezas?
- ¿Cuáles son los identificadores operativos de operaciones?
- ¿Existen códigos internos para modos de falla?

### Datos obligatorios

- ¿Qué datos son indispensables para guardar un control?
- ¿Qué datos son indispensables para registrar una falla?
- ¿Qué datos deben validarse antes de aceptar una carga?

### Datos opcionales

- ¿Qué datos aportan contexto pero no son obligatorios?
- ¿Qué observaciones o textos libres se registran?
- ¿Qué datos podrían agregarse en una etapa posterior?

### Histórico

- ¿Qué datos deben conservarse aunque queden inactivos?
- ¿Qué cambios de configuración deben mantener trazabilidad?
- ¿Qué período histórico se necesita analizar?

## 5. Usuarios y permisos

### Quién carga

- ¿Qué usuarios cargan controles?
- ¿Desde dónde cargan los datos?
- ¿Qué restricciones tienen al cargar?

### Quién administra

- ¿Qué usuarios administran clientes, piezas, operaciones y modos de falla?
- ¿Quién puede activar o desactivar elementos de configuración?
- ¿Qué cambios requieren autorización?

### Quién consulta

- ¿Qué usuarios consultan indicadores?
- ¿Qué filtros o vistas necesita cada tipo de usuario?
- ¿Hay información que deba quedar restringida?

## 6. Resultados esperados

### Indicadores necesarios

- ¿Qué indicadores deben calcularse?
- ¿Debe calcularse DPU?
- ¿Qué métricas se usan actualmente?
- ¿Qué umbrales o referencias se consideran relevantes?

### Filtros requeridos

- ¿Qué filtros temporales se necesitan?
- ¿Se requiere filtrar por cliente?
- ¿Se requiere filtrar por pieza?
- ¿Se requiere filtrar por operación?
- ¿Se requiere filtrar por turno?

### Preguntas que el sistema debe responder

- ¿Cómo evoluciona la calidad en el tiempo?
- ¿Qué cliente concentra más fallas?
- ¿Qué pieza concentra más fallas?
- ¿Qué operación concentra más fallas?
- ¿Qué turno presenta peor desempeño?
- ¿Cuáles son los principales modos de falla?
- ¿Qué fallas explican la mayor parte del problema?

## Alcance del cuestionario

Este cuestionario no define una estructura fija. Sirve para descubrir cómo funciona cada empresa y adaptar el modelo de Engineer.
