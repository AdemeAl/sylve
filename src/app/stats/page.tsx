"use client";
import React, { useState } from "react";
import { useApp } from "@/lib/store";
import { PALETTE } from "@/lib/catalog";
import { DAY, JOURS, fmtMin, mondayOf, pad, startOfDay, streakOf, wd } from "@/lib/utils";
import { Flame } from "@/components/ui";

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export default function Stats() {
  const { S, sessions, update, signOut, profile } = useApp();
  const [period, setPeriod] = useState<"semaine" | "mois" | "tout">("semaine");
  const now = Date.now();
  const from = period === "semaine" ? mondayOf(now) : period === "mois" ? new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime() : mondayOf(now) - 11 * 7 * DAY;
  const list = sessions.filter((x) => x.t >= from), ok = list.filter((x) => x.ok);
  const total = ok.reduce((a, x) => a + x.m, 0), rate = list.length ? Math.round((ok.length / list.length) * 100) : 0, avg = ok.length ? total / ok.length : 0;
  const subjectById = (id: string) => S.subjects.find((x) => x.id === id) || { name: "Sans matière", color: "#999" };

  let buckets: [number, number][] = [], labels: string[] = [];
  if (period === "semaine") { const s0 = mondayOf(now); for (let i = 0; i < 7; i++) { buckets.push([s0 + i * DAY, s0 + (i + 1) * DAY]); labels.push(JOURS[i]); } }
  else if (period === "mois") { const d = new Date(now); const s0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); const nd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); for (let i = 0; i < nd; i++) { buckets.push([s0 + i * DAY, s0 + (i + 1) * DAY]); labels.push((i + 1) % 5 === 0 || i === 0 ? String(i + 1) : ""); } }
  else { const s0 = mondayOf(now) - 11 * 7 * DAY; for (let i = 0; i < 12; i++) { buckets.push([s0 + i * 7 * DAY, s0 + (i + 1) * 7 * DAY]); const dd = new Date(s0 + i * 7 * DAY); labels.push(i % 2 === 0 ? dd.getDate() + "/" + (dd.getMonth() + 1) : ""); } }
  const series = buckets.map(([a, b]) => { const per: Record<string, number> = {}; ok.forEach((x) => { if (x.t >= a && x.t < b) per[x.s] = (per[x.s] || 0) + x.m; }); return per; });
  const sums = series.map((p) => Object.values(p).reduce((a, b) => a + b, 0));
  const maxV = Math.max(60, ...sums), stepH = maxV <= 120 ? 30 : maxV <= 300 ? 60 : maxV <= 600 ? 120 : 240, top = Math.ceil(maxV / stepH) * stepH;
  const CW = 320, CH = 150, L = 34, B = 18, bw = (CW - L - 4) / buckets.length;
  let bars = "";
  for (let y = 0; y <= top; y += stepH) { const py = CH - B - (y / top) * (CH - B - 8); bars += `<line x1="${L}" x2="${CW}" y1="${py}" y2="${py}" stroke="rgba(255,255,255,.08)"/><text x="${L - 4}" y="${py + 3}" text-anchor="end">${y >= 60 ? y / 60 + "h" : y + "m"}</text>`; }
  series.forEach((per, i) => { let acc = 0; const x = L + 2 + i * bw + bw * 0.18, w = bw * 0.64; Object.entries(per).forEach(([sid, v]) => { const sub = subjectById(sid); const h = (v / top) * (CH - B - 8); const y = CH - B - acc - h; acc += h; bars += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, 1)}" rx="1.5" fill="${sub.color}"><title>${esc(sub.name)} : ${fmtMin(v)}</title></rect>`; }); bars += `<text x="${x + w / 2}" y="${CH - 5}" text-anchor="middle">${labels[i]}</text>`; });

  const bySub: Record<string, number> = {};
  ok.forEach((x) => (bySub[x.s] = (bySub[x.s] || 0) + x.m));
  const subRows = S.subjects.map((s) => ({ s, m: bySub[s.id] || 0 })).sort((a, b) => b.m - a.m), maxSub = Math.max(1, ...subRows.map((r) => r.m));

  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  ok.forEach((x) => { let t = x.t, rem = x.m; while (rem > 0) { const d = new Date(t); const inH = Math.min(rem, 60 - d.getMinutes()); heat[wd(t)][d.getHours()] += inH; rem -= inH; t += inH * 6e4; } });
  const hmax = Math.max(1, ...heat.flat()), cw = 12.5, chh = 14, HL = 26;
  let hm = "";
  for (let h = 0; h < 24; h += 3) hm += `<text x="${HL + h * cw + cw / 2}" y="9" text-anchor="middle">${h}h</text>`;
  heat.forEach((row, d) => { hm += `<text x="${HL - 4}" y="${16 + d * chh + 10}" text-anchor="end">${JOURS[d]}</text>`; row.forEach((v, h) => { hm += `<rect x="${HL + h * cw + 1}" y="${16 + d * chh + 1}" width="${cw - 2}" height="${chh - 2}" rx="2.5" fill="${v ? "#86f2b6" : "rgba(255,255,255,.05)"}" ${v ? `fill-opacity="${(0.15 + 0.85 * (v / hmax)).toFixed(2)}"` : ""}><title>${JOURS[d]} ${h}h : ${Math.round(v)} min</title></rect>`; }); });

  const slot: Record<number, { m: number; ok: number; n: number }> = {};
  list.forEach((x) => { const k = Math.floor(new Date(x.t).getHours() / 2) * 2; slot[k] = slot[k] || { m: 0, ok: 0, n: 0 }; slot[k].n++; if (x.ok) { slot[k].ok++; slot[k].m += x.m; } });
  const best = Object.entries(slot).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ k: +k, ...v, score: v.m * (v.ok / v.n) })).sort((a, b) => b.score - a.score).slice(0, 3);
  const rec = Math.max(...sums);
  const st = streakOf(sessions);

  return (
    <main className="page">
      <div className="pagehead"><h1>Statistiques</h1><span className="coins glass" style={{ color: "var(--ink)" }}><Flame /> {st}</span></div>
      <div className="seg glass" role="group" aria-label="Période">
        {(["semaine", "mois", "tout"] as const).map((p) => <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{{ semaine: "Semaine", mois: "Mois", tout: "12 semaines" }[p]}</button>)}
      </div>
      <div className="kpis">
        <div className="kpi wide glass"><div className="v">{fmtMin(total)}</div><div className="l">Temps de focus réussi</div></div>
        <div className="kpi glass"><div className="v">{ok.length}<span className="small"> / {list.length}</span></div><div className="l">Sessions réussies</div></div>
        <div className="kpi glass"><div className="v">{rate} %</div><div className="l">Taux de réussite</div></div>
        <div className="kpi glass"><div className="v">{st} j</div><div className="l">Série en cours</div></div>
        <div className="kpi glass"><div className="v">{fmtMin(avg)}</div><div className="l">Durée moyenne</div></div>
      </div>
      <section className="card glass chart"><h3>{period === "tout" ? "Par semaine" : "Par jour"}{rec ? ` · record ${fmtMin(rec)}` : ""}</h3><svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Temps de focus" dangerouslySetInnerHTML={{ __html: bars }} /></section>
      <section className="card glass bars">
        <h3>Temps par matière</h3>
        {subRows.map((r) => (
          <div className="r" key={r.s.id}>
            <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: r.s.color }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.s.name}</span></span>
            <div className="track"><div className="fill" style={{ width: `${(r.m / maxSub) * 100}%`, background: r.s.color }} /></div>
            <span className="val">{fmtMin(r.m)} · {total ? Math.round((r.m / total) * 100) : 0} %</span>
          </div>
        ))}
      </section>
      <section className="card glass">
        <h3>Quand tu te concentres</h3>
        <div className="heat"><svg viewBox={`0 0 ${HL + 24 * cw + 4} ${16 + 7 * chh + 4}`} role="img" aria-label="Carte horaire" dangerouslySetInnerHTML={{ __html: hm }} /></div>
        <div className="best">
          <h3 style={{ margin: "6px 0 0" }}>Meilleurs créneaux</h3>
          {best.length ? best.map((b, i) => <div key={b.k}><span>{i + 1}. {b.k}h – {b.k + 2}h</span><span>{fmtMin(b.m)} · {Math.round((b.ok / b.n) * 100)} % réussies</span></div>) : <p className="small" style={{ margin: 0, textAlign: "left" }}>Encore quelques sessions pour trouver tes meilleurs créneaux.</p>}
        </div>
      </section>
      <section className="card glass hist">
        <h3>Historique</h3>
        {list.length ? [...list].sort((a, b) => b.t - a.t).slice(0, 12).map((x, i) => {
          const s = subjectById(x.s), d = new Date(x.t);
          return (
            <div className="h" key={(x.id ?? "n") + "-" + i}>
              <span className="dot" style={{ background: s.color }} />
              <div style={{ minWidth: 0 }}><div>{s.name}{x.group_id ? " · en groupe" : ""}</div><div className="when">{JOURS[wd(x.t)]} {d.getDate()}/{d.getMonth() + 1} · {pad(d.getHours())}:{pad(d.getMinutes())}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontWeight: 500, fontSize: 13 }}>{fmtMin(x.m)}</div><span className={"tag " + (x.ok ? "ok" : "ko")}>{x.ok ? "Réussie" : "Fanée"}</span></div>
            </div>
          );
        }) : <p className="small" style={{ margin: 0, textAlign: "left" }}>Aucune session sur cette période.</p>}
      </section>
      <section className="card glass">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Mes matières</h3>
          <button className="chip" onClick={() => update((s) => { s.subjects.push({ id: "s" + Date.now().toString(36), name: "Nouvelle matière", color: PALETTE[s.subjects.length % PALETTE.length] }); })}>+ Ajouter</button>
        </div>
        <div className="subj">
          {S.subjects.map((s) => (
            <div className="s" key={s.id}>
              <input type="color" defaultValue={s.color} aria-label="Couleur" onBlur={(e) => { const v = e.target.value; update((st) => { const x = st.subjects.find((y) => y.id === s.id); if (x) x.color = v; }); }} />
              <input type="text" defaultValue={s.name} aria-label="Nom de la matière" onBlur={(e) => { const v = e.target.value.trim(); if (v) update((st) => { const x = st.subjects.find((y) => y.id === s.id); if (x) x.name = v; }); }} />
              <button className="icon-btn" aria-label={"Supprimer " + s.name} disabled={S.subjects.length < 2} onClick={() => update((st) => { st.subjects = st.subjects.filter((y) => y.id !== s.id); if (st.settings.subject === s.id) st.settings.subject = st.subjects[0].id; })}>✕</button>
            </div>
          ))}
        </div>
      </section>
      <section className="card glass">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small" style={{ textAlign: "left" }}>Connecté en tant que <b>{profile?.display_name}</b> (@{profile?.username})</span>
          <button className="chip" onClick={signOut}>Se déconnecter</button>
        </div>
      </section>
    </main>
  );
}
