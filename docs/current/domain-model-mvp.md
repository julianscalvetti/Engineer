# Modelo de dominio MVP

## Contexto

Engineer debe representar procesos de calidad manufacturera mediante configuraciones adaptables por empresa.

## Objetivo

Engineer busca representar procesos de calidad manufacturera mediante una estructura configurable y datos discriminables.

El objetivo del modelo conceptual es separar la configuración industrial del proceso de los registros operativos generados durante los controles de calidad.

Este documento es una referencia conceptual para futuras decisiones de modelo de datos. No define tablas, columnas técnicas ni arquitectura de implementación.

## Principio general

Separar:

- Configuración industrial.
- Registros operativos.

La configuración industrial describe qué se controla y cómo se estructura el proceso.

Los registros operativos describen qué ocurrió en cada control realizado.

## Configuración industrial

Jerarquía:

```text
Cliente
→ Pieza
→ Operación
→ Modo de falla
```

### Cliente

- Representa al cliente para el cual se fabrican piezas.
- Tiene nombre.
- Puede quedar inactivo sin perder historial.
- No debe existir sin piezas asociadas.

### Pieza

- Entidad única.
- Identificada por código oficial y nombre.
- Puede estar activa/inactiva.
- Pertenece a un único cliente.

### Operación

- Representa una etapa del proceso productivo.
- Identificada por código operativo y nombre.
- Pertenece a una única pieza.
- No se comparte entre piezas.

### Modo de falla

- Representa un defecto posible dentro de una operación.
- Tiene nombre.
- Puede tener código interno.
- Puede aparecer en distintas operaciones.
- Debe permitir reutilización cuando corresponda.

## Registro operativo

### Control

Un control representa un registro operativo de calidad.

Debe contener:

- Fecha.
- Turno.
- Operario como texto libre.
- Cliente.
- Pieza.
- Operación.
- Cantidad controlada obligatoria.
- Observaciones opcionales.
- Fallas detectadas.

Reglas:

- Un control pertenece a una pieza y operación determinada.
- Un control puede no tener fallas.
- Un control puede tener múltiples fallas.
- Una falla dentro de un control no puede repetirse.
- Cada falla registrada requiere cantidad.

### Fallas

- Cada falla registra modo de falla y cantidad detectada.

## Permisos generales

- Existe un usuario con capacidad administrativa.
- Los usuarios operativos pueden cargar controles según permisos.
- La modificación de configuración requiere autorización.

## Análisis esperados

El modelo conceptual debe permitir analizar:

- Evolución DPU.
- DPU por cliente.
- DPU por pieza.
- DPU por operación.
- DPU por turno.
- Ranking de piezas.
- Ranking de operaciones.
- Top modos de falla.
- Pareto de fallas.
- Filtros temporales.

## Decisiones descartadas

Quedan fuera del alcance conceptual del MVP:

- Puestos/áreas.
- Producción total.
- Características dimensionales.
- Metrología.
- Acciones correctivas.
- Integraciones industriales.

## Alcance del documento

Este documento es conceptual y será usado como entrada para el futuro modelo de datos.

No agrega reglas no definidas.
No diseña base de datos.
No define arquitectura.
