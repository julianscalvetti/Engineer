# 14 — Flujo de pantallas del MVP 0

## 1. Objetivo

Este documento define el primer flujo visual del MVP personal.

No se busca construir un dashboard completo.

El objetivo es que la persona pueda:

```text
cargar un CSV
ver si el archivo sirve
obtener un aviso breve de calidad
```

---

## 2. Flujo mínimo

```text
Inicio
  ↓
Cargar CSV
  ↓
Validar archivo
  ↓
Procesar datos
  ↓
Mostrar aviso
  ↓
Mostrar tabla mínima de respaldo
```

---

# Pantalla 1 — Carga de archivo

## Objetivo

Permitir cargar el CSV exportado desde la hoja `BASE DE REGISTRO`.

## Elementos mínimos

- Título de la herramienta.
- Breve explicación.
- Botón para seleccionar archivo.
- Texto indicando formato esperado.
- Estado de carga.

## Texto sugerido

```text
Cargá el CSV exportado desde la hoja BASE DE REGISTRO.

El sistema va a validar las columnas mínimas y generar un aviso inicial de calidad.
```

## Formato esperado

```text
.csv
```

No se acepta Excel directo en el MVP 0.

---

# Pantalla 2 — Validación de columnas

## Objetivo

Mostrar si el archivo puede procesarse.

## Estados posibles

### Estado correcto

```text
Archivo válido.
Se encontraron las columnas mínimas.
```

### Estado con advertencias

```text
Archivo válido con advertencias.
Faltan columnas recomendadas, por lo que algunas métricas no estarán disponibles.
```

### Estado bloqueado

```text
No se puede procesar el archivo.
Faltan columnas obligatorias.
```

---

## Columnas obligatorias

```text
FECHA
COD PIEZA
MODO DE FALLA
CANT NO OK
```

---

## Columnas recomendadas

```text
DESCRIPCION PZA
OPERACIÓN
TURNO
CANT TOTAL
TOTAL CONTROLADO
DPU
```

---

# Pantalla 3 — Aviso de calidad

## Objetivo

Mostrar una primera lectura automática del archivo.

No debe ser largo.

Debe ser claro y orientado a acción.

## Estructura del aviso

```text
Aviso de calidad

[Hallazgo principal]

[Modo de falla principal]

[Tasa estimada, si aplica]

[Prioridad sugerida]
```

---

## Ejemplo

```text
Aviso de calidad

El mayor volumen de unidades no OK se concentra en la pieza PZA-001,
con 124 unidades no conformes.

El modo de falla principal es Fisura,
representando el 38% del total de unidades no OK registradas.

Usando TOTAL CONTROLADO como denominador,
la tasa estimada para este grupo es 3,6%.

Prioridad sugerida:
revisar pieza PZA-001 / operación OP-20 / modo de falla Fisura.
```

---

# Pantalla 4 — Tabla mínima de respaldo

## Objetivo

Permitir verificar de dónde salió el aviso.

La tabla no debe ser un dashboard grande.

Debe mostrar solo los principales resultados.

## Tablas iniciales

### Top modos de falla

| Modo de falla | Cantidad no OK | Participación |
|---|---:|---:|

### Top piezas

| Pieza | Cantidad no OK | Participación |
|---|---:|---:|

### Top operaciones

| Operación | Cantidad no OK | Participación |
|---|---:|---:|

---

## No incluir todavía

- gráficos complejos;
- filtros avanzados;
- login;
- guardado histórico;
- exportar PDF;
- enviar email;
- comparar períodos;
- predicción;
- IA generativa.

---

# 5. Decisión visual inicial

El MVP debe sentirse como una herramienta simple, no como un ERP completo.

Estilo recomendado:

```text
una pantalla limpia
un flujo lineal
pocos botones
un resultado principal visible
tablas solo como respaldo
```

---

# 6. Próximo paso

El próximo paso es convertir este flujo en un prompt técnico para Codex.

El primer prompt no debe pedir toda la app.

Debe pedir solamente:

```text
crear una app Next.js local
implementar carga CSV
validar columnas obligatorias/recomendadas
mostrar resultado de validación
```

El análisis de calidad se pide en un segundo prompt.
