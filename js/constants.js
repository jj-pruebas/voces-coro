export const SLOTS = ['melodia', 'voz2', 'voz3'];

export const SLOT_LABELS = {
  melodia: 'Melodía',
  voz2: '2da voz',
  voz3: '3ra voz',
};

export const VOICE_TYPES = ['soprano', 'contralto', 'tenor', 'bajo'];

export const VOICE_TYPE_LABELS = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  bajo: 'Bajo',
};

export const MAX_FILE_SIZE_MB = 20;

export const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/wav',
  'audio/ogg',
];

// Tone.PitchShift pierde calidad fuera de este rango cómodo; se permite
// llegar hasta una octava completa pero se marca visualmente el límite fiable.
export const SEMITONE_MIN = -12;
export const SEMITONE_MAX = 12;
export const SEMITONE_COMFORTABLE = 6;

export const STORAGE_BUCKET = 'audio';
