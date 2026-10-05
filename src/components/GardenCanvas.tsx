"use client";
import React, { useEffect, useRef, useState } from "react";
import { GardenScene, GardenView } from "@/lib/garden3d";

export default function GardenCanvas({ view, onPick, className = "stage", clouds = true }: {
  view: GardenView;
  onPick?: (p: { tileK?: string; ghost?: [number, number] }) => void;
  className?: string;
  clouds?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GardenScene | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const s = new GardenScene(cv.current!, wrap.current!, { clouds });
      s.onReady = () => setLoaded(true);
      scene.current = s;
    } catch {
      setFailed(true);
    }
    return () => scene.current?.dispose();
  }, [clouds]);

  useEffect(() => { scene.current?.setView(view); }, [view]);
  useEffect(() => { if (scene.current) scene.current.onPick = onPick; }, [onPick]);

  return (
    <div className={className} ref={wrap}>
      <canvas ref={cv} aria-label="Jardin en 3D. Glisse pour tourner, pince pour zoomer." />
      {!loaded && <div className="loading">{failed ? "La 3D n'est pas disponible sur cet appareil." : "Chargement du jardin…"}</div>}
    </div>
  );
}
