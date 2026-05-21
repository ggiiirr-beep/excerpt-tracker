# Excerpt Tracker

A calm, Claude-design-inspired repertoire confidence tracker for orchestral excerpts. The app is a responsive React + Vite web app with Supabase authentication and cloud-backed per-user data.

## Current MVP

- Requires sign-in
- Supabase is the source of truth for each user’s excerpts, lists, notes, resources, and practice history
- localStorage is used only as a per-user cache after cloud load/save
- Mobile section navigation: Focus, New, and star sections open dedicated list pages
- Tablet/desktop section sidebar with a focused main pane
- Excerpt cue page with PDF attachment, recording control, confidence stars, and collapsed details
- Practice logging sheet from the cue page’s **Practice finished** button
- Export Backup as JSON
- Import Backup from JSON

## Local Setup

```bash
npm install
```

Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then run:

```bash
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173`.

## Supabase Schema

Create one JSON document table for the MVP. This keeps the frontend repository layer simple while still enforcing per-user ownership with RLS.

```sql
create table public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

create policy "Users can read their own app data"
on public.user_app_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own app data"
on public.user_app_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own app data"
on public.user_app_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## Build

```bash
npm run build
```

The production files are written to `dist/`.

## Deploy To GitHub Pages

1. Commit the project to a GitHub repository.
2. Keep `base: './'` in `vite.config.ts` so assets work from a repo subpath.
3. Add the Supabase env vars to the build environment.
4. Run `npm run build`.
5. Publish the `dist/` folder to GitHub Pages, commonly via a `gh-pages` branch or a Pages GitHub Action.

## Future Storage

PDFs and recordings are currently stored in the per-user JSON document for MVP continuity. The repository layer is intentionally isolated so these can move to Supabase Storage later without rewriting UI components.
