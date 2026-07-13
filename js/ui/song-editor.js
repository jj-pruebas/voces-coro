import { getSong, createSong, updateSong, deleteTrack } from '../songs-repo.js';
import { uploadTrack } from '../upload.js';
import { SLOTS, SLOT_LABELS, VOICE_TYPES, VOICE_TYPE_LABELS } from '../constants.js';
import { escapeHtml } from './song-list.js';

export async function renderSongEditor(container, songId) {
  let song = songId
    ? await getSong(songId)
    : { id: null, title: '', artist: '', original_key: '', tracks: [] };

  container.innerHTML = `
    <header class="topbar">
      <a class="btn-back" href="${songId ? '#/cancion/' + songId : '#/'}">&larr;</a>
      <h1>${songId ? 'Editar canción' : 'Nueva canción'}</h1>
    </header>

    <form id="song-form" class="form">
      <label>Título
        <input name="title" required value="${escapeHtml(song.title)}" placeholder="Ej. Cuán grande es Él" />
      </label>
      <label>Artista / arreglista (opcional)
        <input name="artist" value="${escapeHtml(song.artist || '')}" />
      </label>
      <label>Tono original (opcional)
        <input name="originalKey" value="${escapeHtml(song.original_key || '')}" placeholder="Ej. Sol" />
      </label>
      <button type="submit" class="btn btn-primary">${songId ? 'Guardar datos' : 'Crear canción'}</button>
    </form>

    <div id="tracks-section" class="${songId ? '' : 'hidden'}">
      <h2>Pistas de audio</h2>
      <div id="tracks-list"></div>
    </div>
  `;

  const form = container.querySelector('#song-form');
  const tracksSection = container.querySelector('#tracks-section');
  const tracksList = container.querySelector('#tracks-list');

  if (songId) renderTracks(tracksList, song);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get('title').trim(),
      artist: fd.get('artist').trim(),
      originalKey: fd.get('originalKey').trim(),
    };
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (song.id) {
        song = { ...song, ...(await updateSong(song.id, {
          title: payload.title,
          artist: payload.artist || null,
          original_key: payload.originalKey || null,
        })) };
      } else {
        song = { ...(await createSong(payload)), tracks: [] };
        tracksSection.classList.remove('hidden');
        renderTracks(tracksList, song);
        history.replaceState(null, '', `#/cancion/${song.id}/editar`);
      }
      submitBtn.textContent = 'Guardado ✓';
      setTimeout(() => (submitBtn.textContent = songId ? 'Guardar datos' : 'Crear canción'), 1500);
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function renderTracks(tracksList, song) {
  const bySlot = Object.fromEntries((song.tracks || []).map((t) => [t.slot, t]));

  tracksList.innerHTML = SLOTS.map((slot) => {
    const track = bySlot[slot];
    return `
      <div class="track-card" data-slot="${slot}">
        <div class="track-card-header">${SLOT_LABELS[slot]}</div>
        <label>Cuerda
          <select data-field="voiceType">
            <option value="">Sin especificar</option>
            ${VOICE_TYPES.map(
              (vt) => `<option value="${vt}" ${track && track.voice_type === vt ? 'selected' : ''}>${VOICE_TYPE_LABELS[vt]}</option>`
            ).join('')}
          </select>
        </label>
        <label>Octava/tono en que se grabó (opcional)
          <input data-field="recordedKeyHint" value="${escapeHtml((track && track.recorded_key_hint) || '')}" placeholder="Ej. octava de barítono" />
        </label>
        <label class="file-label">
          ${track ? 'Reemplazar audio' : 'Subir audio'}
          <input type="file" accept="audio/*" data-field="file" />
        </label>
        <div class="track-status">${track ? `Audio cargado (${formatSize(track.file_size_bytes)})` : 'Sin audio todavía'}</div>
        ${track ? '<button type="button" class="btn btn-danger btn-small" data-action="delete">Eliminar pista</button>' : ''}
      </div>
    `;
  }).join('');

  tracksList.querySelectorAll('.track-card').forEach((card) => {
    const slot = card.dataset.slot;
    const fileInput = card.querySelector('[data-field="file"]');
    const statusEl = card.querySelector('.track-status');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const voiceType = card.querySelector('[data-field="voiceType"]').value || null;
      const recordedKeyHint = card.querySelector('[data-field="recordedKeyHint"]').value || null;
      try {
        await uploadTrack({
          songId: song.id,
          slot,
          file,
          voiceType,
          recordedKeyHint,
          onProgress: (stage) => (statusEl.textContent = stage + '…'),
        });
        statusEl.textContent = `Audio cargado (${formatSize(file.size)})`;
      } catch (err) {
        statusEl.textContent = 'Error al subir: ' + err.message;
      }
    });

    const deleteBtn = card.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const track = (song.tracks || []).find((t) => t.slot === slot);
        if (!track) return;
        if (!confirm(`¿Eliminar la pista "${SLOT_LABELS[slot]}"?`)) return;
        try {
          await deleteTrack(track.id, track.storage_path);
          song.tracks = song.tracks.filter((t) => t.id !== track.id);
          renderTracks(tracksList, song);
        } catch (err) {
          alert('No se pudo eliminar: ' + err.message);
        }
      });
    }
  });
}

function formatSize(bytes) {
  if (!bytes) return '';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
