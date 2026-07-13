# 03 — Flujo de usuario y pantallas

## Usuario principal

Perfil inicial:

- Analista de calidad.
- Responsable de calidad.
- Jefe de calidad.

## Flujo mínimo

```text
1. Usuario inicia sesión
2. Entra al panel principal
3. Crea o selecciona un análisis
4. Sube archivo Excel/CSV
5. El sistema valida el archivo
6. El sistema procesa los datos
7. Usuario ve resultados
8. Usuario descarga o comparte el reporte
```

## Pantallas mínimas

### 1. Login

Función:

- Permitir acceso seguro al sistema.

Elementos:

- Email.
- Password o magic link.
- Recuperación de acceso, opcional.

### 2. Dashboard principal

Función:

- Mostrar análisis anteriores y permitir iniciar uno nuevo.

Elementos:

- Botón “Nuevo análisis”.
- Lista de archivos/análisis cargados.
- Estado: pendiente, procesando, completado, error.
- Fecha de carga.

### 3. Carga de archivo

Función:

- Permitir subir Excel/CSV.

Elementos:

- Dropzone.
- Nombre del archivo.
- Tipo de archivo.
- Botón “Procesar”.

### 4. Validación de archivo

Función:

- Mostrar si el archivo puede procesarse.

Elementos:

- Columnas detectadas.
- Columnas obligatorias encontradas.
- Columnas faltantes.
- Errores de formato.
- Advertencias.

### 5. Resultados

Función:

- Mostrar el análisis de calidad.

Elementos mínimos:

- Total inspeccionado.
- Total fallado.
- Tasa de falla.
- Top fallas.
- Fallas por producto.
- Fallas por fecha.
- Concentraciones relevantes.
- Resumen ejecutivo.

## Criterio de diseño

La interfaz debe priorizar claridad operativa:

- Pocos pasos.
- Lenguaje de calidad industrial.
- Sin sobrecargar al usuario.
- Mostrar errores de datos de forma entendible.
- Evitar interfaz tipo BI compleja en la primera versión.
