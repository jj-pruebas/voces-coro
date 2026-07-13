import { renderSongList } from './ui/song-list.js';
import { renderSongEditor } from './ui/song-editor.js';
import { renderPlayer, disposeActive } from './ui/player.js';
import { isConfigured } from './supabase-init.js';

const app = document.getElementById('app');

async function router() {
  const hash = location.hash || '#/';
  disposeActive();

  if (!isConfigured) {
    app.innerHTML = `
      <div class="setup-warning">
        <h1>Falta configurar Supabase</h1>
        <p>Rellena <code>js/supabase-config.js</code> con la URL y la anon key de tu proyecto de Supabase (Settings → API), según el README.</p>
      </div>
    `;
    return;
  }

  const playerMatch = hash.match(/^#\/cancion\/([^/]+)$/);
  const editMatch = hash.match(/^#\/cancion\/([^/]+)\/editar$/);

  try {
    if (hash === '#/' || hash === '') {
      await renderSongList(app);
    } else if (hash === '#/nueva') {
      await renderSongEditor(app, null);
    } else if (editMatch) {
      await renderSongEditor(app, editMatch[1]);
    } else if (playerMatch) {
      await renderPlayer(app, playerMatch[1]);
    } else {
      await renderSongList(app);
    }
  } catch (err) {
    app.innerHTML = `<p class="error">Error inesperado: ${err.message}</p>`;
    console.error(err);
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

if (document.readyState !== 'loading') router();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('No se pudo registrar el service worker', err);
    });
  });
}
