# Babylon Scanlation

Este es el sitio web oficial para el grupo de scanlation Babylon. La plataforma permite a los usuarios leer manga y cómics traducidos por el grupo, con una experiencia de lectura optimizada y características sociales.

## 🚀 Estructura del Proyecto

El proyecto está construido con [Astro](https://astro.build/) y utiliza el ecosistema de [Cloudflare](https://www.cloudflare.com/) para el despliegue y backend.

```text
/
├── public/            # Archivos estáticos públicos
├── src/               # Código fuente
│   ├── components/    # Componentes de UI (Astro y Svelte)
│   ├── layouts/       # Plantillas de diseño de página
│   ├── lib/           # Lógica de negocio, clientes de DB/API y utilidades
│   ├── pages/         # Rutas de la aplicación y endpoints API
│   ├── db/            # Definición de esquema de base de datos (Drizzle)
│   └── styles/        # Estilos CSS globales
├── db_snapshots/      # Copias locales de la base de datos
├── migrations/        # Migraciones de base de datos D1
├── package.json       # Dependencias y scripts
├── astro.config.mjs   # Configuración de Astro
└── wrangler.toml      # Configuración de Cloudflare (D1, R2, Pages)
```

## 🛠️ Tecnologías Utilizadas

*   **Core:** [Astro](https://astro.build/) (SSR mode)
*   **Lenguaje:** TypeScript
*   **Interactividad:** [Svelte](https://svelte.dev/)
*   **Estilos:** CSS estándar con variables globales.
*   **Infraestructura (Cloudflare):**
    *   **Hosting:** Cloudflare Pages
    *   **Base de Datos:** Cloudflare D1 (SQLite distribuido)
    *   **Almacenamiento:** Cloudflare R2 (Imágenes y caché)
*   **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
*   **Autenticación:** Firebase Authentication
*   **Otros:** `swiper` (carruseles), `cropperjs` (edición de imágenes).

## ⚙️ Configuración y Desarrollo Local

### Prerrequisitos

*   Node.js (LTS recomendado)
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) instalado globalmente o accesible vía npx.

### Instalación

1.  **Instalar dependencias:**
    ```sh
    npm install
    ```

2.  **Configuración de Variables de Entorno:**
    Asegúrate de tener los archivos `.env` o `.env.local` configurados con las credenciales necesarias (Firebase, etc.).

### Flujo de Trabajo con Base de Datos (Drizzle & D1)

El proyecto utiliza Drizzle ORM con Cloudflare D1. Aquí están los comandos principales para manejar la base de datos:

*   **`npm run db:generate`**: Genera los archivos de migración SQL basados en los cambios de `src/db/schema.ts`.
*   **`npm run db:migrate`**: Aplica las migraciones pendientes a la base de datos local (simulada por Wrangler).
*   **`npm run db:pull`**: Descarga una copia de la base de datos de producción (`babylon-scanlation-prod`) a `./db_snapshots/dump.sql`.
*   **`npm run db:local`**: Importa el dump descargado a tu base de datos local.

**Comandos "Todo en uno" para desarrollo:**

*   **`npm run db:offline`**: Reinicia la DB local y aplica migraciones. Útil para empezar limpio sin depender de datos reales.
*   **`npm run db:online`**: Descarga la DB de producción, la importa localmente y aplica migraciones. Útil para trabajar con datos reales.

## 🧞 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo de Astro. |
| `npm run dev:cf` | Inicia el servidor usando el proxy de Cloudflare (necesario para probar bindings D1/R2 localmente). |
| `npm run build` | Compila el sitio para producción. |
| `npm run preview` | Previsualiza la compilación de producción usando Wrangler. |
| `npm run deploy` | Despliega la aplicación en Cloudflare Pages. |
| `npm run lint` | Ejecuta ESLint para verificar el código. |
| `npm run check` | Verifica los tipos de TypeScript en el proyecto Astro. |

## 🗄️ Esquema de Base de Datos

Las tablas principales definidas en `src/db/schema.ts` incluyen:
*   **Series:** Información de los mangas/cómics.
*   **Chapters:** Capítulos asociados a una serie.
*   **Pages:** Imágenes individuales de cada capítulo.
*   **News:** Sistema de noticias y anuncios.
*   **Users/AnonymousUsers:** Gestión de roles y seguimiento de invitados.
*   **Comments/Reviews:** Interacción social en series y capítulos.
