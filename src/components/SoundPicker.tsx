"use client";
import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ambience, SOUNDS, SoundId } from "@/lib/ambience";

// Choix de l'ambiance sonore. Hors session, toucher un son le fait écouter (aperçu) ;
// pendant une session, le changement s'applique tout de suite.
export default function SoundPicker() {
  const { S, update, active } = useApp();
  const st = S.settings;
  const [vol, setVol] = useState(st.volume ?? 0.6);
  const [preview, setPreview] = useState<SoundId | null>(null);

  useEffect(() => () => { if (!active) ambience().stop(); }, [active]);

  const pick = (id: SoundId | "") => {
    update((s) => { s.settings.sound = id; });
    if (!id) { ambience().stop(); setPreview(null); return; }
    ambience().play(id, vol);
    if (!active) setPreview(id);
  };
  const stopPreview = () => { ambience().stop(); setPreview(null); };

  return (
    <div>
      <h3>Ambiance sonore</h3>
      <div className="chips">
        <button className="chip" aria-pressed={!st.sound} onClick={() => pick("")}>Silence</button>
        {SOUNDS.map((x) => (
          <button key={x.id} className="chip" aria-pressed={st.sound === x.id} onClick={() => pick(x.id)}>
            {preview === x.id && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
            {x.name}
          </button>
        ))}
      </div>
      {st.sound && (
        <div className="range" style={{ marginTop: 12 }}>
          <label htmlFor="vol">Volume</label>
          <input type="range" id="vol" min={0} max={1} step={0.05} value={vol}
            onChange={(e) => { const v = +e.target.value; setVol(v); ambience().setVolume(v); }}
            onPointerUp={() => update((s) => { s.settings.volume = vol; })}
            onBlur={() => update((s) => { s.settings.volume = vol; })} />
          <output>{Math.round(vol * 100)} %</output>
        </div>
      )}
      <p className="small" style={{ textAlign: "left", margin: "8px 0 0" }}>
        {active ? "Le son joue pendant ta session." : preview ? <>Aperçu en cours. Le son démarrera avec ta session. <button className="linkbtn" onClick={stopPreview}>Arrêter l&apos;aperçu</button></> : "Touche un son pour l'écouter. Il démarrera avec ta session."}
      </p>
    </div>
  );
}
