# 12 — Cómo pensar frontend, backend y procesamiento en el MVP 0

## 1. Objetivo

Este documento explica qué hace cada parte del software en el MVP personal.

No se busca una arquitectura empresarial.

Se busca entender, de forma práctica, cómo se reparte el trabajo entre:

```text
frontend
backend
procesamiento
estado de la app
salida de resultados
```

---

## 2. Idea base

El MVP 0 puede funcionar como una app local en Next.js.

```text
Usuario
    ↓
Frontend
    ↓
Carga CSV
    ↓
Procesamiento en la app
    ↓
Resultado en pantalla
```

No hay login.  
No hay base de datos.  
No hay servidor externo obligatorio.  
No hay emails.  
No hay jobs.  
No hay pagos.  

---

## 3. Qué es el frontend en este MVP

El frontend es la parte que ve y usa la persona.

En el MVP 0, el frontend hace:

- mostrar la pantalla de carga;
- permitir seleccionar o arrastrar un archivo;
- mostrar si el archivo fue leído correctamente;
- mostrar errores de columnas;
- mostrar advertencias;
- mostrar indicadores;
- mostrar el aviso de calidad.

Ejemplo de pantallas:

```text
Pantalla 1: cargar archivo
Pantalla 2: validar columnas
Pantalla 3: ver aviso de calidad
```

---

## 4. Qué es el backend en este MVP

En un software más grande, el backend suele encargarse de:

- recibir datos;
- validar;
- consultar bases;
- guardar información;
- ejecutar reglas;
- proteger accesos;
- exponer APIs.

Pero en este MVP personal, el backend puede ser mínimo o incluso casi inexistente.

El primer MVP puede procesar el archivo en memoria, dentro de la misma app.

Decisión:

```text
Backend mínimo al inicio.
```

---

## 5. Qué es el procesamiento

El procesamiento es la parte que transforma datos crudos en información útil.

En este proyecto, es el núcleo de valor.

Hace cosas como:

- leer filas;
- normalizar nombres de columnas;
- convertir textos y números;
- detectar columnas faltantes;
- calcular cantidades;
- agrupar por modo de falla;
- agrupar por pieza;
- calcular tasas;
- detectar concentraciones;
- generar un aviso breve.

Ejemplo:

```text
CANT NO OK por MODO DE FALLA
CANT NO OK por COD PIEZA
CANT NO OK por OPERACIÓN
DPU estimado por grupo crítico
```

---

## 6. Diferencia entre app, base de datos y archivo

### Archivo

Es la fuente de datos original.

En esta etapa:

```text
CSV exportado desde BASE DE REGISTRO
```

---

### App

Es la herramienta que interpreta el archivo.

En esta etapa:

```text
Next.js local
```

---

### Base de datos

Es donde se guardarían datos históricos.

En esta etapa:

```text
No se usa base de datos todavía.
```

Motivo:

- el objetivo es validar análisis;
- no hace falta guardar usuarios;
- no hace falta guardar empresas;
- no hace falta comparar cargas históricas todavía.

---

## 7. Qué herramientas tienen sentido

### Next.js

Sirve para construir la app web.

Uso en MVP 0:

```text
pantallas + componentes + lógica local
```

---

### Papa Parse

Sirve para leer CSV en JavaScript.

Uso en MVP 0:

```text
leer el CSV exportado desde Excel
```

---

### SheetJS

Sirve para leer Excel directamente.

Uso posterior:

```text
leer .xlsx o .xlsm y elegir hoja BASE DE REGISTRO
```

No se usa primero para evitar complejidad.

---

### React Dropzone

Sirve para crear una zona visual para arrastrar y cargar archivos.

Uso opcional:

```text
mejorar experiencia de carga
```

No es obligatorio para la primera versión.

---

## 8. Arquitectura mínima recomendada

```text
/app
  page.tsx
  components/
    FileUploader.tsx
    ValidationPanel.tsx
    QualityNotice.tsx
    ResultsTable.tsx
  lib/
    parseCsv.ts
    validateRows.ts
    normalizeColumns.ts
    analyzeQuality.ts
    generateNotice.ts
  types/
    quality.ts
```

---

## 9. Flujo técnico mínimo

```text
1. El usuario carga un CSV.
2. La app lee el archivo.
3. El parser convierte el CSV en filas.
4. El normalizador mapea columnas del Excel a nombres internos.
5. El validador detecta errores y advertencias.
6. El analizador calcula indicadores.
7. El generador arma un aviso breve.
8. El frontend muestra el resultado.
```

---

## 10. Qué se suele hacer en software moderno

En aplicaciones modernas se suele separar:

| Capa | Función |
|---|---|
| Frontend | Lo que ve el usuario |
| Backend | Reglas, APIs, seguridad, persistencia |
| Base de datos | Guardado estructurado |
| Storage | Archivos |
| Jobs | Procesos largos |
| Observabilidad | Logs y monitoreo |
| Deploy | Publicación de la app |

Pero para este MVP personal solo se necesita:

| Capa | Se usa ahora |
|---|---|
| Frontend | Sí |
| Backend | Mínimo |
| Base de datos | No |
| Storage | No |
| Jobs | No |
| Observabilidad avanzada | No |
| Deploy | Después |

---

## 11. Regla de decisión

Cada parte técnica debe justificar su existencia.

```text
Si no resuelve un problema actual, no se agrega.
```

Ejemplos:

| Problema actual | Solución |
|---|---|
| Tengo un CSV | Parser CSV |
| Necesito ver errores | Validador |
| Necesito calcular indicadores | Motor de análisis |
| Necesito ver resultado | Componente de aviso |
| Necesito guardar histórico | Base de datos, más adelante |
| Necesito leer Excel directo | SheetJS, más adelante |
| Necesito publicar online | Vercel, más adelante |
| Necesito usuarios | Auth, más adelante |

---

## 12. Próximo paso

Diseñar el primer flujo funcional:

```text
Cargar CSV
    ↓
Detectar columnas
    ↓
Mostrar si el archivo sirve
```

Recién después se calcula la tasa de falla.
