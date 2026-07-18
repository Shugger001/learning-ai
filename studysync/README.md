# StudySync

Turn lectures (video, PDF, PowerPoint, audio, text, YouTube) into notes, flashcards, quizzes, mind maps, chat, and podcasts.

**Stack:** Next.js 14 · TypeScript · Tailwind · Supabase · OpenAI · Zustand · TanStack Query · Framer Motion

**Live:** https://studysync-alpha-opal.vercel.app

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

### Apply database migrations

1. First-time: paste `supabase/migrations/20260718140000_init_studysync.sql` in the Supabase SQL Editor.
2. Then run `supabase/migrations/RUN_PENDING.sql` (quiz count, PowerPoint, Turbo parity, product depth).

### Auth providers

Supabase → Authentication → Providers: enable **Email**, **Google**, and/or **GitHub**.

**Redirect URLs** (add both):

- `http://localhost:3000/auth/callback`
- `https://studysync-alpha-opal.vercel.app/auth/callback`

Site URL (production): `https://studysync-alpha-opal.vercel.app`

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
| Premium landing + light/dark theme | ✅ |
| Email + Google/GitHub OAuth | ✅ |
| Dashboard + folders (create / rename / delete) | ✅ |
| Multi-file upload + YouTube + in-browser recording | ✅ |
| Notes (TipTap + KaTeX) / Flashcards + SRS / Quiz + Mind Map | ✅ |
| Quiz session scores + attempt history | ✅ |
| Study chat + dual-voice podcasts | ✅ |
| Public share links (interactive cards + quiz) | ✅ |
| Study delete + retry failed processing | ✅ |
| Free plan usage meter (30-day rolling limits) | ✅ |
| Premade library + pricing / Pro soft limits | ✅ |

---

## Key routes

- `/` — landing
- `/login`, `/signup` — auth
- `/dashboard` — studies grid + FAB
- `/study/[id]` — study workspace
- `/share/[token]` — public interactive share
- `/library`, `/pricing` — premade packs + plans
- `POST /api/studies` — create study
- `POST /api/process-file` — extract + generate
