// Strict, read-only CSV intake for externally exported BLACKPINE FIELD measurements.
// This module validates supplied files; it does not connect to analytics or affiliate accounts.

import { createHash } from "node:crypto";

const DATASETS = Object.freeze({
  "analytics-report": {
    required: ["date", "sessions", "landing_page", "source_medium", "product_page_views"],
    numeric: ["sessions", "product_page_views"],
  },
  "affiliate-click-report": {
    required: ["date", "product", "destination", "outbound_clicks"],
    numeric: ["outbound_clicks"],
  },
  "commission-report": {
    required: ["date", "network", "advertiser", "clicks", "orders", "reversals", "commission", "currency"],
    numeric: ["clicks", "orders", "reversals", "commission"],
  },
});

function parseCsv(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      if (field.length) throw new Error("CSV_INVALID_QUOTE_POSITION");
      quoted = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV_UNCLOSED_QUOTED_FIELD");
  row.push(field);
  if (row.some((cell) => cell.length)) rows.push(row);
  if (rows.length < 2) throw new Error("CSV_HEADER_AND_DATA_REQUIRED");
  const headers = rows[0].map((value) => value.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV_DUPLICATE_HEADERS");
  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV_COLUMN_COUNT_MISMATCH:row-${index + 2}`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
  });
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function ingestBlackpineMeasurementCsv({ datasetType, csv, metadata }) {
  const schema = DATASETS[datasetType];
  if (!schema) throw new Error("UNSUPPORTED_MEASUREMENT_DATASET");
  if (typeof csv !== "string" || !csv.trim()) throw new Error("CSV_CONTENT_REQUIRED");
  const requiredMetadata = ["source", "reference", "periodStart", "periodEnd", "timezone", "currency", "capturedAt", "verifiedBy"];
  for (const key of requiredMetadata) {
    if (typeof metadata?.[key] !== "string" || !metadata[key].trim()) throw new Error(`METADATA_REQUIRED:${key}`);
  }
  if (!/^https:\/\//i.test(metadata.reference)) throw new Error("EVIDENCE_REFERENCE_MUST_BE_HTTPS");
  if (!validDate(metadata.periodStart) || !validDate(metadata.periodEnd) || metadata.periodStart > metadata.periodEnd) {
    throw new Error("INVALID_REPORTING_PERIOD");
  }
  if (Number.isNaN(Date.parse(metadata.capturedAt))) throw new Error("INVALID_CAPTURE_TIMESTAMP");
  if (!/^[A-Z]{3}$/.test(metadata.currency)) throw new Error("INVALID_CURRENCY_CODE");

  const rows = parseCsv(csv);
  const headers = Object.keys(rows[0]);
  const missing = schema.required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`REQUIRED_COLUMNS_MISSING:${missing.join(",")}`);

  const normalizedRows = rows.map((row, index) => {
    if (!validDate(row.date) || row.date < metadata.periodStart || row.date > metadata.periodEnd) {
      throw new Error(`ROW_DATE_OUTSIDE_REPORTING_PERIOD:${index + 2}`);
    }
    const normalized = { ...row };
    for (const key of schema.numeric) {
      if (normalized[key] === "" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized[key])) {
        throw new Error(`INVALID_NONNEGATIVE_NUMBER:${key}:row-${index + 2}`);
      }
      normalized[key] = Number(normalized[key]);
      if (!Number.isFinite(normalized[key])) throw new Error(`INVALID_NONFINITE_NUMBER:${key}`);
    }
    if (datasetType === "commission-report" && row.currency !== metadata.currency) {
      throw new Error(`CURRENCY_MISMATCH:row-${index + 2}`);
    }
    for (const key of Object.keys(normalized)) {
      if (typeof normalized[key] === "string" && !normalized[key].trim()) {
        throw new Error(`EMPTY_REQUIRED_VALUE:${key}:row-${index + 2}`);
      }
    }
    return normalized;
  });

  const totals = Object.fromEntries(schema.numeric.map((key) => [
    key, normalizedRows.reduce((sum, row) => sum + row[key], 0),
  ]));
  const contentSha256 = createHash("sha256").update(csv, "utf8").digest("hex");
  const evidence = {
    type: datasetType,
    reference: metadata.reference,
    contentSha256,
    verifiedBy: metadata.verifiedBy,
    verifiedAt: metadata.capturedAt,
    source: metadata.source,
    periodStart: metadata.periodStart,
    periodEnd: metadata.periodEnd,
    timezone: metadata.timezone,
    currency: metadata.currency,
  };
  return Object.freeze({
    datasetType,
    rowCount: normalizedRows.length,
    totals: Object.freeze(totals),
    rows: Object.freeze(normalizedRows.map((row) => Object.freeze(row))),
    evidence: Object.freeze(evidence),
  });
}

export const blackpineMeasurementCsvSchemas = DATASETS;
