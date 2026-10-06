"use client";
// Sons d'ambiance générés en direct avec Web Audio (aucun fichier à télécharger).

export type SoundId = "pluie" | "foret" | "riviere" | "vent" | "feu" | "orage" | "brun";
export const SOUNDS: { id: SoundId; name: string }[] = [
  { id: "pluie", name: "Pluie" },
  { id: "foret", name: "Forêt" },
  { id: "riviere", name: "Rivière" },
  { id: "vent", name: "Vent" },
  { id: "feu", name: "Feu de camp" },
  { id: "orage", name: "Orage lointain" },
  { id: "brun", name: "Bruit brun" },
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

class Ambience {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  bus: GainNode | null = null;
  white: AudioBuffer | null = null;
  brown: AudioBuffer | null = null;
  timers: any[] = [];
  sources: (AudioScheduledSourceNode)[] = [];
  playing: SoundId | null = null;
  volume = 0.6;

  private ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 4;
      this.white = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      this.brown = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const r = Math.random() * 2 - 1;
        w[i] = r;
        last = (last + 0.02 * r) / 1.02;
        b[i] = last * 3.5;
      }
      // fondu aux extrémités pour une boucle sans clic
      for (let i = 0; i < 2000; i++) { const k = i / 2000; w[i] *= k; w[len - 1 - i] *= k; b[i] *= k; b[len - 1 - i] *= k; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private loop(kind: "white" | "brown") {
    const s = this.ctx!.createBufferSource();
    s.buffer = kind === "white" ? this.white : this.brown;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 3);
    this.sources.push(s);
    return s;
  }
  private filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }
  private gain(v: number) { const g = this.ctx!.createGain(); g.gain.value = v; return g; }
  private lfo(rate: number, depth: number, target: AudioParam) {
    const o = this.ctx!.createOscillator(); o.frequency.value = rate;
    const g = this.gain(depth); o.connect(g); g.connect(target); o.start(); this.sources.push(o);
  }
  private chain(...nodes: AudioNode[]) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); nodes[nodes.length - 1].connect(this.bus!); }
  private every(min: number, max: number, fn: () => void) {
    const tick = () => { fn(); this.timers.push(setTimeout(tick, rand(min, max))); };
    this.timers.push(setTimeout(tick, rand(min, max)));
  }
  // court bruit filtré (goutte, crépitement, clapotis)
  private burst(freq: number, q: number, dur: number, vol: number, type: BiquadFilterType = "bandpass") {
    const c = this.ctx!, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.white;
    const f = this.filter(type, freq, q), g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus!);
    s.start(t, Math.random() * 3, dur + 0.05);
  }
  private chirp(f0: number, f1: number, dur: number, vol: number, at = 0) {
    const c = this.ctx!, t = c.currentTime + at;
    const o = c.createOscillator(), g = this.gain(0);
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private build(id: SoundId) {
    switch (id) {
      case "pluie":
        this.chain(this.loop("white"), this.filter("highpass", 500), this.filter("lowpass", 7000), this.gain(0.22));
        this.chain(this.loop("brown"), this.filter("lowpass", 450), this.gain(0.35));
        this.every(15, 70, () => this.burst(rand(2200, 6500), 6, rand(0.02, 0.06), rand(0.05, 0.18)));
        break;
      case "foret": {
        const g = this.gain(0.25);
        this.chain(this.loop("brown"), this.filter("lowpass", 700), g);
        this.lfo(0.08, 0.12, g.gain);
        const leaves = this.gain(0.025);
        this.chain(this.loop("white"), this.filter("bandpass", 3200, 0.6), leaves);
        this.lfo(0.13, 0.02, leaves.gain);
        this.every(1500, 6000, () => {
          const base = rand(2400, 4600), n = Math.floor(rand(2, 7)), d = rand(0.05, 0.13), up = Math.random() < 0.5;
          for (let i = 0; i < n; i++) this.chirp(base * rand(0.95, 1.05), base * (up ? rand(1.15, 1.4) : rand(0.65, 0.85)), d, 0.035, i * (d + rand(0.03, 0.09)));
        });
        break;
      }
      case "riviere": {
        const bp = this.filter("bandpass", 1100, 0.45);
        this.chain(this.loop("white"), bp, this.gain(0.2));
        this.lfo(0.27, 350, bp.frequency);
        this.chain(this.loop("brown"), this.filter("lowpass", 500), this.gain(0.35));
        this.every(40, 220, () => this.burst(rand(500, 1600), 12, rand(0.03, 0.08), rand(0.03, 0.08)));
        break;
      }
      case "vent": {
        const lp = this.filter("lowpass", 550, 1.2), g = this.gain(0.45);
        this.chain(this.loop("brown"), lp, g);
        this.lfo(0.06, 380, lp.frequency);
        this.lfo(0.045, 0.25, g.gain);
        const hiss = this.gain(0.03);
        this.chain(this.loop("white"), this.filter("bandpass", 1800, 1.5), hiss);
        this.lfo(0.09, 0.025, hiss.gain);
        break;
      }
      case "feu":
        this.chain(this.loop("brown"), this.filter("lowpass", 320), this.gain(0.4));
        this.chain(this.loop("white"), this.filter("bandpass", 900, 0.8), this.gain(0.015));
        this.every(25, 260, () => this.burst(rand(1800, 5000), 2, rand(0.004, 0.02), rand(0.08, 0.35), "highpass"));
        this.every(800, 3500, () => this.burst(rand(300, 700), 3, rand(0.04, 0.09), rand(0.15, 0.3)));
        break;
      case "orage":
        this.chain(this.loop("white"), this.filter("highpass", 600), this.filter("lowpass", 6000), this.gain(0.16));
        this.chain(this.loop("brown"), this.filter("lowpass", 380), this.gain(0.32));
        this.every(20, 90, () => this.burst(rand(2500, 6000), 6, rand(0.02, 0.05), rand(0.04, 0.12)));
        this.every(9000, 25000, () => {
          const c = this.ctx!, t = c.currentTime;
          const s = c.createBufferSource(); s.buffer = this.brown;
          const f = this.filter("lowpass", 160, 0.8), g = this.gain(0);
          const peak = rand(0.6, 1.1), dur = rand(3, 6);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + rand(0.3, 1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          s.connect(f); f.connect(g); g.connect(this.bus!); s.start(t, Math.random() * 2, dur + 0.1);
        });
        break;
      case "brun":
        this.chain(this.loop("brown"), this.filter("lowpass", 1200), this.gain(0.5));
        break;
    }
  }

  play(id: SoundId, volume = this.volume) {
    if (this.playing === id) { this.setVolume(volume); return; }
    this.stop(true);
    const c = this.ensure();
    this.volume = volume;
    this.bus = c.createGain();
    this.bus.gain.setValueAtTime(0, c.currentTime);
    this.bus.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);
    this.bus.connect(this.master!);
    this.master!.gain.value = volume;
    this.build(id);
    this.playing = id;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  stop(quick = false) {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const bus = this.bus, c = this.ctx, srcs = this.sources;
    this.sources = [];
    this.bus = null;
    this.playing = null;
    if (bus && c) {
      const fade = quick ? 0.15 : 0.8;
      bus.gain.cancelScheduledValues(c.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, c.currentTime);
      bus.gain.linearRampToValueAtTime(0, c.currentTime + fade);
      setTimeout(() => { srcs.forEach((x) => { try { x.stop(); } catch {} }); bus.disconnect(); }, fade * 1000 + 100);
    }
  }
}

let instance: Ambience | null = null;
export const ambience = () => (instance ||= new Ambience());
