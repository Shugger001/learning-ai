# StudySync

Turn lectures (video, PDF, audio, text) into notes, flashcards, quizzes, and mind maps.

**Stack:** Next.js 14 · TypeScript · Tailwind · Supabase · OpenAI · Zustand · TanStack Query · Framer Motion

---

## Setup

```bash
cd "/Users/shugger_dadie/Learning AI/studysync"
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=sk-...
```

### Apply database migration

Paste and run `supabase/migrations/20260718140000_init_studysync.sql` in the Supabase SQL Editor  
(or `npx supabase db push` after linking).

### Auth providers

Supabase → Authentication → Providers: enable **Email**, **Google**, and/or **GitHub**.

Redirect URL: `http://localhost:3000/auth/callback`

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Without `OPENAI_API_KEY`, processing still completes using mock study materials (useful for UI demos).

---

## What’s implemented

| Area | Status |
|------|--------|
| Landing + dark/light theme | ✅ |
| Email + Google/GitHub OAuth | ✅ |
| Dashboard + New Study modal (3 steps) | ✅ |
| Upload to Supabase Storage + credit debit (1/upload) | ✅ |
| `/api/process-file` (PDF parse, Whisper, GPT materials) | ✅ |
| Realtime/poll processing progress | ✅ |
| Study page: Notes / Flashcards / Quiz / Mind Map | ✅ |
| Edit + save flashcards & notes | ✅ |
| Credits counter in nav (Stripe later) | ✅ |

---

## Key routes

- `/` — landing
- `/login`, `/signup` — auth
- `/dashboard` — studies grid + FAB
- `/study/[id]` — study workspace
- `POST /api/studies` — create study (multipart)
- `POST /api/process-file` — extract + generate
- `GET/POST /api/credits` — balance / demo top-up (dev only)
