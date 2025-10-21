# Babylon Scanlation

Este es el sitio web para el grupo de scanlation Babylon. La plataforma permite a los usuarios leer manga y cómics traducidos por el grupo.

## 🚀 Estructura del Proyecto

El proyecto está construido con [Astro](https://astro.build/) y utiliza [Cloudflare Pages](https://pages.cloudflare.com/) para el despliegue.

```text
/
├── public/            # Archivos estáticos
├── src/               # Código fuente
│   ├── components/    # Componentes de Astro
│   ├── layouts/       # Layouts de página
│   ├── lib/           # Lógica de negocio (Firebase, DB, etc.)
│   ├── pages/         # Páginas y endpoints de la API
│   └── styles/        # Estilos globales
├── package.json       # Dependencias y scripts
└── astro.config.mjs   # Configuración de Astro
```

## ⚙️ Configuración y Desarrollo Local

### Prerrequisitos

*   Node.js
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) para interactuar con Cloudflare.

### Pasos

1.  **Instalar dependencias:**
    ```sh
    npm install
    ```

2.  **Sincronizar la base de datos:**
    Para desarrollo local, puedes sincronizar la base de datos de producción a tu entorno local.
    ```sh
    npm run db:sync
    ```

3.  **Iniciar el servidor de desarrollo:**
    Esto iniciará el servidor de desarrollo de Astro.
    ```sh
    npm run dev
    ```
    El sitio estará disponible en `localhost:4321`.

## 🧞 Comandos

Todos los comandos se ejecutan desde la raíz del proyecto:

| Comando           | Acción                                                                 |
| :---------------- | :--------------------------------------------------------------------- |
| `npm install`     | Instala las dependencias del proyecto.                                 |
| `npm run dev`     | Inicia el servidor de desarrollo local.                                |
| `npm run build`   | Compila el sitio para producción en la carpeta `./dist/`.              |
| `npm run preview` | Previsualiza la compilación de producción localmente.                  |
| `npm run deploy`  | Despliega el sitio en Cloudflare Pages.                                |
| `npm run db:sync` | Sincroniza la base de datos de producción al entorno de desarrollo local. |

## 🛠️ Tecnologías Utilizadas

*   **Framework:** [Astro](https://astro.build/)
*   **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com/)
*   **Base de Datos:** [Cloudflare D1](https://developers.cloudflare.com/d1/)
*   **Autenticación:** [Firebase Authentication](https://firebase.google.com/docs/auth)