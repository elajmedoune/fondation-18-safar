// Sons synthétisés via la Web Audio API : aucun fichier audio à charger,
// fonctionne hors-ligne. Le contexte doit être "déverrouillé" par une
// interaction utilisateur (clic sur "Activer la caméra") pour les navigateurs
// qui bloquent l'autoplay audio.

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// À appeler sur une interaction utilisateur (ex. activation de la caméra)
// afin d'autoriser la lecture des sons ensuite.
export function unlockAudio() {
  getCtx();
}

function beep(ctx, { freq, start, duration, type = 'sine', volume = 0.25 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Double bip ascendant : scan réussi, membre reconnu.
export function playScanSuccess() {
  const ctx = getCtx();
  if (!ctx) return;
  beep(ctx, { freq: 880, start: 0, duration: 0.12 });
  beep(ctx, { freq: 1320, start: 0.13, duration: 0.18 });
}

// Bip grave descendant : code inconnu ou erreur.
export function playScanError() {
  const ctx = getCtx();
  if (!ctx) return;
  beep(ctx, { freq: 330, start: 0, duration: 0.2, type: 'square', volume: 0.15 });
  beep(ctx, { freq: 220, start: 0.22, duration: 0.3, type: 'square', volume: 0.15 });
}
