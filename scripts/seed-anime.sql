-- Remove existing if any
DELETE FROM episodeServers WHERE chapter_id IN (SELECT id FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble'));
DELETE FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble');
DELETE FROM Series WHERE slug = 'school-rumble';

-- Insert Series
INSERT INTO Series (title, slug, description, cover_image_url, telegram_topic_id, status, type, genres, is_hidden, is_nsfw, author, artist, published_by, demographic, alternative_names)
VALUES (
  'School Rumble',
  'school-rumble',
  'Tenma Tsukamoto es una estudiante de preparatoria que está enamorada de Oji Karasuma, un chico excéntrico y despistado. Al mismo tiempo, Kenji Harima, el delincuente de la escuela, está perdidamente enamorado de Tenma. Una comedia romántica llena de enredos escolares.',
  'covers/anime/school-rumble.jpg',
  987654321,
  'completed',
  'anime',
  'Comedia, Romance, Escolar',
  0,
  0,
  'Jin Kobayashi',
  'Studio Comet',
  'TV Tokyo',
  'Shounen',
  'School Rumble!'
);

-- Insert Chapters
INSERT INTO Chapters (series_id, chapter_number, language, title, status)
VALUES 
((SELECT id FROM Series WHERE slug = 'school-rumble'), 1, 'es-la', 'Nuevo semestre: ¡Todos emocionados!', 'live'),
((SELECT id FROM Series WHERE slug = 'school-rumble'), 2, 'es-la', '¡Test desconocido! / ¡Atrapada en el lavabo!', 'live'),
((SELECT id FROM Series WHERE slug = 'school-rumble'), 3, 'es-la', '¡Mirando de frente! / ¡Mirando a otra parte!', 'live'),
((SELECT id FROM Series WHERE slug = 'school-rumble'), 4, 'es-la', '¡Cerdos resoplando! / ¡Gatos maullando!', 'live'),
((SELECT id FROM Series WHERE slug = 'school-rumble'), 5, 'es-la', '¡Un amor ardiente!', 'live');

-- Insert Episode Servers (Links to MP4)
INSERT INTO EpisodeServers (chapter_id, server_name, iframe_url, language, is_direct_video)
VALUES
((SELECT id FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble') AND chapter_number = 1), 'Archive', 'https://ia600106.us.archive.org/8/items/sr-cast-001_202609/SR_Cast_001.mp4', 'es-la', 1),
((SELECT id FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble') AND chapter_number = 2), 'Archive', 'https://ia600106.us.archive.org/8/items/sr-cast-001_202609/SR_Cast_002.mp4', 'es-la', 1),
((SELECT id FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble') AND chapter_number = 3), 'Archive', 'https://ia600106.us.archive.org/8/items/sr-cast-001_202609/SR_Cast_003.mp4', 'es-la', 1),
((SELECT id FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble') AND chapter_number = 4), 'Archive', 'https://ia600106.us.archive.org/8/items/sr-cast-001_202609/SR_Cast_004.mp4', 'es-la', 1),
((SELECT id FROM Chapters WHERE series_id = (SELECT id FROM Series WHERE slug = 'school-rumble') AND chapter_number = 5), 'Archive', 'https://ia600106.us.archive.org/8/items/sr-cast-001_202609/SR_Cast_005.mp4', 'es-la', 1);
