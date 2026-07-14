# Product Decisions

## 1. Product Construction

- Engineer se reconstruye desde una base técnica limpia.
- No se migra ni repara el MVP anterior.
- El código heredado solo puede reutilizarse si demuestra valor claro y compatibilidad con el nuevo alcance.
- La aplicación principal permanece en la raíz del repositorio Next.js.

## 2. Design Approach

- Figma es la fuente visual de referencia.
- El template v0 se utiliza como guía de layout, componentes, densidad y estilo.
- El template no forma parte del código ejecutable.
- No se diseña toda la interfaz desde cero.
- Se diseñan únicamente flujos nuevos, estados complejos y componentes específicos de Engineer.
- La prioridad es la estructura funcional antes que el refinamiento visual.

## 3. Development Approach

- El desarrollo se realiza mediante vertical slices.
- Cada vertical debe incluir datos, lógica, interfaz y validación.
- No se desarrollan múltiples módulos incompletos en paralelo.
- Cada etapa debe terminar con lint y build aprobados.
- Los cambios deben quedar versionados mediante checkpoints y commits claros.

## 4. Technical Baseline

- Next.js y TypeScript para la aplicación.
- Supabase y PostgreSQL para persistencia.
- Vercel para despliegue.
- Row Level Security para separación de datos.
- Eliminación lógica y trazabilidad para registros principales.
- Los tipos de base de datos deben generarse desde el schema definitivo cuando sea posible.

## 5. Data Model

- El nuevo schema Supabase se define desde cero.
- database/domain-model/ es una referencia conceptual, no un schema ejecutable.
- No existe sincronización automática entre el modelo de dominio y Supabase.
- El modelo del MVP debe contener solo las entidades necesarias para los flujos incluidos.
- Cada métrica visible debe tener definición y respaldo en datos persistidos.

## 6. User and Scope Assumptions

- El usuario ya está autenticado.
- La empresa y los permisos ya están resueltos.
- El usuario trabaja dentro de una planta o scope definido.
- La selección de planta solo aparece cuando el usuario tiene más de una opción.
- La vista corporativa es un scope analítico, no una planta operativa.

## 7. Integrated Agent

- El agente está integrado dentro de la aplicación.
- No es un chatbot separado.
- Conoce el contexto de la pantalla y los filtros activos.
- Opera mediante herramientas controladas.
- En la primera versión tiene acceso de solo lectura a datos operativos.
- Puede consultar métricas, aplicar filtros, cambiar agrupaciones, navegar y explicar resultados.
- No puede generar SQL libre.
- No puede modificar registros operativos sin una futura política explícita de confirmación y permisos.

## 8. Security and IT/OT

- El MVP no se conecta directamente con ERP, MES, SCADA, PLC ni redes OT.
- No se solicitan credenciales de sistemas industriales.
- Se aplica mínimo privilegio.
- Toda acción relevante debe ser trazable.
- Las integraciones futuras deben realizarse mediante APIs controladas, vistas seguras o capas intermedias.

## 9. Explicitly Rejected for the Current MVP

- OCR.
- Dependencia central de CSV.
- localStorage como persistencia.
- Machine learning.
- Predictive quality.
- Root-cause analysis autónomo.
- Agente autónomo con escritura libre.
- Dashboard corporativo avanzado.
- Aplicación móvil.
- Reportes PDF.
- Emails automáticos.
- Integración industrial directa.

## 10. Decision Rule

Cuando exista una contradicción entre documentación antigua y este archivo, prevalece product/decisions.md junto con product/scope.md.
