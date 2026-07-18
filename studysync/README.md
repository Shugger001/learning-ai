# StudySync

Turn lectures (video, PDF, PowerPoint, audio, text) into notes, flashcards, quizzes, and mind maps.

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
2. Then run `supabase/migrations/RUN_PENDING.sql` (quiz count, PowerPoint storage, Turbo parity schema).

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
| Dashboard + New Study modal (3 steps) | ✅ |
| PDF / PPTX / video / audio / text upload | ✅ |
| Quiz + flashcard count pickers | ✅ |
| `/api/process-file` (extract + generate) | ✅ |
| Study page: Notes / Flashcards / Quiz / Mind Map | ✅ |
| Edit + save flashcards & notes | ✅ |

---

## Key routes

- `/` — landing
- `/login`, `/signup` — auth
- `/dashboard` — studies grid + FAB
- `/study/[id]` — study workspace
- `POST /api/studies` — create study (multipart)
- `POST /api/process-file` — extract + generate
