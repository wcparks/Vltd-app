import { useState } from "react";
import { db, requestNotificationPermission } from "../config/firebase";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { upsertEmployee } from "./EmployeeProfiles";

const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const BORDER = "#2a2a2a";
const MANAGER_PIN = "0711";
const VALET_PIN = "1111";
const CASHIER_PIN = "2222";
const MANAGER_NAMES = ["ivan m", "malynda m"];

function today() { return new Date().toISOString().slice(0, 10); }

const S = {
  app: { background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" },
  logo: { fontFamily: "sans-serif", fontSize: "40px", fontWeight: 900, color: ACCENT },
  sub: { fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" },
  input: { width: "100%", background: "#111", border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "13px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none", boxSizing: "border-box" },
  btn: { background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px", letterSpacing: "1px" },
  label: { fontSize: "9px", color: "#aaa", letterSpacing: "2px", marginBottom: "6px" },
};

export default function PinLogin({ onSuccess }) {
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const login = async () => {
    if (!nameInput.trim()) return;
    let role = null;
    let resolvedName = nameInput.trim();

    if (pinInput === MANAGER_PIN) {
      if (MANAGER_NAMES.includes(nameInput.trim().toLowerCase())) {
        role = "manager";
      } else {
        setPinError("Incorrect name or PIN. Contact your manager.");
        return;
      }
    } else {
      try {
        const q = query(collection(db, "valetAccounts"), where("pin", "==", pinInput), where("active", "==", true));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const account = snap.docs[0].data();
          role = account.role;
          resolvedName = account.name;
        }
      } catch (e) {
        role = pinInput === VALET_PIN ? "valet" : pinInput === CASHIER_PIN ? "cashier" : null;
      }
      if (!role) {
        role = pinInput === VALET_PIN ? "valet" : pinInput === CASHIER_PIN ? "cashier" : null;
      }
    }

    if (!role) { setPinError("Incorrect PIN. Contact your manager."); return; }
    await addDoc(collection(db, "logins"), { name: resolvedName, role, time: serverTimestamp(), date: today() });
    if (role !== "manager") await upsertEmployee(resolvedName).catch(() => {});
    try {
      const token = await requestNotificationPermission(resolvedName);
      if (token) await addDoc(collection(db, "valetTokens"), { name: resolvedName, role, token, date: today(), time: serverTimestamp() });
    } catch (e) {}
    localStorage.setItem("valetName", resolvedName);
    localStorage.setItem("valetRole", role);
    onSuccess(resolvedName, role);
  };

  return (
    <div style={{ ...S.app, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", minHeight: "100vh" }}>
      <div style={{ ...S.logo, marginBottom: "6px" }}>VLTD</div>
      <div style={{ ...S.sub, marginBottom: "48px" }}>VALET - REDEFINED</div>
      <div style={{ width: "100%", maxWidth: "320px" }}>
        <div style={S.label}>YOUR NAME</div>
        <input style={S.input} placeholder="Enter your name..." value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <div style={S.label}>ACCESS PIN</div>
        <input style={S.input} placeholder="Enter PIN..." type="password" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(""); }} onKeyDown={e => e.key === "Enter" && login()} />
        {pinError && <div style={{ color: "#ff4444", fontSize: "12px", marginBottom: "10px" }}>{pinError}</div>}
        <button style={S.btn} onClick={login}>START SHIFT</button>
      </div>
    </div>
  );
}
