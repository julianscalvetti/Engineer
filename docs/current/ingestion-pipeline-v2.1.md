# Pipeline de Ingesta Industrial — Especificación Técnica v2.1

## 1. Propósito

El pipeline de ingesta es el mecanismo mediante el cual Engineer incorpora datos industriales existentes, los interpreta, normaliza, valida y transforma en información compatible con el Industrial Context Layer.

No es solamente un importador de Excel.

Debe garantizar:

- inmutabilidad del origen;
- trazabilidad fila a fila;
- configuración versionada;
- validación previa a la carga;
- aprobación humana;
- commit transaccional;
- auditoría;
- reversión controlada.

## 2. Flujo general

RAW INMUTABLE
→ Technical Profiling
→ Semantic Mapping
→ Staging persistente
→ Normalization
→ Validation / Curation
→ Import Plan persistido
→ Review & Approval
→ Transactional Revalidation
→ Atomic Commit
→ Audit
→ Controlled Rollback

## 3. RAW inmutable

Los archivos originales:

- se procesan en modo de solo lectura;
- no deben ser modificados;
- deben conservar hash SHA-256;
- deben asociarse a company_id;
- deben registrar nombre, tamaño, tipo y fecha de recepción;
- no deben ejecutar macros ni código incrustado.

## 4. Technical Profiling

El perfilador técnico analiza exclusivamente la estructura física del archivo.

Debe detectar:

- archivos;
- hojas;
- dimensiones;
- encabezados;
- tipos inferidos;
- vacíos;
- fórmulas;
- columnas duplicadas;
- cardinalidad;
- rangos de fechas;
- posibles catálogos;
- errores de formato.

Artefactos esperados:

- source-profile.json;
- source-profile.md.

## 5. Semantic Mapping

Traduce columnas y valores del lenguaje de la empresa al modelo Engineer.

El mapeo debe:

- ser configurable;
- estar versionado;
- mantenerse fuera del código;
- conservar el valor original;
- definir entidad y campo de destino;
- indicar transformación;
- indicar obligatoriedad;
- permitir revisión humana.

## 6. Staging

La staging debe conservar:

- valor original;
- valor transformado;
- archivo;
- hoja;
- fila;
- estado de validación;
- issues detectados;
- versión de reglas aplicada.

No debe insertar directamente en tablas operativas.

## 7. Normalización

Las transformaciones y equivalencias deben vivir en:

- archivos YAML o JSON;
- catálogos configurables;
- tablas maestras;
- reglas versionadas.

No deben existir equivalencias específicas de clientes hardcodeadas en la lógica central.

## 8. Validación y curado

Estados posibles:

- valid;
- warning;
- pending_review;
- rejected.

Las reglas warning deben indicar:

- commit_allowed: true;
- commit_allowed: false.

Política inicial:

```yaml
allow_partial_commit: false
block_on_rejected: true
block_on_pending_review: true
block_on_warning_not_allowed: true
```

## 9. Reglas MVP

Usar inicialmente reglas determinísticas:

- campos obligatorios;
- formatos válidos;
- valores no negativos;
- límites estáticos;
- relaciones válidas;
- ausencia de duplicados exactos;
- trazabilidad completa.

No implementar todavía detección estadística de anomalías.

No aplicar como regla universal:

```text
cantidad no OK <= cantidad controlada
```

hasta distinguir semánticamente:

- unidades no conformes;
- ocurrencias de defectos.

## 10. Gestión de maestros

Durante el MVP se permiten solamente las acciones:

- created;
- matched;
- skipped.

El pipeline no debe modificar automáticamente entidades maestras existentes.

Cualquier actualización requerida debe quedar como pending_review.

## 11. Import Plan

El dry run debe generar un plan de importación sin escribir datos operativos.

El plan debe:

- persistirse;
- almacenarse como JSONB;
- tener hash;
- indicar entidades nuevas y coincidentes;
- indicar controles y fallas a insertar;
- indicar warnings, pendientes y rechazados;
- registrar cuándo se generó;
- invalidarse si cambian staging, mapping, reglas o destino.

## 12. Aprobación y concurrencia

Flujo:

```text
draft
→ ready
→ approved
→ committing
→ committed
```

Para rollback:

```text
committed
→ rollback_pending
→ rolled_back
```

Durante el commit:

- bloquear la fila del lote mediante SELECT FOR UPDATE;
- validar status = approved;
- evitar commits simultáneos del mismo lote;
- revalidar claves y entidades;
- verificar el hash del plan;
- abortar ante conflictos.

El estado failed debe registrarse fuera de la transacción abortada.

## 13. Commit y permisos

El commit debe realizarse mediante una función PostgreSQL/RPC controlada.

La aplicación no debe tener permisos directos amplios sobre tablas operativas.

Funciones futuras previstas:

- commit_import_batch(batch_id);
- rollback_import_batch(batch_id, reason).

## 14. Auditoría

Componentes previstos:

- import_batches;
- import_files;
- import_staging_controls;
- import_staging_failures;
- import_issues;
- import_batch_entities.

Los controles importados deberán quedar asociados al lote.

## 15. Rollback

Para el MVP usar eliminación física controlada:

1. validar ausencia de modificaciones posteriores;
2. eliminar fallas;
3. eliminar controles;
4. eliminar maestros creados por el lote solo si quedaron sin referencias;
5. conservar archivos, staging, issues, plan y auditoría;
6. registrar usuario, motivo y timestamps;
7. marcar el lote como rolled_back.

## 16. Seguridad

Aplicar:

- mínimo privilegio;
- aislamiento por company_id;
- almacenamiento separado por empresa;
- validación de MIME type;
- límite de tamaño;
- solo lectura sobre RAW;
- prohibición de ejecución de VBA;
- logs;
- trazabilidad;
- funciones privilegiadas controladas.

## 17. Alcance actual

Esta directiva define la arquitectura objetivo.

En esta etapa se implementará únicamente:

- estructura modular;
- Technical Profiler;
- generación local de reportes.

Quedan fuera de esta primera implementación:

- staging en Supabase;
- import plan persistido;
- aprobación;
- RPC de commit;
- rollback;
- interfaz web.
