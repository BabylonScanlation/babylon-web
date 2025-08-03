// src/types.ts

// ✅ CORRECCIÓN: Se añade la propiedad opcional 'chapters'
interface ChapterInfo {
  number: number;
  createdAt: string;
}

// Definimos una única interfaz para una Serie que usaremos en todo el proyecto.
export interface Series {
  slug: string;
  title: string;
  cover_image_url: string;
  description?: string; // La descripción es opcional
  views?: number; // Conteo de vistas
  lastChapter?: string; 
  lastChapterCreatedAt?: string;
  chapters?: ChapterInfo[]; // <--- AÑADE ESTA LÍNEA
}