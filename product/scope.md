# MVP Scope

## 1. Objective

Validar que una empresa industrial pueda estructurar y registrar datos básicos de calidad, analizarlos dentro de una aplicación web y consultar esos datos mediante una interfaz simple y un agente integrado.

## 2. Operating Assumptions

- El usuario ya tiene una cuenta.
- Pertenece a una empresa.
- Tiene permisos definidos.
- Tiene acceso a una planta concreta.
- El contexto de empresa y planta ya está resuelto al ingresar.
- Autenticación y administración de accesos no forman parte del primer flujo a construir.

## 3. Primary User

- Responsable de calidad.
- Supervisor.
- Analista de calidad.
- Usuario con conocimiento industrial básico o intermedio.

## 4. Core Workflow

Configurar estructura industrial
→ registrar controles
→ consultar registros
→ visualizar resultados
→ profundizar una desviación
→ consultar o modificar el análisis con el agente

## 5. In Scope

### Industrial Configuration

- Productos.
- Operaciones.
- Relación producto–operación.
- Áreas o puestos.
- Modos de falla.

### Quality Records

- Crear un control.
- Cantidad inspeccionada.
- Cantidad defectuosa.
- Scrap.
- Fallas asociadas.
- Fecha.
- Turno.
- Producto.
- Operación.
- Área.

### Record Management

- Historial.
- Filtros.
- Detalle.
- Edición básica.
- Eliminación lógica.

### Dashboard

- Unidades inspeccionadas.
- Unidades defectuosas.
- Tasa de defectos.
- Scrap.
- DPU cuando corresponda.
- Tendencias.
- Pareto de modos de falla.

### Analysis

- Por producto.
- Por operación.
- Por turno.
- Por modo de falla.
- Por período.

### Integrated Agent

- Consultar métricas.
- Aplicar filtros.
- Cambiar agrupaciones.
- Abrir vistas.
- Explicar resultados.
- Generar análisis descriptivos simples.
- Acceso de solo lectura sobre datos operativos en la primera versión.

## 6. Out of Scope

- ERP, MES, SCADA, PLC e integración OT.
- Importación automática.
- Machine learning.
- Predictive quality.
- Root-cause analysis autónomo.
- Acciones correctivas completas.
- Auditorías.
- Reclamos.
- Proveedores.
- Costos de no calidad.
- Aplicación móvil.
- Personalización por empresa.
- Multiempresa corporativa avanzada.
- Agente con escritura libre.
- Acciones autónomas.
- SQL generado libremente.
- PDF.
- Emails automáticos.

## 7. Technical Baseline

- Next.js.
- TypeScript.
- Supabase.
- PostgreSQL.
- Vercel.
- Figma como fuente visual.
- Template v0 como referencia visual, no como código activo.

## 8. Constraints

- Mínimo privilegio.
- Separación por empresa y planta.
- Row Level Security.
- Trazabilidad de creación y modificación.
- Eliminación lógica.
- Herramientas controladas para el agente.
- Sin acceso directo a sistemas industriales internos.

## 9. MVP Success Criteria

El MVP se considera funcional cuando un usuario puede:

1. Configurar un producto, una operación y un modo de falla.
2. Registrar controles.
3. Consultar el historial.
4. Ver indicadores calculados desde datos persistidos.
5. Identificar una desviación.
6. Pedirle al agente una agrupación o filtro.
7. Ver la interfaz actualizada con el resultado.
