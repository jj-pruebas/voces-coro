import { supabase } from './supabase-init.js';
import { upsertTrack } from './songs-repo.js';
import { STORAGE_BUCKET, MAX_FILE_SIZE_MB, ALLOWED_MIME_TYPES } from './constants.js';

export function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Tipo de archivo no permitido (${file.type || 'desconocido'}). Usa mp3, m4a/aac, wav u ogg.`;
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

export async function uploadTrack({ songId, slot, file, label, voiceType, recordedKeyHint, onProgress }) {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const ext = extFromFile(file);
  const path = `${songId}/${slot}.${ext}`;

  onProgress && onProgress('subiendo');
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  onProgress && onProgress('leyendo duración');
  const durationSec = await readAudioDuration(file);

  onProgress && onProgress('guardando metadatos');
  const track = await upsertTrack(songId, slot, {
    label: label || null,
    voice_type: voiceType || null,
    storage_path: path,
    duration_sec: durationSec,
    recorded_key_hint: recordedKeyHint || null,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_at: new Date().toISOString(),
  });

  onProgress && onProgress('listo');
  return track;
}
