/* ...existing code... */
const audio = document.getElementById('stream');
const playBtn = document.getElementById('playBtn');
const srcEl = document.getElementById('stream-src');
const status = document.getElementById('status');
const volume = document.getElementById('volume');
const volumePct = document.getElementById('volumePct');
const muteBtn = document.getElementById('muteBtn');
const wave = document.getElementById('wave');
// new now playing elements
const nowPlayingRoot = document.getElementById('nowPlaying');
const npArt = document.getElementById('npArt');
const npTitle = document.getElementById('npTitle');
const npSub = document.getElementById('npSub');
const npOpen = document.getElementById('npOpen');

// hero elements (grande debajo del header)
const heroArt = document.getElementById('heroArt');
const heroMeta = document.getElementById('heroMeta');
const hpBitrate = document.getElementById('hpBitrate');
const hpListeners = document.getElementById('hpListeners');

const SONIC_INFO_URL = 'https://cp.sonicpanel.stream/cp/get_info.php?p=8004';
let lastTrack = null;

// --- add: compute average color from image URL and apply to CSS vars ---
async function setAccentFromImage(imgUrl){
  if (!imgUrl) return;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;
    await img.decode();

    const w = 32, h = 32;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0,0,w,h).data;
    let r=0,g=0,b=0,count=0;
    for(let i=0;i<data.length;i+=4){
      const alpha = data[i+3];
      if (alpha===0) continue;
      r += data[i]; g += data[i+1]; b += data[i+2]; count++;
    }
    if (!count) return;
    r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
    const color = `rgb(${r}, ${g}, ${b})`;
    const soft = `rgba(${r}, ${g}, ${b}, 0.12)`;
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-soft', soft);
  } catch(e){
    // fail silently
  }
}

// Try to fetch SonicPanel metadata and update UI. If possible, try to fetch an artist image from Deezer.
async function updateNowPlaying(){
  try {
    const res = await fetch(SONIC_INFO_URL, {cache:'no-store'});
    if (!res.ok) throw new Error('No metadata');
    const data = await res.json();

    // The API may return title and art fields
    const title = data.title || 'Sin título';
    const artUrl = data.art && data.art.startsWith('http') ? data.art : '';
    npTitle.textContent = title;

    // Attempt to extract an artist name from the title (basic heuristics " - " or " x " / " X ")
    let artist = '';
    if (title.includes(' - ')) {
      artist = title.split(' - ')[0].trim();
    } else if (/ x /i.test(title)) {
      artist = title.split(/ x /i)[0].trim();
    } else {
      const parts = title.split(' ');
      artist = parts[0] || '';
    }
    npSub.textContent = `${artist || 'Artista desconocido'} • ${data.bitrate || ''} kbps`;

    // actualizar hero (título / artista / stats)
    const bitrate = data.bitrate || '--';
    const listeners = data.listeners || data.ulistener || '--';
    if (heroMeta){
      heroMeta.querySelector('.hero-title').textContent = title;
      // derive artist similarly al npSub logic
      let artistLabel = artist || 'Artista desconocido';
      heroMeta.querySelector('.hero-artist').textContent = artistLabel;
      if (hpBitrate) hpBitrate.textContent = `${bitrate} kbps`;
      if (hpListeners) hpListeners.textContent = `${listeners} oyentes`;
    }

    // If the track changed, try to update art (avoid refetching on same track)
    if (title !== lastTrack){
      lastTrack = title;
      // prefer SonicPanel art if present, otherwise try Deezer
      if (artUrl){
        npArt.src = artUrl;
        npArt.alt = title + ' — imagen';
        if (heroArt) { heroArt.src = artUrl; heroArt.alt = title + ' — imagen'; }
        npOpen.style.display = 'none';
        setAccentFromImage(artUrl);
      } else {
        // Deezer search: try to find artist/track cover image
        try {
          // build a query: artist and/or track
          const dq = encodeURIComponent(`${title}`);
          const deezerUrl = `https://api.deezer.com/search?q=${dq}&limit=1`;
          const dres = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(deezerUrl)}`);
          if (dres.ok){
            const djson = await dres.json();
            if (djson.data && djson.data.length){
              const item = djson.data[0];
              const pic = item.album && item.album.cover_medium;
              if (pic){
                npArt.src = pic;
                npArt.alt = item.title + ' — carátula';
                if (heroArt) { heroArt.src = pic; heroArt.alt = item.title + ' — carátula'; }
                // show button linking to Deezer track
                npOpen.style.display = 'inline-flex';
                npOpen.onclick = ()=> window.open(item.link, '_blank');
                setAccentFromImage(pic);
              } else {
                // fallback to placeholder icon (clear src)
                npArt.src = '';
                if (heroArt) heroArt.src = '';
                npOpen.style.display = 'none';
              }
            } else {
              npArt.src = '';
              if (heroArt) heroArt.src = '';
              npOpen.style.display = 'none';
            }
          } else {
            npArt.src = '';
            npOpen.style.display = 'none';
          }
        } catch (err){
          // Deezer fetch failed — fallback
          npArt.src = '';
          npOpen.style.display = 'none';
        }
      }
    }
  } catch (err){
    // console.warn('NP fetch failed', err);
    npTitle.textContent = 'No se pudo obtener metadata';
    npSub.textContent = '';
    npArt.src = '';
    if (heroArt) heroArt.src = '';
    npOpen.style.display = 'none';
    // reset to default accent values (optional)
    document.documentElement.style.setProperty('--accent', '#0f172a');
    document.documentElement.style.setProperty('--accent-soft', 'rgba(15,23,42,0.08)');
  }
}

// initial fetch and poll periodically
updateNowPlaying();
setInterval(updateNowPlaying, 15000);

// Ensure user replaces placeholder URL
if (!srcEl.src || srcEl.src.includes('TU_STREAM_URL_AQUI')) {
  status.textContent = 'URL de streaming no configurada — configure el src en index.html';
} else {
  status.textContent = 'Detenido';
}

/* ...existing code... */

// load button to set stream url at runtime
/* Removed runtime load button — set stream src directly in HTML source element */

// replace simple emoji text with SVG icons for play/pause
function setPlayIcon(playing){
  if (playing){
    playBtn.classList.add('playing');
    playBtn.innerHTML = `<span class="play-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>
    </span>`;
  } else {
    playBtn.classList.remove('playing');
    playBtn.innerHTML = `<span class="play-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>
    </span>`;
  }
}

// play/pause toggle
function playPause(){
  if (audio.paused){
    audio.play().then(()=> {
      setPlayIcon(true);
      playBtn.setAttribute('aria-pressed','true');
      status.textContent = 'Reproduciendo';
      startWave();
    }).catch(err=>{
      status.textContent = 'Error al reproducir';
      console.error(err);
    });
  } else {
    audio.pause();
    setPlayIcon(false);
    playBtn.setAttribute('aria-pressed','false');
    status.textContent = 'Pausado';
    stopWave();
  }
}

playBtn.addEventListener('click', playPause);

// initialize button icon to show play
setPlayIcon(false);

// volume control
volume.addEventListener('input', e=>{
  audio.volume = parseFloat(e.target.value);
  updateMuteIcon();
  updateVolumePct();
});

// update percentage display
function updateVolumePct(){
  const pct = Math.round((audio.muted ? 0 : audio.volume) * 100);
  if (volumePct) volumePct.textContent = `${pct}%`;
}

// initialize displayed volume
updateVolumePct();

// mute toggle
function updateMuteIcon(){
  // show SVG matching volume style; uses CSS currentColor so it follows --accent
  if (audio.muted || audio.volume===0) {
    muteBtn.setAttribute('aria-pressed','true');
    muteBtn.innerHTML = `<span class="mute-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M16.5 12l3.5 3.5-1.5 1.5L15 13.5V10.5L18.5 7l1.5 1.5L16.5 12zM3 9v6h4l5 4V5L7 9H3z"/></svg>
    </span>`;
  } else {
    muteBtn.setAttribute('aria-pressed','false');
    muteBtn.innerHTML = `<span class="mute-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3z"/></svg>
    </span>`;
  }
}
muteBtn.addEventListener('click', ()=>{
  audio.muted = !audio.muted;
  updateMuteIcon();
  updateVolumePct();
});

// keyboard: space toggles play/pause
window.addEventListener('keydown', (e)=>{
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT'){
    e.preventDefault();
    if (!playBtn.disabled) playPause();
  }
});

// simple visual pulse when playing
let waveInterval = null;
function startWave(){
  if (waveInterval) return;
  waveInterval = setInterval(()=>{
    const size = 80 + Math.random()*40;
    wave.style.boxShadow = `0 0 ${Math.round(size/2)}px rgba(0,0,0,0.06), inset 0 0 ${Math.round(size/4)}px rgba(0,0,0,0.02)`;
    wave.style.transform = `scale(${1 + (Math.random()*0.02)})`;
  }, 350);
}
function stopWave(){
  clearInterval(waveInterval);
  waveInterval = null;
  wave.style.boxShadow = '';
  wave.style.transform = '';
}

/* ...existing code... */