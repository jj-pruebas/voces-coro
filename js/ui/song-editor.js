import { getSong, createSong, updateSong, updateTrack, deleteTrack } from '../songs-repo.js';
import { uploadTrack, replaceTrackAudio } from '../upload.js';
import { VOICE_TYPES, VOICE_TYPE_LABELS, KEYS, CATEGORIES, CATEGORY_LABELS } from '../constants.js';
import { escapeHtml } from './song-list.js';

export async function renderSongEditor(container, songId) {
  let song = songId
    ? await getSong(songId)
    : { id: null, title: '', artist: '', original_key: '', category: '', tracks: [] };

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
      <label>Categoría
        ${selectHtml('category', CATEGORIES, CATEGORY_LABELS, song.category, 'Sin categoría')}
      </label>
      <label>Tono original (opcional)
        ${selectHtml('originalKey', KEYS, null, song.original_key, 'Sin especificar')}
      </label>
      <button type="submit" class="btn btn-primary">${songId ? 'Guardar datos' : 'Crear canción'}</button>
    </form>

    <div id="tracks-section" class="${songId ? '' : 'hidden'}">
      <h2>Pistas de audio</h2>
      <div id="tracks-list"></div>
      <button type="button" id="add-track-btn" class="btn btn-large">+ Agregar pista</button>
      <input type="file" id="add-track-input" class="hidden" />
      <div id="add-track-status" class="track-status"></div>
    </div>
  `;

  const form = container.querySelector('#song-form');
  const tracksSection = container.querySelector('#tracks-section');
  const tracksList = container.querySelector('#tracks-list');
  const addTrackBtn = container.querySelector('#add-track-btn');
  const addTrackInput = container.querySelector('#add-track-input');
  const addTrackStatus = container.querySelector('#add-track-status');

  if (songId) renderTracks(tracksList, song);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get('title').trim(),
      artist: fd.get('artist').trim(),
      originalKey: fd.get('originalKey') || '',
      category: fd.get('category') || '',
    };
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (song.id) {
        song = {
          ...song,
          ...(await updateSong(song.id, {
            title: payload.title,
            artist: payload.artist || null,
            original_key: payload.originalKey || null,
            category: payload.category || null,
          })),
        };
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

  addTrackBtn.addEventListener('click', () => addTrackInput.click());

  addTrackInput.addEventListener('change', async () => {
    const file = addTrackInput.files[0];
    addTrackInput.value = '';
    if (!file || !song.id) return;
    const nextLabel = `Pista ${(song.tracks || []).length + 1}`;
    try {
      const track = await uploadTrack({
        songId: song.id,
        file,
        label: nextLabel,
        onProgress: (stage) => (addTrackStatus.textContent = stage + '…'),
      });
      song.tracks = [...(song.tracks || []), track];
      addTrackStatus.textContent = '';
      renderTracks(tracksList, song);
    } catch (err) {
      addTrackStatus.textContent = 'Error al subir: ' + err.message;
    }
  });
}

function selectHtml(name, options, labels, current, emptyLabel) {
  const opts = [`<option value="" ${!current ? 'selected' : ''}>${emptyLabel}</option>`]
    .concat(
      options.map(
        (opt) =>
          `<option value="${opt}" ${current === opt ? 'selected' : ''}>${labels ? labels[opt] : opt}</option>`
      )
    )
    .join('');
  return `<select name="${name}">${opts}</select>`;
}

function renderTracks(tracksList, song) {
  const tracks = song.tracks || [];

  if (tracks.length === 0) {
    tracksList.innerHTML = `<p class="empty">Aún no hay pistas. Toca "+ Agregar pista" para subir la primera (melodía, 2da voz, 3ra voz, o la que necesites).</p>`;
    return;
  }

  tracksList.innerHTML = tracks.map((track) => trackCardHtml(track)).join('');

  tracksList.querySelectorAll('.track-card').forEach((card) => {
    const trackId = card.dataset.trackId;
    const track = tracks.find((t) => t.id === trackId);

    const labelInput = card.querySelector('[data-field="label"]');
    labelInput.addEventListener('change', async () => {
      try {
        await updateTrack(trackId, { label: labelInput.value.trim() || 'Pista' });
      } catch (err) {
        alert('No se pudo guardar la etiqueta: ' + err.message);
      }
    });

    card.querySelector('[data-field="voiceType"]').addEventListener('change', async (e) => {
      try {
        await updateTrack(trackId, { voice_type: e.target.value || null });
      } catch (err) {
        alert('No se pudo guardar la cuerda: ' + err.message);
      }
    });

    card.querySelector('[data-field="recordedKey"]').addEventListener('change', async (e) => {
      try {
        await updateTrack(trackId, { recorded_key: e.target.value || null });
      } catch (err) {
        alert('No se pudo guardar la tonalidad: ' + err.message);
      }
    });

    const replaceInput = card.querySelector('[data-field="replaceAudio"]');
    const statusEl = card.querySelector('.track-status');
    replaceInput.addEventListener('change', async () => {
      const file = replaceInput.files[0];
      replaceInput.value = '';
      if (!file) return;
      try {
        await replaceTrackAudio({
          track,
          file,
          onProgress: (stage) => (statusEl.textContent = stage + '…'),
        });
        statusEl.textContent = `Audio actualizado (${formatSize(file.size)})`;
      } catch (err) {
        statusEl.textContent = 'Error al subir: ' + err.message;
      }
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`¿Eliminar la pista "${track.label}"?`)) return;
      try {
        await deleteTrack(track.id, track.storage_path);
        song.tracks = song.tracks.filter((t) => t.id !== track.id);
        renderTracks(tracksList, song);
      } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
      }
    });
  });
}

function trackCardHtml(track) {
  return `
    <div class="track-card" data-track-id="${track.id}">
      <label>Etiqueta
        <input data-field="label" value="${escapeHtml(track.label)}" placeholder="Ej. Melodía, 2da voz, Voz accesible…" />
      </label>
      <label>Cuerda
        ${selectHtml('voiceType', VOICE_TYPES, VOICE_TYPE_LABELS, track.voice_type, 'Sin especificar')
          .replace('name="voiceType"', 'data-field="voiceType"')}
      </label>
      <label>Tono en que se grabó
        ${selectHtml('recordedKey', KEYS, null, track.recorded_key, 'Sin especificar')
          .replace('name="recordedKey"', 'data-field="recordedKey"')}
      </label>
      <label class="file-label">
        Reemplazar audio
        <input type="file" data-field="replaceAudio" />
      </label>
      <div class="track-status">Audio cargado (${formatSize(track.file_size_bytes)})</div>
      <button type="button" class="btn btn-danger btn-small" data-action="delete">Eliminar pista</button>
    </div>
  `;
}

function formatSize(bytes) {
  if (!bytes) return '';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
