import { FormEvent, useState } from "react";
import { supabase } from "./lib/supabase";

export default function SupportPanel({ userId }: { userId: string }) {
  const [category, setCategory] = useState("account");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.from("support_requests").insert({
      user_id: userId,
      category,
      message: message.trim(),
    });
    setBusy(false);
    if (error) return setStatus(error.message);
    setMessage("");
    setStatus("Support request submitted.");
  }

  return (
    <section className="section support-panel">
      <h2>Support</h2>
      <p className="small muted">Requests are attached to your signed-in Guaplet account.</p>
      <form className="request-form" onSubmit={submit}>
        <label>Topic
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="account">Account</option>
            <option value="earn_listing">Earn listing</option>
            <option value="money_university">Money University</option>
            <option value="billing">Billing</option>
            <option value="privacy">Privacy</option>
            <option value="technical">Technical issue</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Message
          <textarea required minLength={10} maxLength={3000} rows={5}
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what happened and what you need." />
        </label>
        <button className="primary" disabled={busy || message.trim().length < 10} type="submit">
          Submit support request
        </button>
      </form>
      {status && <p className="notice" role="status">{status}</p>}
    </section>
  );
}
