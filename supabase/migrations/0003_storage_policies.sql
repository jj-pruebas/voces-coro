-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 0001 y 0002.
-- El bucket "audio" siendo público solo permite LEER archivos sin login;
-- para poder SUBIR/reemplazar/borrar desde el cliente (sin login, v1) hace
-- falta además una política de Row Level Security sobre storage.objects.
-- Sin esto, el navegador deja elegir el archivo pero la subida real falla.

drop policy if exists "public select audio" on storage.objects;
drop policy if exists "public insert audio" on storage.objects;
drop policy if exists "public update audio" on storage.objects;
drop policy if exists "public delete audio" on storage.objects;

create policy "public select audio" on storage.objects
  for select using (bucket_id = 'audio');

create policy "public insert audio" on storage.objects
  for insert with check (bucket_id = 'audio');

create policy "public update audio" on storage.objects
  for update using (bucket_id = 'audio');

create policy "public delete audio" on storage.objects
  for delete using (bucket_id = 'audio');
