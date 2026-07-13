# Preguntas abiertas

## Relacion producto, operacion y caracteristica

- Confirmar si una caracteristica debe pertenecer siempre a una combinacion `product_operation`.
- Evaluar si en el futuro conviene reutilizar una misma caracteristica tecnica entre varios productos u operaciones.
- Definir si una caracteristica puede aplicar a una familia de productos sin copiarse por producto.

## Criterios por cliente

- Definir si el criterio de aceptacion puede variar por cliente.
- Definir prioridad cuando existan criterios internos y criterios especificos de cliente.
- Evaluar si el cliente debe ser entidad maestra o solo atributo comercial en una version posterior.

## Criterios por version de producto

- Definir si los productos tendran revision, version de plano o version de especificacion.
- Definir si `acceptance_criteria` debe relacionarse con una version de producto ademas de la caracteristica.
- Definir como cerrar vigencias cuando cambia una especificacion.

## Control por unidad versus lote

- Confirmar si `control_records.inspected_quantity` alcanza para la primera version.
- Definir si se necesita identificar unidades individuales dentro de un lote.
- Definir si el resultado de una muestra puede representar todo el lote.

## Multiples mediciones por registro

- La decision actual es una fila de `control_records` por caracteristica evaluada.
- Evaluar si luego se necesita una entidad de encabezado de inspeccion que agrupe multiples caracteristicas.
- Evaluar si una misma caracteristica necesita multiples lecturas individuales dentro de una misma muestra.

## Relacion entre falla y caracteristica

- Confirmar si un `failure_mode` puede ser general de planta, especifico de una ruta producto-operacion o especifico de una caracteristica.
- Definir si debe exigirse que `failure_modes.product_operation_id` coincida con la ruta de `failure_modes.control_characteristic_id` cuando ambos existan.
- Definir si algunos desvios no deben tener modo de falla catalogado y solo deben guardar descripcion manual.

## Tratamiento de retrabajos

- Definir si un retrabajo genera una nueva orden, una nueva ruta o solo una accion posterior.
- Definir si las piezas retrabajadas deben volver a inspeccionarse con trazabilidad separada.
- Definir si se debe registrar costo, tiempo o responsable del retrabajo.

## Versionado de rutas de proceso

- Definir si `product_operations` debe tener version de ruta.
- Definir como conservar historial cuando cambia la secuencia de operaciones.
- Definir si las rutas futuras deben tener estado `draft`, `active` y `obsolete`.

## Productos compartidos entre plantas

- La decision actual mantiene `products.plant_id`.
- Evaluar si en el futuro conviene separar producto corporativo de producto fabricado por planta.
- Definir como se sincronizarian codigos, descripciones y especificaciones entre plantas.

## Contexto operativo

- Definir si `shift`, `production_order`, `lot_code` y `operator_name` seguiran como texto o pasaran a entidades maestras.
- Definir reglas de obligatoriedad segun tipo de control.
- Definir si la planta del registro debe heredarse siempre desde la caracteristica o conservarse como contexto directo.

## Disposiciones

- Confirmar si las disposiciones deben configurarse por empresa, por planta o por tipo de producto.
- Definir si una disposicion puede requerir obligatoriamente una accion posterior.
- Definir si `approved` debe poder usarse para desvios bajo concesion o si deben separarse ambos conceptos.
