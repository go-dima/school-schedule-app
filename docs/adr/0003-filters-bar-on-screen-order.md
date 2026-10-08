# 0003. FiltersBar keeps its historical on-screen order

- Status: accepted
- Date: 2026-10-05
- Issues: #250, #249

## Context

#250 unified the page filter bars into one `FiltersBar` and pinned its groups to `rtl`, so the order matched the code comments and PRs #172/#225. That flipped the Schedule bar on screen. The bars' order had come from a leaking global `.ant-space { direction: ltr }` rule (#249).

## Decision

Keep the order the bars already had on screen. Each `FiltersBar` group renders **first child leftmost**, pinned explicitly in `FiltersBar.css` rather than relying on the global leak.

Right to left on screen:

- **Schedule:** grade · student picker · class search ‖ refresh · draft/committed · print
- **User Management:** roles · name search ‖ refresh · scope
- **Students:** grade · search ‖ Add · scope
- **Class Management:** search … clear

## Alternatives rejected

- **Pin the groups to `rtl`** so the first child is rightmost, matching the earlier code comments. The human saw the flipped Schedule bar and chose today's order.

## Consequences

- Comments beside `FiltersBar` children say "first child leftmost".
- Any change that touches bar order shows the before/after order, or screenshots.
