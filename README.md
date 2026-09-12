# Fitness OS

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

Zero-cost autonomous fitness and nutrition engine (Train / Eat / Today) as a Next.js PWA.

**Licensed AGPL-3.0**; UI adapted from [openGym](https://github.com/DuarteSantos8/openGym) (Duarte Santos); source at https://github.com/connectwithmanzar/fitness-os.

See [NOTICE.md](NOTICE.md) for third-party credits and [LICENSE](LICENSE) for the full GNU Affero GPL v3 text.

## App

- **Today** (`/pulse`) — home: week strip, today’s session row, body weight, streak
- **Train** (`/`) — start workout + logger + rest timer
- **Eat** (`/diet`) — Indian-unit meal logging and macro targets

Local-first (`localStorage`) with optional Supabase guest/sign-in sync.

## Develop

```bash
npm install
npx tsc --noEmit && npx next lint && npx next build
npm run dev
```

PWA `start_url` is `/pulse?source=pwa`.
