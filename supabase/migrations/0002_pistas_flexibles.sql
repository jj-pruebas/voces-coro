-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 0001_init.sql.
-- No destructivo: conserva las canciones/pistas ya subidas.
-- Cambios: las pistas dejan de tener un "slot" fijo (melodia/voz2/voz3) y
-- pasan a tener una etiqueta libre; la tonalidad (canción y pista grabada)
-- pasa a notación de letras (C, C#, D...); se añade categoría de canción.

-- tracks: quitar el slot fijo, pasar a etiqueta libre
alter table tracks drop constraint if exists tracks_song_id_slot_key;
alter table tracks drop constraint if exists tracks_slot_check;
alter table tracks add column if not exists label text;
update tracks set label = coalesce(label, case slot
  when 'melodia' then 'Melodía'
  when 'voz2' then '2da voz'
  when 'voz3' then '3ra voz'
  else coalesce(slot, 'Pista')
end) where label is null;
alter table tracks alter column label set not null;
alter table tracks drop column if exists slot;

-- tracks: tonalidad grabada estructurada (letras) en vez de texto libre
alter table tracks add column if not exists recorded_key text;
alter table tracks drop column if exists recorded_key_hint;
alter table tracks drop constraint if exists tracks_recorded_key_check;
alter table tracks add constraint tracks_recorded_key_check
  check (recorded_key is null or recorded_key in ('C','C#','D','D#','E','F','F#','G','G#','A','A#','B'));

alter table tracks drop column if exists suggested_range_min;
alter table tracks drop column if exists suggested_range_max;

-- songs: tonalidad original estructurada + categoría
update songs set original_key = null
  where original_key is not null
  and original_key not in ('C','C#','D','D#','E','F','F#','G','G#','A','A#','B');
alter table songs drop constraint if exists songs_original_key_check;
alter table songs add constraint songs_original_key_check
  check (original_key is null or original_key in ('C','C#','D','D#','E','F','F#','G','G#','A','A#','B'));

alter table songs add column if not exists category text;
alter table songs drop constraint if exists songs_category_check;
alter table songs add constraint songs_category_check
  check (category is null or category in ('jubilo', 'adoracion'));
