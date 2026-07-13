// Se carga primero. Sin esto no hay forma de ver errores/consola en el
// iPhone (no hay Mac/Xcode disponible para el Web Inspector remoto).
const params = new URLSearchParams(location.search);
const debugFlag = params.get('debug') === '1' || localStorage.getItem('debug') === '1';

if (debugFlag) {
  localStorage.setItem('debug', '1');
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  script.onload = () => window.eruda && window.eruda.init();
  document.head.appendChild(script);
} else if (params.get('debug') === '0') {
  localStorage.removeItem('debug');
}

window.addEventListener('error', (e) => {
  console.error('[error global]', e.message, e.filename, e.lineno);
  showFatalBanner(e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[promesa rechazada]', e.reason);
  showFatalBanner(e.reason && e.reason.message ? e.reason.message : String(e.reason));
});

function showFatalBanner(message) {
  let banner = document.getElementById('fatal-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'fatal-banner';
    banner.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;background:#b00020;color:#fff;' +
      'padding:10px 14px;font:13px system-ui;z-index:99999;white-space:pre-wrap;' +
      'padding-bottom:calc(10px + env(safe-area-inset-bottom));';
    document.body.appendChild(banner);
  }
  banner.textContent = 'Error: ' + message + '  (añade ?debug=1 a la URL para ver más detalle)';
}
