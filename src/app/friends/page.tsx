"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { SPECIES } from "@/lib/catalog";
import { fmtMin, randomCode } from "@/lib/utils";
import { Avatar, Overlay, Thumb } from "@/components/ui";

type P = { id: string; username: string; display_name: string; avatar_url: string | null };
type Row = P & { minutes: number; trees: number };

export default function Friends() {
  const { profile, presence, toast, S } = useApp();
  const router = useRouter();
  const [friends, setFriends] = useState<P[]>([]);
  const [board, setBoard] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupSheet, setGroupSheet] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const load = useCallback(async () => {
    const c = sb();
    const { data: fr } = await c.from("friendships").select("user_b, p:profiles!friendships_user_b_fkey(id, username, display_name, avatar_url)").eq("user_a", profile!.id);
    setFriends((fr || []).map((r: any) => r.p).filter(Boolean));
    const { data: lb } = await c.rpc("weekly_leaderboard");
    setBoard((lb || []).map((r: any) => ({ id: r.user_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url, minutes: Number(r.minutes), trees: Number(r.trees) })));
    setLoading(false);
  }, [profile]);
  useEffect(() => { load(); }, [load]);

  const inviteUrl = typeof window !== "undefined" && profile ? `${window.location.origin}/invite/${profile.invite_code}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); toast("Lien d'invitation copié"); }
    catch { toast("Sélectionne le lien pour le copier"); }
  };
  const share = async () => {
    if ((navigator as any).share) { try { await (navigator as any).share({ title: "Sylve", text: "Viens réviser avec moi sur Sylve !", url: inviteUrl }); } catch {} }
    else copy();
  };
  const remove = async (f: P) => {
    if (!confirm(`Retirer ${f.display_name} de tes amis ?`)) return;
    await sb().rpc("remove_friend", { other: f.id });
    toast(f.display_name + " retiré de tes amis");
    load();
  };

  const createGroup = async (minutes: number) => {
    const code = randomCode(6);
    const c = sb();
    const { data, error } = await c.from("groups").insert({ code, host_id: profile!.id, minutes, species: S.current, grace: S.settings.grace ?? 120 }).select().single();
    if (error) { toast("Impossible de créer la session : " + error.message); return; }
    await c.from("group_members").insert({ group_id: data.id, user_id: profile!.id });
    router.push("/group/" + code);
  };

  const live = Object.values(presence).filter((p) => p.user_id !== profile?.id && friends.some((f) => f.id === p.user_id));

  return (
    <main className="page">
      <div className="pagehead"><h1>Amis</h1></div>

      <section className="card glass center">
        <h2 style={{ margin: 0 }}>Session de groupe</h2>
        <p className="small" style={{ margin: 0 }}>Concentrez-vous ensemble. Un arbre commun pousse ; si quelqu&apos;un quitte l&apos;appli trop longtemps, il fane pour tout le monde. Le délai suit ton réglage de session.</p>
        <button className="go" onClick={() => setGroupSheet(true)}>Lancer une session de groupe</button>
        <form className="copy" style={{ width: "100%" }} onSubmit={(e) => { e.preventDefault(); if (joinCode.trim()) router.push("/group/" + joinCode.trim().toUpperCase()); }}>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Code reçu (ex. K7QH2M)" aria-label="Code de session" maxLength={8} />
          <button className="chip" type="submit">Rejoindre</button>
        </form>
      </section>

      {live.length > 0 && (
        <section className="card glass">
          <h3>En train de se concentrer</h3>
          <div className="list">
            {live.map((p) => {
              const f = friends.find((x) => x.id === p.user_id)!;
              return (
                <div className="person" key={p.user_id}>
                  <Avatar url={f.avatar_url} name={f.display_name} />
                  <div className="who"><div className="nm">{f.display_name}</div><div className="sub">{p.focusing ? (p.group ? "En session de groupe" : p.until ? `Encore ${Math.max(1, Math.round((p.until - Date.now()) / 6e4))} min` : "Chrono en cours") : "En ligne"}</div></div>
                  {p.group ? <Link className="chip" href={"/group/" + p.group}>Rejoindre</Link> : p.focusing ? <span className="live">Focus</span> : <span className="sub">En ligne</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card glass">
        <h3>Classement de la semaine</h3>
        {loading ? <p className="small">Chargement…</p> : board.length <= 1 && !friends.length ? (
          <p className="small" style={{ textAlign: "left", margin: 0 }}>Invite des amis pour voir le classement.</p>
        ) : (
          <div className="list">
            {board.map((r, i) => (
              <div className="person" key={r.id} style={{ gridTemplateColumns: "auto auto 1fr auto" }}>
                <span className="rank">{i + 1}</span>
                <Avatar url={r.avatar_url} name={r.display_name} />
                <div className="who"><div className="nm">{r.display_name}{r.id === profile?.id ? " (toi)" : ""}</div><div className="sub">{r.trees} arbre{r.trees > 1 ? "s" : ""}</div></div>
                <b style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtMin(r.minutes)}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card glass">
        <h3>Inviter des amis</h3>
        <p className="small" style={{ textAlign: "left", margin: "0 0 10px" }}>Envoie ce lien : en l&apos;ouvrant et en se connectant avec Google, ton ami est ajouté automatiquement.</p>
        <div className="copy">
          <input readOnly value={inviteUrl} aria-label="Lien d'invitation" onFocus={(e) => e.target.select()} />
          <button className="chip" onClick={share}>Partager</button>
        </div>
      </section>

      <section className="card glass">
        <h3>Mes amis ({friends.length})</h3>
        {!friends.length ? <p className="small" style={{ textAlign: "left", margin: 0 }}>Aucun ami pour l&apos;instant.</p> : (
          <div className="list">
            {friends.map((f) => {
              const p = presence[f.id];
              return (
                <div className="person" key={f.id}>
                  <Avatar url={f.avatar_url} name={f.display_name} />
                  <div className="who"><div className="nm">{f.display_name}</div><div className="sub">@{f.username}{p ? (p.focusing ? " · en focus" : " · en ligne") : ""}</div></div>
                  <div className="row" style={{ gap: 6 }}>
                    <Link className="chip" href={"/u/" + f.id}>Jardin</Link>
                    <button className="icon-btn" aria-label={"Retirer " + f.display_name} onClick={() => remove(f)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {groupSheet && (
        <Overlay onClose={() => setGroupSheet(false)}>
          <h2>Durée de la session</h2>
          <p className="small" style={{ textAlign: "left", margin: 0 }}>Tu recevras un code et un lien à partager. La session démarre quand tu appuies sur « Lancer ».</p>
          <div className="chips">
            {[25, 45, 60, 90].map((m) => <button key={m} className="chip" onClick={() => createGroup(m)}>{fmtMin(m)}</button>)}
          </div>
          <div className="row"><div style={{ width: 64, flex: "none" }}><Thumb kind="tree" k={S.current} /></div><span className="small">Arbre commun : {SPECIES[S.current].name}</span></div>
        </Overlay>
      )}
    </main>
  );
}
