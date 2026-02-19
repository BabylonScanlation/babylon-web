# 🪐 Babylon Web - Arquitectura y Guía Técnica

Este archivo es una guía fundamental para Gemini CLI. Léelo siempre al iniciar una sesión para recuperar el contexto crítico del proyecto.

## 🚀 Prompt de Arranque Recomendado
> "Ejecuta una investigación profunda de la arquitectura usando `codebase_investigator`. Analiza el stack (Astro 5 + Svelte 5), el flujo de datos desde D1 (especialmente el uso de CAST en SQL para fechas), el sistema de firmado HMAC en `crypto.ts`, el proxy de activos en R2 y la integración con Telegram para capítulos. Utiliza **Context7** para obtener la documentación más actualizada de los componentes y dependencias. No te detengas hasta tener una comprensión completa del 'Estado de Aceptación' de Babylon."

## 🏗️ Pilares de la Arquitectura

### 1. Stack Tecnológico
- **Framework:** Astro 5 (SSR / Server Islands) + Svelte 5 (Runes).
- **Runtime:** Cloudflare Pages (Edge).
- **Base de Datos:** Cloudflare D1 (SQLite) + Drizzle ORM.
- **Almacenamiento:** Cloudflare R2 (Caché/Assets) + Telegram API (Origen de archivos ZIP).

### 2. Manejo de Datos Críticos (Fechas)
- **Regla de Oro:** Siempre usar timestamps numéricos (milisegundos) para la comunicación Servidor -> Cliente.
- **SQLite Fix:** Las consultas SQL para fechas deben usar `CAST(columna AS INTEGER)` para evitar corrupciones de serialización en Astro 5.
- **Utilidades:** Usar `parseToTimestamp()` y `timeAgo()` en `src/lib/utils.ts` para cualquier representación temporal.

### 3. Sistema de Activos (R2 Proxy)
- **Seguridad:** URLs firmadas con HMAC en `crypto.ts` para evitar hotlinking.
- **Resiliencia:** El proxy en `src/pages/api/assets/proxy/` implementa **Auto-Seeding**. Si una imagen no está en local, la busca en producción, la sirve y la guarda en el R2 local automáticamente.

### 4. Integración con Telegram
- Los capítulos se suben a hilos de Telegram (`message_thread_id`) y se procesan por streaming usando `ZipReader` sin descargar el archivo completo al Worker.

## 📚 Documentación y Componentes
- **Context7:** Utiliza siempre la herramienta Context7 para consultar la API y documentación más reciente de los componentes internos y librerías externas (Astro, Svelte, Swiper, etc.).
- **Reactividad:** Prioriza el uso de Runes (`$state`, `$derived`, `$effect`) para mantener la fluidez de Svelte 5.

---
*Babylon es un proyecto de alto rendimiento. Mantén la limpieza del código, la seguridad HMAC y el tipado estricto en cada cambio.*
