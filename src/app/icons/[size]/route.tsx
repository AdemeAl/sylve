import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export function generateStaticParams() {
  return [{ size: "180" }, { size: "192" }, { size: "512" }];
}

// Icône : une petite île hexagonale avec un arbre, sur un ciel de nuit.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = Math.min(1024, Math.max(48, parseInt(size, 10) || 512));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 40%, #22355c 0%, #121c33 45%, #0a0f1d 100%)" }}>
        <svg width={s * 0.78} height={s * 0.78} viewBox="0 0 100 100">
          <circle cx="18" cy="16" r="0.9" fill="#dfe8ff" opacity="0.8" />
          <circle cx="82" cy="22" r="0.7" fill="#dfe8ff" opacity="0.6" />
          <circle cx="74" cy="10" r="0.6" fill="#dfe8ff" opacity="0.7" />
          <circle cx="26" cy="30" r="0.5" fill="#dfe8ff" opacity="0.5" />
          {/* côtés de l'île */}
          <polygon points="14,58 50,76 50,88 14,70" fill="#4f8f2c" />
          <polygon points="50,76 86,58 86,70 50,88" fill="#3d7322" />
          {/* dessus hexagonal (vue isométrique) */}
          <polygon points="50,40 86,58 50,76 14,58" fill="#9ee07a" />
          <polygon points="50,44 80,58 50,72 20,58" fill="#b4ea8f" />
          {/* ombre */}
          <ellipse cx="50" cy="62" rx="13" ry="4.5" fill="#000" opacity="0.18" />
          {/* tronc */}
          <rect x="47.5" y="46" width="5" height="15" rx="1.5" fill="#7a5233" />
          {/* feuillage */}
          <circle cx="50" cy="38" r="14" fill="#3f9a57" />
          <circle cx="40" cy="44" r="9" fill="#4aab63" />
          <circle cx="60" cy="43" r="9.5" fill="#358a4b" />
          <circle cx="52" cy="28" r="9" fill="#5cc276" />
          <circle cx="46" cy="33" r="4" fill="#86f2b6" opacity="0.55" />
        </svg>
      </div>
    ),
    { width: s, height: s }
  );
}
