import { supabase } from './supabase-init.js';
import { insertTrack, updateTrack } from './songs-repo.js';
import { STORAGE_BUCKET, MAX_FILE_SIZE_MB, ALLOWED_MIME_TYPES } from './constants.js';

export function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Tipo de archivo no permitido (${file.type || 'desconocido'}). Usa mp3, m4a/aac, wav, ogg o video mp4.`;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `El archivo pesa demasiado (máx. ${MAX_FILE_SIZE_MB} MB).`;
  }
  return null;
}

function readAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

function extFromFile(file) {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type.split('/')[1] || 'bin').toLowerCase();
}

// Sube el archivo y crea una fila de pista nueva (ya no hay "slot" fijo:
// cada canción puede tener cualquier número de pistas).
export async function uploadTrack({ songId, file, label, voiceType, recordedKey, onProgress }) {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const trackId = crypto.randomUUID();
  const ext = extFromFile(file);
  const path = `${songId}/${trackId}.${ext}`;

  onProgress && onProgress('subiendo');
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  onProgress && onProgress('leyendo duración');
  const durationSec = await readAudioDuration(file);

  onProgress && onProgress('guardando metadatos');
  const track = await insertTrack({
    id: trackId,
    song_id: songId,
    label: label || 'Pista',
    voice_type: voiceType || null,
    recorded_key: recordedKey || null,
    storage_path: path,
    duration_sec: durationSec,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_at: new Date().toISOString(),
  });

  onProgress && onProgress('listo');
  return track;
}

// Reemplaza el audio de una pista existente sin cambiar su id/metadata de texto.
export async function replaceTrackAudio({ track, file, onProgress }) {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const ext = extFromFile(file);
  const path = `${track.song_id}/${track.id}.${ext}`;

  onProgress && onProgress('subiendo');
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  onProgress && onProgress('leyendo duración');
  const durationSec = await readAudioDuration(file);

  onProgress && onProgress('guardando metadatos');
  const updated = await updateTrack(track.id, {
    storage_path: path,
    duration_sec: durationSec,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_at: new Date().toISOString(),
  });

  onProgress && onProgress('listo');
  return updated;
}
