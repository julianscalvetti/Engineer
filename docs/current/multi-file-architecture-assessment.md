# Evaluacion multiarchivo de arquitectura de ingesta

Fecha: 2026-07-17

## Alcance

Se ejecuto el Technical Profiler existente sobre todos los archivos `.xlsx` encontrados en `data/raw/`, sin modificar el profiler, el mapping engine ni agregar excepciones por archivo.

Artefactos generados por caso:

- `data/reports/alimentos_calidad_complejo/source-profile.json`
- `data/reports/alimentos_calidad_complejo/source-profile.md`
- `data/reports/forja_calidad_industrial/source-profile.json`
- `data/reports/forja_calidad_industrial/source-profile.md`
- `data/reports/neon_quality_control/source-profile.json`
- `data/reports/neon_quality_control/source-profile.md`
- `data/reports/tambo_caotico_industrial/source-profile.json`
- `data/reports/tambo_caotico_industrial/source-profile.md`
- `data/reports/romet__Registro_Control_Final_ROMET_-_Profiling_/source-profile.json`
- `data/reports/romet__Registro_Control_Final_ROMET_-_Profiling_/source-profile.md`

`data/raw/` y `data/reports/` permanecen fuera de Git por `.gitignore`.

## Resumen comparativo

| Archivo / caso | Hojas | Fuentes potencialmente utiles | Estructuras predominantes | Compatibilidad con primitivas actuales | Configuracion necesaria | Patrones nuevos observados |
|---|---:|---|---|---|---|---|
| `alimentos_calidad_complejo.xlsx` | 4 | Registro diario, maestro de recetas, desvios, dashboard | Tablas transaccionales, catalogo simple, reporte agregado | `row_table` cubre registros/catalogos/desvios. Dashboard queda no cubierto como reporte agregado. | Source selection por hoja/rango; mapping `row_table`; campos directos, parseos numericos/fecha y lookups a catalogos. | Formula de resumen, multiples bloques candidatos similares. |
| `forja_calidad_industrial.xlsx` | 2 | Log de produccion, maestro de piezas | Tabla transaccional desplazada, catalogo simple | `row_table` cubre ambos con header/rango explicitos. | Header row/rango no empezando en A1; mapping `row_table`; transformaciones numericas; lookups para pieza/turno/estado. | Celdas combinadas, encabezado desplazado, tipo mixto en una columna. |
| `neon_quality_control.xlsx` | 3 | Inspeccion, maestro de componentes, reporte mensual | Registro transaccional, catalogo, reporte agregado | `row_table` cubre inspeccion/catalogo si se resuelven encabezados duplicados; reporte mensual es legible como tabla, pero no como evento operativo. | Header row 6 para inspeccion; desambiguacion generica de columnas repetidas; mapping `row_table`; formulas como campo derivado/ignorado. | Encabezados duplicados, formulas de costo, reporte mensual agregado. |
| `tambo_caotico_industrial.xlsx` | 2 | Registro de control, maestro de animales | Registro transaccional con encabezados sucios, catalogo | `row_table` cubre la estructura base, pero encabezados duplicados requieren desambiguacion generica. | Header row 4; mapping `row_table`; normalizacion de espacios; parseos numericos/fecha; campos formula ignorados o preservados. | Duplicados de encabezado, celdas combinadas, formulas, texto libre de historial. |
| `Registro Control Final ROMET - Profiling .xlsx` | 14 | Base de registro, total producido, productos, operaciones, modo de falla, seguimiento | Registro transaccional, formularios, catalogos en bloques, matrices, reportes/pivots | `row_table` cubre principalmente la base de registro. `wide_columns_to_rows` cubre solo matrices simples; no cubre bien matrices con contexto por fila/multi-encabezado. Formularios/reportes agregados no estan cubiertos. | Source selection manual por bloques; `row_table` para base y catalogos tabulares; posible `wide_columns_to_rows` solo para matrices simples; decisiones pendientes para formularios, pivots y matrices con contexto. | Formularios con macros, muchas celdas combinadas, formulas, bloques multiples, matrices calendario, pivots/reportes, catalogos no rectangulares. |

## Hojas, rangos, encabezados y bloques

| Archivo | Hoja | Rango/bloque candidato principal | Fila encabezado | Encabezados observados, enmascarados | Clasificacion de fuente | Layout actual interpretable | Cobertura |
|---|---|---|---:|---|---|---|---|
| `alimentos_calidad_complejo.xlsx` | `PRODUCCION_DIARIA` | `A1:I2001` | 1 | `<fecha>`, `<lote>`, `<producto>`, `<litros>`, `<parametros>`, `<operador>`, `<turno>`, `<estado>` | Registro transaccional | `row_table` | Cubierta con configuracion. |
| `alimentos_calidad_complejo.xlsx` | `MAESTRO_RECETAS` | `A1:E3` | 1 | `<producto>`, `<limites_temperatura>`, `<limites_ph>` | Catalogo | `row_table` | Cubierta con configuracion. |
| `alimentos_calidad_complejo.xlsx` | `CONTROL_DESVIOS` | `A1:D2` | 1 | `<lote>`, `<tipo_desvio>`, `<accion>`, `<costo>` | Registro transaccional / incidencias | `row_table` | Cubierta, aunque el profiler la marco como `unknown` por bajo volumen. |
| `alimentos_calidad_complejo.xlsx` | `DASHBOARD_CALIDAD` | `A2:B4` | 2 | `<metrica>`, `<formula/valor>` | Reporte | Ninguno dedicado | No cubierta como reporte agregado; se deberia excluir o tratar como fuente derivada. |
| `forja_calidad_industrial.xlsx` | `LOG_FORJA_PRODUCCION` | `E2:L2002` | 2 | `<lote>`, `<temperatura>`, `<presion>`, `<tolerancia>`, `<operario>`, `<turno>`, `<pieza>`, `<estado>` | Registro transaccional | `row_table` | Cubierta con rango/header explicitos. |
| `forja_calidad_industrial.xlsx` | `MAESTRO_PIEZAS_OBSOLETAS` | `A1:C3` | 1 | `<codigo>`, `<especificacion>`, `<vigencia>` | Catalogo | `row_table` | Cubierta con configuracion. |
| `neon_quality_control.xlsx` | `INSPECCION_NEON_LED` | `A6:L4006` | 6 | `<fecha>`, `<orden>`, `<operador>`, `<modelo>`, `<medida>`, `<voltaje>`, `<defecto_a>`, `<defecto_b_repetido>`, `<estado>`, `<formula>`, `<notas>` | Registro transaccional | `row_table` | Parcial: estructura cubierta, encabezados duplicados requieren mecanismo generico. |
| `neon_quality_control.xlsx` | `MAESTRO_COMPONENTES` | `A1:D5` | 1 | `<id_componente>`, `<tipo>`, `<color>`, `<proveedor>` | Catalogo | `row_table` | Cubierta con configuracion. |
| `neon_quality_control.xlsx` | `REPORTE_MENSUAL` | `A2:C4` | 2 | `<periodo>`, `<total>`, `<rechazos>` | Reporte | `row_table` tecnicamente posible | Cubierta solo como tabla agregada, no como evento operativo normalizado. |
| `tambo_caotico_industrial.xlsx` | `REGISTRO_ORDEÑE` | `A4:L5004` | 4 | `<fecha>`, `<animal>`, `<turno>`, `<operador>`, `<litros>`, `<conductividad_repetida>`, `<temperatura>`, `<estado>`, `<grasa>`, `<celulas>`, `<formula>` | Registro transaccional | `row_table` | Parcial: estructura cubierta, duplicados/formulas requieren decisiones genericas. |
| `tambo_caotico_industrial.xlsx` | `MAESTRO_SUCIO` | `A1:D4` | 1 | `<id>`, `<raza>`, `<fecha_alta>`, `<historial>` | Catalogo | `row_table` | Cubierta, con calidad semantica a revisar por texto libre. |
| `Registro Control Final ROMET - Profiling .xlsx` | `FORMULARIO` | `D29:F30` | 29 | `<instruccion_formulario_repetida>` | Formulario | Ninguno dedicado | No cubierta. |
| `Registro Control Final ROMET - Profiling .xlsx` | `CARGA` | `D28:F30` | 28 | `<texto_operativo_formulario>` | Formulario | Ninguno dedicado | No cubierta. |
| `Registro Control Final ROMET - Profiling .xlsx` | `BASE DE REGISTRO` | `A1:R23942` | 1 | `<fecha>`, `<periodo>`, `<pieza>`, `<cliente>`, `<operacion>`, `<turno>`, `<operador>`, `<modo_falla>`, `<cantidad_no_ok>`, `<cantidad_total>` | Registro transaccional | `row_table` | Cubierta principalmente por configuracion. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Total producido` | `A2:H3529` | 2 | `<fecha_formula>`, `<periodo>`, `<producto>`, `<operacion>`, `<semana>`, `<dia>`, `<cantidad>` | Matriz / registro derivado | `row_table` parcial; `wide_columns_to_rows` no ideal | Parcial; requiere seleccion de bloque y posible remodelado de contexto. |
| `Registro Control Final ROMET - Profiling .xlsx` | `PRODUCTOS` | `A3:C19` | 3 | `<codigo_producto>`, `<descripcion>`, `<cliente>` | Catalogo | `row_table` parcial | Parcial: bloque util pequeno dentro de hoja amplia. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Hoja1` | n/a | n/a | n/a | Vacia | n/a | Excluir. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Hoja2` | n/a | n/a | n/a | Vacia | n/a | Excluir. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Tablas1` | `B31:D39`; otros bloques `N8:T16`, `B29:D39` | 31 | `<etiqueta_fila>`, `<total_producido>`, `<total_controlado>` | Reporte / pivot | Ninguno dedicado | No cubierta como reporte agregado multi-bloque. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Tablas2` | `B25:C37`; otros bloques `M7:V11`, `B7:C37` | 25 | `<etiqueta_fila>`, `<suma_cantidad_no_ok>` | Reporte / pivot | Ninguno dedicado | No cubierta como reporte agregado multi-bloque. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Seguimiento` | `A24:HK53` | 24 | `<operacion>`, `<producto>`, `<turno>`, `<estado_por_fecha>` | Matriz | `wide_columns_to_rows` parcial | No cubierta completamente: necesita conservar contexto por fila y manejar encabezados dinamicos/multiples. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Indicador RO` | `B1:X5` | 1 | `<fecha_actualizacion>`, `<indicador_calidad>` | Reporte | Ninguno dedicado | No cubierta. |
| `Registro Control Final ROMET - Profiling .xlsx` | `Indicador por Puesto` | `B1:X74` | 1 | `<fecha_actualizacion>`, `<indicador_calidad>` | Reporte / matriz | `wide_columns_to_rows` parcial | No cubierta completamente por multi-encabezado y bloques. |
| `Registro Control Final ROMET - Profiling .xlsx` | `OPERACIONES` | `A2:C9`; otros bloques `M2:O4`, `A1:R9` | 2 | `<operacion_1>`, `<operacion_2>`, `<operacion_3>` | Catalogo / matriz | `wide_columns_to_rows` parcial | Parcial; parece catalogo distribuido por columnas. |
| `Registro Control Final ROMET - Profiling .xlsx` | `MODO DE FALLA` | `P15:Q26` | 15 | `<modo_falla_repetido>` | Catalogo / matriz | `wide_columns_to_rows` parcial | Parcial; encabezados duplicados y bloque pequeno dentro de hoja amplia. |

## Compatibilidad por primitiva

### `row_table`

Cubre bien:

- registros transaccionales con una fila por evento/control/lote;
- catalogos rectangulares simples;
- hojas desplazadas si `header_row` y `data_range` se configuran explicitamente;
- columnas formula si se preservan, ignoran o tratan como derivadas por configuracion.

Limitaciones observadas:

- encabezados duplicados, porque el executor actual resuelve columnas por texto de encabezado;
- hojas con varios bloques utiles simultaneos;
- reportes agregados que no representan eventos fuente.

### `wide_columns_to_rows`

Cubre parcialmente:

- columnas dinamicas simples donde el encabezado de columna representa una entidad/categoria y cada celda vertical representa un valor.

Limitaciones observadas:

- matrices con dimensiones de fila que deben viajar con cada celda;
- multi-encabezados, encabezados por fecha/periodo y celdas combinadas;
- pivots o reportes con totales, subtotales y secciones.

## Estructuras no cubiertas

1. Formularios y hojas de carga con celdas clave-valor, instrucciones, celdas combinadas y macros asociadas.
2. Reportes agregados, dashboards y pivots con formulas, totales y multiples bloques.
3. Matrices con contexto por fila, encabezados dinamicos o multi-encabezados.

## Maximo tres brechas genericas del motor

1. Falta una primitiva generica para matrices con contexto por fila.
   `wide_columns_to_rows` transforma columnas a filas, pero no modela de forma suficiente dimensiones de fila como `<operacion>`, `<producto>`, `<turno>` junto con cada celda dinamica.

2. Falta una primitiva generica para formularios/reportes clave-valor y multi-bloque.
   El profiler detecta rangos candidatos, pero el mapping engine solo interpreta tablas o columnas anchas simples. No hay contrato para extraer pares clave-valor, secciones, totales o bloques independientes en una misma hoja.

3. Falta desambiguacion generica de columnas cuando los encabezados son duplicados o no son estables.
   `row_table` usa el texto del encabezado como llave. En hojas con dos columnas `<defecto>` o `<conductividad>`, la configuracion necesita poder referenciar columna por posicion, letra o alias normalizado sin tocar el motor por archivo.

## Conclusion

La arquitectura actual si permite abordar archivos industriales distintos principalmente mediante configuracion cuando las fuentes utiles son tablas rectangulares: registros transaccionales, catalogos simples y algunas tablas desplazadas. Los cinco archivos confirman que `source-selection.yaml` y `semantic-mapping.yaml` pueden absorber diferencias de hoja, rango, fila de encabezado, nombres de columnas, transformaciones y lookups sin modificar la logica central.

La respuesta completa es: si, pero solo para el subconjunto tabular y para matrices simples. Los archivos industriales reales tambien traen formularios, reportes, pivots, multi-bloques, matrices con contexto por fila y encabezados duplicados. Esas estructuras no deberian resolverse con excepciones por archivo; requieren ampliar el contrato del motor con pocas primitivas genericas.

Recomendacion concreta: mantener la arquitectura config-driven y no introducir casos especiales. El siguiente paso deberia ser disenar nuevas primitivas genericas para `matrix_with_row_context`, `key_value_form` o `report_block`, y desambiguacion de columnas por posicion/alias, antes de implementar capacidades nuevas.

## Documentacion relacionada

- [Pipeline de Ingesta Industrial - Especificacion Tecnica v2.1](./ingestion-pipeline-v2.1.md)
- [Semantic Mapping Engine v1](./semantic-mapping-engine-v1.md)
- [Product Decisions](../../product/decisions.md)
- [Ingestion Pipeline README](../../src/ingestion/README.md)
