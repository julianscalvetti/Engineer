# User Flows

## 1. Alcance

Este documento describe los flujos generales del MVP de Engineer.

Parte del supuesto de que el usuario ya tiene una cuenta, una empresa y un acceso definido.

No se detallan todavía reglas de negocio, validaciones ni lógica técnica.

## 2. Configuración inicial

Objetivo:

Permitir que la empresa defina la estructura básica sobre la cual trabajará el sistema.

Flujo general:

Configuración
→ definición de productos
→ definición de operaciones
→ definición de áreas o puestos
→ definición de modos de falla
→ estructura disponible para operar

## 3. Registro de controles

Objetivo:

Permitir que un usuario registre información de calidad asociada a la estructura previamente configurada.

Flujo general:

Nuevo control
→ selección del contexto operativo
→ carga de información
→ revisión
→ guardado
→ registro disponible en el sistema

## 4. Consulta de registros

Objetivo:

Permitir que el usuario consulte los controles cargados y acceda a su información.

Flujo general:

Registros
→ búsqueda o filtrado
→ listado de resultados
→ selección de un registro
→ acceso al detalle

## 5. Análisis

Objetivo:

Permitir que el usuario visualice el comportamiento general de la calidad y profundice sobre una desviación.

Flujo general:

Dashboard
→ detección de un indicador relevante
→ apertura de una vista de análisis
→ aplicación de filtros o agrupaciones
→ revisión de resultados
→ acceso a registros relacionados

## 6. Interacción con el agente

Objetivo:

Permitir que el usuario consulte información y opere vistas de análisis mediante lenguaje natural.

Flujo general:

Abrir agente
→ realizar consulta
→ interpretación de la intención
→ consulta o modificación de la vista
→ presentación del resultado
→ profundización opcional

## 7. Relación entre flujos

Los flujos se conectan de la siguiente forma:

Configuración inicial
→ registro de controles
→ consulta de registros
→ análisis
→ interacción con el agente

El agente funciona como una capa adicional sobre los datos y funcionalidades existentes.

No reemplaza la configuración, el registro ni el análisis estructurado.
