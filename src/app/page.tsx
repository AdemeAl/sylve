"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { SPECIES, TILES, GRACE_OPTIONS, graceLabel, graceText } from "@/lib/catalog";
import { fmtClock, fmtMin, streakOf } from "@/lib/utils";
import { gardenSlots } from "@/lib/garden3d";
import GardenCanvas from "@/components/GardenCanvas";
import { Avatar, Chevron, Coin, Flame, Overlay, Thumb } from "@/components/ui";

export default function Home() {
  const app = useApp();
  const { S, sessions, active, brk, profile, update, toast } = app;
  const [editing, setEditing] = useState(false);
  const [selInv, setSelInv] = useState<string | null>(null);
  const [selTile, setSelTile] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "setup" | "garden">(null);
  const [, force] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!active && !brk) return;
    const id = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [active, brk]);

  const view = useMemo(() => ({
    tiles: S.tiles,
    sessions,
    editing,
    selInv,
    selTile,
    active: active ? {
      sp: active.sp,
      progress: () => {
        const el = Date.now() - active.start;
        return active.mode === "chrono" ? el / (120 * 6e4) : el / (active.end - active.start);
      },
    } : null,
  }), [S.tiles, sessions, editing, selInv, selTile, active]);

  const onPick = useCallback((p: { tileK?: string; ghost?: [number, number] }) => {
    if (p.ghost && selInv) {
      const type = selInv;
      update((s) => {
        if (!(s.tileInv[type] > 0)) return;
        s.tileInv[type]--;
        s.tiles.push({ k: "t" + Date.now().toString(36), type, q: p.ghost![0], r: p.ghost![1], rot: 0 });
      });
      if (!(S.tileInv[type] > 1)) setSelInv(null);
      toast(TILES[type].name + " posée");
    } else if (p.tileK) {
      setSelTile((cur) => (cur === p.tileK ? null : p.tileK!));
      setSelInv(null);
    }
  }, [selInv, update, S.tileInv, toast]);

  const st = S.settings;
  const sub = S.subjects.find((x) => x.id === (active ? active.s : st.subject)) || { name: "Sans matière", color: "#999" };
  const modeName = { pomo: "Pomodoro", timer: "Minuteur", chrono: "Chrono" }[active ? active.mode : st.mode];
  const planned = st.mode === "pomo" ? st.work : st.mode === "timer" ? st.free : 0;
  const { slots } = gardenSlots(S.tiles);
  const waiting = Math.max(0, sessions.length - slots.length);
  const now = Date.now();

  let body: React.ReactNode;
  if (active) {
    const elS = (now - active.start) / 1000;
    body = (
      <>
        <div className="setup"><span className="dot" style={{ background: sub.color }} />{sub.name} · {modeName}</div>
        <div className="digits">{active.mode === "chrono" ? fmtClock(elS) : fmtClock((active.end - now) / 1000)}</div>
        {active.mode === "chrono" ? (
          <button className="go" onClick={() => {
            if (elS >= 600) app.stopFocus(true);
            else if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); }
            else { setArmed(false); app.stopFocus(false, "Chrono arrêté avant 10 minutes."); }
          }}>{elS >= 600 ? "Terminer et planter" : armed ? "Moins de 10 min : toucher encore pour abandonner" : "Abandonner"}</button>
        ) : (
          <button className="go ghost" onClick={() => {
            if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); }
            else { setArmed(false); app.stopFocus(false, "Session abandonnée."); }
          }}>{armed ? "Toucher encore pour confirmer" : "Abandonner"}</button>
        )}
        <div className="small">{graceText(active.grace ?? 120)}</div>
      </>
    );
  } else if (brk) {
    body = (
      <>
        <div className="setup">Pause · étire-toi, bois de l&apos;eau</div>
        <div className="digits">{fmtClock((brk.end - now) / 1000)}</div>
        <button className="go plain" onClick={app.skipBreak}>Passer la pause</button>
      </>
    );
  } else {
    body = (
      <>
        <button className="setup" onClick={() => setSheet("setup")}><span className="dot" style={{ background: sub.color }} />{sub.name} · {modeName}<Chevron /></button>
        <div className="digits">{fmtClock(planned * 60)}</div>
        <button className="go" onClick={app.startFocus}>Focus</button>
      </>
    );
  }

  const inv = Object.entries(S.tileInv).filter(([, n]) => n > 0);
  const selected = selTile ? S.tiles.find((t) => t.k === selTile) : null;

  return (
    <section className="home">
      <div className="pills">
        <Link className="pill glass" href="/stats" aria-label="Série">
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={36} />
          <Flame /> {streakOf(sessions)}
        </Link>
        <Link className="pill right glass" href="/shop" aria-label="Pièces"><Coin s={26} /><span>{S.coins}</span></Link>
      </div>
      <GardenCanvas view={view} onPick={onPick} />
      <div className="under">
        {editing ? (
          <div className="edit glass">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontWeight: 600 }}>Modifier le jardin</b>
              <button className="softbtn glass" style={{ padding: "6px 14px", fontSize: 14 }} onClick={() => { setEditing(false); setSelInv(null); setSelTile(null); }}>Terminer</button>
            </div>
            {selected && (
              <div className="row">
                <span style={{ flex: 1, fontWeight: 500 }}>{TILES[selected.type].name}</span>
                <button className="chip" onClick={() => update((s) => { const t = s.tiles.find((x) => x.k === selTile); if (t) t.rot = (t.rot + 1) % 6; })}>Tourner</button>
                <button className="chip" disabled={S.tiles.length < 2} onClick={() => {
                  update((s) => { const t = s.tiles.find((x) => x.k === selTile); if (t && s.tiles.length > 1) { s.tiles = s.tiles.filter((x) => x !== t); s.tileInv[t.type] = (s.tileInv[t.type] || 0) + 1; } });
                  toast(TILES[selected.type].name + " rangée dans ta réserve");
                  setSelTile(null);
                }}>Ranger</button>
              </div>
            )}
            <div className="small" style={{ textAlign: "left" }}>
              {selInv ? "Touche un emplacement vert pour poser la tuile." : inv.length ? "Choisis une tuile de ta réserve, ou touche une tuile du jardin pour la tourner ou la ranger." : "Touche une tuile du jardin pour la tourner ou la ranger. Les nouvelles tuiles s'achètent dans la boutique."}
            </div>
            {inv.length > 0 && (
              <div className="inv">
                {inv.map(([k, n]) => (
                  <button key={k} className="it" aria-pressed={selInv === k} onClick={() => { setSelInv(selInv === k ? null : k); setSelTile(null); }}>
                    <Thumb kind="tile" k={k} />{TILES[k].name}<span className="small">× {n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="chiprow">
              <button className="softbtn glass" onClick={() => setSheet("garden")}>Mon jardin <Chevron /></button>
              {waiting > 0 && <Link className="softbtn glass" href="/shop" style={{ color: "var(--coral)" }}>{waiting} arbre{waiting > 1 ? "s" : ""} sans place</Link>}
            </div>
            <div className="timer glass">{body}</div>
          </>
        )}
      </div>

      {sheet === "setup" && <SetupSheet onClose={() => setSheet(null)} />}
      {sheet === "garden" && (
        <Overlay onClose={() => setSheet(null)}>
          <h2>Mon jardin</h2>
          <div className="kpis">
            <div className="kpi glass"><div className="v">{S.tiles.length}</div><div className="l">Tuiles posées</div></div>
            <div className="kpi glass"><div className="v">{sessions.filter((x) => x.ok).length}</div><div className="l">Arbres plantés</div></div>
            <div className="kpi glass"><div className="v">{sessions.filter((x) => !x.ok).length}</div><div className="l">Souches</div></div>
            <div className="kpi glass"><div className="v">{Math.max(0, slots.length - sessions.length)}</div><div className="l">Places libres{waiting ? ` · ${waiting} en attente` : ""}</div></div>
          </div>
          <p className="small" style={{ textAlign: "left", margin: 0 }}>Chaque tuile accueille quelques arbres. Quand le jardin est plein, achète une tuile et pose-la contre les autres pour l&apos;agrandir.</p>
          <button className="go" onClick={() => { setSheet(null); setEditing(true); }}>Modifier le jardin</button>
          <Link className="go plain" style={{ textAlign: "center" }} href="/shop">Aller à la boutique</Link>
        </Overlay>
      )}
    </section>
  );
}

function SetupSheet({ onClose }: { onClose: () => void }) {
  const { S, update, toast } = useApp();
  const st = S.settings;
  const Range = ({ id, label, min, max, step }: { id: "free" | "work" | "pause"; label: string; min: number; max: number; step: number }) => {
    const [v, setV] = useState(st[id]);
    return (
      <div className="range">
        <label htmlFor={id}>{label}</label>
        <input type="range" id={id} min={min} max={max} step={step} value={v}
          onChange={(e) => setV(+e.target.value)}
          onPointerUp={() => update((s) => { s.settings[id] = v; })}
          onKeyUp={() => update((s) => { s.settings[id] = v; })}
          onBlur={() => update((s) => { s.settings[id] = v; })} />
        <output>{fmtMin(v)}</output>
      </div>
    );
  };
  return (
    <Overlay onClose={onClose}>
      <h2>Ta session</h2>
      <div className="seg glass" role="group" aria-label="Mode">
        {(["timer", "chrono", "pomo"] as const).map((m) => (
          <button key={m} aria-pressed={st.mode === m} onClick={() => update((s) => { s.settings.mode = m; })}>{{ timer: "Minuteur", chrono: "Chrono", pomo: "Pomodoro" }[m]}</button>
        ))}
      </div>
      {st.mode === "pomo" && <><Range id="work" label="Travail" min={10} max={90} step={5} /><Range id="pause" label="Pause" min={3} max={30} step={1} /></>}
      {st.mode === "timer" && <Range id="free" label="Durée" min={10} max={180} step={5} />}
      {st.mode === "chrono" && <p className="small" style={{ textAlign: "left", margin: 0 }}>Le chrono monte jusqu&apos;à ce que tu t&apos;arrêtes. Tiens au moins 10 min pour planter ton arbre ; il grandit jusqu&apos;à 2 h.</p>}
      <div>
        <h3>Matière</h3>
        <div className="chips">
          {S.subjects.map((x) => (
            <button key={x.id} className="chip" aria-pressed={st.subject === x.id} onClick={() => update((s) => { s.settings.subject = x.id; })}>
              <span className="dot" style={{ background: x.color }} />{x.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3>Espèce</h3>
        <div className="species">
          {Object.keys(SPECIES).map((k) => {
            const own = S.species.includes(k);
            return (
              <button key={k} className={"sp" + (own ? "" : " locked")} aria-pressed={S.current === k}
                onClick={() => own ? update((s) => { s.current = k; }) : toast(SPECIES[k].name + " : à débloquer dans la boutique")}>
                <Thumb kind="tree" k={k} />{SPECIES[k].name}{!own && <span className="small">{SPECIES[k].price} pièces</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3>Si je quitte l&apos;appli</h3>
        <div className="chips">
          {GRACE_OPTIONS.map((g) => (
            <button key={g} className="chip" aria-pressed={(st.grace ?? 120) === g} onClick={() => update((s) => { s.settings.grace = g; })}>
              {g === 0 ? "Ne jamais faner" : "Fane après " + graceLabel(g)}
            </button>
          ))}
        </div>
        <p className="small" style={{ textAlign: "left", margin: "8px 0 0" }}>L&apos;écran qui s&apos;éteint compte comme quitter l&apos;appli : le navigateur ne fait pas la différence.</p>
      </div>
      <label className="row" style={{ justifyContent: "space-between", cursor: "pointer" }}>
        <span><b style={{ fontWeight: 500 }}>Garder l&apos;écran allumé</b><br /><span className="small">Pendant le focus, ton téléphone ne se met pas en veille.</span></span>
        <input type="checkbox" checked={st.keepAwake !== false} onChange={(e) => { const v = e.target.checked; update((s) => { s.settings.keepAwake = v; }); }} style={{ width: 22, height: 22, accentColor: "var(--mint2)", flex: "none" }} />
      </label>
      <button className="go" onClick={onClose}>Valider</button>
    </Overlay>
  );
}
