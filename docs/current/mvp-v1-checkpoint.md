# Engineer MVP v1 - Checkpoint

## 1. Objetivo del MVP

Engineer permite configurar una estructura industrial, registrar controles de calidad y analizar fallas.

El MVP v1 valida el flujo funcional mínimo:

```text
Configuración → Registro → Historial → Dashboard
```

Este documento deja constancia del estado funcional alcanzado antes de continuar con nuevas funcionalidades.

---

## 2. Modelo conceptual actual

Jerarquía de configuración industrial:

```text
Empresa
 └── Planta
      └── Cliente
           └── Pieza
                └── Operación
                     └── Modo de falla
```

Registros operativos:

```text
Control
 └── Control failures
```

---

## 3. Configuración implementada

Empresa:

- Crear.
- Editar.
- Activar/desactivar.

Planta:

- Asociada a empresa.

Cliente:

- Asociado a planta.

Pieza:

- Código.
- Nombre.
- Asociada a cliente.

Operación:

- Código.
- Nombre.
- Asociada a pieza.

Modo de falla:

- Asociado a operación.

---

## 4. Registro de controles

Un control contiene:

- Fecha.
- Operación.
- Turno.
- Operador.
- Cantidad controlada.
- Observaciones.

Reglas:

- Un control puede tener cero fallas.
- Un control puede tener múltiples fallas.
- Cada falla registra cantidad detectada.
- Una falla no puede repetirse dentro del mismo control.

---

## 5. Historial de controles

Funcionalidades:

- Listado.
- Filtros.
- Detalle.
- Visualización de fallas.
- Edición básica.

---

## 6. Dashboard MVP

Funcionalidades implementadas:

Filtros:

- Planta.
- Cliente.
- Pieza.
- Operación.
- Turno.
- Período.

KPIs:

- DPU total.
- Unidades controladas.
- Defectos.
- Controles realizados.

Análisis:

- Evolución DPU.
- DPU por operación.
- Top modos de falla.
- Pareto de fallas (estructura implementada, pendiente ajuste).

Tabla:

- Controles del día actual.

---

## 7. Decisiones de diseño importantes

- No existe catálogo global de operaciones.
- Las operaciones pertenecen a una pieza.
- Los modos de falla pertenecen a una operación.
- No se eliminan registros críticos, se utiliza active.
- No se duplican datos históricos.
- La base está diseñada para filtros y análisis posteriores.

---

## 8. Pendientes posteriores

Próximas mejoras:

- Usuarios y permisos.
- Auditoría.
- Mejoras de dashboard.
- Reportes automáticos.
- IA consultiva.

No desarrollar todavía.

---

## 9. Estado del MVP

MVP funcional validado:

```text
Configuración → Registro → Historial → Dashboard
```
