import { supabase } from './supabase-init.js';
import { STORAGE_BUCKET } from './constants.js';

export async function listSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select('*, tracks(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSong(id) {
  const { data, error } = await supabase
    .from('songs')
    .select('*, tracks(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSong({ title, artist, originalKey, category, tags }) {
  const { data, error } = await supabase
    .from('songs')
    .insert({
      title,
      artist: artist || null,
      original_key: originalKey || null,
      category: category || null,
      tags: tags || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSong(id, patch) {
  const { data, error } = await supabase
    .from('songs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSong(id) {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
}

export async function insertTrack(track) {
  const { data, error } = await supabase.from('tracks').insert(track).select().single();
  if (error) throw error;
  return data;
}

export async function updateTrack(trackId, patch) {
  const { data, error } = await supabase
    .from('tracks')
    .update(patch)
    .eq('id', trackId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTrack(trackId, storagePath) {
  if (storagePath) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  }
  const { error } = await supabase.from('tracks').delete().eq('id', trackId);
  if (error) throw error;
}

export function publicAudioUrl(storagePath) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
