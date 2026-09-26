const base = "https://xesfpthmlcpjaeljekay.supabase.co";
const key = "sb_publishable_7D0J3A6wzoAXl_wteIZGig_xnjm97jb";

async function rows(table) {
  const response = await fetch(`${base}/rest/v1/${table}?select=*`, {
    headers: { apikey: key }
  });
  if (!response.ok) {
    throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const checks = [
  ["money_university_modules", 10],
  ["money_university_lessons", 10],
  ["earning_opportunities", 3],
  ["app_disclosures", 6],
  ["guaplet_profiles", 0],
  ["lesson_progress", 0],
  ["saved_opportunities", 0],
  ["premium_entitlements", 0],
  ["support_requests", 0],
  ["guaplet_privacy_requests", 0],
  ["user_consents", 0]
];

for (const [table, expected] of checks) {
  const data = await rows(table);
  if (!Array.isArray(data) || data.length !== expected) {
    throw new Error(`${table}: expected ${expected} anonymous rows, received ${Array.isArray(data) ? data.length : "non-array response"}`);
  }
  console.log(`✓ ${table}: ${data.length}`);
}

console.log("Guaplet production data/RLS smoke test passed.");
