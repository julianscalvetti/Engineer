# 08 — Croquis del MVP en entorno gratis

## Objetivo del documento

Definir un croquis inicial del MVP para entender qué hace cada parte del sistema, manteniendo una restricción central:

> El proyecto debe poder construirse y probarse sin pagar servicios.

Esto implica priorizar herramientas gratuitas, límites bajos de uso, archivos pequeños, procesamiento simple y evitar infraestructura paga hasta validar valor real.

---

## Principio de trabajo

El MVP no debe empezar como una plataforma industrial completa.

Debe empezar como una aplicación web liviana que pruebe este flujo:

```text
Usuario de calidad
  ↓
Carga archivo Excel/CSV
  ↓
El sistema valida estructura
  ↓
El sistema procesa datos
  ↓
El sistema muestra resultados
  ↓
El usuario entiende fallas, patrones y prioridades
```

La prioridad no es escalar.
La prioridad es validar que el análisis automático aporta valor.

---

## Croquis general del sistema

```text
┌────────────────────────────────────────────┐
│              Usuario de calidad             │
│  Analista / responsable / jefe de calidad   │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│              App web del MVP                │
│                 Next.js                     │
│                                            │
│  - Login                                   │
│  - Panel principal                         │
│  - Carga de archivo                        │
│  - Validación de columnas                  │
│  - Visualización de resultados             │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│              Base y archivos                │
│                Supabase                     │
│                                            │
│  - Usuarios                                │
│  - Empresas / proyectos                    │
│  - Archivos cargados                       │
│  - Datos procesados                        │
│  - Resultados del análisis                 │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│          Procesamiento inicial              │
│     Next.js API / Server Action             │
│                                            │
│  - Leer Excel/CSV                          │
│  - Validar campos mínimos                  │
│  - Limpiar nombres                         │
│  - Calcular indicadores                    │
│  - Guardar resultados                      │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│              Salida de valor                │
│                                            │
│  - Ranking de fallas                       │
│  - Tasa de falla                           │
│  - Tendencias por fecha                    │
│  - Segmentación por producto/línea/lote    │
│  - Resumen ejecutivo                       │
└────────────────────────────────────────────┘
```

---

## Versión recomendada para empezar: MVP 0

Para mantener costo cero y complejidad baja, la primera versión debería evitar jobs externos.

```text
Next.js + Supabase Free + Vercel Hobby
```

Sin Trigger.dev al inicio.
Sin Resend al inicio.
Sin dominio propio.
Sin IA generativa todavía.
Sin conexión a sistemas internos.

---

## Qué hace cada parte

| Parte | Herramienta inicial | Función | Comentario |
|---|---|---|---|
| Interfaz | Next.js | Pantallas del usuario | Carga, validación y resultado |
| Backend liviano | Next.js API / Server Actions | Procesamiento simple | Útil para archivos pequeños |
| Base de datos | Supabase Postgres | Guardar entidades y resultados | Free tier suficiente para MVP |
| Storage | Supabase Storage | Guardar Excel/CSV subidos | Limitar tamaño de archivo |
| Auth | Supabase Auth | Login de usuarios | Puede postergarse si el demo es local |
| Hosting | Vercel Hobby | Deploy gratuito | Usar subdominio de Vercel |
| Repositorio | GitHub Free | Código y control de versiones | Base para trabajar con Codex |
| Jobs | Trigger.dev | Procesamiento asincrónico | No usar hasta que sea necesario |
| Emails | Resend | Enviar reportes/alertas | Postergar |

---

## Decisión importante: no usar Trigger.dev al inicio

Trigger.dev es útil para tareas en segundo plano, pero agrega otra dependencia.

Para el MVP inicial, conviene procesar archivos chicos directamente desde Next.js.

```text
Carga archivo
  ↓
Next.js recibe archivo
  ↓
Lee Excel/CSV
  ↓
Calcula indicadores
  ↓
Guarda resultados
  ↓
Muestra dashboard
```

Usar Trigger.dev recién cuando aparezca alguno de estos problemas:

- Archivos más pesados.
- Procesamiento lento.
- Necesidad de reintentos automáticos.
- Jobs programados.
- Varios usuarios procesando a la vez.
- Generación de reportes en background.

---

## Restricciones por entorno gratis

Para evitar costos, el MVP debe tener límites explícitos.

| Restricción | Decisión inicial |
|---|---|
| Tamaño de archivo | Máximo 5–10 MB recomendado |
| Formato | CSV primero, Excel después |
| Usuarios | 1–3 usuarios de prueba |
| Empresas | 1 empresa/demo al inicio |
| Históricos | Dataset reducido |
| Procesamiento | Sin modelos pesados |
| Reportes | Visualización web, no PDF al inicio |
| Emails | No enviar automáticamente |
| Dominio | Usar dominio gratuito de Vercel |
| Integraciones | Ninguna integración directa con ERP/MES/QMS/SCADA |

---

## Flujo funcional del usuario

```text
1. Usuario entra a la app
2. Selecciona o crea un proyecto de análisis
3. Sube un archivo CSV/Excel
4. El sistema revisa columnas mínimas
5. El sistema muestra errores si faltan datos clave
6. El usuario confirma procesamiento
7. El sistema calcula indicadores básicos
8. El usuario ve resultados en dashboard simple
9. El usuario puede descargar o copiar un resumen
```

---

## Pantallas mínimas del croquis

### 1. Home / Landing interna

Función:

- Explicar brevemente qué hace el MVP.
- Dar acceso al demo o login.

Contenido mínimo:

```text
Proyecto Calidad
Carga datos de fallas y obtené un análisis automático inicial.
```

---

### 2. Panel principal

Función:

- Mostrar análisis anteriores.
- Permitir crear nuevo análisis.

Elementos:

```text
[ Nuevo análisis ]

Análisis recientes:
- Fallas junio 2026
- Reclamos lote A
- Control línea 2
```

---

### 3. Carga de archivo

Función:

- Permitir subir un CSV/Excel.
- Mostrar requisitos mínimos.

Columnas mínimas sugeridas:

```text
fecha
producto
tipo_falla
cantidad_inspeccionada
cantidad_fallada
```

Columnas opcionales:

```text
linea
lote
turno
sector
proveedor
observaciones
```

---

### 4. Validación de archivo

Función:

- Revisar si el archivo sirve.
- Marcar columnas faltantes.
- Mostrar advertencias.

Ejemplo:

```text
Estado: Archivo válido con advertencias

OK:
- fecha
- producto
- tipo_falla
- cantidad_inspeccionada
- cantidad_fallada

Advertencias:
- 18 filas sin lote
- 7 filas sin turno
- 3 tipos de falla escritos con variantes similares
```

---

### 5. Resultado / Dashboard simple

Función:

- Mostrar hallazgos accionables.

Bloques mínimos:

```text
Resumen general
Ranking de fallas
Tasa de falla por producto
Tendencia temporal
Segmentación por línea/lote/turno si existe
Observaciones del sistema
```

---

## Pipeline mínimo de datos

```text
Archivo original
  ↓
Lectura
  ↓
Validación de columnas
  ↓
Normalización básica
  ↓
Cálculo de métricas
  ↓
Generación de insights simples
  ↓
Persistencia de resultados
  ↓
Visualización
```

---

## Métricas iniciales

El MVP debería calcular pocas métricas, pero bien.

| Métrica | Fórmula / criterio |
|---|---|
| Total inspeccionado | Suma de cantidad_inspeccionada |
| Total fallado | Suma de cantidad_fallada |
| Tasa de falla | cantidad_fallada / cantidad_inspeccionada |
| Top fallas | Ranking por cantidad fallada |
| Producto más problemático | Mayor tasa o mayor volumen fallado |
| Evolución temporal | Tasa por fecha/semana/mes |
| Concentración | Fallas agrupadas por línea/lote/turno si existe |

---

## Primer modelo de datos conceptual

```text
users
  id
  email
  created_at

projects
  id
  user_id
  name
  company_name
  created_at

uploads
  id
  project_id
  file_name
  file_path
  status
  created_at

quality_records
  id
  upload_id
  date
  product
  defect_type
  inspected_qty
  failed_qty
  line
  batch
  shift
  supplier
  notes

analysis_results
  id
  upload_id
  metric_name
  metric_value
  dimension
  dimension_value
  created_at

insights
  id
  upload_id
  priority
  title
  description
  suggested_action
  created_at
```

---

## Librerías gratuitas posibles

| Necesidad | Librería posible |
|---|---|
| Leer CSV | `papaparse` |
| Leer Excel | `xlsx` |
| Validar datos | `zod` |
| Tablas | HTML table / TanStack Table más adelante |
| Gráficos | `recharts` o `chart.js` |
| UI | CSS simple / Tailwind CSS |
| Fechas | `date-fns` |
| Base de datos | Supabase JS client |

---

## Criterio de seguridad inicial

En MVP gratis no se debe conectar nada sensible.

Reglas:

- No conectar ERP.
- No conectar MES.
- No conectar SCADA.
- No conectar PLC.
- No pedir accesos internos.
- No usar datos confidenciales reales sin anonimización.
- Usar archivos exportados manualmente.
- Usar datos de prueba o datasets anonimizados.

Flujo seguro inicial:

```text
Empresa exporta archivo
  ↓
Se revisa / anonimiza
  ↓
Se carga manualmente
  ↓
El MVP analiza
  ↓
Se genera resultado
```

---

## Qué NO construir todavía

No construir en esta etapa:

- ERP propio.
- QMS completo.
- Módulo de tickets.
- Gestión documental.
- Auditorías.
- Integración con sensores.
- Integración con PLC/SCADA.
- IA generativa conectada a datos reales.
- Reportes PDF complejos.
- Multiempresa avanzado.
- Roles complejos.
- Facturación.
- Emails automáticos.

---

## Camino evolutivo

### MVP 0 — Local / gratis estricto

```text
Next.js local
CSV de prueba
Procesamiento en memoria
Dashboard simple
```

Objetivo:

- Validar lógica.
- Probar pantallas.
- No depender de servicios externos.

---

### MVP 1 — Demo cloud gratis

```text
Next.js
Vercel Hobby
Supabase Free
GitHub Free
```

Objetivo:

- Tener una URL demo.
- Guardar archivos/resultados.
- Probar flujo completo.

---

### MVP 2 — Procesamiento más robusto

```text
Next.js
Supabase
Trigger.dev Free o worker local
```

Objetivo:

- Procesar archivos más grandes.
- Separar jobs pesados.
- Mejorar trazabilidad.

---

### MVP 3 — Producto comercial inicial

```text
Infraestructura paga o controlada
Límites definidos
Seguridad más formal
Backups
Roles
Logs
Mayor confiabilidad
```

Objetivo:

- Usar con clientes reales.
- Cumplir requisitos mínimos de operación.

---

## Decisión actual

La decisión recomendada para empezar es:

```text
Construir MVP 0 primero.
Después llevarlo a MVP 1.
```

Esto permite avanzar sin gastar, sin sobrediseñar y sin depender de infraestructura que todavía no necesitamos.

---

## Definición corta

> El croquis inicial del MVP es una app web gratuita y liviana que permite cargar un archivo de fallas, validar su estructura, procesarlo con reglas simples y mostrar un análisis de calidad entendible para un usuario industrial.
