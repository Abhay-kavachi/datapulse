# FEATURE_TICKETS.md — DataPulse

Tickets are ordered for implementation. P0 tickets include full detail per the template; P1/P2 are scoped more lightly as they are not required for the MVP acceptance criteria in `PRD.md`.

---

## P0 — Must Have

### DAT-001 — Project Scaffold & Design Tokens
**Objective**: Stand up the Next.js/TypeScript/Tailwind project with the dark control-room design tokens so every later ticket builds on a consistent base.
**Description**: Initialize the app, configure Tailwind with the color/typography tokens from `FRONTEND_SPEC.md` Section 2, set up the global app shell (icon rail + top bar placeholder), and configure security headers (`SECURITY_AND_ACCESS.md` Section 9).
**Dependencies**: None.
**Implementation notes**: Keep the token set small and named semantically (`--color-state-normal`, `--color-state-warning`, `--color-state-critical`) rather than raw hex references throughout components.
**Acceptance criteria**: App boots locally with zero config; shell renders with placeholder rail/top bar; security headers present on responses.
**Testing requirements**: Smoke test that the app builds and serves; header presence test.
**Security considerations**: Establish CSP/`X-Content-Type-Options` at this stage so nothing later ships without them.

---

### DAT-002 — Seeded Synthetic Data Generator (Core Signals)
**Objective**: Produce the deterministic 24-hour, 6-signal, 4-region dataset described in `TECHNICAL_ARCHITECTURE.md` Section 6.
**Description**: Implement the seeded PRNG and the baseline + seasonal + noise composition function for all six metrics across all four regions at 1-minute resolution.
**Dependencies**: DAT-001.
**Implementation notes**: Isolate the PRNG and the composition function as pure functions so they're independently unit-testable; log a generation summary (row counts, seed) at boot per `TECHNICAL_ARCHITECTURE.md` Section 13.
**Acceptance criteria**: Same seed produces byte-identical output across runs; dataset covers full 24h window for all metric×region pairs.
**Testing requirements**: Unit tests asserting determinism (two generations with same seed match) and expected row counts.
**Security considerations**: None (server-generated, no external input).

---

### DAT-003 — Designed Multi-Stage Incident Injection
**Objective**: Inject the scripted APAC incident (PRD Section 4) plus at least one non-escalating "blip" into the generated dataset.
**Description**: Implement `incidentDelta` and the ground-truth `Incident.stages` script; apply it on top of the base series from DAT-002 for the APAC region across the six scripted stages; seed the smaller EU "blip" that must stay under detection threshold.
**Dependencies**: DAT-002.
**Implementation notes**: Keep the ground-truth script fully separate from the detector (DAT-006) so detection can be validated against it without being hardcoded to it.
**Acceptance criteria**: Generated series show a visible, designed deviation in APAC starting ~14:25 and recovering by ~15:10; the EU blip stays within normal variance bounds.
**Testing requirements**: Unit test asserting APAC values in the incident window exceed a sanity magnitude threshold; unit test asserting the EU blip stays under the DAT-006 multi-criteria threshold.
**Security considerations**: None.

---

### DAT-004 — In-Memory Dataset Store
**Objective**: Provide a single, queryable, server-side store for the generated `MetricPoint[]`, `EventPoint[]`, `Anomaly[]`, and `Incident[]` data.
**Description**: Build the module-level store singleton, initialized once at boot from DAT-002/DAT-003 output, with query helpers (`getMetricSlice(metric, region, from, to)`, etc.).
**Dependencies**: DAT-002, DAT-003.
**Implementation notes**: Keep query helpers allow-list-friendly — they should accept only the typed enum values, never raw strings, to make DAT-014 (validation) straightforward.
**Acceptance criteria**: Store is queryable by any downstream module; identical results across repeated queries for the same params.
**Testing requirements**: Unit tests for each query helper against known fixture slices.
**Security considerations**: Store is never externally writable in MVP — no mutation endpoints exist (see DAT-014/SECURITY_AND_ACCESS.md Section 9).

---

### DAT-005 — Analytics Engine (Rolling Stats, Z-Score, Rate-of-Change, Correlation)
**Objective**: Implement the deterministic statistical functions defined in `TECHNICAL_ARCHITECTURE.md` Section 7.
**Description**: `rollingMean`, `rollingStdDev`, `zScore`, `percentChange`, `percentChangeVsBaseline`, `rateOfChange`, `correlate`.
**Dependencies**: DAT-004.
**Implementation notes**: Pure functions, no I/O; window sizes as named constants, not magic numbers, so they can be tuned without touching call sites.
**Acceptance criteria**: All functions produce correct values against hand-computed fixtures.
**Testing requirements**: Unit tests per function with fixture series and hand-verified expected outputs, including edge cases (window larger than available history, zero-variance series).
**Security considerations**: None (pure computation over trusted internal data).

---

### DAT-006 — Anomaly Detector (Multi-Criteria)
**Objective**: Flag anomalies using the multi-criteria rule in `TECHNICAL_ARCHITECTURE.md` Section 8, producing `Anomaly[]` records with severity/confidence.
**Description**: Combine z-score, rate-of-change, and baseline % change; require ≥2 of 3 to agree; compute severity and confidence scores; assign status (`forming`/`active`/`critical`/`resolved`) based on evolving severity over time.
**Dependencies**: DAT-005.
**Implementation notes**: Keep `triggeringCriteria` on each `Anomaly` record (which specific criteria fired) so the Evidence Panel (DAT-011) can show it directly without recomputation drift.
**Acceptance criteria**: Detector independently identifies the DAT-003 scripted incident within a small time tolerance (≤2 min) of each scripted stage; does **not** flag the seeded blip as a full anomaly.
**Testing requirements**: Unit test comparing detector output against the ground-truth `Incident.stages` script (tolerance-based match); unit test asserting the blip stays below threshold.
**Security considerations**: None (internal computation).

---

### DAT-007 — Cascade Edge Detection (Correlation-Based)
**Objective**: Propose directed edges between co-anomalous signals within a bounded lag window, to drive the Cascade Replay graph.
**Description**: Use `correlate` (DAT-005) between pairs of currently-anomalous signals in the same region within a 0–10 minute lag; store proposed edges on the `Incident` record.
**Dependencies**: DAT-006.
**Implementation notes**: Edges must be labeled/stored as "correlated," never as "caused," consistent with the honesty rule in the PRD.
**Acceptance criteria**: For the DAT-003 incident, edges are produced in the expected order (traffic → latency → payment failures → conversion).
**Testing requirements**: Unit test asserting edge order and lag values for the known incident.
**Security considerations**: None.

---

### DAT-008 — Deterministic Insight Engine
**Objective**: Generate the structured, plain-language explanation described in `TECHNICAL_ARCHITECTURE.md` Section 9, via `DeterministicInsightProvider`.
**Description**: Implement the `InsightProvider` interface and the default deterministic implementation; template sentences filled exclusively from DAT-005/DAT-006/DAT-007 computed values.
**Dependencies**: DAT-006, DAT-007.
**Implementation notes**: No hardcoded incident-specific copy anywhere in the templates — verify by running the same templates against the seeded blip (should produce a null/"no incident" result, not a copy-pasted narrative).
**Acceptance criteria**: Generated text for the DAT-003 incident contains real computed % changes and timestamps that match DAT-005/006 output exactly.
**Testing requirements**: Unit test asserting generated sentence values match the underlying computed values (not just non-empty text).
**Security considerations**: Output is plain text only, rendered without `dangerouslySetInnerHTML` on the frontend (DAT-013).

---

### DAT-009 — API Layer & Input Validation
**Objective**: Expose all read endpoints listed in `FRONTEND_SPEC.md` (`/api/pulse`, `/api/anomalies`, `/api/cascade/:id`, `/api/insight/:id`, `/api/evidence/:id`, `/api/what-changed`) with full request validation.
**Description**: Implement each route calling into DAT-004–008; validate every param per `SECURITY_AND_ACCESS.md` Section 4 using a schema library (allow-listed enums, date-range checks, numeric bounds).
**Dependencies**: DAT-004, DAT-005, DAT-006, DAT-007, DAT-008.
**Implementation notes**: Centralize the validation schemas so enum allow-lists are defined once and imported everywhere (route handlers, DAT-004 query helpers).
**Acceptance criteria**: All endpoints return correctly-shaped JSON for valid input and a 400 with a safe error message for invalid input.
**Testing requirements**: Contract tests per route (valid case); negative tests per route (out-of-range date, invalid enum, malformed number) all returning 400, per `SECURITY_AND_ACCESS.md` Section 15.
**Security considerations**: This ticket is the primary implementation of `SECURITY_AND_ACCESS.md` Sections 4, 6 (no dynamic SQL exists at this stage), 8, and 9.

---

### DAT-010 — Global Playback / Timeline Engine (Client)
**Objective**: Implement the simulated clock, play/pause/speed controls, and scrub bar shared across all screens.
**Description**: React Context holding `currentTime`/`isPlaying`/`speed`; top bar component wired to it; drives all data-fetching hooks with the current simulated time.
**Dependencies**: DAT-009.
**Implementation notes**: Scrub bar must support both drag and keyboard arrow stepping (`FRONTEND_SPEC.md` Section 9).
**Acceptance criteria**: Advancing/scrubbing time updates all mounted screens consistently; reaching dataset end/start is handled without error (clamped, not crashing).
**Testing requirements**: Component tests for play/pause/speed/scrub interactions and boundary clamping.
**Security considerations**: Client-side time value is re-validated server-side on every request per DAT-009 — never trusted as-is.

---

### DAT-011 — Pulse Screen
**Objective**: Implement the home Pulse screen per `FRONTEND_SPEC.md` Section 3.
**Description**: Health badge, 4 region tiles, 6 metric sparkline cards, activity feed; wired to `/api/pulse` and the playback engine (DAT-010).
**Dependencies**: DAT-009, DAT-010.
**Implementation notes**: Use skeleton components matched to final layout for loading state, per `FRONTEND_SPEC.md` Section 10.
**Acceptance criteria**: Screen renders and updates live as simulated time advances; all states (loading/empty/error/anomaly) implemented per spec.
**Testing requirements**: Component tests for each documented state; visual regression check (optional) for the color-state transitions.
**Security considerations**: All rendered text goes through React's default escaping (no raw HTML injection points).

---

### DAT-012 — Anomaly Radar Screen
**Objective**: Implement the Anomaly Radar per `FRONTEND_SPEC.md` Section 4.
**Description**: Node layout, filter bar (region/metric/status/severity, closed-set controls only), "jump to time" action.
**Dependencies**: DAT-009, DAT-010.
**Implementation notes**: Filters are dropdown/segmented controls only — no free-text filter input, per the security and UX requirements.
**Acceptance criteria**: Radar reflects `/api/anomalies` output; filters correctly narrow the set; "jump to time" moves the global clock and navigates to Pulse.
**Testing requirements**: Component tests for filter combinations, including the "filtered-empty vs. true-empty" distinction.
**Security considerations**: Filter values are constrained to the same allow-lists validated server-side in DAT-009; client never sends free text for these fields.

---

### DAT-013 — Investigation View: Cascade Replay (Signature Feature)
**Objective**: Implement the centerpiece interaction per `FRONTEND_SPEC.md` Section 5a.
**Description**: SVG node graph with directed edges, incident-scoped scrubber, node state transitions (dim → forming → active → critical), click-through to Evidence Panel.
**Dependencies**: DAT-007, DAT-009, DAT-010.
**Implementation notes**: Node/edge state must be a pure function of `scrubTime` + `/api/cascade` response, so scrubbing backward is exact (no accumulated animation state); respect `prefers-reduced-motion` per `FRONTEND_SPEC.md` Section 13.
**Acceptance criteria**: Scrubbing forward/backward through the incident window reproduces the exact expected node/edge state at every scripted stage timestamp; "Replay from start" resets correctly; works down to tablet width per Section 8.
**Testing requirements**: Component tests asserting node state at each of the six scripted stage timestamps (forward and backward scrub); a boundary test at incident start/end.
**Security considerations**: `incidentId` and `scrubTime` params validated per DAT-009 before any data is returned to this component.

---

### DAT-014 — Investigation View: Insight Engine & Evidence Panels
**Objective**: Implement the Insight Engine panel and Evidence Panel per `FRONTEND_SPEC.md` Sections 5b/5c.
**Description**: Render DAT-008 output with a "Deterministic Insight Engine" label; render DAT-005/006 stat table and chart with rolling mean/std-dev band overlay in the Evidence Panel.
**Dependencies**: DAT-008, DAT-009, DAT-013.
**Implementation notes**: "View evidence for this claim" links must deep-link to the specific signal tab in the Evidence Panel.
**Acceptance criteria**: Displayed explanation text and evidence numbers match the API response exactly (no client-side recomputation/drift); provider label is never mislabeled (see honesty rule).
**Testing requirements**: Component test asserting rendered numbers match mocked API response fixtures; render test confirming no `dangerouslySetInnerHTML` usage and that script-like content in a fixture is escaped, not executed.
**Security considerations**: Direct implementation of `SECURITY_AND_ACCESS.md` Section 7 (XSS) for all insight/evidence text.

---

### DAT-015 — What-Changed View
**Objective**: Implement the What-Changed comparison screen per `FRONTEND_SPEC.md` Section 6.
**Description**: Comparison table (current vs. prior-day baseline), preset window selector, meaningful-change highlighting.
**Dependencies**: DAT-005, DAT-009, DAT-010.
**Implementation notes**: Window selector is a closed preset list, not free text, matching Section 7's cross-cutting filter rule.
**Acceptance criteria**: Table reflects real `/api/what-changed` output for at least two metrics; empty/no-significant-change state implemented distinctly from an error state.
**Testing requirements**: Component tests for populated, empty, and error states.
**Security considerations**: `window` preset validated server-side against an allow-list (DAT-009).

---

## P1 — Important

### DAT-016 — Optional SQLite Persistence Mirror
**Objective**: Mirror the in-memory dataset into a local SQLite file at boot for restart resilience.
**Dependencies**: DAT-004.
**Notes**: All queries via prepared statements only (`SECURITY_AND_ACCESS.md` Section 6); feature-flagged, off by default in MVP.

### DAT-017 — Correlation Confidence Boost Refinement
**Objective**: Tune the confidence-score boost when a correlated upstream signal is also anomalous (`TECHNICAL_ARCHITECTURE.md` Section 8), based on demo feedback.
**Dependencies**: DAT-006, DAT-007.

### DAT-018 — Accessibility Pass
**Objective**: Full keyboard/focus/contrast audit across all screens against `FRONTEND_SPEC.md` Section 9.
**Dependencies**: DAT-011–015.

### DAT-019 — Mobile Cascade Replay Variant
**Objective**: Implement the vertical stage-list variant of Cascade Replay for <768px per `FRONTEND_SPEC.md` Section 8.
**Dependencies**: DAT-013.

### DAT-020 — `LLMInsightProvider` Interface Stub
**Objective**: Add the optional provider interface implementation behind a feature flag, per `TECHNICAL_ARCHITECTURE.md` Section 9; requires stakeholder decision (PRD Section 15, item 2) before enabling by default.
**Dependencies**: DAT-008.
**Notes**: Must visibly label output "AI-generated summary" if ever enabled; detection logic remains deterministic regardless.

### DAT-021 — Observability/Dev Instrumentation Pass
**Objective**: Structured boot-time logging and request-timing logs per `TECHNICAL_ARCHITECTURE.md` Section 13.
**Dependencies**: DAT-009.

### DAT-022 — Security Test Suite Hardening
**Objective**: Complete the full negative-test matrix from `SECURITY_AND_ACCESS.md` Section 15 across all routes.
**Dependencies**: DAT-009.

---

## P2 — Future

### DAT-023 — Scenario Library (Multiple Incidents)
**Objective**: Support more than one designed incident scenario, selectable by the user, per PRD Future Improvements.

### DAT-024 — CSV Upload (Sandboxed)
**Objective**: Allow a user-supplied CSV dataset, fully validated per `SECURITY_AND_ACCESS.md` Sections 4 and 14, as an alternative to the built-in synthetic dataset.

### DAT-025 — Incident Report Export
**Objective**: Export a selected incident's Insight + Evidence summary as a shareable PDF/link.

### DAT-026 — Real Authentication/Authorization
**Objective**: Design and implement a real auth model, as a prerequisite for any future "connect real data" mode — explicitly deferred per `SECURITY_AND_ACCESS.md` Section 2.
