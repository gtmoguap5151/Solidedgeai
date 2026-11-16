import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ingestBlackpineMeasurementCsv } from "../adapters/blackpine/measurement-csv.mjs";

const metadata = {
  source: "GA4 export",
  reference: "https://example.com/exports/ga4.csv",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-07",
  timezone: "America/New_York",
  currency: "USD",
  capturedAt: "2026-11-08T12:00:00.000Z",
  verifiedBy: "human-reviewed-export",
};

test("BP-CSV-001: analytics export normalizes rows, totals, and content provenance", () => {
  const csv = "date,sessions,landing_page,source_medium,product_page_views\n2026-11-01,120,/,facebook / social,44\n2026-11-02,80,/guides,organic / search,31\n";
  const result = ingestBlackpineMeasurementCsv({ datasetType: "analytics-report", csv, metadata });
  assert.equal(result.rowCount, 2);
  assert.deepEqual(result.totals, { sessions: 200, product_page_views: 75 });
  assert.equal(result.evidence.contentSha256, createHash("sha256").update(csv).digest("hex"));
  assert.equal(result.evidence.verifiedBy, "human-reviewed-export");
});

test("BP-CSV-002: affiliate click report handles quoted commas and computes clicks", () => {
  const csv = 'date,product,destination,outbound_clicks\n2026-11-03,"Field Pack, 30L",https://retailer.example/item,19\n';
  const result = ingestBlackpineMeasurementCsv({ datasetType: "affiliate-click-report", csv, metadata });
  assert.equal(result.rows[0].product, "Field Pack, 30L");
  assert.equal(result.totals.outbound_clicks, 19);
});

test("BP-CSV-003: missing columns block ingestion instead of silently defaulting", () => {
  assert.throws(() => ingestBlackpineMeasurementCsv({
    datasetType: "analytics-report",
    csv: "date,sessions\n2026-11-01,12\n",
    metadata,
  }), /REQUIRED_COLUMNS_MISSING:landing_page,source_medium,product_page_views/);
});

test("BP-CSV-004: mixed currencies in commission exports are rejected", () => {
  const csv = "date,network,advertiser,clicks,orders,reversals,commission,currency\n2026-11-03,Awin,Brand,10,2,0,12.50,GBP\n";
  assert.throws(() => ingestBlackpineMeasurementCsv({ datasetType: "commission-report", csv, metadata }), /CURRENCY_MISMATCH/);
});

test("BP-CSV-005: dates outside the declared reporting window are rejected", () => {
  const csv = "date,product,destination,outbound_clicks\n2026-11-08,Pack,https://retailer.example/item,1\n";
  assert.throws(() => ingestBlackpineMeasurementCsv({ datasetType: "affiliate-click-report", csv, metadata }), /ROW_DATE_OUTSIDE_REPORTING_PERIOD/);
});

test("BP-CSV-006: negative and malformed metric values are rejected", () => {
  const csv = "date,product,destination,outbound_clicks\n2026-11-03,Pack,https://retailer.example/item,-4\n";
  assert.throws(() => ingestBlackpineMeasurementCsv({ datasetType: "affiliate-click-report", csv, metadata }), /INVALID_NONNEGATIVE_NUMBER/);
});

test("BP-CSV-007: HTTPS evidence references are mandatory", () => {
  assert.throws(() => ingestBlackpineMeasurementCsv({
    datasetType: "analytics-report",
    csv: "date,sessions,landing_page,source_medium,product_page_views\n2026-11-01,1,/,direct,1\n",
    metadata: { ...metadata, reference: "file:///local/export.csv" },
  }), /EVIDENCE_REFERENCE_MUST_BE_HTTPS/);
});
