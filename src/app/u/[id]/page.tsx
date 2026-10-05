"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { rowToSession } from "@/lib/store";
import { normalizeState, GardenState, Session } from "@/lib/catalog";
import { fmtMin, mondayOf, streakOf } from "@/lib/utils";
import GardenCanvas from "@/components/GardenCanvas";
import { Avatar, Flame } from "@/components/ui";

export default function FriendGarden() {
  const { id } = useParams<{ id: string }>();
  const [prof, setProf] = useState<any>(null);
  const [st, setSt] = useState<GardenState | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const c = sb();
      const { data: p } = await c.from("profiles").select("id, username, display_name, avatar_url").eq("id", id).maybeSingle();
      setProf(p);
      const { data: s } = await c.from("user_state").select("data").eq("user_id", id).maybeSingle();
      if (!s) { setDenied(true); return; }
      setSt(normalizeState(s.data));
      const { data: rows } = await c.from("sessions").select("*").eq("user_id", id).order("started_at", { ascending: true });
      setSessions((rows || []).map(rowToSession));
    })();
  }, [id]);

  const view = useMemo(() => ({ tiles: st?.tiles || [], sessions }), [st, sessions]);
  const week = sessions.filter((x) => x.ok && x.t >= mondayOf(Date.now())).reduce((a, x) => a + x.m, 0);

  return (
    <section className="home">
      <div className="pills">
        <Link className="pill glass" href="/friends" aria-label="Retour">
          {prof && <Avatar url={prof.avatar_url} name={prof.display_name} size={36} />}
          <span style={{ fontSize: 15 }}>{prof?.display_name || "…"}</span>
        </Link>
        <span className="pill right glass"><Flame /> {streakOf(sessions)}</span>
      </div>
      {denied ? (
        <div className="stage"><div className="loading">Ce jardin n&apos;est visible que par ses amis.</div></div>
      ) : <GardenCanvas view={view} />}
      <div className="under">
        <div className="timer glass">
          <div className="setup">Jardin de {prof?.display_name || "…"}</div>
          <div className="digits" style={{ fontSize: 48 }}>{fmtMin(week)}</div>
          <div className="small">de focus cette semaine · {sessions.filter((x) => x.ok).length} arbres au total</div>
          <Link className="go plain" style={{ textAlign: "center", marginTop: 8 }} href="/friends">Retour aux amis</Link>
        </div>
      </div>
    </section>
  );
}
