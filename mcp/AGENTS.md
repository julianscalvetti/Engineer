# MCP Engineer

- La interfaz MCP debe permanecer read-only salvo decision explicita documentada.
- No exponer acceso directo libre a tablas, SQL arbitrario ni credenciales de service role.
- Usar primitivas analiticas controladas desde `lib/engineer/`.
- Respetar siempre el contexto de tenant autenticado.
- Validar tests, typecheck y bundle MCP antes de cerrar cambios del dominio.
