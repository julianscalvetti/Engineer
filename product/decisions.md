# Product Decisions

## 1. Product Construction

- Engineer se reconstruye desde una base técnica limpia.
- No se migra ni repara el MVP anterior.
- El código heredado solo puede reutilizarse si demuestra valor claro y compatibilidad con el nuevo alcance.
- La aplicación principal permanece en la raíz del repositorio Next.js.

## 2. Design Approach

- Figma es la fuente visual de referencia.
- El template v0 se utiliza como guía de layout, componentes, densidad y estilo.
- El template no forma parte del código ejecutable.
- No se diseña toda la interfaz desde cero.
- Se diseñan únicamente flujos nuevos, estados complejos y componentes específicos de Engineer.
- La prioridad es la estructura funcional antes que el refinamiento visual.

## 3. Development Approach

- El desarrollo se realiza mediante vertical slices.
- Cada vertical debe incluir datos, lógica, interfaz y validación.
- No se desarrollan múltiples módulos incompletos en paralelo.
- Cada etapa debe terminar con lint y build aprobados.
- Los cambios deben quedar versionados mediante checkpoints y commits claros.

## 4. Technical Baseline

- Next.js y TypeScript para la aplicación.
- Supabase y PostgreSQL para persistencia.
- Vercel para despliegue.
- Row Level Security para separación de datos.
- Eliminación lógica y trazabilidad para registros principales.
- Los tipos de base de datos deben generarse desde el schema definitivo cuando sea posible.

## 5. Data Model

- El nuevo schema Supabase se define desde cero.
- database/domain-model/ es una referencia conceptual, no un schema ejecutable.
- No existe sincronización automática entre el modelo de dominio y Supabase.
- El modelo del MVP debe contener solo las entidades necesarias para los flujos incluidos.
- Cada métrica visible debe tener definición y respaldo en datos persistidos.

## 6. User and Scope Assumptions

- El usuario ya está autenticado.
- La empresa y los permisos ya están resueltos.
- El usuario trabaja dentro de una planta o scope definido.
- La selección de planta solo aparece cuando el usuario tiene más de una opción.
- La vista corporativa es un scope analítico, no una planta operativa.

## 7. Integrated Agent

- El agente está integrado dentro de la aplicación.
- No es un chatbot separado.
- Conoce el contexto de la pantalla y los filtros activos.
- Opera mediante herramientas controladas.
- En la primera versión tiene acceso de solo lectura a datos operativos.
- Puede consultar métricas, aplicar filtros, cambiar agrupaciones, navegar y explicar resultados.
- No puede generar SQL libre.
- No puede modificar registros operativos sin una futura política explícita de confirmación y permisos.

## 8. Security and IT/OT

- El MVP no se conecta directamente con ERP, MES, SCADA, PLC ni redes OT.
- No se solicitan credenciales de sistemas industriales.
- Se aplica mínimo privilegio.
- Toda acción relevante debe ser trazable.
- Las integraciones futuras deben realizarse mediante APIs controladas, vistas seguras o capas intermedias.

## 9. Explicitly Rejected for the Current MVP

- OCR.
- Dependencia central de CSV.
- localStorage como persistencia.
- Machine learning.
- Predictive quality.
- Root-cause analysis autónomo.
- Agente autónomo con escritura libre.
- Dashboard corporativo avanzado.
- Aplicación móvil.
- Reportes PDF.
- Emails automáticos.
- Integración industrial directa.

## 10. Decision Rule

Cuando exista una contradicción entre documentación antigua y este archivo, prevalece product/decisions.md junto con product/scope.md.

## Ingestion pipeline — July 2026

- Se adopta la especificación técnica v2.1 del pipeline de ingesta industrial.
- ROMET será el primer caso piloto.
- El primer componente será el Technical Profiler.
- El pipeline será configurable y no hardcodeado por empresa.
- Los archivos originales serán inmutables.
- No se ejecutarán macros.
- El dry run se basará en un Import Plan.
- No se permitirán cargas parciales durante el MVP.
- No se modificarán maestros automáticamente.
- Supabase staging y commit quedan para una etapa posterior.

## Motor genérico + configuración por empresa

Estado: Aprobada

Carácter: Principio arquitectónico no negociable

### Decisión

Todo el pipeline de ingestión de Engineer debe implementarse como un motor genérico, reutilizable y desacoplado de empresas concretas.

Las particularidades de cada empresa deben declararse mediante configuración versionada, nunca mediante lógica hardcodeada en el código fuente.

La separación obligatoria es:

```text
Motor genérico de Engineer
+
Configuración específica por empresa
=
Implementación concreta
```

### Aplicación

El código genérico incluye:

- Technical Profiling
- Source Selection
- Semantic Mapping
- diagnóstico de granularidad
- normalización
- validación
- staging
- Import Plan
- commit
- auditoría
- rollback

La configuración por empresa puede incluir:

- nombres de hojas;
- rangos;
- encabezados;
- nombres de columnas;
- equivalencias semánticas;
- tipos de estructura;
- reglas de transformación;
- claves de granularidad;
- catálogos;
- criterios de validación;
- decisiones aprobadas manualmente.

### Restricciones

No se permite en el motor genérico:

- condicionar lógica por nombre de empresa;
- condicionar lógica por nombre específico de una hoja;
- leer columnas mediante nombres hardcodeados de un cliente;
- crear scripts exclusivos para una empresa;
- incorporar excepciones específicas dentro de funciones compartidas;
- asumir que todas las empresas registran controles, fallas o cantidades de la misma manera.

Ejemplos incorrectos:

```ts
if (company === "ROMET") { ... }

if (sheetName === "BASE DE REGISTRO") { ... }

row["COD PIEZA"]
```

Ejemplo correcto:

```ts
const sourceColumn = mapping.fields.product_external_code.source_column
```

### Caso ROMET

ROMET es:

- el primer caso real de validación;
- una configuración específica;
- una fuente de patrones reutilizables;
- un posible origen de templates manufactureros.

ROMET no debe convertirse en una dependencia del código genérico.

### Escalabilidad

El conocimiento acumulado debe transformarse en:

- primitivas genéricas;
- layouts reutilizables;
- transformaciones configurables;
- validaciones parametrizables;
- templates industriales versionados.

No debe transformarse en ramas de código por cliente.

### Regla de revisión

Toda nueva implementación del pipeline debe revisarse preguntando:

> “¿Esta lógica funcionaría para otra empresa cambiando únicamente la configuración?”

Si la respuesta es no, la implementación debe rediseñarse antes de incorporarse.

## Motor de Perfilado y Diagnostico v1 - Frozen

Estado: Frozen

Fecha: 2026-07-17

### Decision

Se congela el Motor de Perfilado y Diagnostico v1 como contrato estable para
evaluar archivos Excel industriales antes de staging, normalizacion, Import Plan
o carga a Supabase.

El alcance congelado incluye:

- Technical Profiler para `.xlsx` en modo lectura.
- Semantic Mapping & Diagnosis Engine para mapping declarativo por YAML.
- Mapping Execution Preview con diagnostico por registro.
- Estados `valid`, `warning`, `pending_review` y `rejected`.
- Trazabilidad a archivo, hoja, fila, columna/celda y configuracion aplicada.

### Evidencia validada

La version v1 fue validada con evidencia multiindustria en:

- ROMET.
- Alimentos.
- Forja.
- Neon.
- Tambo.

La evidencia confirma que el motor cubre el subconjunto v1: Excel `.xlsx`,
fuentes tabulares, catalogos simples, lookups configurables, mediciones por fila
fuente y diagnostico de calidad de datos.

### Principio vigente

El motor permanece generico y reutilizable. Las diferencias por empresa se
resuelven mediante configuracion versionada:

- seleccion de hojas, rangos y encabezados;
- layouts soportados;
- mapeos semanticos;
- transformaciones;
- catalogos y lookups;
- politicas de diagnostico;
- exclusiones explicitas de fuentes derivadas o fuera de alcance.

No se permiten ramas de codigo, excepciones ni comportamiento hardcodeado por
empresa, archivo, hoja o industria.

### Cambios futuros

Futuras ampliaciones del motor solo se aceptan ante una brecha repetible y
bloqueante que:

- aparezca en mas de un caso o pueda formularse como patron generico;
- no pueda resolverse con configuracion existente;
- bloquee la incorporacion de una empresa dentro del alcance del pipeline;
- mantenga el principio de motor generico + configuracion por empresa.

Problemas puntuales de datos, catalogos incompletos, valores invalidos,
formularios, reportes agregados, dashboards, pivots, formulas ejecutables y
texto libre normalizado no justifican por si solos modificar v1.
