import { listSongs } from '../songs-repo.js';
import { CATEGORIES, CATEGORY_LABELS } from '../constants.js';

export async function renderSongList(container) {
  container.innerHTML = `
    <header class="topbar">
      <h1>Voces Coro</h1>
      <a class="btn btn-primary" href="#/nueva">+ Canción</a>
    </header>
    <div id="song-sections">Cargando…</div>
  `;

  const sectionsEl = container.querySelector('#song-sections');
  try {
    const songs = await listSongs();
    if (songs.length === 0) {
      sectionsEl.innerHTML = `<p class="empty">Aún no hay canciones. Toca "+ Canción" para subir la primera.</p>`;
      return;
    }

    const groups = { jubilo: [], adoracion: [], sin_categoria: [] };
    for (const song of songs) {
      const bucket = CATEGORIES.includes(song.category) ? song.category : 'sin_categoria';
      groups[bucket].push(song);
    }

    const sectionOrder = [
      ['jubilo', CATEGORY_LABELS.jubilo],
      ['adoracion', CATEGORY_LABELS.adoracion],
      ['sin_categoria', 'Sin categoría'],
    ];

    sectionsEl.innerHTML = sectionOrder
      .filter(([key]) => groups[key].length > 0)
      .map(
        ([key, label]) => `
          <section class="song-section">
            <h2>${label}</h2>
            <div class="list">${groups[key].map(songCardHtml).join('')}</div>
          </section>
        `
      )
      .join('');
  } catch (err) {
    sectionsEl.innerHTML = `<p class="error">No se pudo cargar la lista: ${escapeHtml(err.message)}</p>`;
  }
}

function songCardHtml(song) {
  const tracks = song.tracks || [];
  const chips = tracks
    .map((t) => `<span class="chip chip-on">${escapeHtml(t.label)}</span>`)
    .join('');

  return `
    <a class="song-card" href="#/cancion/${song.id}">
      <div class="song-title">${escapeHtml(song.title)}</div>
      <div class="song-meta">${escapeHtml(song.artist || '')}${song.original_key ? ' · Tono original: ' + escapeHtml(song.original_key) : ''}</div>
      <div class="chips">${chips || '<span class="chip chip-off">Sin pistas</span>'}</div>
    </a>
  `;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
