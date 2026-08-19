# FRONTEND_SPEC.md — DataPulse

## 1. Navigation

Single-page app shell with a persistent left icon-rail and a global top bar (playback controls + simulated clock). No traditional multi-route navigation is needed for MVP; views are:

- **Pulse** (default/home)
- **Anomaly Radar** (accessible from rail + from Pulse anomaly badges)
- **Investigation View** (opened by selecting an anomaly; contains Cascade Replay, Insight Engine, Evidence Panel as sub-panels/tabs)
- **What-Changed** (accessible from rail)

Global top bar persists across all views: `[ ⏮ ⏵/⏸ ⏭ ]  [1x 4x 30x]  [ ───●───────── timeline scrub ── ]  [ current simulated time ]`.

## 2. Visual Language (applies to all screens)

- Dark control-room theme: near-black background (`#0B0E14`-range), muted slate surfaces for cards, restrained accent colors reserved for state (green = normal, amber = warning, red = critical, blue = neutral/informational).
- No glow/neon effects; borders and subtle elevation (soft shadow, 1px border) distinguish surfaces instead.
- Motion is smooth but restrained: metric sparklines animate on tick, anomaly state changes use a brief (150–250ms) transition, Cascade Replay node activation uses a short pulse-and-settle animation — never continuous glow/pulse loops that would read as "busy."
- Typography: one clean sans-serif family; numeric/metric values use tabular figures for stable alignment as numbers change.

---

## 3. Screen: Pulse (Home)

**PURPOSE**
Give the operator an at-a-glance read of overall system health and surface that something needs attention, immediately and continuously as simulated time advances.

**CONTENT**
- Overall health badge (Normal / Warning / Critical) — derived from the highest-severity active anomaly.
- 4 region tiles (NA, EU, APAC, LATAM), each showing a compact status color and a 1-line summary ("APAC: 1 critical anomaly").
- 6 metric sparkline cards (traffic, checkout latency, payment failure rate, conversion rate, error rate, revenue index), each with current value, short trend arrow, and a small rolling-window sparkline chart.
- Activity feed: a scrolling list of recent events/anomaly state changes up to the current simulated time, most recent first.

**ACTIONS**
- Click a region tile → filters metric cards and activity feed to that region.
- Click a metric card → opens a focused mini-chart (rolling baseline + current value + std-dev band).
- Click an anomaly entry in the activity feed → opens Investigation View for that anomaly.
- Global playback controls (play/pause/speed/scrub) always available.

**STATES**
- *Loading*: skeleton tiles/cards while initial dataset slice loads.
- *Empty* (time = dataset start, before any anomaly): all tiles green, activity feed shows only seasonal/baseline notes — this is a valid, expected normal state, not an error.
- *Error*: if the API call for the current time slice fails, show an inline retry banner on the affected card only (not a full-page error) since other cards may still have valid data.
- *Anomaly forming/active/critical*: region tile and relevant metric card visibly shift color state in sync with the Anomaly Radar.

**DATA DEPENDENCIES**
`GET /api/pulse?t=<simulatedTime>&region=<optional>`

---

## 4. Screen: Anomaly Radar

**PURPOSE**
Show all detected anomalies (current and historical, up to simulated time) in one visually scannable view, and be the entry point into investigation.

**CONTENT**
- Radial or grid layout of anomaly "nodes," each sized/colored by severity and positioned/grouped by region.
- Each node shows on hover/focus: metric, region, severity, confidence, timestamp, status (forming/active/critical/resolved).
- A filter bar: region, metric, status, minimum severity — all constrained to allow-listed values (see `SECURITY_AND_ACCESS.md` Section 4).

**ACTIONS**
- Click a node → opens Investigation View for that anomaly.
- Adjust filters → radar re-renders filtered set (client-side filter over already-fetched data, or a validated API call).
- "Jump to time" on a node → moves the global simulated clock to that anomaly's start time and opens Pulse focused on that region (fulfills the "anomaly radar that lets users jump directly into incidents" signature-interaction option, in support of the Cascade Replay centerpiece).

**STATES**
- *Loading*: skeleton nodes.
- *Empty*: "No anomalies detected in the current window" message with a suggestion to advance the simulated clock — valid at dataset start.
- *Error*: inline retry banner, radar area only.
- *Filtered-empty*: distinct message from true-empty ("No anomalies match the current filters" + a clear-filters action).

**DATA DEPENDENCIES**
`GET /api/anomalies?t=<simulatedTime>&region=&metric=&status=&minSeverity=`

---

## 5. Screen: Investigation View (contains the signature feature)

**PURPOSE**
The core "investigation" experience: let the operator see how an incident formed, why the system flagged it, and inspect the raw evidence. Composed of three tabs/panels: Cascade Replay, Insight Engine, Evidence Panel.

### 5a. Cascade Replay (signature interaction)

**PURPOSE**
Visually reconstruct, step by step, how an incident's signals triggered one another — the single most memorable interaction in the product.

**CONTENT**
- A node graph: one node per signal involved in the incident (e.g., Traffic, Checkout Latency, Payment Failures, Conversion, Revenue), laid out left-to-right in rough chronological order, with directed edges representing statistically-correlated propagation (labeled "correlated," not "caused," per the honesty rule).
- A timeline scrubber beneath the graph, scoped to the incident's window (e.g., 14:15–15:15), with tick marks at each scripted stage.
- As the scrubber moves, each node transitions: dim/inactive → forming (amber outline) → active (filled amber) → critical (filled red), and its edge to the next node draws in once both ends are anomalous.

**ACTIONS**
- Drag scrubber, or press Play to auto-advance through the incident at a chosen speed.
- Click any node → opens that signal's Evidence Panel (Section 5c) without leaving the graph.
- "Replay from start" button resets the scrubber to the incident's first stage.
- "Exit to full timeline" returns control to the global clock/scrubber.

**STATES**
- *Pre-incident* (scrubber before first stage): all nodes dim/inactive — a legitimate initial state.
- *Mid-incident*: partial graph lit, matches Section 4 of the PRD's stage list.
- *Post-incident/resolved*: nodes shown in a muted "resolved" green-outline state, edges remain visible as a historical record.
- *Loading*: skeleton graph.
- *Error*: retry banner; scrubber disabled until resolved.

**DATA DEPENDENCIES**
`GET /api/cascade/:incidentId?t=<scrubTime>`

### 5b. Insight Engine Panel

**PURPOSE**
Show the deterministic, plain-language explanation of the incident, generated from real computed values.

**CONTENT**
- A short structured explanation (2–4 sentences), e.g.: "Checkout latency in APAC increased 31% beginning at 14:28, followed 4 minutes later by a 12% increase in payment failures in the same region. Conversion fell 9% by 14:35. Composite severity: Critical (confidence 92%)."
- A small "generated by" tag: "Deterministic Insight Engine" (or "AI-generated summary" only if `LLMInsightProvider` is active — see architecture doc; must never be mislabeled).

**ACTIONS**
- "View evidence for this claim" links jump to the relevant Evidence Panel section.

**STATES**
- *Loading*, *Error* (retry banner), and a *no-incident-selected* empty state ("Select an anomaly to see its explanation").

**DATA DEPENDENCIES**
`GET /api/insight/:incidentId`

### 5c. Evidence Panel

**PURPOSE**
Show the underlying rolling-window statistics behind a specific flagged signal, so the operator can verify *why* it was flagged rather than trust a black box.

**CONTENT**
- Selected signal's raw value chart with rolling mean line and ±std-dev band overlaid.
- A small stat table: current value, rolling mean, rolling std-dev, z-score, % change vs. prior-day baseline, rate-of-change, and which detection criteria were met (see `TECHNICAL_ARCHITECTURE.md` Section 8) — each criterion shown as met/not-met.

**ACTIONS**
- Switch between signals involved in the current incident via a small tab strip.
- "Back to Cascade Replay" returns to 5a with the same scrub time preserved.

**STATES**
- *Loading*, *Error* (retry banner), *no-signal-selected* empty state.

**DATA DEPENDENCIES**
`GET /api/evidence/:signalId?t=<scrubTime>`

---

## 6. Screen: What-Changed View

**PURPOSE**
Let the operator compare the current period against the prior-day baseline for the same time-of-day, to see which metrics moved meaningfully.

**CONTENT**
- A comparison table/bar-pair view: one row per metric, showing current-period value vs. prior-day-baseline value, and a highlighted % delta.
- Meaningful changes (beyond a small noise threshold) are visually emphasized (color + bold delta); non-meaningful changes are shown muted, so the operator's eye goes to what matters.

**ACTIONS**
- Adjust the compared window (e.g., "last 15 min" / "last 60 min") via a validated preset selector (not free text).
- Click a highlighted row → opens that signal's Evidence Panel.

**STATES**
- *Loading*, *Error* (retry banner), and an *empty/no-significant-change* state ("No metric moved beyond baseline noise in this window") — a valid, calm state.

**DATA DEPENDENCIES**
`GET /api/what-changed?window=<preset>&t=<simulatedTime>`

---

## 7. Filters (cross-cutting)

Applies to Pulse, Anomaly Radar, and What-Changed: region selector, metric selector, and (Radar only) status/severity selectors. All filter controls are closed-set (dropdown/segmented control), never free-text — this both matches the product's investigative UX and enforces the allow-list validation described in `SECURITY_AND_ACCESS.md`.

## 8. Responsive Behavior

- **Desktop (primary target, ≥1200px)**: full multi-column layout as described above; Cascade Replay graph shown at full size.
- **Tablet (768–1199px)**: region tiles and metric cards reflow to 2-column grid; Cascade Replay graph scales down but remains interactive (no feature removal).
- **Mobile (<768px)**: treated as a secondary "viewer" experience — Pulse and Anomaly Radar remain fully usable in single-column layout; Cascade Replay graph switches to a vertical stage-list variant (same underlying data and scrub control, simplified layout) rather than being removed, so the signature feature is never mobile-unavailable.

## 9. Accessibility

- All interactive elements (region tiles, metric cards, anomaly nodes, scrubber, filters) are keyboard-operable and have visible focus states.
- Color is never the sole signal of state: severity/status also shown via icon/label text (e.g., a small "Critical" text badge alongside the red color), so the product remains legible for color-vision-deficient users.
- Scrubber supports arrow-key stepping in addition to drag.
- All charts/graphs include an accessible text alternative (e.g., a visually-hidden summary of current values) for screen readers.
- Sufficient contrast ratios maintained for text on the dark theme (WCAG AA minimum).

## 10. Loading States

Skeleton placeholders matched to each component's final layout (not a generic spinner) to reduce layout shift; used consistently across all screens listed above.

## 11. Empty States

Distinguished consistently: **true-empty** (valid state, e.g., dataset start with no anomalies yet) vs. **filtered-empty** (data exists but current filters exclude it) — each with distinct copy so the operator isn't confused about whether something is broken.

## 12. Error States

Scoped, inline retry banners per affected panel/card rather than full-page error screens, since a single failed fetch (e.g., Evidence Panel) should never block the rest of the investigation experience.

## 13. Animations

- Sparkline updates: smooth interpolation on tick (≤250ms).
- Anomaly state transitions: brief color/outline transition, no looping pulse.
- Cascade Replay node activation: a single short "activation pulse" (scale + fade, ~300ms) when a node crosses into a new state, then settles to a static styled state — motion communicates the *moment* of change, not a constant animated background.
- Respect `prefers-reduced-motion`: fall back to instant state changes with no transition when set.

## 14. Visual Hierarchy

Health/severity state is always the strongest visual signal on any screen (color + position), followed by the metric/value itself, followed by supporting metadata (timestamps, confidence numbers, filters) in a visually quieter treatment — consistent across Pulse, Radar, Investigation, and What-Changed so the operator's eye follows the same priority order everywhere in the product.
