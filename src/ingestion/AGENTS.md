# Ingestion

- El pipeline debe ser generico y configurable.
- La lectura de fuentes debe ser segura, inmutable y trazable.
- Mantener separacion clara entre Technical Profiler y Semantic Mapping.
- Ninguna regla de ROMET puede hardcodearse en `src/ingestion/`.
- La persistencia solo puede ejecutarse despues de preview, dry-run y validaciones.
- Para cambios de ingestion, ejecutar tests especificos del dominio y `npm run typecheck`.
