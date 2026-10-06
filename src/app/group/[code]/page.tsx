"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { fmtClock, fmtMin, lsGet, lsSet } from "@/lib/utils";
import { graceLabel } from "@/lib/catalog";
import GardenCanvas from "@/components/GardenCanvas";
import { Avatar, Coin } from "@/components/ui";

type Group = { id: string; code: string; host_id: string; status: "lobby" | "running" | "done" | "failed"; minutes: number; species: string; starts_at: string | null; ends_at: string | null; failed_by: string | null; grace?: number | null };
type P = { id: string; username: string; display_name: string; avatar_url: string | null };

const g0 = (g: { grace?: number | null } | null) => (g && g.grace != null ? g.grace : 120);

export default function GroupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { profile, toast, addSession, update, S, setGroupPresence } = useApp();
  const [group, setGroup] = useState<Group | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [members, setMembers] = useState<P[]>([]);
  const [here, setHere] = useState<Record<string, { away: boolean }>>({});
  const [, force] = useState(0);
  const groupRef = useRef<Group | null>(null);
  groupRef.current = group;
  const chRef = useRef<any>(null);
  const hiddenAt = useRef<number | null>(null);
  const goneSince = useRef<Record<string, number>>({});
  const startPresent = useRef<Set<string>>(new Set());

  const loadMembers = useCallback(async (gid: string) => {
    const { data } = await sb().from("group_members").select("user_id, p:profiles!group_members_user_id_fkey(id, username, display_name, avatar_url)").eq("group_id", gid);
    setMembers((data || []).map((r: any) => r.p).filter(Boolean));
  }, []);

  // Chargement + adhésion
  useEffect(() => {
    if (!profile) return;
    let off = false;
    (async () => {
      const c = sb();
      const { data: g } = await c.from("groups").select("*").eq("code", String(code).toUpperCase()).maybeSingle();
      if (off) return;
      if (!g) { setNotFound(true); return; }
      setGroup(g as Group);
      if (g.status === "lobby" || g.status === "running") {
        await c.from("group_members").upsert({ group_id: g.id, user_id: profile.id }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
      }
      loadMembers(g.id);
    })();
    return () => { off = true; };
  }, [code, profile, loadMembers]);

  // Temps réel : changements du groupe + présence
  useEffect(() => {
    if (!group?.id || !profile) return;
    const c = sb();
    const ch = c.channel("group:" + group.code, { config: { presence: { key: profile.id } } });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "groups", filter: "id=eq." + group.id }, (p: any) => setGroup(p.new as Group));
    ch.on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: "group_id=eq." + group.id }, () => loadMembers(group.id));
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, any[]>;
      const map: Record<string, { away: boolean }> = {};
      for (const [k, arr] of Object.entries(st)) map[k] = { away: Boolean(arr[arr.length - 1]?.away) };
      setHere(map);
    });
    ch.subscribe((s) => { if (s === "SUBSCRIBED") { chRef.current = ch; ch.track({ away: document.visibilityState === "hidden" }); } });
    setGroupPresence(group.code);
    return () => { chRef.current = null; c.removeChannel(ch); setGroupPresence(null); };
  }, [group?.id, group?.code, profile, loadMembers, setGroupPresence]);

  const fail = useCallback(async (who: string) => {
    const g = groupRef.current;
    if (!g || g.status !== "running") return;
    await sb().from("groups").update({ status: "failed", failed_by: who }).eq("id", g.id).eq("status", "running");
  }, []);

  // Règle du délai pour soi-même (0 = jamais)
  useEffect(() => {
    const onVis = () => {
      chRef.current?.track({ away: document.visibilityState === "hidden" });
      const g = groupRef.current;
      if (!g || g.status !== "running" || !profile) return;
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else {
        const away = Date.now() - (hiddenAt.current || Date.now());
        hiddenAt.current = null;
        const g = (g0(groupRef.current)) * 1000;
        if (g > 0 && away > g) fail(profile.id);
        else if (away > 1500) toast("Ouf, revenu à temps (" + Math.round(away / 1000) + " s)");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fail, profile, toast]);

  // Horloge, départ des autres, fin de session
  useEffect(() => {
    const id = setInterval(() => {
      force((x) => x + 1);
      const g = groupRef.current;
      if (!g || !profile) return;
      if (g.status === "running" && g.starts_at && g.ends_at) {
        const now = Date.now();
        if (now >= +new Date(g.starts_at) && startPresent.current.size === 0) Object.keys(here).forEach((k) => startPresent.current.add(k));
        // un membre parti (présence perdue ou écran caché) plus longtemps que le délai fait échouer la session
        const gMs = g0(g) * 1000;
        startPresent.current.forEach((uid) => {
          const gone = !here[uid] || here[uid].away;
          if (gone) { goneSince.current[uid] = goneSince.current[uid] || now; if (gMs > 0 && now - goneSince.current[uid] > gMs + 1500 && uid !== profile.id) fail(uid); }
          else delete goneSince.current[uid];
        });
        if (now >= +new Date(g.ends_at)) sb().from("groups").update({ status: "done" }).eq("id", g.id).eq("status", "running");
      }
    }, 500);
    return () => clearInterval(id);
  }, [here, profile, fail]);

  // Garder l'écran allumé pendant la session de groupe
  useEffect(() => {
    if (group?.status !== "running" || S.settings.keepAwake === false) return;
    let lock: any = null, off = false;
    const take = () => (navigator as any).wakeLock?.request("screen").then((w: any) => { if (off) w.release(); else lock = w; }).catch(() => {});
    take();
    const onVis = () => { if (document.visibilityState === "visible") take(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { off = true; document.removeEventListener("visibilitychange", onVis); lock?.release?.().catch(() => {}); };
  }, [group?.status, S.settings.keepAwake]);

  // Enregistrer le résultat une seule fois
  useEffect(() => {
    if (!group || !profile || (group.status !== "done" && group.status !== "failed") || !group.starts_at) return;
    if (!members.some((m) => m.id === profile.id)) return;
    const key = "sylve-group-" + group.id;
    if (lsGet(key)) return;
    lsSet(key, "1");
    const start = +new Date(group.starts_at);
    if (group.status === "done") {
      addSession({ t: start, m: group.minutes, s: S.settings.subject, ok: true, sp: group.species, group_id: group.id });
      update((s) => { s.coins += group.minutes + 10; });
    } else {
      const m = Math.max(0, Math.round((Date.now() - start) / 6e4));
      addSession({ t: start, m: Math.min(m, group.minutes), s: S.settings.subject, ok: false, sp: group.species, group_id: group.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.status, members.length]);

  const view = useMemo(() => {
    const tiles = [{ k: "g", type: "prairie", q: 0, r: 0, rot: 0 }];
    if (!group) return { tiles, sessions: [] };
    if (group.status === "done") return { tiles, sessions: [{ t: 1, m: 0, s: "", ok: true, sp: group.species }] };
    if (group.status === "failed") return { tiles, sessions: [{ t: 1, m: 0, s: "", ok: false, sp: group.species }] };
    return {
      tiles, sessions: [],
      active: { sp: group.species, progress: () => (group.status === "running" && group.starts_at && group.ends_at ? (Date.now() - +new Date(group.starts_at)) / (+new Date(group.ends_at) - +new Date(group.starts_at)) : 0.05) },
    };
  }, [group]);

  if (notFound) return (
    <main className="page"><div className="card glass center"><h2 style={{ margin: 0 }}>Session introuvable</h2><p className="small">Vérifie le code ou demande un nouveau lien.</p><Link className="go" href="/friends">Retour aux amis</Link></div></main>
  );
  if (!group || !profile) return <main className="page"><p className="small">Chargement de la session…</p></main>;

  const isHost = group.host_id === profile.id;
  const url = typeof window !== "undefined" ? window.location.origin + "/group/" + group.code : "";
  const now = Date.now();
  const starts = group.starts_at ? +new Date(group.starts_at) : 0, ends = group.ends_at ? +new Date(group.ends_at) : 0;
  const failer = members.find((m) => m.id === group.failed_by);

  const start = async () => {
    const s = new Date(Date.now() + 3000), e = new Date(s.getTime() + group.minutes * 6e4);
    const { error } = await sb().from("groups").update({ status: "running", starts_at: s.toISOString(), ends_at: e.toISOString() }).eq("id", group.id).eq("status", "lobby");
    if (error) toast("Impossible de lancer : " + error.message);
  };
  const share = async () => {
    const text = `Rejoins ma session Sylve (${fmtMin(group.minutes)}) avec le code ${group.code}`;
    if ((navigator as any).share) { try { await (navigator as any).share({ title: "Sylve", text, url }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(url); toast("Lien copié"); } catch { toast("Code : " + group.code); }
  };

  return (
    <main className="page" style={{ gap: 14 }}>
      <div className="pagehead">
        <h1>Session de groupe</h1>
        <span className="coins glass" style={{ color: "var(--ink)", letterSpacing: 2 }}>{group.code}</span>
      </div>
      <GardenCanvas view={view as any} className="groupstage" clouds={false} />
      <div className="members">
        {members.map((m) => {
          const h = here[m.id];
          return (
            <div key={m.id} className={"member" + (h ? (h.away ? " away" : " on") : "")}>
              <Avatar url={m.avatar_url} name={m.display_name} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{m.id === profile.id ? "Toi" : m.display_name.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>

      <div className="timer glass" style={{ alignSelf: "center" }}>
        {group.status === "lobby" && (
          <>
            <div className="setup">{fmtMin(group.minutes)} · {members.length} participant{members.length > 1 ? "s" : ""}</div>
            <div className="digits">{fmtClock(group.minutes * 60)}</div>
            {isHost ? <button className="go" onClick={start}>Lancer pour tout le monde</button> : <p className="small">En attente du lancement par l&apos;hôte…</p>}
            <button className="go plain" onClick={share}>Inviter (code {group.code})</button>
          </>
        )}
        {group.status === "running" && (
          <>
            <div className="setup">{now < starts ? "Départ imminent" : "Concentrez-vous ensemble"}</div>
            <div className="digits">{now < starts ? fmtClock((starts - now) / 1000) : fmtClock((ends - now) / 1000)}</div>
            <p className="small">{g0(group) === 0 ? "L'arbre commun ne fane jamais : concentrez-vous à votre rythme." : `Si quelqu'un quitte l'appli plus de ${graceLabel(g0(group))}, l'arbre commun fane pour tout le monde.`}</p>
          </>
        )}
        {group.status === "done" && (
          <>
            <h2 style={{ margin: 0 }}>Arbre commun planté</h2>
            <div className="big">+{group.minutes + 10} <Coin s={26} /></div>
            <p className="small">{fmtMin(group.minutes)} de focus + 10 pièces de bonus de groupe. L&apos;arbre pousse aussi dans ton jardin.</p>
            <button className="go" onClick={() => router.push("/")}>Voir mon jardin</button>
          </>
        )}
        {group.status === "failed" && (
          <>
            <h2 style={{ margin: 0 }}>L&apos;arbre commun a fané</h2>
            <p className="small">{failer ? (failer.id === profile.id ? `Tu as quitté l'appli plus de ${graceLabel(g0(group))}.` : `${failer.display_name} a quitté l'appli plus de ${graceLabel(g0(group))}.`) : "Un participant a quitté la session."}</p>
            <Link className="go plain" href="/friends">Retour aux amis</Link>
          </>
        )}
      </div>
    </main>
  );
}
