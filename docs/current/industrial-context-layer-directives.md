# Industrial Context Layer — Directivas del proyecto

## 1. Definición central

Engineer actúa como una capa de intermediación entre la complejidad operativa de una industria y los sistemas analíticos o agentes de IA.

La propuesta no consiste solamente en:

- cargar datos;
- mostrar dashboards;
- conectar un chatbot;
- ejecutar cálculos predefinidos.

El activo central es construir un contexto industrial estructurado, gobernado, trazable y comprensible para software y LLMs.

Industrial Context Layer:

Capa estructurada y gobernada que representa cómo una empresa fabrica, controla y registra desvíos, y permite que dashboards, APIs, MCPs y agentes consulten esa información de forma segura y trazable.

---

## 2. Relación con el Motor de Perfilado Operativo y Diagnóstico

El Motor de Perfilado Operativo y Diagnóstico es el proceso mediante el cual Engineer entiende cómo funciona una empresa y construye su Industrial Context Layer.

Secuencia conceptual:

```text
Empresa industrial
→ relevamiento o datos existentes
→ transformación y validación
→ Industrial Context Layer
→ dashboard / API / MCP / agente
```

El Motor de Perfilado descubre y estructura.

El Industrial Context Layer es el resultado consolidado y reutilizable.

---

## 3. Dos caminos de entrada

### Camino A — La empresa tiene datos existentes

Flujo:

```text
Datos existentes
→ Normalización
→ Curado
→ Industrial Context Layer
```

### Camino B — La empresa no tiene datos utilizables

Flujo:

```text
Onboarding guiado
→ Configuración inicial del modelo
→ Captura operativa piloto
→ Validación y ajuste
→ Industrial Context Layer
```

Ambos caminos deben converger en la misma estructura conceptual.

---

## 4. Definición de normalización

Normalización:

Transformación de datos, términos y estructuras heterogéneas de la empresa a un modelo estándar y configurable de Engineer.

Incluye:

- unificación de nombres;
- estandarización de códigos;
- eliminación o consolidación de duplicados;
- conversión de fechas, turnos, cantidades y formatos;
- mapeo de columnas y campos externos al modelo Engineer;
- relación entre empresa, planta, cliente, pieza, operación, modo de falla y control;
- transformación de históricos a estructuras consistentes;
- homologación de conceptos equivalentes usados con nombres diferentes.

La normalización resuelve la forma técnica del dato.

---

## 5. Definición de curado

Curado:

Validación técnica y contextual de los datos normalizados para asegurar coherencia, calidad, significado industrial y aptitud para análisis.

Incluye:

- detección de campos faltantes;
- identificación de relaciones inválidas;
- revisión de cantidades anómalas;
- resolución de ambigüedades;
- validación de pertenencia entre piezas, operaciones y fallas;
- confirmación de definiciones con la empresa;
- documentación de excepciones;
- identificación de limitaciones de uso;
- validación de comparabilidad entre registros;
- marcación de datos dudosos o incompletos.

El curado resuelve el significado y la confiabilidad industrial del dato.

---

## 6. Rama sin datos existentes

El onboarding no es suficiente para construir contexto confiable.

El onboarding genera una hipótesis inicial del modelo industrial.

Después debe existir:

### Configuración inicial del modelo

Creación inicial de:

- empresas;
- plantas;
- clientes;
- piezas;
- operaciones;
- modos de falla;
- formularios;
- relaciones;
- campos obligatorios;
- métricas iniciales.

### Captura operativa piloto

Uso acotado del sistema para generar datos reales y observar:

- cómo se cargan los datos;
- qué campos faltan;
- qué conceptos son ambiguos;
- qué excepciones aparecen;
- qué relaciones deben corregirse;
- si las métricas pueden calcularse correctamente.

### Validación y ajuste

Comparación entre:

- lo declarado durante el onboarding;
- lo observado durante el piloto.

Ajustar:

- nombres;
- relaciones;
- formularios;
- catálogos;
- reglas;
- métricas;
- criterios;
- permisos.

---

## 7. Componentes del Industrial Context Layer

Estructura:

```text
Industrial Context Layer
│
├── Modelo de datos
├── Semántica de dominio
├── Reglas y métricas
├── Datos normalizados y validados
├── Criterios internos de la empresa
├── Servicios de consulta
├── Control de acceso
└── Evidencia y trazabilidad
```

### Modelo de datos

Entidades, relaciones y restricciones que representan la operación industrial.

### Semántica de dominio

Significado industrial de cada entidad, campo, relación y evento.

### Reglas y métricas

Definiciones determinísticas de cálculo e interpretación.

### Datos normalizados y validados

Información transformada y curada.

### Criterios internos de la empresa

Convenciones, umbrales, definiciones y excepciones propias del cliente.

### Servicios de consulta

Funciones reutilizables para dashboards, APIs, MCPs y agentes.

### Control de acceso

Separación por empresa, planta, usuario y rol, aplicando mínimo privilegio.

### Evidencia y trazabilidad

Capacidad de vincular cada resultado con los registros que lo originaron.

---

## 8. Validación e implementación asistida

Después de construir el Industrial Context Layer debe existir una etapa de validación e implementación asistida.

El soporte humano debe enfocarse en:

- validar relaciones del proceso;
- ajustar conceptos técnicos;
- confirmar campos y métricas;
- acompañar la puesta en marcha;
- resolver excepciones;
- capacitar al usuario;
- verificar que el modelo represente la operación real.

La consultoría no debe desaparecer, pero debe ser:

- estandarizada;
- acotada;
- apoyada por el producto;
- repetible;
- cada vez menos dependiente de trabajo manual.

---

## 9. Salida mínima esperada

La salida de una implementación MVP debe incluir:

- modelo industrial configurado;
- datos normalizados;
- reglas y métricas contextualizadas;
- formularios operativos;
- dashboard operativo;
- contexto preparado para MCP o agente;
- trazabilidad básica;
- usuarios y permisos configurados.

---

## 10. Principio de escalabilidad

Escalabilidad =

```text
software reutilizable
+ metodología repetible
+ implementación asistida
+ intervención humana acotada
+ conocimiento acumulado entre implementaciones
```

Cada nueva empresa debería mejorar:

- plantillas;
- preguntas de onboarding;
- reglas de normalización;
- patrones de curado;
- modelos sectoriales;
- semántica;
- herramientas de consulta.

---

## 11. Relación con IA y MCP

El Industrial Context Layer debe ser independiente del proveedor de LLM.

Debe poder alimentar:

- MCP de Engineer conectado al LLM del cliente;
- agente integrado dentro de Engineer;
- dashboards;
- APIs;
- futuras integraciones.

El LLM interpreta y razona.

Engineer controla:

- los datos;
- la semántica;
- las métricas;
- los permisos;
- la evidencia;
- la trazabilidad.

No permitir como arquitectura objetivo:

- acceso libre del LLM a PostgreSQL;
- ejecución de SQL arbitrario;
- cálculos críticos no gobernados;
- acceso entre empresas;
- respuestas sin evidencia.

---

## 12. Directiva de producto

Engineer no debe posicionarse principalmente como un chatbot ni como un dashboard.

Engineer construye la infraestructura de contexto que permite que sistemas analíticos y agentes comprendan una industria compleja de forma segura, estructurada y trazable.

Esta directiva debe considerarse vigente para decisiones futuras de:

- producto;
- arquitectura;
- modelo de datos;
- onboarding;
- UX;
- MCP;
- IA;
- implementación;
- escalabilidad.
