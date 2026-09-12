# Supabase (free tier)

Fitness OS uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for optional auth and cloud sync.

If those env vars are missing, the app stays in guest/offline mode. There is no placeholder client.

## Apply schema

1. Open the Supabase dashboard → SQL editor.
2. Paste `schema.sql` and run it.
3. Confirm RLS is enabled on `meal_logs`, `workout_sessions`, and `exercise_logs`.

Rows are owned by `auth.uid() = user_id`.
