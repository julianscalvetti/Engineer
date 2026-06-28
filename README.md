# Quality AI MVP

Aplicación local en Next.js y TypeScript para cargar un CSV exportado desde Excel y validar si contiene las columnas mínimas del MVP de calidad industrial.

## Uso local

```powershell
npm.cmd install
npm.cmd run dev
```

Abrir `http://localhost:3000`. El CSV se procesa en el navegador y no se almacena ni se envía a servicios externos.

## Estructura

| Ruta | Contenido |
|---|---|
| `app/` | Pantallas y estilos de Next.js |
| `components/` | Componentes de carga y validación |
| `lib/` | Lectura del CSV y reglas de validación |
| `types/` | Tipos y definición de columnas esperadas |
| `docs/proyecto-calidad-mvp-docs/` | Documentación funcional y técnica |
| `data/raw/` | Archivos Excel reales locales; ignorados por Git |
| `data/csv/` | Exportaciones CSV locales; ignoradas por Git |
| `data/samples/` | Datos de ejemplo no sensibles |
| `screenshots/` | Capturas de la aplicación |

Los directorios de datos se conservan con `.gitkeep`. Los archivos Excel y CSV están excluidos del repositorio.
