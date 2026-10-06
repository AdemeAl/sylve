"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb, supabaseConfigured } from "./supabase";
import { freshState, normalizeState, GardenState, Session, SPECIES, graceLabel } from "./catalog";
import { dayKey, lsGet, lsSet } from "./utils";
import { gardenSlots } from "./garden3d";
import { ambience, SoundId } from "./ambience";

export type Profile = { id: string; username: string; display_name: string; avatar_url: string | null; invite_code: string };
export type Active = { start: number; end: number; planned: number; s: string; sp: string; mode: "pomo" | "timer" | "chrono"; beat: number; hiddenAt?: number | null; grace?: number };
export type PresenceInfo = { user_id: string; focusing: boolean; until?: number; mode?: string; group?: string | null };

type Ctx = {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  S: GardenState;
  sessions: Session[];
  update: (fn: (s: GardenState) => void) => void;
  addSession: (s: Omit<Session, "id">) => Promise<void>;
  active: Active | null;
  brk: { end: number } | null;
  startFocus: () => void;
  stopFocus: (ok: boolean, reason?: string) => void;
  startBreak: () => void;
  skipBreak: () => void;
  toast: (t: string) => void;
  modal: any;
  setModal: (n: any) => void;
  presence: Record<string, PresenceInfo>;
  setGroupPresence: (code: string | null) => void;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [S, setS] = useState<GardenState>(freshState());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [brk, setBrk] = useState<{ end: number } | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [modal, setModal] = useState<any>(null);
  const [chReady, setChReady] = useState(false);
  const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const saveTimer = useRef<any>(null);
  const Sref = useRef(S);
  Sref.current = S;
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const presenceCh = useRef<any>(null);
  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<any>(null);
  const toastTimer = useRef<any>(null);

  const toast = useCallback((t: string) => {
    setToastText(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 2800);
  }, []);

  // ---------- Auth ----------
  useEffect(() => {
    if (!supabaseConfigured) { setReady(true); return; }
    const c = sb();
    c.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); if (!data.session) setReady(true); });
    const { data: sub } = c.auth.onAuthStateChange((_e, session) => { setUser(session?.user ?? null); if (!session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const reloadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await sb().from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) setProfile(data as Profile);
  }, [user]);

  // ---------- Chargement des données ----------
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let cancelled = false;
    (async () => {
      const c = sb();
      let prof = null;
      for (let i = 0; i < 5 && !prof; i++) {
        const { data } = await c.from("profiles").select("*").eq("id", user.id).maybeSingle();
        prof = data;
        if (!prof) await new Promise((r) => setTimeout(r, 600));
      }
      const { data: st } = await c.from("user_state").select("data").eq("user_id", user.id).maybeSingle();
      let state: GardenState;
      if (!st) {
        state = freshState();
        await c.from("user_state").insert({ user_id: user.id, data: state });
      } else state = normalizeState(st.data);
      const { data: rows } = await c.from("sessions").select("*").eq("user_id", user.id).order("started_at", { ascending: true });
      if (cancelled) return;
      setProfile(prof as Profile);
      setS(state);
      setSessions((rows || []).map(rowToSession));
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;
    const { error } = await sb().from("user_state").upsert({ user_id: user.id, data: Sref.current, updated_at: new Date().toISOString() });
    if (error) toast("Enregistrement impossible : " + error.message);
  }, [user, toast]);

  const update = useCallback((fn: (s: GardenState) => void) => {
    setS((prev) => {
      const next: GardenState = JSON.parse(JSON.stringify(prev));
      fn(next);
      Sref.current = next;
      return next;
    });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 500);
  }, [save]);

  const addSession = useCallback(async (s: Omit<Session, "id">) => {
    if (!user) return;
    setSessions((prev) => [...prev, s]);
    const { data, error } = await sb().from("sessions").insert({
      user_id: user.id, started_at: new Date(s.t).toISOString(), minutes: s.m, subject: s.s, ok: s.ok, species: s.sp, group_id: s.group_id ?? null,
    }).select().single();
    if (error) toast("Session non enregistrée : " + error.message);
    else setSessions((prev) => prev.map((x) => (x === s ? rowToSession(data) : x)));
  }, [user, toast]);

  // ---------- Focus solo ----------
  const beep = () => {
    try {
      const a = audio.current;
      if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.6);
      o.start(); o.stop(a.currentTime + 0.65);
    } catch {}
  };

  const persistActive = (a: Active | null) => lsSet("sylve-active", a ? JSON.stringify(a) : null);

  const startFocus = useCallback(() => {
    const st = Sref.current.settings;
    const planned = st.mode === "pomo" ? st.work : st.mode === "timer" ? st.free : 120;
    const now = Date.now();
    const { slots } = gardenSlots(Sref.current.tiles);
    if (sessionsRef.current.length >= slots.length) toast("Jardin plein : ton arbre poussera dès que tu ajoutes une tuile");
    const a: Active = { start: now, end: now + planned * 6e4, planned, s: st.subject, sp: Sref.current.current, mode: st.mode, beat: now, grace: st.grace ?? 120 };
    setActive(a);
    persistActive(a);
    try { audio.current = audio.current || new (window.AudioContext || (window as any).webkitAudioContext)(); } catch {}
    if (st.sound) { try { ambience().play(st.sound as SoundId, st.volume ?? 0.6); } catch {} }
    if (st.keepAwake) (navigator as any).wakeLock?.request("screen").then((w: any) => { wake.current = w; w.addEventListener?.("release", () => { if (wake.current === w) wake.current = null; }); }).catch(() => {});
  }, [toast]);

  const stopFocus = useCallback((ok: boolean, reason?: string) => {
    const a = activeRef.current;
    if (!a) return;
    setActive(null);
    activeRef.current = null;
    persistActive(null);
    wake.current?.release?.().catch(() => {});
    wake.current = null;
    try { ambience().stop(); } catch {}
    const now = Math.min(Date.now(), a.end);
    const elapsed = Math.max(0, Math.round((now - a.start) / 6e4));
    const m = ok ? (a.mode === "chrono" ? elapsed : a.planned) : elapsed;
    const firstToday = !sessionsRef.current.some((x) => x.ok && dayKey(x.t) === dayKey(a.start));
    addSession({ t: a.start, m, s: a.s, ok, sp: a.sp });
    if (ok) {
      let gain = m;
      const parts = [m + " min de focus"];
      if (a.mode === "pomo") { gain += 5; parts.push("+5 Pomodoro"); }
      if (firstToday) { gain += 10; parts.push("+10 première session du jour"); }
      update((s) => { s.coins += gain; });
      beep();
      setModal({ kind: "reward", gain, parts, sp: a.sp, pomo: a.mode === "pomo" } as any);
    } else {
      setModal({ kind: "dead", reason: reason || "Session abandonnée.", m } as any);
    }
  }, [addSession, update]);

  const startBreak = useCallback(() => setBrk({ end: Date.now() + Sref.current.settings.pause * 6e4 }), []);
  const skipBreak = useCallback(() => setBrk(null), []);

  useEffect(() => {
    // reprise après rechargement
    const j = lsGet("sylve-active");
    if (!j) return;
    try {
      const a: Active = JSON.parse(j);
      const last = a.hiddenAt || a.beat;
      const g = (a.grace ?? 120) * 1000;
      if (g === 0 || Date.now() - last <= g) setActive({ ...a, hiddenAt: null });
      else { activeRef.current = a; setTimeout(() => stopFocus(false, `Tu as quitté Sylve plus de ${graceLabel(a.grace ?? 120)}.`), 1500); }
    } catch { persistActive(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active && !brk) return;
    const id = setInterval(() => {
      const now = Date.now();
      const a = activeRef.current;
      if (a) {
        if (document.visibilityState === "visible") { a.beat = now; persistActive(a); }
        if (now >= a.end) stopFocus(true);
      } else if (brk && now >= brk.end) {
        setBrk(null);
        beep();
        toast("Pause terminée. Prêt pour la suite ?");
      }
    }, 500);
    return () => clearInterval(id);
  }, [active, brk, stopFocus, toast]);

  useEffect(() => {
    const onVis = () => {
      const a = activeRef.current;
      if (!a) return;
      if (document.visibilityState === "hidden") { a.hiddenAt = Date.now(); persistActive(a); }
      else {
        const away = Date.now() - (a.hiddenAt || Date.now());
        a.hiddenAt = null;
        const g = (a.grace ?? 120) * 1000;
        if (Sref.current.settings.keepAwake && !wake.current) (navigator as any).wakeLock?.request("screen").then((w: any) => { wake.current = w; w.addEventListener?.("release", () => { if (wake.current === w) wake.current = null; }); }).catch(() => {});
        if (g > 0 && away > g) stopFocus(false, `Tu as quitté Sylve plus de ${graceLabel(a.grace ?? 120)}.`);
        else if (away > 1500) toast("Ouf, revenu à temps (" + Math.round(away / 1000) + " s)");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stopFocus, toast]);

  // ---------- Présence en direct ----------
  useEffect(() => {
    if (!user) return;
    const ch = sb().channel("presence:sylve", { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, any[]>;
      const map: Record<string, PresenceInfo> = {};
      for (const [k, arr] of Object.entries(st)) if (arr[0]) map[k] = arr[arr.length - 1];
      setPresence(map);
    });
    ch.subscribe((status) => { if (status === "SUBSCRIBED") { presenceCh.current = ch; setChReady(true); } });
    return () => { presenceCh.current = null; setChReady(false); sb().removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    const ch = presenceCh.current;
    if (!ch || !user) return;
    ch.track({ user_id: user.id, focusing: Boolean(active) || Boolean(groupCode), until: active?.end, mode: active?.mode, group: groupCode });
  }, [active, groupCode, user, chReady]);

  const signOut = useCallback(async () => {
    await sb().auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ready, user, profile, S, sessions, update, addSession, active, brk, startFocus, stopFocus, startBreak, skipBreak,
    toast, modal, setModal, presence, setGroupPresence: setGroupCode, signOut, reloadProfile,
  }), [ready, user, profile, S, sessions, update, addSession, active, brk, startFocus, stopFocus, startBreak, skipBreak, toast, modal, presence, signOut, reloadProfile]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastText && <div className="toast" role="status">{toastText}</div>}
    </AppCtx.Provider>
  );
}

export function rowToSession(r: any): Session {
  return { id: r.id, t: new Date(r.started_at).getTime(), m: r.minutes, s: r.subject, ok: r.ok, sp: SPECIES[r.species] ? r.species : "chene", group_id: r.group_id };
}
