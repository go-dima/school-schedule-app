# 0001. Device-based UI Mode on the same routes

- Status: accepted
- Date: 2026-10-05
- Issues: #233 (tracking), #234

## Context

Phones need a different UI from desktop. The schedule grid (5 days × N time slots) and the approvals table don't work at 375px. The app is a Vite SPA on Vercel with Supabase auth. The main users on phones are parents and children; admins approve sign-ups on the go.

## Decision

- The **UI Mode** (`mobile` | `desktop`) is the user's override if set, otherwise the **detected device**.
  - Detection uses `navigator.userAgentData.mobile` when available, otherwise a phone-only UA regex.
  - Tablets get desktop.
  - The device is detected once per load.
- The override is a per-browser preference (localStorage key `uiMode`), set from the profile menu.
- **Same URLs in both modes.** The router swaps a route's _element_ by mode. It does not use separate paths.
- Pages without a mobile version render their desktop component inside the mobile shell.
- Page logic lives in controller hooks shared by the desktop and mobile views.

## Alternatives rejected

- **An `m.` subdomain:** it needs a second Vercel domain and more Supabase redirect URLs, and the auth session isn't shared across origins.
- **`/m/*` routes:** they duplicate the route tree and guards, and shared links break across devices.
- **Viewport breakpoints only:** a narrow desktop window would flip into the mobile UI, and the schedule needs a structurally different component, not just CSS.
- **Edge middleware that picks HTML by user agent:** too much machinery for a decision the client can make.

## Consequences

- UA detection is heuristic. A wrong guess costs one tap on "switch to desktop/mobile".
- Two views per mobile-enabled page. Logic must stay in the shared controller hooks so it doesn't drift.
