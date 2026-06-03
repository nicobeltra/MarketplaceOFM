# OFM Marketplace — Command Center

Sistema de gestión para markets de modelos. Stack: **Next.js + Supabase + Vercel**.

---

## 1. Configurar Supabase

1. Entrá a tu proyecto en [supabase.com](https://supabase.com).
2. Andá a **SQL Editor → New query**, pegá TODO el contenido de `supabase-schema.sql` y dale **Run**. Esto crea todas las tablas, las reglas de seguridad (RLS) y el bucket de fotos.
3. Andá a **Authentication → Users → Add user** y creá tu usuario (email + password). Con ese vas a entrar al sistema.
4. Andá a **Settings → API** y copiá:
   - **Project URL** → `https://lalovsbmgeabwxycfgks.supabase.co`
   - **anon / public key** (la `sb_publishable_...`)

> La **secret key** NO se usa en este proyecto. Nunca la pongas en el código ni la subas a GitHub.

---

## 2. Variables de entorno

Creá un archivo `.env.local` en la raíz (copiá `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://lalovsbmgeabwxycfgks.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aca
```

---

## 3. Probar en local (opcional)

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 → te lleva al login.

---

## 4. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/nicobeltra/MarketplaceOFM.git
git push -u origin main
```

(El `.gitignore` ya evita subir `node_modules`, `.next` y `.env.local`.)

---

## 5. Deploy en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Add New → Project** → importá `MarketplaceOFM`.
2. En **Environment Variables**, agregá las dos:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Click **Deploy**.

Cada vez que hagas `git push`, Vercel redeploya solo.

---

## 6. Usar el sistema

- Entrás con tu email y password.
- Cargás categorías, sellers, buyers, leads.
- Cargás modelos con fotos (se guardan en Supabase Storage).
- El listing 🌴 se arma solo.
- Botón **Publish to Telegram** en cada modelo: configurás el bot una vez (token + chat ID) y publica con fotos.
- Dashboard con facturación y comisiones del market.
- Alertas automáticas (30+ días sin venta) y manuales.

---

## Estructura

```
app/
  globals.css        → estilos (negro/dorado)
  layout.js          → layout raíz
  page.js            → redirige a /login o /app
  login/page.js      → login
  app/
    page.js          → guard de auth (server)
    AppShell.js      → toda la app (cliente)
lib/supabase/        → clientes de Supabase
middleware.js        → protección de rutas
supabase-schema.sql  → esquema de la base de datos
```
