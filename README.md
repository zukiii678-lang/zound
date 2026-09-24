# ZOUND

ZOUND is a dark modern sound library for video editors. It indexes official Freesound previews and keeps license metadata visible per card.

## Setup

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
2. Copy `.env.example` to `.env.local` and add `SUPABASE_URL`, `SUPABASE_KEY`, and `FREESOUND_API_KEY`.
3. Install and start: `npm install`, then `npm run dev`.

## Freesound API key

Create a free account at [Freesound](https://freesound.org/), open your user profile, and create an API application/key. Put the token in `FREESOUND_API_KEY`. The script searches seven categories, keeps previews up to 30 seconds, and writes up to 15 results per category using the official preview URL.

Run `npm run seed` after the schema and environment variables are ready. Failed categories are logged and skipped so the remaining categories can finish.

## Notes

The download action points to the source provider's official preview URL. Always verify the source license before publishing a commercial project, especially for CC BY items that require attribution.
