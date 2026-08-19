# Specification Consistency Audit — DataPulse

Cross-checked: `PRD.md` ↕ `TECHNICAL_ARCHITECTURE.md` ↕ `SECURITY_AND_ACCESS.md` ↕ `FRONTEND_SPEC.md` ↕ `FEATURE_TICKETS.md`

## 1. Feature Traceability (no feature appears in one doc and disappears from the others)

| Feature | PRD | Architecture | Security | Frontend | Tickets |
|---|---|---|---|---|---|
| System Pulse | §8.1 | §5, §7 (analytics feeds it) | §4 (input validation) | §3 | DAT-011 |
| Anomaly Radar | §8.2 | §8 (detector) | §4, §15 | §4 | DAT-006, DAT-012 |
| Cascade Replay (signature) | §4, §8.3 | §8, §10 | §4 | §5a | DAT-007, DAT-013 |
| Insight Engine (deterministic) | §8.4 | §9 | §7 | §5b | DAT-008, DAT-014 |
| Evidence Panel | §8.5 | §7 | §7 | §5c | DAT-014 |
| What-Changed | §8.6 | §7, §10 | §4 | §6 | DAT-015 |
| Synthetic dataset + incident script | §4, §9 | §6 | §5 | (drives all) | DAT-002, DAT-003 |
| No-auth decision | §6 (non-goal) | — | §2 | (footer note, §3–6 implied) | DAT-026 (P2) |
| Optional LLM provider | §13 (future) | §9 | §10 | §5b (label rule) | DAT-020 (P1) |
| Optional SQLite persistence | §15 Q4 | §12 | §6 | — | DAT-016 (P1) |
| CSV upload | §13 (future) | — | §1, §4, §14 | — | DAT-024 (P2) |

Result: every MVP feature named in the PRD has a corresponding architecture mechanism, a security treatment, a frontend screen spec, and at least one ticket. Every P1/P2 item is consistently deferred across all five documents — none of them are silently required in one doc while marked optional in another.

## 2. Contradictions Found

**None material.** One phrasing risk was checked and resolved: `TECHNICAL_ARCHITECTURE.md` allows an *optional* SQLite mirror, while `SECURITY_AND_ACCESS.md` §6 writes SQL-injection rules as if a database is definitely in use. This is intentional, not contradictory — the rules are written so they apply automatically if/when DAT-016 is picked up, without blocking MVP (which ships in-memory only, no SQL surface at all).

## 3. Unnecessary Complexity (flagged and trimmed)

- **`LLMInsightProvider`**: kept as an interface *shape* only, not implemented in MVP. This is the one place the spec deliberately avoids over-building — do not implement the LLM path until DAT-020 is explicitly picked up. Adding it now would add a dependency, a secret, and a labeling obligation for zero MVP benefit.
- **SQLite mirror**: correctly scoped as P1/optional. In-memory generation is simpler, fully sufficient for a demo process lifetime, and removes a whole category of query-safety work from the MVP critical path.
- **Correlation engine**: intentionally bounded to a short lag window (0–10 min) and only used to draw cascade edges — not generalized into a full correlation-matrix feature. This keeps DAT-007 small while still being the thing that makes Cascade Replay feel intelligent.

**Recommendation for "don't over-engineer, but stand out": ship P0 only, and put almost all remaining polish budget into DAT-013 (Cascade Replay).** Everything else in this spec (Pulse, Radar, Insight, Evidence, What-Changed) can be built at a clean, competent "solid SaaS" bar — but the differentiation of the whole demo rides on one screen. A mediocre Pulse screen with a genuinely great Cascade Replay will read as more impressive than five uniformly average screens. Concretely: get DAT-001–012 and DAT-014–015 done at a straightforward, no-frills implementation level, then spend the disproportionate remaining effort on DAT-013's animation timing, node/edge layout, and scrub feel — that single interaction is what makes DataPulse look like it's "out of its league" rather than another dashboard.

## 4. Unresolved Decisions (carried over from PRD §15, restated for Antigravity)

1. Single incident scenario vs. pulling scenario library into MVP — **spec assumes single scenario for MVP** (DAT-023 is P2). Do not build scenario-switching infrastructure unless this is explicitly reversed.
2. `LLMInsightProvider` — **spec assumes interface-only, unimplemented** in MVP (DAT-020 is P1, feature-flagged off).
3. What-Changed baseline method — **spec assumes prior-day-same-time-window**, not a rolling multi-day average, to keep the generator and the comparison logic simple.
4. In-memory vs. SQLite-backed persistence — **spec assumes in-memory only** for MVP (DAT-016 is P1).

Antigravity should treat all four "spec assumes" resolutions above as the default build path unless a stakeholder overrides them before implementation begins.

## 5. Technical Risks

- **Detector tuning risk**: the multi-criteria thresholds (z-score, rate-of-change, baseline %) must be tuned against the actual generated dataset (DAT-002/003) so the designed incident reliably crosses them and the seeded blip reliably doesn't. This is a numbers-tuning task, not an architecture risk, but it's the one place a demo could visibly fail (an anomaly that doesn't fire, or a blip that false-positives) — budget explicit iteration time for DAT-006's fixture tests.
- **Animation correctness risk**: Cascade Replay must be a pure function of `scrubTime`, not accumulated animation state, or backward-scrubbing will desync from forward-scrubbing. Flagged explicitly in DAT-013's implementation notes; treat as a hard acceptance criterion, not a nice-to-have.
- **Scope creep risk**: the feature list (radar, cascade, insight, evidence, what-changed) is already a full P0 set for a small team. The biggest risk to "not over-engineering" is quietly building toward P1/P2 items (scenario library, LLM narrative, CSV upload) before P0 is polished. None of those should start before DAT-001–015 are complete and DAT-013 specifically has had a dedicated polish pass.

## 6. Assumptions Carried Through All Documents

- Demo runs as a single local Node process, zero required external services or API keys.
- All data is synthetic, deterministic, and regenerated identically on every server start.
- No real users, no real auth, no real data — stated explicitly in-product per `SECURITY_AND_ACCESS.md` §14, not just in these docs.
- Desktop is the primary target; mobile is a secondary, fully-functional-but-simplified experience (not a stripped/broken one).

## 7. Scope Creep Check

Nothing in `FRONTEND_SPEC.md` or `FEATURE_TICKETS.md` introduces a feature not present in the PRD. The only additions beyond the PRD's explicit feature list are supporting infrastructure required to make the named features work (e.g., the validation layer, the playback engine) — none of these are user-facing "features" in their own right, so they don't count as scope creep against PRD §6 Non-Goals.

## 8. Audit Conclusion

The five documents are internally consistent, and the P0/P1/P2 split correctly isolates everything genuinely optional. The single actionable recommendation from this audit: **build the P0 set at a clean, minimal-but-solid bar, and concentrate the "make it impressive" effort entirely on Cascade Replay (DAT-013/DAT-007/DAT-008)** — that is the one interaction this spec was designed around, and it's the cheapest way to make a small, honest demo feel like a much bigger product without adding real architectural weight.
