import { supabase } from './supabase-init.js';
import { insertTrack, updateTrack } from './songs-repo.js';
import { STORAGE_BUCKET, MAX_FILE_SIZE_MB, ALLOWED_MIME_TYPES } from './constants.js';

// El navegador/SO a veces informa un `file.type` vacío o no estándar para
// audio (ej. iOS reporta "" o "audio/x-mp3" según el origen del archivo).
// Para no depender de eso, el tipo real que se usa para validar y subir se
// deduce siempre de la extensión del nombre de archivo cuando es reconocida.
const EXT_MIME_MAP = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
};

function extOf(file) {
  const fromName = file.name.split('.').pop();
  return fromName ? fromName.toLowerCase() : '';
}

function resolveMimeType(file) {
  const ext = extOf(file);
  return EXT_MIME_MAP[ext] || file.type;
}

export function validateFile(file) {
  const mimeType = resolveMimeType(file);
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return `Tipo de archivo no permitido (${mimeType || 'desconocido'}, extensión .${extOf(file)}). Usa mp3, m4a/aac, wav, ogg o video mp4.`;
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

function describeUploadError(err) {
  const parts = [err.message || String(err)];
  if (err.statusCode) parts.push(`(código ${err.statusCode})`);
  return parts.join(' ');
}

// Sube el archivo y crea una fila de pista nueva (ya no hay "slot" fijo:
// cada canción puede tener cualquier número de pistas).
export async function uploadTrack({ songId, file, label, voiceType, recordedKey, onProgress }) {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const mimeType = resolveMimeType(file);
  const trackId = crypto.randomUUID();
  const ext = extOf(file) || 'bin';
  const path = `${songId}/${trackId}.${ext}`;

  onProgress && onProgress('subiendo');
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: mimeType });
  if (uploadError) throw new Error(describeUploadError(uploadError));

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
    mime_type: mimeType,
    uploaded_at: new Date().toISOString(),
  });

  onProgress && onProgress('listo');
  return track;
}

// Reemplaza el audio de una pista existente sin cambiar su id/metadata de texto.
export async function replaceTrackAudio({ track, file, onProgress }) {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const mimeType = resolveMimeType(file);
  const ext = extOf(file) || 'bin';
  const path = `${track.song_id}/${track.id}.${ext}`;

  onProgress && onProgress('subiendo');
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: mimeType });
  if (uploadError) throw new Error(describeUploadError(uploadError));

  onProgress && onProgress('leyendo duración');
  const durationSec = await readAudioDuration(file);

  onProgress && onProgress('guardando metadatos');
  const updated = await updateTrack(track.id, {
    storage_path: path,
    duration_sec: durationSec,
    file_size_bytes: file.size,
    mime_type: mimeType,
    uploaded_at: new Date().toISOString(),
  });

  onProgress && onProgress('listo');
  return updated;
}
