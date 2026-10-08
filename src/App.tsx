
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function App() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setHasSession(!!session);
        setReady(true);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) {
      setMessage("Use at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
    } else {
      await supabase.auth.signOut();
      setPassword("");
      setConfirmPassword("");
      setMessage("Password saved. Open the warehouse desktop app to log in.");
    }
    setBusy(false);
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    setMessage(
      error
        ? error.message
        : "If this email has an account, a recovery link will be sent."
    );
    setBusy(false);
  }

  if (!ready) return <main><p>Checking invitation...</p></main>;

  return (
    <main style={{
      maxWidth: 420, margin: "80px auto", padding: 24,
      fontFamily: "Arial, sans-serif"
    }}>
      <h1>Warehouse Account</h1>

      {hasSession ? (
        <form onSubmit={savePassword}>
          <h2>Set your password</h2>
          <p>Choose a password for your warehouse account.</p>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button disabled={busy}>Save Password</button>
        </form>
      ) : (
        <form onSubmit={requestReset}>
          <h2>Forgot password?</h2>
          <p>Enter your registered email to receive a reset link.</p>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button disabled={busy}>Send Reset Email</button>
        </form>
      )}

      {message && <p role="status">{message}</p>}
    </main>
  );
}
