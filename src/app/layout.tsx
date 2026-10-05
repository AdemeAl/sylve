import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Sylve",
  description: "Concentre-toi, fais pousser ton jardin, révise avec tes amis.",
  applicationName: "Sylve",
  appleWebApp: { capable: true, title: "Sylve", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }],
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0a0f1d" };

const registerSW = `if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); }); }`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: registerSW }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
