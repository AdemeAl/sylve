# Sylve

Appli de concentration : sessions de focus (minuteur, chrono, Pomodoro), jardin 3D qui grandit avec tes sessions, boutique, statistiques, et un côté social (amis, classement, présence en direct, sessions de groupe en temps réel).

Stack : Next.js · Supabase (comptes Google, base de données, temps réel) · Three.js · Vercel.

---

## Mise en ligne pas à pas (≈ 20 min)

### 1. Créer le projet Supabase
1. Va sur [supabase.com](https://supabase.com), crée un compte puis **New project** (région : Paris ou Francfort).
2. Une fois le projet prêt : **SQL Editor → New query**, colle tout le contenu de `supabase/schema.sql`, puis **Run**. Tu dois voir « Success ».
3. **Project Settings → API** : note la **Project URL** et la clé **anon public**. Tu en auras besoin à l'étape 3.

### 2. Activer la connexion Google
1. Va sur [console.cloud.google.com](https://console.cloud.google.com) → crée un projet (par ex. « Sylve »).
2. **APIs & Services → OAuth consent screen** : type « External », remplis le nom de l'appli et ton email, puis enregistre.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** :
   - Type : **Web application**
   - **Authorized redirect URIs** : `https://<ton-projet>.supabase.co/auth/v1/callback`
     (Supabase te donne l'adresse exacte dans **Authentication → Sign In / Providers → Google**.)
4. Copie le **Client ID** et le **Client secret**.
5. Dans Supabase : **Authentication → Sign In / Providers → Google** → active-le et colle le Client ID et le secret.

### 3. Déployer sur Vercel
1. Va sur [vercel.com](https://vercel.com) → **Add New → Project** → importe ce dépôt GitHub.
2. Dans **Environment Variables**, ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL` = la Project URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clé anon public
3. **Deploy**. Note l'adresse obtenue (par ex. `https://sylve.vercel.app`).

### 4. Autoriser l'adresse de l'appli dans Supabase
**Authentication → URL Configuration** :
- **Site URL** : l'adresse Vercel (`https://sylve.vercel.app`)
- **Redirect URLs** : ajoute `https://sylve.vercel.app/**` (et `http://localhost:3000/**` pour tester en local)

C'est prêt : ouvre l'adresse, connecte-toi avec Google, et partage ton lien d'invitation depuis l'onglet **Amis**.

> Tant que l'écran de consentement Google est en mode « Testing », seuls les comptes ajoutés comme *testeurs* peuvent se connecter. Pour ouvrir à tous tes amis, clique sur **Publish app** dans l'écran de consentement.

---

## Lancer en local
```bash
cp .env.example .env.local   # puis remplis les deux valeurs
npm install
npm run dev                  # http://localhost:3000
```

## Installer sur le téléphone
Ouvre l'adresse dans Safari ou Chrome → **Partager → Sur l'écran d'accueil**. Sylve s'ouvre alors comme une appli.

---

## Comment ça marche
- **Focus solo** : quitter l'appli plus de 10 s fait faner l'arbre. 1 pièce par minute réussie, +5 par Pomodoro, +10 pour la première session du jour.
- **Jardin** : chaque tuile a quelques places d'arbre. Quand c'est plein, achète une tuile dans la boutique et pose-la depuis *Mon jardin → Modifier*.
- **Amis** : le lien d'invitation ajoute l'ami automatiquement. On voit le jardin de ses amis, leur présence en direct et le classement de la semaine (lundi → dimanche, heure de Paris).
- **Session de groupe** : l'hôte choisit la durée, partage le code, puis lance pour tout le monde. Si un participant quitte l'appli plus de 10 s, l'arbre commun fane pour tous. Réussie : minutes + 10 pièces de bonus, et l'arbre pousse dans le jardin de chacun.

## Structure
```
supabase/schema.sql      tables, sécurité (RLS), fonctions (invitation, classement), temps réel
src/lib/catalog.ts       tuiles, espèces, prix
src/lib/garden3d.ts      moteur 3D du jardin (Three.js)
src/lib/store.tsx        compte, données, focus solo, présence
src/app/page.tsx         jardin + minuteur
src/app/friends          amis, classement, présence, création de groupe
src/app/group/[code]     session de groupe en temps réel
src/app/invite/[code]    acceptation d'une invitation
src/app/u/[id]           jardin d'un ami
src/app/shop, stats      boutique et statistiques
```

## Crédits
Modèles 3D : [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) par Kay Lousberg, licence CC0 (`public/kaykit-license.txt`).
