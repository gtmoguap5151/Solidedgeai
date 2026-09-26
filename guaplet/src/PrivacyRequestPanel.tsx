import { FormEvent, useState } from "react";
import { supabase } from "./lib/supabase";

export default function PrivacyRequestPanel({ userId }: { userId: string }) {
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.from("guaplet_privacy_requests").insert({
      user_id: userId,
      request_type: requestType,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) return setStatus(error.message);
    setDetails("");
    setStatus("Privacy request submitted.");
  }

  return (
    <section className="section">
      <h2>Privacy requests</h2>
      <form className="request-form" onSubmit={submit}>
        <label>Request
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="access">Access my information</option>
            <option value="correct">Correct my information</option>
            <option value="delete">Request deletion</option>
            <option value="export">Export my information</option>
            <option value="other">Other privacy request</option>
          </select>
        </label>
        <label>Details (optional)
          <textarea maxLength={2000} rows={4}
            value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="Add anything that helps us process your request." />
        </label>
        <button className="secondary" disabled={busy} type="submit">Submit privacy request</button>
      </form>
      {status && <p className="notice" role="status">{status}</p>}
    </section>
  );
}
