# Modelo de datos SaaS para calidad en manufactura discreta

## Objetivo

Este boceto define un primer modelo relacional en PostgreSQL para una plataforma SaaS de calidad industrial orientada a manufactura discreta.

El objetivo es representar como una empresa fabrica, controla caracteristicas de calidad, registra resultados, identifica desvios, dispone cantidades afectadas y gestiona acciones posteriores.

No incluye frontend, API, autenticacion, IA, integraciones, MCP, microservicios ni dashboards.

## Flujo universal de control

El modelo parte del siguiente criterio universal:

```text
Objeto producido
-> Operacion o etapa del proceso
-> Unidad de ejecucion
-> Tiempo y contexto operativo
-> Caracteristica o variable controlada
-> Criterio de aceptacion
-> Resultado de evaluacion
-> Desvio
-> Cantidad y disposicion
-> Accion posterior
```

El flujo no se implementa como una cadena rigida de tablas. Se traduce a entidades relacionales con responsabilidades separadas:

- configuracion del proceso;
- configuracion del control;
- registros operativos;
- gestion de desvios;
- acciones posteriores.

## Entidades principales

### Organizacion

- `companies`: empresas usuarias del SaaS.
- `plants`: plantas pertenecientes a una empresa.

### Configuracion del proceso

- `products`: productos, piezas, lotes o conjuntos fabricados en una planta.
- `operations`: operaciones o etapas productivas disponibles en una planta.
- `product_operations`: ruta de proceso de un producto, con secuencia por operacion.
- `resources`: maquinas, lineas, puestos, celulas u otros recursos productivos.
- `operation_resources`: recursos habilitados para ejecutar una operacion.

### Configuracion del control

- `control_characteristics`: caracteristicas controladas para una combinacion producto-operacion.
- `acceptance_criteria`: criterios de aceptacion versionados por vigencia temporal.
- `acceptance_criterion_allowed_values`: valores categoricos permitidos para un criterio.

### Registros operativos

- `control_records`: evaluacion de una unica caracteristica controlada en un contexto operativo concreto.

### Gestion de desvios

- `failure_modes`: catalogo de modos de falla generales o especificos.
- `record_failures`: desvios registrados a partir de un control no conforme.
- `dispositions`: disposiciones configurables, como retrabajo, rechazo o scrap.

### Acciones posteriores

- `corrective_actions`: acciones simples asociadas a un desvio. No modela todavia CAPA ni 8D completo.

## Relaciones principales

| Relacion | Cardinalidad |
|---|---|
| `companies` -> `plants` | 1:N |
| `plants` -> `products` | 1:N |
| `plants` -> `operations` | 1:N |
| `plants` -> `resources` | 1:N |
| `products` -> `product_operations` | 1:N |
| `operations` -> `product_operations` | 1:N |
| `operations` -> `operation_resources` | 1:N |
| `resources` -> `operation_resources` | 1:N |
| `product_operations` -> `control_characteristics` | 1:N |
| `control_characteristics` -> `acceptance_criteria` | 1:N |
| `acceptance_criteria` -> `acceptance_criterion_allowed_values` | 1:N |
| `control_characteristics` -> `control_records` | 1:N |
| `acceptance_criteria` -> `control_records` | 1:N |
| `control_records` -> `record_failures` | 1:N |
| `failure_modes` -> `record_failures` | 1:N |
| `dispositions` -> `record_failures` | 1:N |
| `record_failures` -> `corrective_actions` | 1:N |

## Decisiones de diseno

1. `control_characteristics` se asocia a `product_operations`.
   Esto modela la combinacion relevante producto + operacion + caracteristica sin crear una estructura universal innecesaria.

2. `control_records` no duplica `product_id` ni `operation_id`.
   Ambos se obtienen por la ruta:

   ```text
   control_records
   -> control_characteristics
   -> product_operations
   -> products / operations
   ```

3. `control_records` conserva `plant_id` y `resource_id` como contexto directo.
   La planta permite filtrar y auditar registros operativos sin joins profundos. El recurso representa la unidad real de ejecucion del control.

4. `control_records.acceptance_criterion_id` identifica el criterio exacto aplicado.
   Esto evita perder trazabilidad cuando cambia la especificacion de una caracteristica.

5. Una fila de `control_records` representa una unica caracteristica evaluada.
   No se modelan todavia formularios de inspeccion con multiples mediciones agrupadas.

6. La caracteristica y el criterio estan separados.
   `control_characteristics` define que se controla; `acceptance_criteria` define contra que se evalua.

7. Los criterios tienen vigencia temporal.
   El esquema usa una restriccion de exclusion para impedir, razonablemente, criterios activos solapados para una misma caracteristica.

8. `unit_of_measure` es texto.
   No se usa enum ni catalogo de unidades en esta primera version.

9. `control_characteristics.criticality` y `failure_modes.severity` son conceptos separados.
   La criticidad describe la importancia de la caracteristica. La severidad describe el impacto del modo de falla.

10. `failure_modes` permite alcance flexible sin motor generico:
    - modo general por planta;
    - modo asociado a una ruta producto-operacion;
    - modo asociado a una caracteristica especifica.

11. `dispositions` es tabla configurable.
    No se modela como texto libre ni como enum rigido.

12. `products.plant_id` se mantiene en esta version.
    La posibilidad de productos compartidos entre plantas queda como decision pendiente.

## Supuestos

- Manufactura discreta es el dominio objetivo.
- Una ruta de proceso pertenece a un producto dentro de una planta.
- Una operacion y un recurso pertenecen a la misma planta para poder relacionarse.
- Un registro puede estar pendiente o no aplicar sin valor observado.
- Algunos desvios pueden seleccionarse manualmente y no derivarse automaticamente del valor observado.
- Las cantidades se modelan con unidad de medida textual.

## Limitaciones

- No hay versionado completo de rutas de proceso.
- No hay clientes ni criterios por cliente.
- No hay versiones de producto.
- No hay tabla maestra de operadores, turnos, ordenes o lotes.
- No hay motor de reglas para evaluar automaticamente todos los criterios.
- No hay workflow CAPA, 8D, causa raiz ni contencion formal.
- No hay soft delete generalizado.
- No hay campos personalizados.

## Decisiones pendientes

- Si los productos deben compartirse entre plantas o seguir siendo especificos por planta.
- Como versionar rutas de proceso.
- Como aplicar criterios distintos por cliente.
- Como aplicar criterios distintos por version de producto.
- Como agrupar multiples mediciones en una inspeccion.
- Como modelar retrabajos que vuelven a entrar al proceso.
- Si conviene normalizar operadores, turnos, ordenes de produccion y lotes.
- Si las unidades de medida deben pasar a catalogo controlado.
