import { useState } from "react";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function EmailLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#0D0D0D", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ fontFamily: "sans-serif", fontSize: "26px", fontWeight: 900, color: "#C8F04B", marginBottom: "4px" }}>VLTD</div>
      <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px", marginBottom: "40px" }}>VALET MANAGEMENT</div>
      <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: "#111", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "14px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: "#111", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "14px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none" }}
        />
        {error && (
          <div style={{ color: "#ff4444", fontSize: "11px", marginBottom: "10px", padding: "10px", background: "#ff444411", borderRadius: "8px" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{ background: "#C8F04B", color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "1px", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "SIGNING IN..." : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}
