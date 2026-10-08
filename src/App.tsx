
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type Page = "signup" | "forgot";
type AuthMode = "invite" | "recovery" | null;

export default function App() {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>("signup");
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [hasSession, setHasSession] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );
    const query = new URLSearchParams(window.location.search);

    const linkType = hash.get("type") ?? query.get("type");
    const linkError =
      hash.get("error_description") ??
      query.get("error_description");

    if (linkError) {
      setMessage(linkError.replace(/\+/g, " "));
    }

    if (linkType === "invite") {
      setAuthMode("invite");
      setPage("signup");
    } else if (linkType === "recovery") {
      setAuthMode("recovery");
      setPage("forgot");
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        setHasSession(!!session);

        if (event === "PASSWORD_RECOVERY") {
          setAuthMode("recovery");
          setPage("forgot");
        }
      }
    );

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      setHasSession(!!data.session);
      if (error) setMessage(error.message);
      setReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const canSetPassword = hasSession && authMode !== null;

  function switchPage(next: Page) {
    setPage(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSetPassword) {
      setMessage("Please open a valid invitation or recovery link.");
      return;
    }

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

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      await supabase.auth.signOut();
      setHasSession(false);
      setAuthMode(null);
      setPassword("");
      setConfirmPassword("");

      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );

      setMessage(
        "Password saved successfully! You can now log in to the Warehouse Desktop App."
      );
    }

    setBusy(false);
  }

  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: window.location.origin + "/",
      }
    );

    setMessage(
      error
        ? error.message
        : "If this email is registered, a password reset link will be sent."
    );

    setBusy(false);
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f4f6f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Arial, Helvetica, sans-serif",
    } as React.CSSProperties,

    card: {
      width: "100%",
      maxWidth: 420,
      background: "#ffffff",
      borderRadius: 14,
      padding: 32,
      boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
    } as React.CSSProperties,

    tabs: {
      display: "flex",
      gap: 8,
      marginTop: 24,
      marginBottom: 26,
    } as React.CSSProperties,

    input: {
      width: "100%",
      boxSizing: "border-box",
      padding: "13px 14px",
      marginTop: 7,
      marginBottom: 16,
      border: "1px solid #d1d5db",
      borderRadius: 8,
      fontSize: 14,
    } as React.CSSProperties,

    button: {
      width: "100%",
      padding: 14,
      background: "#1d4ed8",
      color: "white",
      border: "none",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      marginTop: 8,
    } as React.CSSProperties,
  };

  if (!ready) {
    return (
      <main style={styles.page}>
        <p>Checking account link...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={{
          margin: 0,
          textAlign: "center",
          fontSize: 25,
          color: "#111827",
        }}>
          Warehouse Account
        </h1>

        <p style={{
          textAlign: "center",
          color: "#6b7280",
          fontSize: 14,
          marginTop: 10,
        }}>
          Employee Account Management
        </p>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => switchPage("signup")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              border: page === "signup"
                ? "1px solid #1d4ed8"
                : "1px solid #d1d5db",
              background: page === "signup"
                ? "#1d4ed8"
                : "#ffffff",
              color: page === "signup"
                ? "#ffffff"
                : "#374151",
            }}
          >
            Sign Up
          </button>

          <button
            type="button"
            onClick={() => switchPage("forgot")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              border: page === "forgot"
                ? "1px solid #1d4ed8"
                : "1px solid #d1d5db",
              background: page === "forgot"
                ? "#1d4ed8"
                : "#ffffff",
              color: page === "forgot"
                ? "#ffffff"
                : "#374151",
            }}
          >
            Forgot Password
          </button>
        </div>

        {canSetPassword ? (
          <form onSubmit={savePassword}>
            <h2 style={{ fontSize: 19 }}>
              {authMode === "invite"
                ? "Create Your Password"
                : "Reset Your Password"}
            </h2>

            <p style={{ color: "#6b7280", fontSize: 14 }}>
              {authMode === "invite"
                ? "Your invitation was accepted. Create a password to activate your account."
                : "Enter a new password for your warehouse account."}
            </p>

            <label htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              placeholder="At least 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={styles.input}
              required
            />

            <label htmlFor="confirm-password">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={styles.input}
              required
            />

            <button
              type="submit"
              disabled={busy}
              style={styles.button}
            >
              {busy ? "Saving..." : "Save Password"}
            </button>
          </form>
        ) : page === "signup" ? (
          <div>
            <h2 style={{ fontSize: 19 }}>
              Employee Sign Up
            </h2>

            <p style={{
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.7,
            }}>
              Warehouse accounts are invitation-only.
              To create your account, please open the
              invitation link sent to your email by your
              administrator.
            </p>

            <div style={{
              background: "#eff6ff",
              padding: 16,
              borderRadius: 8,
              color: "#1e40af",
              fontSize: 13,
              lineHeight: 1.7,
            }}>
              Already received an invitation?
              Open the invitation email and click
              <strong> Accept Invite</strong> to set
              your password.
            </div>
          </div>
        ) : (
          <form onSubmit={requestReset}>
            <h2 style={{ fontSize: 19 }}>
              Forgot Password?
            </h2>

            <p style={{
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.6,
            }}>
              Enter your registered email address.
              We'll send you a link to reset your password.
            </p>

            <label htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={styles.input}
              required
            />

            <button
              type="submit"
              disabled={busy}
              style={styles.button}
            >
              {busy
                ? "Sending..."
                : "Send Reset Email"}
            </button>
          </form>
        )}

        {message && (
          <p
            role="status"
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 8,
              background: "#f3f4f6",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
