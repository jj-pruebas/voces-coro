# Voces Coro

App web para practicar armonías vocales: sube tantas pistas como quieras por
canción (melodía, 2da voz, 3ra voz, o cualquier otra que necesites), cada una
etiquetada por cuerda (soprano/contralto/tenor/bajo), y cambia el tono/octava
de cada pista en tiempo real desde el reproductor, sin tener que regrabar ni
resubir audio. Las canciones se agrupan en secciones de Júbilo y Adoración.

Proyecto personal, gratuito (sin tarjeta de crédito en ningún servicio):
- **Datos y audio:** [Supabase](https://supabase.com) (plan gratuito)
- **Hosting:** GitHub Pages (gratuito, repo público)
- **Sin build:** HTML/CSS/JS plano con ES modules, se abre directo en Safari del iPhone

## 1. Configurar Supabase (una sola vez)

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (gratis, sin tarjeta).
2. En el panel del proyecto, ve a **SQL Editor → New query**, pega el contenido
   de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) y ejecútalo (▶ Run).
   Esto crea las tablas `songs` y `tracks` con las políticas de acceso.
3. Pega también el contenido de
   [`supabase/migrations/0002_pistas_flexibles.sql`](supabase/migrations/0002_pistas_flexibles.sql)
   en una nueva query y ejecútalo. Añade categorías (Júbilo/Adoración), tonalidad
   en letras (C, D, E...) y quita el límite de 3 pistas fijas por canción.
4. Ve a **Storage** → **New bucket**:
   - Nombre: `audio`
   - Marca la casilla **Public bucket**
   - En "Additional configuration" (o al editar el bucket después de crearlo): límite de tamaño de archivo ≈ 40 MB, y tipos MIME permitidos: `audio/mpeg, audio/mp4, audio/aac, audio/x-m4a, audio/wav, audio/ogg, video/mp4`
5. Ve a **Settings → API** y copia:
   - **Project URL**
   - **anon public key**
6. Abre [`js/supabase-config.js`](js/supabase-config.js) y reemplaza los valores de `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los que copiaste.

## 2. Subir el proyecto a GitHub

```powershell
git add -A
git commit -m "Primera versión de Voces Coro"
```

Luego, en GitHub:
1. Crea un repositorio nuevo **público** (ej. `voces-coro`) en tu cuenta.
2. Conéctalo y sube el código:

```powershell
git remote add origin https://github.com/TU-USUARIO/voces-coro.git
git branch -M main
git push -u origin main
```

3. En GitHub, ve a **Settings → Pages** → en "Source" elige la rama `main` y
   carpeta `/ (root)`. Guarda. En 1-2 minutos tu app estará publicada en:

```
https://TU-USUARIO.github.io/voces-coro/
```

## 3. Probar desde el iPhone

1. Abre esa URL en **Safari** (no Chrome — el "Agregar a inicio" de iOS solo
   funciona bien desde Safari).
2. Toca **Compartir → Agregar a pantalla de inicio** para instalarla como app.
3. Si algo falla y quieres ver la consola de errores directamente en el
   iPhone (no hay Mac disponible para el inspector remoto), abre la URL con
   `?debug=1` al final, por ejemplo:
   `https://TU-USUARIO.github.io/voces-coro/?debug=1`
   Esto activa un panel de consola/errores en la propia pantalla.

## Cómo funciona el cambio de tono

Cada pista de audio se reproduce con [Tone.js](https://tonejs.github.io/), que
permite subir o bajar el tono **sin cambiar la velocidad** de la canción. En
vez de mover un número de semitonos a ciegas, el reproductor usa notación
estadounidense de letras (C, C#, D, D#, E, F, F#, G, G#, A, A#, B):

1. Al subir una pista, opcionalmente indicas en qué tono se grabó ("Tono en
   que se grabó"). Si no lo indicas, se asume C.
2. En el reproductor, cada pista tiene un selector **"Tonalidad objetivo"**:
   eliges a qué nota quieres que suene y la app calcula sola los semitonos
   necesarios.
3. El botón **"±1 octava"** permite además subir o bajar una octava completa
   sobre esa tonalidad — por ejemplo, para llevar una 3ra voz grabada en
   tesitura de soprano a la tesitura de un barítono.

El rango total va de -12 a +12 semitonos (una octava completa hacia abajo o
hacia arriba). Fuera de ±6 semitonos la calidad del audio puede notarse algo
menos limpia (limitación del algoritmo); el recuadro de la pista se resalta
cuando te sales de ese rango cómodo.

**Importante:** debes tocar primero "Reproducir todo" para que el audio se
active — es un requisito de seguridad de Safari en iPhone (el sonido no puede
empezar solo, necesita un toque).

## Si la calidad del pitch-shift no convence en el iPhone real

El motor de audio vive aislado en [`js/audio-engine.js`](js/audio-engine.js).
Si `Tone.PitchShift` no da buena calidad en pruebas reales, se puede sustituir
solo esa pieza por [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS)
(mejor calidad, pero requiere más integración manual) sin tener que tocar el
resto de la app.

## Estructura del proyecto

```
index.html              Página única
css/styles.css           Estilos
js/
  constants.js            Constantes compartidas (cuerdas, tonalidades, categorías, límites)
  debug.js                Consola de depuración para el iPhone (?debug=1)
  supabase-config.js       Credenciales públicas de Supabase (rellenar)
  supabase-init.js         Cliente de Supabase
  songs-repo.js            Lectura/escritura de canciones y pistas
  upload.js                Subida de archivos de audio/video
  audio-engine.js           Motor de reproducción + cambio de tono (Tone.js)
  app.js                    Router de la app (lista / editor / reproductor)
  ui/
    song-list.js             Lista agrupada por Júbilo/Adoración
    song-editor.js            Alta de canción + pistas (número libre, sin límite fijo)
    player.js                  Reproductor con selector de tonalidad + octava por pista
supabase/migrations/
  0001_init.sql              Esquema inicial
  0002_pistas_flexibles.sql   Pistas sin slot fijo, tonalidad en letras, categorías
manifest.webmanifest, service-worker.js, icons/   Soporte PWA
```
