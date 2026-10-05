"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { loadLibrary, thumb } from "@/lib/garden3d";
import { rng } from "@/lib/utils";

export const Coin = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9.2" fill="#f2b93a" />
    <circle cx="10" cy="9.4" r="8.2" fill="#ffd772" />
    <circle cx="10" cy="10" r="6.2" fill="none" stroke="#c98a0e" strokeWidth="1.2" opacity=".6" />
    <path d="M10 5.6c.9 2 2.6 2.7 2.6 5a2.6 2.6 0 0 1-5.2 0c0-2.3 1.7-3 2.6-5z" fill="#b57a06" opacity=".85" />
  </svg>
);
export const Flame = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z" fill="#ff8a3c" />
    <path d="M12 12c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3 0 1 .5 1.5 1 1.5-.3-1.5 0-3 .5-4z" fill="#ffd36a" />
  </svg>
);
export const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
);

export function Avatar({ url, name, size }: { url?: string | null; name?: string; size?: number }) {
  const st = size ? { width: size, height: size } : undefined;
  if (url) return <img className="av" src={url} alt="" style={st} referrerPolicy="no-referrer" />;
  return <span className="av" style={st}>{(name || "?").slice(0, 1).toUpperCase()}</span>;
}

const NAV = [
  { href: "/stats", label: "Stats", icon: <path d="M5 20v-7M12 20V5M19 20v-10" /> },
  { href: "/", label: "Jardin", icon: <><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="M12 15v-4m0 0c0-2 1.5-3.5 3.5-3.5 0 2-1.5 3.5-3.5 3.5Zm0 1c0-1.8-1.3-3-3-3 0 1.7 1.3 3 3 3Z" /></> },
  { href: "/friends", label: "Amis", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2" /></> },
  { href: "/shop", label: "Boutique", icon: <><path d="M4 8h16l-1.4 11.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8z" /><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" /></> },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Navigation">
      <div className="in glass">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className="navbtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{n.icon}</svg>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const x = c.getContext("2d")!;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = (c.width = innerWidth * dpr), h = (c.height = innerHeight * dpr);
      const r = rng(7);
      for (let i = 0; i < 110; i++) {
        const px = r() * w, py = r() * h * 0.75, s = (r() * 1.3 + 0.3) * dpr;
        x.fillStyle = `rgba(220,230,255,${0.15 + r() * 0.55})`;
        x.beginPath(); x.arc(px, py, s, 0, 6.3); x.fill();
      }
    };
    draw();
    addEventListener("resize", draw);
    return () => removeEventListener("resize", draw);
  }, []);
  return <canvas className="stars" ref={ref} aria-hidden="true" />;
}

// Charge la bibliothèque 3D et renvoie une fonction de vignette
export function useThumbs() {
  const [lib, setLib] = useState<any>(null);
  useEffect(() => { loadLibrary().then(setLib).catch(() => {}); }, []);
  return (kind: "tile" | "tree", key: string) => thumb(lib, kind, key);
}
export function Thumb({ kind, k, className }: { kind: "tile" | "tree"; k: string; className?: string }) {
  const t = useThumbs();
  const src = t(kind, k);
  return src ? <img src={src} alt="" className={className} /> : <div className="ph">Chargement…</div>;
}

export function Overlay({ children, onClose, center }: { children: React.ReactNode; onClose?: () => void; center?: boolean }) {
  return (
    <div className={"overlay" + (center ? " center" : "")} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={center ? "modal" : "sheet"} role="dialog" aria-modal="true">
        {!center && <div className="grab" />}
        {children}
      </div>
    </div>
  );
}

export function Modals() {
  const { modal, setModal, startBreak, S } = useApp();
  if (!modal) return null;
  const close = () => setModal(null);
  if (modal.kind === "reward")
    return (
      <Overlay center onClose={close}>
        <Thumb kind="tree" k={modal.sp} className="pop" />
        <h2>Arbre planté</h2>
        <div className="big">+{modal.gain} <Coin s={28} /></div>
        <p className="small">{modal.parts.join(" · ")}</p>
        {modal.pomo ? (
          <>
            <button className="go" onClick={() => { close(); startBreak(); }}>Pause {S.settings.pause} min</button>
            <button className="go plain" onClick={close}>Plus tard</button>
          </>
        ) : <button className="go" onClick={close}>Super</button>}
      </Overlay>
    );
  if (modal.kind === "dead")
    return (
      <Overlay center onClose={close}>
        <h2>Ton arbre a fané</h2>
        <p className="small">{modal.reason} {modal.m ? `${modal.m} min comptées dans tes stats, sans pièces.` : ""}</p>
        <button className="go" onClick={close}>Compris</button>
      </Overlay>
    );
  return <Overlay center onClose={close}>{modal}</Overlay>;
}
