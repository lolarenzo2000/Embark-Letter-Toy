export class AudioController {
  constructor(config = {}) {
    this.tracks = (config.music || []).filter(Boolean);
    this.finalMusic = config.finalMusic || '';
    this.sounds = config.sounds || {};
    this.musicVolume = config.musicVolume ?? .35;
    this.soundVolume = config.soundVolume ?? .85;
    this.duckFactor = config.duckFactor ?? .3;
    this.finalFadeDuration = config.finalFadeDuration ?? 2;
    this.lastTrack = null;
    this.currentMusic = null;
    this.transitionOutgoing = null;
    this.crossfadeTimer = null;
    this.musicGain = 1;
    this.musicGeneration = 0;
    this.activeSounds = new Set();
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.playNextTrack();
  }

  playNextTrack(excluded = []) {
    if (!this.started || !this.tracks.length || typeof Audio === 'undefined') return;
    const available = this.tracks.filter(track => !excluded.includes(track) && track !== this.lastTrack);
    const candidates = available.length ? available : this.tracks.filter(track => !excluded.includes(track));
    if (!candidates.length) { this.currentMusic = null; return; }

    const track = candidates[Math.floor(Math.random() * candidates.length)];
    const player = new Audio(track);
    const generation = ++this.musicGeneration;
    const advance = nextExcluded => {
      if (generation !== this.musicGeneration || this.currentMusic !== player) return;
      this.currentMusic = null;
      this.playNextTrack(nextExcluded);
    };
    player.addEventListener('ended', () => advance(excluded), { once: true });
    player.addEventListener('error', () => {
    this.musicGain = 1;
      console.warn('No se pudo cargar la canción', track);
      advance([...excluded, track]);
    }, { once: true });
    this.lastTrack = track;
    this.currentMusic = player;
    this.syncMusicVolume();
    player.play().catch(error => console.warn('No se pudo reproducir la canción', track, error));
  }

  playFinalMusic() {
    const outgoing = this.currentMusic;
    this.musicGeneration++;
    this.clearCrossfade();
    if (!this.finalMusic || typeof Audio === 'undefined') {
      this.stopMusic();
      return false;
    }
    this.started = true;
    const player = new Audio(this.finalMusic);
    const generation = ++this.musicGeneration;
    const finish = () => {
      if (generation !== this.musicGeneration || this.currentMusic !== player) return;
      this.currentMusic = null;
      this.musicGain = 1;
    };
    const fail = () => {
      if (generation !== this.musicGeneration || this.currentMusic !== player) return;
      this.currentMusic = outgoing || null;
      this.musicGain = 1;
      this.syncMusicVolume();
    };
    player.addEventListener('ended', finish, { once: true });
    player.addEventListener('error', () => {
      console.warn('No se pudo cargar la canción final', this.finalMusic);
      fail();
    }, { once: true });
    this.currentMusic = player;
    this.musicGain = outgoing ? 0 : 1;
    this.syncMusicVolume();
    player.play().then(() => {
      if (generation === this.musicGeneration && this.currentMusic === player && outgoing) {
        this.beginCrossfade(outgoing, player);
      }
    }).catch(error => {
      fail();
      console.warn('No se pudo reproducir la canción final', this.finalMusic, error);
    });
    return true;
  }

  beginCrossfade(outgoing, incoming) {
    const duration = Math.max(0, this.finalFadeDuration) * 1000;
    if (!duration) {
      outgoing.pause();
      this.musicGain = 1;
      this.syncMusicVolume();
      return;
    }
    this.transitionOutgoing = outgoing;
    const startTime = performance.now();
    this.crossfadeTimer = setInterval(() => {
      if (this.currentMusic !== incoming) {
        this.clearCrossfade();
        return;
      }
      const progress = Math.min(1, (performance.now() - startTime) / duration);
      const duck = this.activeSounds.size ? this.duckFactor : 1;
      outgoing.volume = this.musicVolume * duck * (1 - progress);
      this.musicGain = progress;
      this.syncMusicVolume();
      if (progress === 1) {
        clearInterval(this.crossfadeTimer);
        this.crossfadeTimer = null;
        this.transitionOutgoing = null;
        outgoing.pause();
      }
    }, 40);
  }

  clearCrossfade() {
    if (this.crossfadeTimer) clearInterval(this.crossfadeTimer);
    this.crossfadeTimer = null;
    if (this.transitionOutgoing) this.transitionOutgoing.pause();
    this.transitionOutgoing = null;
  }

  stopMusic() {
    this.musicGeneration++;
    this.clearCrossfade();
    if (this.currentMusic) this.currentMusic.pause();
    this.currentMusic = null;
    this.musicGain = 1;
  }

  syncMusicVolume() {
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume * this.musicGain * (this.activeSounds.size ? this.duckFactor : 1);
    }
  }

  playSound(name) {
    const source = this.sounds[name];
    if (!this.started || !source || typeof Audio === 'undefined') return false;
    const player = new Audio(source);
    player.volume = this.soundVolume;
    let active = true;
    const finish = () => {
      if (!active) return;
      active = false;
      this.activeSounds.delete(player);
      this.syncMusicVolume();
    };
    this.activeSounds.add(player);
    player.addEventListener('ended', finish, { once: true });
    player.addEventListener('error', finish, { once: true });
    this.syncMusicVolume();
    player.play().catch(error => {
      finish();
      console.warn(`No se pudo reproducir el sonido "${name}"`, error);
    });
    return true;
  }

  stop() {
    this.started = false;
    this.stopMusic();
    this.activeSounds.forEach(player => player.pause());
    this.activeSounds.clear();
  }
}
