# Engineer — Product Strategy Checkpoint

## 1. Definición actual

Engineer es una infraestructura de contexto industrial que intermedia entre la complejidad operativa de una empresa y sistemas analíticos o agentes de IA.

No debe definirse principalmente como:

- dashboard;
- chatbot;
- software de reportes;
- agente con preguntas predefinidas.

## 2. Núcleo del producto

El núcleo está compuesto por:

### Motor de Perfilado Operativo y Diagnóstico

Proceso mediante el cual Engineer:

- releva cómo fabrica la empresa;
- identifica cómo controla;
- entiende cómo registra desvíos;
- detecta entidades, relaciones, reglas y criterios;
- transforma esa operación en un modelo estándar configurable.

### Industrial Context Layer

Activo resultante que contiene:

- modelo de datos;
- semántica de dominio;
- reglas y métricas;
- datos normalizados y validados;
- criterios internos;
- servicios de consulta;
- control de acceso;
- evidencia y trazabilidad.

## 3. Flujo de implementación

### Empresa con datos existentes

```text
Datos existentes
→ normalización
→ curado
→ Industrial Context Layer
```

### Empresa sin datos utilizables

```text
Onboarding guiado
→ configuración inicial del modelo
→ captura operativa piloto
→ validación y ajuste
→ Industrial Context Layer
```

Ambos caminos convergen en:

```text
Industrial Context Layer
→ validación e implementación asistida
→ salida MVP
```

## 4. Definiciones vigentes

### Normalización

Transformación de datos, términos y estructuras heterogéneas al modelo estándar configurable de Engineer.

### Curado

Validación técnica y contextual para asegurar coherencia, significado industrial, confiabilidad y aptitud para análisis.

### Configuración inicial del modelo

Creación inicial de entidades, relaciones, formularios, catálogos, campos y métricas.

### Captura operativa piloto

Etapa de uso acotado para generar evidencia real y validar si el modelo representa correctamente la operación.

### Validación e implementación asistida

Intervención humana acotada para confirmar relaciones, semántica, métricas, excepciones y puesta en marcha.

## 5. Salida mínima esperada

- modelo industrial configurado;
- datos normalizados;
- reglas y métricas contextualizadas;
- formularios operativos;
- dashboard operativo;
- usuarios y permisos;
- trazabilidad básica;
- contexto preparado para MCP o agente.

## 6. Estado funcional actual

Completado:

- configuración industrial;
- registro de controles;
- historial;
- dashboard;
- autenticación;
- roles operativo e ingeniero;
- protección de rutas;
- Supabase operativo.

El flujo funcional validado del MVP es:

```text
Configuración → Registro → Historial → Dashboard
```

## 7. Decisiones descartadas

Registrar explícitamente:

- reportes automáticos no son prioridad ni función central;
- asistente con preguntas estáticas descartado;
- consultas predefinidas no representan la visión final;
- no desarrollar agente sin LLM;
- no exponer SQL arbitrario a un LLM;
- no permitir acceso directo del LLM a PostgreSQL;
- no tratar el dashboard como núcleo diferencial.

## 8. Arquitectura futura

La arquitectura futura debe preservar a Engineer como fuente gobernada de contexto industrial.

El Industrial Context Layer debe poder alimentar:

- dashboards;
- APIs;
- MCP de Engineer conectado al LLM del cliente;
- agente integrado dentro de Engineer;
- futuras integraciones.

El LLM interpreta y razona.

Engineer controla:

- datos;
- semántica;
- métricas;
- permisos;
- evidencia;
- trazabilidad.

## 9. Funciones postergadas

No desarrollar todavía:

- reportes automáticos como función central;
- agente sin LLM;
- acceso libre de LLM a datos productivos;
- SQL arbitrario generado o ejecutado por LLM;
- consultas estáticas como reemplazo de una capa semántica real;
- funcionalidades que traten el dashboard como diferencial principal.

## 10. Directiva vigente

Engineer debe evolucionar como infraestructura de contexto industrial.

El objetivo no es sumar pantallas o automatizaciones aisladas, sino consolidar una capa estructurada, gobernada, trazable y útil para análisis, APIs, MCPs y agentes de IA.

Esta directiva orienta decisiones futuras de:

- producto;
- arquitectura;
- modelo de datos;
- onboarding;
- UX;
- MCP;
- IA;
- implementación;
- escalabilidad.
