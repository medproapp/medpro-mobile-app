const pool = require("../utils/database");
const timezoneUtils = require("../utils/timezoneUtils");

const RULE_VERSION = 1;
const TEXT_BLOCK_CHARS = 200;
const ATTACHMENT_BASE_UNITS = 2;
const ATTACHMENT_MB_UNITS = 1;
const MULTIPLIERS = { shared_record: 1.25, high_priority: 1.25 };
const MAX_UNITS_PER_MESSAGE = 50;

function computeCommunicationUnits({ contentLength = 0, attachmentsCount = 0, attachmentsSizeBytes = 0, type = "text", priority = "normal", }) {
  const baseUnits = 1;
  const textBlocks = Math.ceil(Math.max(0, contentLength) / TEXT_BLOCK_CHARS);
  const sizeMb = Math.ceil(Math.max(0, attachmentsSizeBytes) / 1000000);
  const attachmentUnits = attachmentsCount * ATTACHMENT_BASE_UNITS + sizeMb * ATTACHMENT_MB_UNITS;
  let preCapUnits = baseUnits + textBlocks + attachmentUnits;
  const multipliersApplied = [];
  if (String(type) === "shared_record") { preCapUnits *= MULTIPLIERS.shared_record; multipliersApplied.push("shared_record"); }
  if (String(priority) === "high") { preCapUnits *= MULTIPLIERS.high_priority; multipliersApplied.push("high_priority"); }
  const unitsRounded = Math.ceil(preCapUnits);
  const capApplied = unitsRounded > MAX_UNITS_PER_MESSAGE;
  const units = capApplied ? MAX_UNITS_PER_MESSAGE : unitsRounded;
  const calcJson = { base: baseUnits, text_blocks: textBlocks, attachments: { count: attachmentsCount, size_mb: sizeMb }, multipliers: multipliersApplied, pre_cap: unitsRounded, cap_applied: capApplied, result: units, rule_version: RULE_VERSION };
  return { units, baseUnits, charCount: contentLength, attachmentsCount, attachmentsSizeBytes, multipliersApplied, capApplied, preCapUnits: unitsRounded, ruleVersion: RULE_VERSION, calcJson };
}

async function insertUsageLedger({ tsUtc, orgId = null, practitionerEmail, patientEmail, threadId, messageId, direction = "practitioner_to_patient", units, baseUnits, charCount = 0, attachmentsCount = 0, attachmentsSizeBytes = 0, type = "text", priority = "normal", app = "practitioner", source = "web", ruleVersion = RULE_VERSION, capApplied = 0, calcJson = null, }) {
  const jsonString = calcJson ? JSON.stringify(calcJson) : null;
  await pool.query(
    `INSERT INTO communication_usage_ledger 
      (ts_utc, org_id, practitioner_email, patient_email, thread_id, message_id, direction,
       units, base_units, char_count, attachments_count, attachments_size_bytes,
       type, priority, app, source, rule_version, cap_applied, calc_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE 
       units = VALUES(units), base_units = VALUES(base_units), char_count = VALUES(char_count),
       attachments_count = VALUES(attachments_count), attachments_size_bytes = VALUES(attachments_size_bytes),
       type = VALUES(type), priority = VALUES(priority), app = VALUES(app), source = VALUES(source),
       rule_version = VALUES(rule_version), cap_applied = VALUES(cap_applied), calc_json = VALUES(calc_json),
       updated_at = CURRENT_TIMESTAMP`,
    [ tsUtc, orgId, practitionerEmail, patientEmail, threadId, messageId, direction, units, baseUnits, charCount, attachmentsCount, attachmentsSizeBytes, type, priority, app, source, ruleVersion, capApplied ? 1 : 0, jsonString ]
  );
}

async function summarizeUsage({ practitioner, patient, from, to, currentUser }) {
  if (currentUser !== practitioner && currentUser !== patient) { const err = new Error("Not authorized to view this summary"); err.status = 403; throw err; }
  const params = [practitioner, patient];
  let where = "WHERE practitioner_email = ? AND patient_email = ?";
  if (from) { where += " AND ts_utc >= ?"; params.push(from); }
  if (to) { where += " AND ts_utc <= ?"; params.push(to); }
  const [rows] = await pool.query(
    `SELECT SUM(units) AS units, COUNT(*) AS messages, SUM(attachments_count) AS attachments_count, MIN(ts_utc) AS first_ts, MAX(ts_utc) AS last_ts
     FROM communication_usage_ledger ${where}`,
    params
  );
  return rows && rows[0] ? rows[0] : { units: 0, messages: 0, attachments_count: 0 };
}

async function getLedger({ threadId, practitioner, patient, direction, from, to, limit = 50, offset = 0, currentUser }) {
  if (practitioner && currentUser !== practitioner && currentUser !== patient) { const err = new Error("Not authorized to view this ledger"); err.status = 403; throw err; }
  const params = []; const conds = [];
  if (threadId) { conds.push("thread_id = ?"); params.push(threadId); }
  if (practitioner) { conds.push("practitioner_email = ?"); params.push(practitioner); }
  if (patient) { conds.push("patient_email = ?"); params.push(patient); }
  if (direction) { conds.push("direction = ?"); params.push(direction); }
  if (from) { conds.push("ts_utc >= ?"); params.push(from); }
  if (to) { conds.push("ts_utc <= ?"); params.push(to); }
  if (!practitioner && !patient) { conds.push("(practitioner_email = ? OR patient_email = ?)"); params.push(currentUser, currentUser); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT ts_utc, practitioner_email, patient_email, thread_id, message_id, direction, units, type, priority, rule_version, cap_applied, calc_json
     FROM communication_usage_ledger ${where} ORDER BY ts_utc DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    params
  );
  const [[{ total } = { total: 0 }]] = await pool.query(`SELECT COUNT(*) AS total FROM communication_usage_ledger ${where}`, params);
  return { data: rows || [], total: Number(total || 0) };
}

async function logPractitionerToPatientUsage({ practitionerEmail, patientEmail, threadId, messageId, contentLength, attachmentsCount = 0, attachmentsSizeBytes = 0, type = "text", priority = "normal", orgId = null, app = "practitioner", source = "web", }) {
  try {
    const breakdown = computeCommunicationUnits({ contentLength, attachmentsCount, attachmentsSizeBytes, type, priority });
    await insertUsageLedger({ tsUtc: timezoneUtils.getCurrentUTCTimestamp(), orgId, practitionerEmail, patientEmail, threadId, messageId, direction: "practitioner_to_patient", units: breakdown.units, baseUnits: breakdown.baseUnits, charCount: breakdown.charCount, attachmentsCount: breakdown.attachmentsCount, attachmentsSizeBytes: breakdown.attachmentsSizeBytes, type, priority, app, source, ruleVersion: breakdown.ruleVersion, capApplied: breakdown.capApplied, calcJson: breakdown.calcJson, });
  } catch (e) { console.error("[CommUsage] Failed to log usage:", e?.message || e); }
}

module.exports = { computeCommunicationUnits, insertUsageLedger, summarizeUsage, getLedger, logPractitionerToPatientUsage };
