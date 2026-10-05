"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { Avatar } from "@/components/ui";

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const { profile } = useApp();
  const [state, setState] = useState<"loading" | "ok" | "self" | "error">("loading");
  const [friend, setFriend] = useState<any>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const c = sb();
      const { data: other, error } = await c.rpc("accept_invite", { code });
      if (error || !other) { setState("error"); return; }
      if (other === profile.id) { setState("self"); return; }
      const { data } = await c.from("profiles").select("id, username, display_name, avatar_url").eq("id", other).maybeSingle();
      setFriend(data);
      setState("ok");
    })();
  }, [code, profile]);

  return (
    <main className="page">
      <div className="card glass center" style={{ marginTop: "18vh" }}>
        {state === "loading" && <p className="small">Ajout de ton ami…</p>}
        {state === "ok" && friend && (
          <>
            <Avatar url={friend.avatar_url} name={friend.display_name} size={64} />
            <h2 style={{ margin: 0 }}>Toi et {friend.display_name} êtes amis</h2>
            <p className="small">Vous pouvez voir vos jardins, vous comparer au classement et lancer des sessions de groupe.</p>
            <Link className="go" href="/friends">Voir mes amis</Link>
          </>
        )}
        {state === "self" && (
          <>
            <h2 style={{ margin: 0 }}>C&apos;est ton propre lien</h2>
            <p className="small">Envoie-le à tes amis pour qu&apos;ils te rejoignent.</p>
            <Link className="go" href="/friends">Retour</Link>
          </>
        )}
        {state === "error" && (
          <>
            <h2 style={{ margin: 0 }}>Invitation introuvable</h2>
            <p className="small">Le lien est peut-être incomplet. Demande à ton ami de te le renvoyer.</p>
            <Link className="go" href="/">Aller au jardin</Link>
          </>
        )}
      </div>
    </main>
  );
}
