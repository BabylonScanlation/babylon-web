// src/types.ts

// ✅ CORRECCIÓN: Se añade la propiedad opcional 'chapters'
interface ChapterInfo {
  id: number; // Assuming chapterId is available
  number: number;
  title?: string; // Chapter title is optional
  thumbnail_url?: string; // New field for thumbnail
  views?: number; // New field for views
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
  chapters?: ChapterInfo[];
  is_hidden?: boolean; // Added for visibility control
}