# 05 — Seguridad IT/OT

## Principio inicial

El MVP no debe conectarse directamente a sistemas críticos de planta.

No se debe integrar inicialmente con:

- PLC.
- SCADA.
- DCS.
- Historians industriales.
- MES productivo.
- ERP productivo.
- Bases internas sensibles.

## Enfoque seguro para MVP

Usar un flujo de exportación controlada:

```text
Sistema interno de la empresa
  ↓
Exportación manual o controlada
  ↓
Archivo Excel/CSV
  ↓
Carga al MVP
  ↓
Procesamiento aislado
```

## Medidas mínimas

- Acceso autenticado.
- Separación por empresa/proyecto.
- Storage privado.
- Logs de carga y procesamiento.
- Registro de usuario que cargó el archivo.
- Eliminación o anonimización de datos sensibles cuando corresponda.
- No pedir credenciales de sistemas internos.

## Datos sensibles a evitar en MVP

No solicitar en primera versión:

- Datos personales de operarios.
- Información confidencial de clientes finales.
- Fórmulas críticas de proceso.
- Parámetros sensibles de máquinas.
- Accesos a redes industriales.

## Integraciones futuras

En etapas posteriores, si una empresa pide integración directa, considerar:

- APIs de solo lectura.
- Vistas intermedias.
- Base espejo o staging.
- Mínimo privilegio.
- Auditoría.
- Autorización por roles.
- Segmentación IT/OT.
- Validación del área de ciberseguridad industrial.

## Decisión para esta versión

El MVP será cloud y basado en carga de archivos.

No habrá conexión directa a red OT.
