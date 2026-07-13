# 00 — Contexto y objetivo

## Contexto

Muchas empresas industriales registran fallas, rechazos, retrabajos o desvíos de calidad en planillas, sistemas internos o exportaciones parciales de ERP/MES/QMS.

El problema no siempre es la falta de datos. Muchas veces el problema es que esos datos quedan dispersos, mal normalizados o requieren análisis manual para transformarse en información útil.

## Problema a resolver

El equipo de calidad suele dedicar tiempo manual a:

- Ordenar archivos.
- Limpiar columnas.
- Unificar nombres de fallas.
- Agrupar datos por producto, lote, línea, turno o fecha.
- Calcular tasas de falla.
- Armar reportes para jefatura o planta.
- Detectar patrones repetitivos.

Este proceso puede ser lento, poco estandarizado y dependiente de personas específicas.

## Objetivo del MVP

Construir una aplicación web mínima que permita:

1. Cargar un archivo de datos de fallas.
2. Validar si el archivo tiene una estructura aceptable.
3. Procesar automáticamente los datos.
4. Calcular indicadores básicos de calidad.
5. Mostrar un resultado claro para análisis y toma de decisiones.

## Usuario principal

El usuario inicial del MVP será un perfil de calidad:

- Analista de calidad.
- Responsable de calidad.
- Jefe de calidad.
- Ingeniero de procesos/calidad.

## Resultado esperado

El MVP debe producir una salida del tipo:

> “Estas son las fallas más relevantes, dónde se concentran, cómo evolucionaron y qué puntos deberían revisarse primero.”

## Criterio de éxito inicial

El MVP se considera exitoso si permite reducir el trabajo manual necesario para pasar de un archivo de fallas a un reporte útil de calidad.
