# Screen Inventory

## 1. Alcance

Este documento enumera las pantallas y vistas principales del MVP de Engineer.

El inventario se mantiene en un nivel general y estructural.

No define todavía contenido detallado, comportamiento técnico ni diseño visual.

## 2. Acceso

### Login

Permite al usuario ingresar al sistema.

### Selección de planta o entorno

Aparece únicamente cuando el usuario tiene acceso a más de una opción.

Permite elegir el contexto de trabajo antes de ingresar a la aplicación.

## 3. Inicio

### Dashboard

Vista principal del sistema.

Resume la situación general de calidad y funciona como punto de entrada hacia análisis y registros.

## 4. Configuración

### Configuración general

Permite acceder a la estructura configurable de la empresa o planta.

### Productos

Permite consultar y administrar productos.

### Operaciones

Permite consultar y administrar operaciones.

### Áreas o puestos

Permite consultar y administrar áreas o puestos de trabajo.

### Modos de falla

Permite consultar y administrar modos de falla.

### Relaciones de configuración

Permite vincular los elementos de la estructura industrial cuando sea necesario.

## 5. Controles

### Nuevo control

Permite registrar nueva información de calidad.

### Confirmación de carga

Informa que el control fue registrado correctamente.

## 6. Registros

### Historial de registros

Permite consultar los controles existentes.

### Detalle de registro

Permite acceder a la información de un control específico.

### Edición de registro

Permite modificar un registro existente cuando corresponda.

## 7. Análisis

### Vista general de análisis

Permite profundizar sobre la información mostrada en el dashboard.

### Análisis por dimensión

Permite revisar resultados desde distintos criterios de agrupación.

### Vista de registros relacionados

Permite acceder a los registros que explican un resultado o desviación.

## 8. Agente

### Panel del agente

Permite realizar consultas mediante lenguaje natural sin abandonar la aplicación.

### Resultado del agente

Presenta la respuesta y, cuando corresponda, refleja cambios sobre la vista actual.

## 9. Vistas globales

### Perfil de usuario

Permite consultar información básica del usuario y su sesión.

### Cambio de planta o entorno

Permite cambiar el contexto de trabajo cuando el usuario dispone de más de una opción.

## 10. Relación general

El recorrido principal del MVP se organiza así:

Acceso
→ selección de contexto cuando corresponda
→ dashboard
→ configuración, controles, registros o análisis
→ interacción opcional con el agente
