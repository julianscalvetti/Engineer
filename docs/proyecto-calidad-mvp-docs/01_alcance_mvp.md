# 01 — Alcance del MVP

## Definición del MVP

El MVP será una aplicación web liviana para carga, procesamiento y visualización básica de datos de fallas industriales.

```text
Carga de archivo → Validación → Procesamiento → Resultado interpretable
```

## Incluye

### 1. Autenticación básica

- Login de usuario.
- Asociación del usuario a una empresa/proyecto.
- Acceso a análisis propios.

### 2. Carga de archivos

- Subida de archivos `.csv` o `.xlsx`.
- Registro del archivo cargado.
- Estado del procesamiento.

### 3. Validación inicial

Validar presencia de campos mínimos, por ejemplo:

- Fecha.
- Producto.
- Tipo de falla.
- Cantidad inspeccionada.
- Cantidad fallada.

Campos opcionales:

- Línea.
- Turno.
- Lote.
- Máquina.
- Proveedor.
- Observaciones.

### 4. Procesamiento básico

- Limpieza de nombres de columnas.
- Normalización simple de datos.
- Cálculo de tasa de falla.
- Agrupaciones por producto, falla, fecha, lote, línea o turno.
- Ranking de fallas principales.
- Detección simple de concentración de problemas.

### 5. Salida de resultados

- Resumen ejecutivo.
- Tabla de principales fallas.
- Indicadores básicos.
- Gráficos simples.
- Exportación/descarga de reporte en una etapa posterior.

## No incluye en la primera versión

- Integración directa con ERP.
- Integración directa con MES.
- Integración directa con SCADA/PLC.
- Modelos predictivos avanzados.
- Agente autónomo conectado a sistemas internos.
- QMS completo.
- Gestión documental.
- Flujos de aprobación complejos.
- Módulo comercial/ventas.
- Multi-tenant avanzado con permisos finos.

## Decisión de producto

El MVP debe probar valor analítico antes que robustez empresarial completa.

Primero se valida:

> “¿El sistema convierte datos crudos de calidad en información útil?”

Después se evalúa:

> “¿Cómo se integra de forma segura y escalable con la operación real?”
