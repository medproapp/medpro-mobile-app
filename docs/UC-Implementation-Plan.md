# UC (Unidades de Comunicação) — Measurement & Visibility Plan

Author: Engineering
Status: Proposed (ready to implement)
Targets: Backend (medproback), Practitioner App, Patient App

## 1) Goals & Scope (V1)

- Quantify communication “effort” between a practitioner and a patient.
- Produce transparent, immutable, content‑free metrics that both parties can see.
- Enable future billing based on measured effort without storing message content.
- V1 scope: patient_chat threads, practitioner → patient outbound messages.

## 2) UC Rules (Versioned)

Unit name: UC (Unidade de Comunicação)

V1 rules (deterministic, content‑free):
- Base per practitioner outbound message: 1 UC
- Text size: +1 UC per 200 characters (ceil(content_length / 200))
- Attachments: +2 UC per attachment +1 UC per MB (ceil(size_bytes / 1_000_000))
- Flags:
  - shared_record: ×1.25 multiplier
  - high priority: ×1.25 multiplier
- Cap: 50 UC per message (hard maximum)

Store `rule_version` with each ledger row and a JSON `calc_json` explaining the calculation.

Notes:
- “Content length” uses character count only; message body is not stored in ledger.
- If attachments’ sizes aren’t available inline, fetch from stored file metadata.
- Patient → practitioner messages can be logged as direction events (0 UC in V1) to support future triage modeling.

## 3) Data Model (Backend: medproback)

### 3.1) Ledger Table (immutable)

Table: `communication_usage_ledger`

Columns:
- id BIGINT AUTO_INCREMENT PRIMARY KEY
- ts_utc DATETIME NOT NULL
- org_id VARCHAR(64) NULL (optional, for multi‑org aggregation)
- practitioner_email VARCHAR(255) NOT NULL
- patient_email VARCHAR(255) NOT NULL
- thread_id VARCHAR(64) NOT NULL
- message_id VARCHAR(64) NOT NULL
- direction ENUM('practitioner_to_patient','patient_to_practitioner') NOT NULL
- units INT NOT NULL
- base_units INT NOT NULL
- char_count INT NOT NULL DEFAULT 0
- attachments_count INT NOT NULL DEFAULT 0
- attachments_size_bytes BIGINT NOT NULL DEFAULT 0
- type ENUM('text','shared_record','attachment','system') NOT NULL DEFAULT 'text'
- priority ENUM('normal','high') NOT NULL DEFAULT 'normal'
- app ENUM('patient','practitioner') NOT NULL
- source ENUM('web','mobile') NOT NULL
- rule_version SMALLINT NOT NULL DEFAULT 1
- cap_applied TINYINT(1) NOT NULL DEFAULT 0
- calc_json JSON NULL  -- machine/human readable breakdown
- created_at DATETIME DEFAULT CURRENT_TIMESTAMP
- updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

Indexes:
- KEY idx_pp_ts (practitioner_email, patient_email, ts_utc)
- KEY idx_thread_ts (thread_id, ts_utc)
- KEY idx_patient_ts (patient_email, ts_utc)
- UNIQUE KEY uq_message_direction_recipient (message_id, direction, patient_email)

### 3.2) Daily Rollup (optional V1.1)

Table: `communication_usage_daily`

Columns:
- date DATE NOT NULL
- practitioner_email VARCHAR(255) NOT NULL
- patient_email VARCHAR(255) NOT NULL
- units INT NOT NULL
- messages INT NOT NULL
- attachments_count INT NOT NULL
- last_rolled_at DATETIME NOT NULL

Indexes:
- PRIMARY KEY (date, practitioner_email, patient_email)
- KEY idx_pract_date (practitioner_email, date)
- KEY idx_patient_date (patient_email, date)

## 4) Backend Changes

### 4.1) Ensure Tables on Startup

- Add table creation in a startup ensure (similar to notifications):
  - File: `src/services/core/commUsageService.js` (new)
  - Called by `src/services/utils/serverStartupService.js` during boot.

### 4.2) UC Computation Utility

File: `src/services/core/commUsageService.js`

Exports:
- `computeCommunicationUnits({ contentLength, attachmentsSizesBytes, type, priority, ruleVersion = 1 })`
  - Returns `{ units, baseUnits, charCount, attachmentsCount, attachmentsSizeBytes, multipliersApplied, capApplied, preCapUnits, ruleVersion, calcJson }`
- `insertUsageLedger({ tsUtc, practitioner, patient, threadId, messageId, direction, units, ...breakdown })`
- `summarizeUsage({ practitioner, patient, from, to })`
- `getLedger({ threadId, practitioner, patient, direction, from, to, limit, offset })`

### 4.3) Hook into Message Flow

Integration point: `src/services/core/internalCommunicationService.js` → `sendMessage()` post‑commit (where push/SSE dispatch happens).

Logic:
1) Determine recipients partition (existing code already does this). Focus on `patientRecipients` for V1.
2) For each patient recipient:
   - Determine `contentLength` = `(content || '').length`
   - `type` from message_type; if `shared_record`, set flag
   - `priority` from message priority
   - Collect attachments sizes (if available) and count
   - Call `computeCommunicationUnits()`
   - Insert into `communication_usage_ledger` with `direction='practitioner_to_patient'`, `app='practitioner'`, `source` based on request origin (can pass via context or infer)

Optional (V1.1): Log patient → practitioner messages on receipt with `direction='patient_to_practitioner'` and computed units (0 in V1).

### 4.4) Aggregation Job (V1.1)

- Nightly rollup of previous day into `communication_usage_daily`.
- Implement in `commUsageService.rollupDaily({ date })` and schedule via a simple interval/cron‑like timer.

## 5) Backend APIs

Router: `routes/comm-usage.js` (new)

Auth: `verifyJWT`. Authorization rules:
- Practitioners can see rows where `practitioner_email === req.user.username`.
- Patients can see rows where `patient_email === req.user.username`.
- Admin/Org‑admin (optional) broader access.

Endpoints:
1) GET `/api/comm-usage/ledger`
   - Query: `thread_id?`, `practitioner?`, `patient?`, `direction?`, `from?`, `to?`, `limit?=50`, `offset?=0`
   - Returns: `{ data: [ { ts_utc, practitioner_email, patient_email, thread_id, message_id, direction, units, type, priority, calc_json } ], total }`

2) GET `/api/comm-usage/summary`
   - Query: `practitioner`, `patient`, `from`, `to`
   - Returns totals: `{ units, messages, attachments_count, first_ts, last_ts }`

3) GET `/api/comm-usage/daily`
   - Query: same as summary
   - Returns array: `[ { date, units, messages } ]`

4) Convenience (Me) variants (optional in V1):
   - Practitioner: `/api/comm-usage/practitioner/me/summary?patient=&from=&to=`
   - Patient: `/api/comm-usage/patient/me/summary?practitioner=&from=&to=`

Mount in `src/services/utils/serverStartupService.js` with path `/api/comm-usage`.

## 6) Practitioner App (medpro-mobile-app)

New UX (V1):
- Conversation header: “UC nesta conversa (mês): X”
  - Load via GET `/api/comm-usage/summary?practitioner=me&patient=<patient>&from=startOfMonth&to=now`
- Per‑message UC chip for practitioner outbound messages: “+N UC”
  - Fetch ledger by `thread_id` and month; map `message_id → units`.
- “Detalhes de UC” screen: paginated ledger list with timestamps and calc breakdown; filters by date.

State:
- Add `commUsageStore` or extend `messagingStore` to cache:
  - `ledgerByThread[threadId]`, `summaryByThread[threadId]`, `lastFetchedAt`

API Client:
- `src/services/commUsageService.ts` with:
  - `getSummary({ patientEmail, from, to })`
  - `getLedger({ threadId, from, to, limit, offset })`

Integration:
- ConversationScreen mounts → fetch summary + ledger for month range.
- Render chips under practitioner’s sent bubbles when `ledger[message_id]` exists.

## 7) Patient App

Mirror practitioner app surface:
- Conversation header: UC this month (same summary endpoint using “me” routes).
- Per‑message UC chips on practitioner messages.
- My UC screen: summaries by practitioner; export CSV (V1.1).

## 8) Transparency, Privacy, Audit

- No message content stored in ledger or rollups.
- `calc_json` includes breakdown: `{ base:1, text_blocks, attachments:{count,size_mb}, multipliers:['shared_record'], pre_cap, cap_applied, result }`
- `rule_version` per row; change log maintained in code comments and docs.

## 9) Backfill Strategy (Optional)

- Script `scripts/backfill_comm_usage.js`:
  - Scan `internal_messages` joined with participants where `thread_type='patient_chat'`.
  - Determine sender role via `users` vs `patients` table.
  - Compute UC per message (using same util) for practitioner → patient, insert ledger row per patient.
  - Idempotent with `UNIQUE (message_id, direction, patient_email)`.
  - Start with last 90 days.

## 10) Testing & Validation

Unit tests:
- `computeCommunicationUnits()` covering:
  - short/long texts, multiples of 200 chars
  - attachments count and size rounding
  - shared_record/priority multipliers
  - cap behavior

Integration tests:
- sendMessage → ledger insertion count and fields
- API summary for a (practitioner, patient, date range)
- Pagination on ledger

Manual validation:
- Send messages with known content sizes/attachments, verify UC on ledger and UI chips.

## 11) Observability & Performance

- Indexes as specified to keep ledger queries fast.
- Log ledger insertion with a compact line (message_id, units, rule_version).
- Monitor daily ledger growth; evaluate rollups (V1.1) if needed.

## 12) Phased Timeline

Phase 1 (MVP, 1–2 days):
- Backend: ensure tables, compute util, ledger insert on sendMessage, GET ledger and GET summary.
- Practitioner app: header total + per‑message UC chip + minimal commUsageService.

Phase 2 (2–3 days):
- Patient app parity (header + chips + simple “Minhas UCs”).
- “Me” endpoints; CSV export endpoint.
- Simple admin query (top patients by UC in range).

Phase 3 (optional):
- Daily rollups; dashboard widgets; dispute flow; notifications (monthly UC summary).

## 13) Open Questions

- Do we want to count patient → practitioner messages at >0 UC in V1 (reading/triage effort)?
- Any org‑specific multipliers (e.g., premium plans) or excluded message types?
- Attachment size source of truth (DB vs storage metadata) — standardize now or later?
- Timezone for rollups/summaries (UTC vs org timezone)?

## 14) Future: Pricing & Billing

- Pricing table mapping UC → currency per plan/tier.
- Monthly invoice line items with ledger references.
- Dispute workflow linked to ledger rows, with resolution notes and adjustments.

