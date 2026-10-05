export const DAY = 864e5;
export const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const fmtMin = (m: number) => {
  m = Math.round(m);
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60), r = m % 60;
  return h + " h" + (r ? " " + pad(r) : "");
};
export const fmtClock = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  return (h ? h + ":" + pad(Math.floor((s % 3600) / 60)) : pad(Math.floor(s / 60))) + ":" + pad(s % 60);
};
export const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const wd = (t: number) => (new Date(t).getDay() + 6) % 7;
export const mondayOf = (t: number) => startOfDay(t) - wd(t) * DAY;

export function hashStr(s: string) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
export function rng(seed: string | number) {
  let a = typeof seed === "string" ? hashStr(seed) : seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function streakOf(sessions: { t: number; ok: boolean }[]) {
  const days = new Set(sessions.filter((x) => x.ok).map((x) => dayKey(x.t)));
  let t = startOfDay(Date.now()), n = 0;
  if (!days.has(dayKey(t))) t -= DAY;
  while (days.has(dayKey(t))) { n++; t -= DAY; }
  return n;
}

export function lsGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
export function lsSet(k: string, v: string | null) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

export function randomCode(n = 6) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint32Array(n);
  crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) s += a[arr[i] % a.length];
  return s;
}
