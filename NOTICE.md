# Third-party notices

## Fitness OS

Fitness OS — Copyright (C) 2026 Manzar Imam and contributors.
Fitness OS is licensed under the **GNU Affero General Public License v3.0** (see [LICENSE](LICENSE)).

Source: https://github.com/connectwithmanzar/fitness-os

## openGym (UI design system & workout chrome)

Substantial portions of the visual design system, home/workout layout patterns, and CSS
component language in this project are adapted from **[openGym](https://github.com/DuarteSantos8/openGym)**
by Duarte Santos, Copyright (C) 2026 Duarte Santos, licensed under the **GNU AGPL v3.0**.

Vendored (adapted) sources:

- `vendor/opengym/index.css` — adapted from `frontend/src/index.css` (design tokens, cards,
  grouped lists, tab bar, workout logger, rest timer, sheets, week strip, today-row).
- `src/styles/opengym-adapt.css` — Fitness OS wiring (Next.js tab links, `#app.resting`,
  streak/chart helpers) on top of that skin.

- Upstream: https://github.com/DuarteSantos8/openGym
- Live demo: https://duartesantos8.github.io/openGym/
- License: AGPL-3.0 (see their LICENSE)

Fitness OS keeps its own product features (Indian meal logging, Pulse coach/bedtime,
Supabase sync, custom splits) as AGPL-licensed additions on top of that adapted UI chrome.

This NOTICE does not grant rights beyond AGPL-3.0.
