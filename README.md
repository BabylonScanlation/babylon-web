<div align="center">
  <h1>📚 Edge-First Manga Platform (Multi-Scanlation)</h1>
  <p><strong>A high-performance, Open Source alternative to MangaDex or TMO, built with Astro, Svelte, and Cloudflare.</strong></p>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/Astro-6.3-FF5D01.svg?style=for-the-badge&logo=astro&logoColor=white" alt="Astro" />
  <img src="https://img.shields.io/badge/Svelte-5.5-FF3E00.svg?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte" />
  <img src="https://img.shields.io/badge/Cloudflare_Pages-F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-C5F74F.svg?style=for-the-badge&logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</div>

<hr />

## 📖 Historia del Proyecto

Este proyecto nació originalmente como un CMS a la medida para **Babylon Scanlation**, impulsado por la necesidad de tener una plataforma de lectura veloz, económica y de fácil mantenimiento. A medida que el desarrollo avanzó, se fueron agregando características cada vez más compleas.

Hoy en día, este repositorio ha evolucionado para convertirse en una **plataforma completa de lectura Multi-Scanlation**, diseñada arquitectónicamente al estilo de **TuMangaOnline (TMO) o MangaDex**.

Desarrollada bajo el concepto de _Edge-First_ con el ecosistema de Cloudflare, permite que **múltiples grupos de scanlation** puedan registrarse, tener sus propios perfiles, gestionar miembros, y subir sus propios capítulos a las diferentes series de la plataforma, manteniendo costos de infraestructura casi nulos (Zero-Egress-Cost en imágenes) y velocidades de carga globales.

## ✨ Características Principales

### 🌐 Arquitectura Multi-Grupo (Multi-Tenant)

- **Registro de Scanlations:** Diferentes grupos pueden crear su perfil en la plataforma (Logo, Banner, Enlaces, Redes Sociales).
- **Gestión de Miembros:** Los líderes (Owners) pueden invitar a Editores y Moderadores a su equipo.
- **Autoría de Capítulos:** Cada capítulo subido queda asociado al Scanlation y al Uploader responsable, permitiendo coexistir múltiples traducciones (por ejemplo, en diferentes idiomas o de distintos grupos) para un mismo capítulo.

### ⚡ Rendimiento Edge-First

- **Despliegue Global:** Funciona íntegramente sobre Cloudflare Workers y Pages. La latencia es mínima, sin importar dónde se encuentre el lector.
- **Base de Datos Distribuida (D1):** Uso intensivo de Cloudflare D1 (SQLite distribuido) con **Drizzle ORM** para consultas hiperrápidas.
- **Lector Fluido en Svelte:** Visor de capítulos nativo con Svelte 5, que incluye _prefetching_ inteligente para una lectura ininterrumpida.

### 👥 Ecosistema Social y Traking

- **Progreso de Lectura:** Seguimiento del historial de lectura (`UserProgress`) de los usuarios registrados.
- **Sistema de Favoritos y Reacciones:** Los usuarios pueden seguir series y reaccionar a capítulos específicos.
- **Comentarios Anidados:** Motor completo de comentarios (padres e hijos) para Series, Capítulos y Noticias, incluyendo sistema de votación (Upvotes/Downvotes).
- **Control de Vistas:** Registro avanzado de visualizaciones por IP y Guest ID/User ID para evitar inflado artificial de visitas.

### 🛠️ Administración y Publicidad

- **Panel Administrativo (CMS):** Control general de la web (aprobación de series, gestión de reportes).
- **Gestor de Noticias:** Sistema de publicación de noticias generales o específicas por Scanlation.
- **Integración de Ads:** Configuración nativa para redes como Adsterra o Monetag, controlable desde un archivo global de configuración.

## 📦 Stack Tecnológico

| Categoría          | Tecnología                                             |
| :----------------- | :----------------------------------------------------- |
| **Framework Core** | [Astro](https://astro.build/) (SSR mode)               |
| **Componentes UI** | [Svelte 5](https://svelte.dev/)                        |
| **Base de Datos**  | [Cloudflare D1](https://developers.cloudflare.com/d1/) |
| **ORM**            | [Drizzle ORM](https://orm.drizzle.team/)               |
| **Storage / CDN**  | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| **Autenticación**  | [Firebase Auth](https://firebase.google.com/)          |

---

## 🚀 Inicio Rápido (Desarrollo Local)

El proyecto viene equipado con scripts potentes para emular perfectamente el entorno de la nube de forma local.

### 1. Prerrequisitos

- Node.js (v20+ recomendado)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cuentas en Cloudflare y Firebase.

### 2. Instalación

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/tu-usuario/manga-platform.git
cd manga-platform
npm install
```

Configura tus variables de entorno y el archivo central:

```bash
cp .env.example .env
cp .env.local.example .env.local
cp .dev.vars.example .dev.vars
cp src/site.config.example.ts src/site.config.ts # Define el branding de tu web
```

### 3. Sincronización Inteligente de Base de Datos

Trabajar con bases de datos en el borde localmente requiere una buena sincronización. Usa nuestros scripts:

- `npm run db:offline` - **Entorno Limpio:** Aplica todas las migraciones SQL a una base de datos local vacía para empezar desde cero.
- `npm run db:online` - **Sincronización Total:** Este script (`scripts/db-sync.js`) es una utilidad avanzada que descarga el último backup de producción (`db:pull`), resetea tu base local, aplica migraciones estructurales, deshabilita chequeos de claves foráneas temporalmente, inyecta los datos de producción en tu emulador local de D1 y, finalmente, arranca el servidor de desarrollo en un solo paso.

### 4. Lanzar el Servidor

Si tu base de datos ya está lista y solo quieres arrancar el entorno de desarrollo:

```bash
npm run dev:cf
```

_(Inicia simultáneamente el servidor Astro y Wrangler Pages para habilitar los bindings locales de R2 y D1)._

## 📜 Comandos Disponibles

| Comando               | Acción                                                                         |
| :-------------------- | :----------------------------------------------------------------------------- |
| `npm run dev:cf`      | Inicia el servidor de desarrollo emulando el stack de Cloudflare.              |
| `npm run db:online`   | Descarga prod DB, resetea local, inyecta datos y lanza el servidor.            |
| `npm run db:generate` | Evalúa `src/db/schema.ts` y genera archivos SQL de migración en `migrations/`. |
| `npm run db:migrate`  | Aplica migraciones SQL pendientes a la DB emulada.                             |
| `npm run db:purge`    | Script de utilidad (limpieza de usuarios sin verificar, etc).                  |
| `npm run check`       | Valida estáticamente el tipado de Svelte y Astro.                              |
| `npm run deploy`      | Compila y despliega en Cloudflare Pages (`wrangler deploy`).                   |

## 📂 Estructura Principal

- `src/db/schema.ts` - Corazón de los datos: _Series, Capítulos, Scanlations, ScanlationMembers, Roles, Reports, Vistas y Comentarios_.
- `src/actions/` - Astro Actions. Maneja mutaciones seguras del servidor (Upload de capítulos, Auth, Gestión de grupos).
- `src/components/` - Componentes modulares, divididos entre Svelte (lectores, sliders interactivos) y Astro (tarjetas SEO-friendly).
- `scripts/` - Automatizaciones (db-sync, purge-utils, postbuild).

## 🤝 Contribuciones

Al ser un proyecto Open Source, las contribuciones son cruciales. Desde mejorar la UI del lector con Svelte, optimizar las _queries_ de Drizzle o aportar nuevas traducciones a la interfaz, siéntete libre de abrir un **Pull Request** o proponer ideas en los _Issues_.

## ⚠️ Aviso Legal (Disclaimer)

Este proyecto se proporciona únicamente con fines educativos y de desarrollo de software (como una plantilla de CMS). Los creadores y contribuyentes de este repositorio **no se hacen responsables** del uso que los usuarios finales le den a esta plataforma, ni del contenido, imágenes, traducciones o archivos que se alojen utilizando este código. Todos los derechos de los mangas, cómics, personajes y obras derivadas pertenecen a sus respectivos autores, artistas y editoriales.

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Eres libre de usar, modificar y distribuir este software para levantar tu propia plataforma.

---

_Cortesía de Babylon Scanlation por Lucas Goldstein._