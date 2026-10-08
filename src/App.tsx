import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { supabase } from "./supabaseClient";

type AuthMode = "recovery" | "invite" | null;

export default function App() {
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const linkType = hash.get("type") ?? query.get("type");
    const linkError = hash.get("error_description") ?? query.get("error_description");
    const tokenHash = query.get("token_hash");
    const code = query.get("code");

    if (linkType === "recovery" || linkType === "invite") {
      setAuthMode(linkType);
    }
    if (linkError) setMessage(linkError.replace(/\+/g, " "));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
      if (event === "PASSWORD_RECOVERY") setAuthMode("recovery");
    });

    async function initialize() {
      try {
        // Supabase normally processes URL fragments and PKCE codes automatically
        // when detectSessionInUrl is enabled in supabaseClient.
        // Token-hash links require an explicit verification step.
        if (tokenHash && (linkType === "recovery" || linkType === "invite")) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: linkType,
          });
          if (error) throw error;
          window.history.replaceState({}, "", window.location.pathname);
        } else if (code) {
          // If the client has already exchanged the code, a session may exist.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setHasSession(!!data.session);
      } catch (err) {
        if (mounted) {
          setMessage(err instanceof Error ? err.message : "Invalid or expired link. Request a new reset email.");
        }
      } finally {
        if (mounted) setReady(true);
      }
    }

    void initialize();
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const canSetPassword = !completed && hasSession && authMode !== null;

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 12) {
      setMessage("Password must contain at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session || !authMode) {
        throw new Error("Your password link is invalid or expired. Please request a new reset email.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Password has been saved at this point. Sign-out failure must not hide success.
      setCompleted(true);
      setAuthMode(null);
      setHasSession(false);
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState({}, "", window.location.pathname);
      setMessage("Password saved successfully! You can now sign in to the Warehouse Desktop App.");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) console.warn("Sign out after password update:", signOutError);
    } catch (err) {
      console.error("Password update failed:", err);
      setMessage(err instanceof Error ? err.message : "Could not update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setMessage("If this email is registered, a password reset link will be sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  const page: CSSProperties = {
    minHeight: "100vh", background: "#f4f6f9", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 20,
    fontFamily: "Arial, Helvetica, sans-serif",
  };
  const card: CSSProperties = {
    width: "100%", maxWidth: 420, background: "white", borderRadius: 14,
    padding: 32, boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  };
  const input: CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "13px 14px", marginTop: 7,
    marginBottom: 16, border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14,
  };
  const button: CSSProperties = {
    width: "100%", padding: 14, background: "#1d4ed8", color: "white",
    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: "pointer", marginTop: 8,
  };

  return (
    <main style={page}>
      <div style={card}>
        <h1 style={{ margin: 0, textAlign: "center", fontSize: 25, color: "#111827" }}>
          Warehouse Account
        </h1>
        <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, marginTop: 10 }}>
          Password Management
        </p>

        {!ready ? (
          <p>Checking account link...</p>
        ) : canSetPassword ? (
          <form onSubmit={savePassword}>
            <h2 style={{ fontSize: 19 }}>
              {authMode === "invite" ? "Create Your Password" : "Reset Your Password"}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14 }}>
              Enter and confirm your new warehouse account password.
            </p>
            <label htmlFor="new-password">New Password</label>
            <input id="new-password" type="password" placeholder="At least 12 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" style={input} minLength={12} required />
            <label htmlFor="confirm-password">Confirm Password</label>
            <input id="confirm-password" type="password" placeholder="Confirm your password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password" style={input} required />
            <button type="submit" disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Saving..." : "Save Password"}
            </button>
          </form>
        ) : !completed ? (
          <form onSubmit={requestReset}>
            <h2 style={{ fontSize: 19 }}>Forgot Password?</h2>
            <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
              Enter your registered email address. We'll send you a link to reset your password.
            </p>
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" placeholder="employee@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" style={input} required />
            <button type="submit" disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Sending..." : "Send Reset Email"}
            </button>
          </form>
        ) : null}

        {message && (
          <p role="status" style={{ marginTop: 20, padding: 12, borderRadius: 8,
            background: "#f3f4f6", fontSize: 13, lineHeight: 1.5 }}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
