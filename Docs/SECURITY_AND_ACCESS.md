# SECURITY_AND_ACCESS.md — DataPulse

> Scope reminder: DataPulse is a demo with **synthetic data only** and **no real user data**. Security requirements below are still treated as first-class — "it's just a demo" is not a reason to skip input validation or safe query practices — but authentication/authorization are explicitly descoped and documented as such below.

## 1. Trust Boundaries

```
Untrusted                          Trusted (server-controlled)
──────────                          ───────────────────────────
Browser query params  ─────┐
Filter/replay inputs  ─────┼──▶  Next.js API routes  ──▶  In-memory store / SQLite
Timeline scrub values  ────┤        (validation layer)      (generated at boot,
Optional CSV upload*  ─────┘                                 never externally writable)
```
\* CSV upload is a P2 stretch feature, not in MVP; if implemented, it crosses a trust boundary and must go through the same validation pipeline described in Section 4, plus size/row limits and strict schema checking before ever touching the store.

Everything originating from the browser — query parameters, filter selections, timeline positions, region/metric selectors — is treated as **untrusted input**, even though this is a single-user demo with no real backend data at stake.

## 2. Authentication Decision

**Authentication is explicitly out of scope for this demo.** DataPulse MVP has no login, no user accounts, and no session concept. This is a deliberate scope decision, not an oversight, and must be stated in the app (e.g., a footer note: "Demo build — no authentication."). Rationale: the dataset is synthetic and non-sensitive, and adding auth would add complexity without demonstrating anything about the core product concept (pulse/anomaly/insight/replay).

If DataPulse were to move toward production, this section would need to specify a real auth provider (e.g., OAuth/OIDC) before any real operational data is connected — that work is explicitly deferred, not designed here.

## 3. Authorization Decision

**No authorization model exists in MVP** (single implicit "viewer" role, no permissions). All API routes are equally accessible; there is nothing to differentiate access to, since all data is synthetic and identical for every viewer. If multi-user workspaces are added later (see PRD Future Improvements), authorization design becomes a required predecessor to that work.

## 4. Input Validation

Every API route must validate inputs at the boundary before they reach the analytics engine or store:

- **Timeline/time params (`t`, `window`, `from`, `to`)**: must parse as valid ISO 8601 timestamps within the dataset's known 24-hour range; reject (400) anything outside that range or that fails to parse. Never pass a raw string into a date constructor without a validation step first.
- **Enum params (`metric`, `region`, `incidentId`, `signalId`)**: validated against a fixed allow-list (the enums defined in `TECHNICAL_ARCHITECTURE.md` Section 5). Any value not in the allow-list is rejected (400), never silently coerced or used to build a dynamic query/property lookup.
- **Numeric params (`speed`, pagination limits)**: validated as numbers within a defined min/max range; reject out-of-range or non-numeric values.
- **Optional CSV upload (P2, if implemented)**: strict row/column count limits, strict header schema check, per-cell type validation, rejection of any non-numeric value in numeric columns, and a hard file-size cap — before any row is stored or analyzed.

Validation uses a schema library (e.g., Zod) at every route boundary so the allow-list/shape is declared once and enforced consistently, not re-implemented ad hoc per route.

## 5. Data Validation

- Synthetic data is generated server-side from a fixed seed and fixed schema — it is trusted by construction and does not require runtime validation on the read path.
- If SQLite mirroring (P1) is used, the generator writes typed columns (no dynamic schema) and the app never accepts externally-supplied rows into that database in MVP.

## 6. SQL Injection

- If the optional SQLite persistence mode (P1) is used, **all queries must use parameterized/prepared statements** (`better-sqlite3` prepared statements or an equivalent query builder) — no string concatenation of user-influenced values into SQL, ever, including for `metric`/`region` filters (these must be validated against the allow-list in Section 4 *and* passed as bound parameters, not interpolated).
- No raw SQL endpoint of any kind is exposed to the client.

## 7. XSS

- All operator-facing text — insight explanations, event labels, region names — is rendered through React's default escaping (no `dangerouslySetInnerHTML` anywhere in the app).
- If the optional CSV upload (P2) is implemented, any free-text fields from the upload (e.g., an event label column) are treated as plain text only, escaped on render, never interpreted as HTML/Markdown.
- No user-controlled value is ever used to construct a URL, `src`, or `href` without validation against an allow-list or safe-format check.

## 8. Query Safety

- API routes accept only the specific, typed query parameters documented per route (Section 4) — no generic "pass-through filter object" pattern that could allow arbitrary property/field injection into internal queries or object lookups.
- Region/metric values used as object keys (e.g., `dataset[metric][region]`) are only ever looked up after allow-list validation, preventing prototype-pollution-style or unexpected-key access.

## 9. API Security

- All API routes are read-only (`GET`) in MVP — there is no write/mutate endpoint, which removes an entire class of risk (no CSRF concern for state-changing requests, since none exist).
- Standard security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`) are set at the Next.js config level.
- Response payloads are capped in size (bounded by the fixed dataset size) — no unbounded query is possible given the allow-listed, range-checked inputs in Section 4.

## 10. Secrets

- **No secrets are required to run the MVP.** The only potential secret is `LLM_API_KEY`, used solely by the optional, feature-flagged-off `LLMInsightProvider` (P2). It is read from environment variables only, never hardcoded, never sent to the client, and never logged.
- If `LLMInsightProvider` is ever enabled, the key stays server-side; the client only ever receives the generated text, never the key or the raw prompt/request payload.

## 11. Logging

- Server logs include request path, validated params, and timing — never raw unvalidated input strings that failed validation (log the rejection reason and the param name only, not necessarily the raw value, to avoid log injection via crafted strings).
- No PII exists in this demo (synthetic data only), so there is no PII-in-logs concern for MVP, but the logging approach is written to generalize safely if real data were ever connected.

## 12. Privacy

- No real user data, no PII, no third-party data of any kind is used or stored. The dataset is entirely synthetic and generated locally.
- If a future "connect real data" mode is built, this section must be revisited before that work begins — it is explicitly not designed here.

## 13. Dependency Security

- Keep the dependency surface small and mainstream (Next.js, React, Tailwind, a schema-validation library, optionally `better-sqlite3`) — avoid unmaintained or unnecessary packages.
- Run `npm audit` (or equivalent) as part of CI; do not ship with known-critical vulnerabilities in direct dependencies.
- Pin dependency versions; review new dependencies before adding (especially anything touching parsing/CSV, given Section 4's upload path).

## 14. Demo Limitations (Explicit Disclosure)

The following must be stated plainly in the product (e.g., an "About this demo" panel) and are intentional, documented scope boundaries — not omissions to be discovered later:

- No authentication or authorization.
- No real data sources; all data is synthetic and deterministic.
- No machine learning; anomaly detection is deterministic statistical logic, fully inspectable in the Evidence Panel.
- No persistence guarantees beyond the current server process, unless the optional SQLite mode is enabled.
- Single-tenant, single-implicit-user design.

## 15. Security Test Requirements

- Automated tests asserting that every API route **rejects** out-of-range dates, non-allow-listed enum values, and malformed numeric params with a 400, rather than passing them through.
- Automated tests asserting no route accepts or executes free-form query strings (SQL or otherwise).
- A test asserting that a crafted `metric`/`region` value containing script-like or SQL-like content (e.g., `"<script>...</script>"`, `"' OR 1=1"`) is rejected by allow-list validation before reaching the store or any query.
- A render test confirming insight/explanation text containing HTML-like characters is escaped in the DOM, not executed.
- If CSV upload (P2) is implemented: tests for oversized files, malformed headers, non-numeric values in numeric columns, and row-count limits, all rejected before ingestion.
