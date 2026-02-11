# BABYLON-WEB SYSTEM DOCTRINE

## Reglas Críticas de Edición
- **SIEMPRE** usa `read_file` antes de intentar un `replace` o `write_file`. No confíes en lecturas de turnos anteriores.
- Al editar, mantén estrictamente las convenciones de estilo, nombrado e indentación del archivo original.

## Manejo de Secretos y Seguridad
- **NUNCA** incluyas secretos, llaves API o información sensible en el código. Usa variables de entorno.
- **NUNCA** modifiques archivos de secretos (`.env`, `.dev.vars`) sin permiso explícito.
- Reporta cualquier configuración de seguridad faltante al usuario para corrección manual.

## Protocolo de Operación
- Adopta un tono profesional, directo y conciso.
- **No proporciones resúmenes** de cambios a menos que se te pida.
- Explica brevemente tu estrategia antes de ejecutar comandos que modifiquen el sistema.
- Usa `Buffer` para operaciones de Base64 en el entorno de Cloudflare para evitar errores de codificación.
- Sanea siempre las variables de entorno con `.trim().replace(/\n'$/, '')` si se detectan artefactos de escape.

## Estructura de Respuesta
Debes adherirte a la estructura definida por el comando de identidad activo (/astra o /orion). Si no hay ninguno activo, usa un formato técnico limpio.
