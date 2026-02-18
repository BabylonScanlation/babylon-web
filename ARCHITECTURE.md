# 🏗️ Arquitectura de Babylon Scanlation (Edge-First)

Este documento explica las decisiones técnicas y el flujo de datos del proyecto para desarrolladores que deseen contribuir o desplegar su propia instancia.

## 🌌 Visión General
Babylon está diseñado para ejecutarse exclusivamente en el **Edge** (Cloudflare Workers/Pages). Esto significa que no hay un servidor central; el código se ejecuta en el centro de datos más cercano al usuario, garantizando latencias mínimas globalmente.

---

## 🛠️ Stack Tecnológico de Élite

| Tecnología | Rol | Por qué? |
| :--- | :--- | :--- |
| **Astro 5** | Framework Core | SSR ultrarrápido y arquitectura de islas. |
| **Svelte 5** | UI & Reactividad | Rendimiento superior con *Runes* y mínima huella de JS. |
| **Cloudflare D1** | Base de Datos | SQLite distribuido con réplicas de lectura globales. |
| **Cloudflare R2** | Almacenamiento | Compatible con S3, sin costes de salida (egress fees). |
| **Cloudflare KV** | Caché de Metadatos | Almacenamiento clave-valor para contadores y sesiones rápidas. |
| **Drizzle ORM** | Capa de Datos | Typescript estricto y migraciones ligeras. |

---

## 🔐 Sistema de Seguridad y Autenticación

El sistema utiliza un flujo de **Doble Capa** para maximizar la velocidad:

1.  **JWT Fast-Path**: Los datos básicos del usuario (UID, Rol, NSFW) se cifran en una cookie JWT. El middleware verifica este token de forma local (sin consultar la base de datos), permitiendo que el 90% de las peticiones se validen en <5ms.
2.  **D1 Session Fallback**: Si el JWT no es suficiente o ha expirado, el sistema consulta la tabla `Sessions` en D1 para una validación completa.

### Protecciones Activas
- **BotShield**: Lista negra de más de 20 scrapers e IAs conocida para proteger el contenido de los traductores.
- **Geo-Blocking**: Capacidad de restringir el acceso por país (configurable en `site.config.ts`).
- **Access Control**: Middleware jerárquico que protege las rutas `/admin` y los endpoints de la API.

---

## 🖼️ Procesamiento de Imágenes (JIT - Just In Time)

Una de las joyas del proyecto es cómo manejamos las imágenes para ahorrar costes y proteger el contenido:

1.  **Web Worker Isolation**: Las imágenes no se cargan directamente en el hilo principal. Se procesan en un `ImageWorker` (Web Worker).
2.  **Canvas Rendering**: El Worker descarga el Blob, aplica marcas de agua dinámicas y procesa la imagen usando `OffscreenCanvas`.
3.  **Memoria Eficiente**: Se utilizan `ImageBitmap` transferibles para mover los datos del Worker al hilo principal con coste cero de copia de memoria.
4.  **Watermarking**: Las marcas de agua se generan en tiempo real en el cliente, evitando procesar miles de imágenes en el servidor.

---

## 🗄️ Estructura de Datos (Drizzle + D1)

- **Tablas Core**: `Series` -> `Chapters` -> `Pages`.
- **Interacción**: `Comments`, `Ratings`, `Favorites`.
- **Logging**: `ChapterViews` y `SeriesViews` con protección de duplicados por IP/GuestId.

### Convenciones de Datos
- **IDs**: Usamos `integer` autoincrementales para relaciones internas y `text` (UUID/Kysely-style) para entidades externas.
- **Fechas**: Siempre almacenadas como `integer` (timestamps de milisegundos) para máxima compatibilidad y rendimiento en SQLite.

---

## 🚀 Cómo empezar a contribuir

1.  **Entorno**: Copia `.env.example` a `.env` y configura tus claves de Firebase.
2.  **Base de Datos**: Usa `npm run db:offline` para tener un entorno SQLite local instantáneo.
3.  **Middleware**: Si necesitas añadir lógica global, revisa `src/middleware.ts` (próximamente modularizado).

---

## 📈 Optimizaciones de Rendimiento
- **Zero-CLP (Cumulative Layout Shift)**: Los contenedores de imágenes en el lector tienen un `aspect-ratio` predefinido.
- **Predictive Prefetch**: El lector observa el scroll del usuario y empieza a descargar las próximas 3 páginas antes de que sean visibles.
- **Edge Caching**: Los headers `Cache-Control` están optimizados para que Cloudflare cachee el HTML para invitados pero nunca para usuarios autenticados.
