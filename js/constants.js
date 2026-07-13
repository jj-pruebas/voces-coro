export const VOICE_TYPES = ['soprano', 'contralto', 'tenor', 'bajo'];

export const VOICE_TYPE_LABELS = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  bajo: 'Bajo',
};

export const CATEGORIES = ['jubilo', 'adoracion'];

export const CATEGORY_LABELS = {
  jubilo: 'Júbilo',
  adoracion: 'Adoración',
};

// Escala cromática en notación estadounidense (con sostenidos, para poder
// representar cualquiera de los 12 semitonos, no solo las notas naturales).
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const MAX_FILE_SIZE_MB = 40;

export const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
];

// Tone.PitchShift pierde calidad fuera de este rango cómodo; se permite
// llegar hasta una octava completa pero se marca visualmente el límite fiable.
export const SEMITONE_MIN = -12;
export const SEMITONE_MAX = 12;
export const SEMITONE_COMFORTABLE = 6;

export const STORAGE_BUCKET = 'audio';

// Semitonos para ir de `fromKey` a `toKey` subiendo (0-11). Si alguna de las
// dos no es una nota válida, se asume 0 (sin desplazamiento).
export function semitonesBetween(fromKey, toKey) {
  const fromIndex = KEYS.indexOf(fromKey);
  const toIndex = KEYS.indexOf(toKey);
  if (fromIndex === -1 || toIndex === -1) return 0;
  return (toIndex - fromIndex + 12) % 12;
}
