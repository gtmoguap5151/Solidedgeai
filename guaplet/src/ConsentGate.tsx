import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function ConsentGate({
  userId,
  terms,
  privacy,
  onAccepted,
  onSignOut,
}: {
  userId: string;
  terms?: string;
  privacy?: string;
  onAccepted: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function accept() {
    if (!adult || !agree) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("user_consents").insert({
      user_id: userId,
      terms_version: "1.0",
      privacy_version: "1.0",
      is_adult: true,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    onAccepted();
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="brand"><span className="brand-mark">G</span><span>Guaplet</span></div>
        <p className="tagline">One quick account step.</p>
        <h1>Know what you're agreeing to.</h1>
        <p className="lede">Guaplet records the current Terms and Privacy versions you accept before personal account features are enabled.</p>

        <div className="auth-card consent-card">
          <details className="disclosure">
            <summary>Read Terms of Use v1.0</summary>
            <div className="legal-text">{terms || "Terms are temporarily unavailable. Please try again before accepting."}</div>
          </details>
          <details className="disclosure">
            <summary>Read Privacy Notice v1.0</summary>
            <div className="legal-text">{privacy || "Privacy Notice is temporarily unavailable. Please try again before accepting."}</div>
          </details>

          <label className="check-row">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>I confirm I am at least 18 years old.</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to Guaplet Terms of Use v1.0 and Privacy Notice v1.0.</span>
          </label>

          <button className="primary full" disabled={busy || !adult || !agree || !terms || !privacy} onClick={accept}>
            {busy ? "Saving…" : "Accept and continue"}
          </button>
          <button className="text-button" onClick={onSignOut}>Sign out instead</button>
          {message && <p className="form-message" role="status">{message}</p>}
        </div>
      </div>
    </div>
  );
}
