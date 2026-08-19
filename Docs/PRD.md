# PRD.md — DataPulse

> **Status: FUNCTIONAL DEMO / PROTOTYPE.** DataPulse, as specified here, is a demonstration product built on a deterministic synthetic dataset. It does not connect to real infrastructure, does not use machine learning, and does not stream real events. Every "live" behavior is a simulated replay of a pre-generated, deterministic dataset. This document, and all documents in this specification set, describe a prototype intended to communicate a product concept credibly — not a production system.

## 1. Product Summary

DataPulse is an interactive operational intelligence console that turns a stream of business/event data into a live "pulse" of what is happening across a digital platform right now. Instead of a static analytics dashboard, DataPulse is built around **investigation**: the operator watches system health evolve, gets alerted when something abnormal is forming, and can drill from a single anomaly down to the raw evidence that explains it.

The centerpiece of the demo is the **Cascade Replay** — a synchronized timeline scrubber and signal graph that visually reconstructs how one anomaly triggers the next (e.g., a traffic spike leading to checkout latency, to payment failures, to a revenue drop), so the operator can *see* causat­ion-shaped correlation unfold rather than read about it in a table.

## 2. Problem

Modern digital platforms emit dozens of operational signals (traffic, latency, errors, payments, revenue) across many services and regions. When something goes wrong, these signals degrade in sequence, but most dashboards show metrics as isolated tiles. Operators are left to manually correlate "latency went up" with "payments failed twenty minutes later" — a slow, error-prone process during an active incident.

DataPulse demonstrates a product direction where the platform itself proposes the causal-looking chain, shows its evidence, and lets the operator replay exactly how the incident unfolded.

## 3. Target Users

- **On-call SRE / operations engineer** — needs to quickly understand "what's wrong right now and where."
- **Product/engineering lead reviewing an incident retrospective** — needs to replay how an incident developed, stage by stage.
- **Prospective buyer / stakeholder evaluating the product concept** — needs a visually credible, interactive demo that communicates the value proposition without requiring real data integration.

## 4. Scenario (Demo Narrative)

**Aurora Commerce** is a fictional global e-commerce platform. DataPulse ingests six synthetic signal types across four regions (NA, EU, APAC, LATAM): `traffic`, `checkout_latency_ms`, `payment_failure_rate`, `conversion_rate`, `error_rate`, `revenue_index`.

The demo dataset spans a **24-hour deterministic window** containing normal operation, expected daily seasonality, background noise, and **one designed multi-stage incident** in the APAC region:

1. `14:20` — Baseline normal.
2. `14:25` — Sudden traffic spike in APAC (regional promotional event, synthetic).
3. `14:28` — Checkout latency in APAC rises beyond its rolling baseline.
4. `14:32` — Payment failure rate in APAC increases following the latency rise.
5. `14:35` — Conversion rate in APAC falls.
6. `14:40` — Composite severity escalates; anomaly marked "Critical."
7. `15:10` — Signals recover toward baseline ("resolution" tail included in the dataset).

This sequence exists in the dataset as designed, labeled ground truth, so the analytics engine's output can be validated against it deterministically.

## 5. Product Goals

- Demonstrate a **live-feeling operational pulse** with clear health/anomaly state.
- Demonstrate **explainable, deterministic anomaly detection** (not a black box).
- Demonstrate an **investigation workflow**: overview → anomaly → evidence → explanation → replay.
- Deliver **one visually memorable, genuinely interactive centerpiece** (Cascade Replay).
- Remain **honest**: never claim real streaming, real ML, or real integrations.

## 6. Non-Goals

- Not a production monitoring/alerting system.
- Not connected to any real data source, webhook, or third-party API.
- Not implementing real machine learning or anomaly-detection research.
- Not implementing multi-tenant auth, RBAC, or user accounts (see `SECURITY_AND_ACCESS.md`).
- Not supporting arbitrary user-uploaded production datasets at MVP (a constrained "upload your own CSV" stretch feature is a P2, sandboxed and validated).
- Not building a distributed/streaming backend (no Kafka, no microservices).

## 7. Primary User Journey

1. User opens DataPulse and sees the **Pulse** screen: overall health state, four region tiles, six live-updating metric sparklines, and an activity feed.
2. The simulated clock advances (auto-play or manual scrub); metrics visibly move.
3. As the clock nears `14:25`, an anomaly begins forming; the APAC region tile and an entry in the **Anomaly Radar** change from normal → warning → critical, with a confidence and severity score.
4. User clicks the anomaly, opening the **Investigation View**.
5. The **Cascade Replay** shows a node graph of the six signals; scrubbing the timeline animates each node lighting up in sequence as it crosses its own anomaly threshold, drawing an edge to the next affected signal.
6. The **Insight Engine** panel shows a structured, plain-language explanation of the chain, generated by deterministic logic over the dataset.
7. User opens the **Evidence Panel** for any node to see the underlying rolling-window statistics (baseline, z-score, % change, threshold crossed) that justified the anomaly.
8. User opens **What-Changed** to compare the incident window against the prior-day baseline for the same time-of-day.
9. User scrubs backward/forward or hits "Replay from start" to relive the incident, or picks a different time window on the timeline to explore normal periods.

## 8. Feature Requirements (MVP Scope)

Selected subset (see `FRONTEND_SPEC.md` for screen-level detail):

1. **System Pulse** — overview screen with health state, region tiles, metric sparklines, activity feed.
2. **Anomaly Radar** — list/visual of detected anomalies with severity, confidence, timestamp, region, metric, status.
3. **Cascade Replay (signature feature)** — timeline scrubber + signal-relationship graph that animates the incident's propagation.
4. **Insight Engine (deterministic)** — structured plain-language explanation per anomaly/incident.
5. **Evidence Panel** — underlying rolling statistics per signal, shown on demand.
6. **What-Changed View** — current window vs. prior-day baseline comparison.

Explicitly deferred to P1/P2: scenario library (multiple incidents), CSV upload, LLM-generated narrative insights (optional provider interface only), export/share.

## 9. Demo Requirements

- Dataset must be **deterministic** (fixed seed) so behavior is reproducible across sessions and demoable reliably.
- Must include: normal periods, seasonal/expected variation, background noise, correlated events, and **at least one multi-stage incident** (see Section 4).
- "Live" behavior is a **simulated playback** of the pre-generated dataset at adjustable speed (1x, 4x, 30x, or manual scrub) — this must be labeled in the UI as simulated.
- The system must run end-to-end with **zero external API keys** required.

## 10. Analytics Requirements

- Rolling mean and rolling standard deviation per signal, per region, over a configurable window.
- Z-score of current value vs. rolling baseline.
- Percentage change vs. previous window and vs. prior-day same-time baseline.
- Rate-of-change (slope) over a short window to catch fast-forming spikes.
- Cross-signal correlation within a bounded time-lag window, used to build the cascade edges (e.g., traffic → latency within 0–5 min).
- Composite **severity score** (0–100) combining z-score magnitude, rate-of-change, and duration.
- **Confidence score** (0–100) reflecting how many independent statistical criteria agree (baseline deviation, rate-of-change, correlation match).
- All formulas must be inspectable by the operator in the Evidence Panel — no opaque scoring.

## 11. Success Criteria

- A first-time viewer can, within ~2 minutes of interacting with the demo unassisted, correctly explain: what went wrong, where, in what order, and how the system decided it was abnormal.
- The Cascade Replay is the single feature viewers describe as "the interesting part."
- No feature described in this PRD is missing from `TECHNICAL_ARCHITECTURE.md`, `FRONTEND_SPEC.md`, or `FEATURE_TICKETS.md` (verified in the Consistency Audit).

## 12. Acceptance Criteria

- [ ] Pulse screen renders and updates from the synthetic dataset without manual refresh.
- [ ] At least one anomaly is detected purely from the deterministic analytics engine (not hardcoded to "APAC is red").
- [ ] Anomaly Radar entries link to a working Investigation View.
- [ ] Cascade Replay scrub control moves the graph state and timeline together, forward and backward, with no dead states.
- [ ] Insight Engine text is generated from real computed values (thresholds, % changes) pulled from the dataset, not static copy.
- [ ] Evidence Panel shows the actual rolling-window numbers behind at least one anomaly.
- [ ] What-Changed view shows a real current-vs-baseline diff for at least two metrics.
- [ ] App runs locally with no required external API keys.
- [ ] No SQL injection / XSS vector exists in any filter, query param, or replay control (see `SECURITY_AND_ACCESS.md`).

## 13. Future Improvements (Out of MVP scope)

- Multiple selectable incident scenarios ("scenario library").
- Optional `LLMInsightProvider` for richer natural-language narrative (interface only in MVP; see architecture doc).
- User-uploaded CSV datasets, sandboxed and schema-validated.
- Real authentication/authorization and multi-user workspaces.
- Export incident report to PDF/shareable link.
- Real-time ingestion adapter (webhook) as a genuinely separate, clearly-labeled "live mode" — not part of this demo.

## 14. Assumptions

- A single demo dataset (24 simulated hours, 4 regions, 6 signals, 1 designed incident) is sufficient to prove the concept.
- The audience for the demo understands they are viewing a simulated/replayed dataset, because the UI states this explicitly.
- Local SQLite (or in-memory equivalent) is acceptable persistence for a demo; no external database is required.

## 15. Decisions Required (Open Questions for Stakeholders)

1. Should the demo ship with exactly one incident scenario, or should "scenario library" (P1) be pulled into MVP?
2. Is a stubbed `LLMInsightProvider` interface (present but unused) worth the added abstraction for MVP, or should it be entirely deferred to P2?
3. Should the What-Changed baseline be "previous day, same time window" (simple, deterministic) or a rolling 7-day synthetic average (more realistic, more generation complexity)? *This spec assumes previous-day baseline for MVP simplicity.*
4. Is SQLite-on-disk required, or is an in-memory store (rebuilt on server start) acceptable for the demo? *This spec assumes in-memory is acceptable and simpler; see architecture doc.*
