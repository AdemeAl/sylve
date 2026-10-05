"use client";
import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { SPECIES, TILES } from "@/lib/catalog";
import { DAY, JOURS, dayKey, mondayOf, pad, rng, streakOf } from "@/lib/utils";
import { Coin, Flame, Thumb } from "@/components/ui";

function deals() {
  const r = rng("deals" + dayKey(Date.now()));
  const keys = Object.keys(TILES).filter((k) => k !== "prairie");
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  const pct = [10, 50, 30, 30, 10, 20];
  return keys.slice(0, 6).map((k, i) => ({ k, off: pct[i], price: Math.round((TILES[k].price * (1 - pct[i] / 100)) / 5) * 5 }));
}
function untilMidnight() {
  const n = new Date(), m = new Date(n);
  m.setHours(24, 0, 0, 0);
  const s = Math.floor((+m - +n) / 1000);
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))} min ${pad(s % 60)} s`;
}
const badgeColor = (o: number) => (o >= 50 ? "var(--coral)" : o >= 30 ? "var(--amber)" : "var(--blue)");

export default function Shop() {
  const { S, sessions, update, toast, setModal } = useApp();
  const [cd, setCd] = useState(untilMidnight());
  useEffect(() => { const id = setInterval(() => setCd(untilMidnight()), 1000); return () => clearInterval(id); }, []);
  const D = deals();
  const now = Date.now(), mon = mondayOf(now), st = streakOf(sessions);
  const days = new Set(sessions.filter((x) => x.ok).map((x) => dayKey(x.t)));
  const today = days.has(dayKey(now)), claimed = S.claimed === dayKey(now), reward = 5 + 5 * Math.min(st, 6);

  const buy = (k: string, price: number) => {
    const T = TILES[k];
    setModal(
      <>
        <Thumb kind="tile" k={k} />
        <h2>{T.name}</h2>
        <p className="small">{T.slots.length ? `Place pour ${T.slots.length} arbre${T.slots.length > 1 ? "s" : ""}.` : "Tuile décorative, sans place pour les arbres."}</p>
        {S.coins >= price ? (
          <button className="go" onClick={() => { update((s) => { s.coins -= price; s.tileInv[k] = (s.tileInv[k] || 0) + 1; }); setModal(null); toast(T.name + " ajoutée à ta réserve. Pose-la depuis Mon jardin"); }}>Acheter pour {price} pièces</button>
        ) : <p className="small" style={{ color: "var(--coral)" }}>Il te manque {price - S.coins} pièces</p>}
        <button className="go plain" onClick={() => setModal(null)}>Annuler</button>
      </>
    );
  };

  const Card = ({ k, price, off }: { k: string; price: number; off: number }) => {
    const T = TILES[k];
    const own = (S.tileInv[k] || 0) + S.tiles.filter((t) => t.type === k).length;
    return (
      <button className={"tilecard glass" + (S.coins < price ? " poor" : "")} onClick={() => buy(k, price)}>
        {off > 0 && <span className="badge" style={{ background: badgeColor(off) }}>−{off} %</span>}
        {own > 0 && <span className="owned">× {own}</span>}
        <Thumb kind="tile" k={k} />
        <span className="nm">{T.name}</span>
        <span className="slots">{T.slots.length ? `${T.slots.length} place${T.slots.length > 1 ? "s" : ""} d'arbre` : "Décor"}</span>
        <span className="pr"><Coin /> {price}</span>
        {off > 0 && <span className="was">{T.price}</span>}
      </button>
    );
  };

  return (
    <main className="page">
      <div className="pagehead"><h1>Boutique</h1><span className="coins glass"><Coin s={26} /> {S.coins}</span></div>
      <h2>Offres du jour</h2>
      <div className="refresh">Renouvelées dans {cd}</div>
      <div className="grid">{D.map((d) => <Card key={d.k} k={d.k} price={d.price} off={d.off} />)}</div>

      <h2>Série</h2>
      <div className="card glass">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 20, display: "inline-flex", gap: 6, alignItems: "center" }}><Flame /> {st} jour{st > 1 ? "s" : ""}</span>
          <span className="small">1 session réussie par jour</span>
        </div>
        <div className="week">
          {JOURS.map((j, i) => {
            const t = mon + i * DAY, on = days.has(dayKey(t));
            return <div key={j} className={"day" + (on ? " on" : "") + (dayKey(t) === dayKey(now) ? " today" : "")}><div className="c">{on && <Flame />}</div>{j}</div>;
          })}
        </div>
        <button className={"go" + (claimed || !today ? " plain" : "")} disabled={claimed || !today}
          onClick={() => { update((s) => { s.coins += reward; s.claimed = dayKey(Date.now()); }); toast("+" + reward + " pièces de série"); }}>
          {claimed ? "Bonus du jour récupéré" : today ? `Récupérer ${reward} pièces` : "Fais une session pour débloquer le bonus"}
        </button>
        <p className="small" style={{ margin: "8px 0 0" }}>Le bonus grandit avec ta série, jusqu&apos;à 35 pièces par jour.</p>
      </div>

      <h2>Toutes les tuiles</h2>
      <div className="grid">{Object.keys(TILES).map((k) => <Card key={k} k={k} price={TILES[k].price} off={0} />)}</div>

      <h2>Espèces d&apos;arbres</h2>
      <div className="grid">
        {Object.entries(SPECIES).filter(([k]) => k !== "chene").map(([k, v]) => {
          const own = S.species.includes(k);
          return (
            <button key={k} className={"tilecard glass" + (!own && S.coins < v.price ? " poor" : "")} disabled={own}
              onClick={() => {
                if (S.coins < v.price) { toast("Il te manque " + (v.price - S.coins) + " pièces"); return; }
                update((s) => { s.coins -= v.price; s.species.push(k); s.current = k; });
                toast(v.name + " débloqué et sélectionné");
              }}>
              <Thumb kind="tree" k={k} />
              <span className="nm">{v.name}</span>
              {own ? <span className="slots">Débloqué</span> : <span className="pr"><Coin /> {v.price}</span>}
            </button>
          );
        })}
      </div>
      <p className="small">1 pièce par minute de focus réussie · +5 par Pomodoro · +10 pour la première session du jour · +10 par session de groupe réussie</p>
      <p className="credit">Modèles 3D : KayKit Medieval Hexagon Pack par Kay Lousberg (CC0)</p>
    </main>
  );
}
