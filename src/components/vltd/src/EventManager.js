// ============================================================
// FILE: src/EventManager.js
// PURPOSE: Manager creates events, valets join with passcode
// USAGE: Import and render <EventManager /> in App.js
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "./firebase"; // adjust path if needed
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";

// ── MANAGER: Create & view events ──────────────────────────
export function ManagerEventPanel({ onSelectEvent, activeEventId }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    name: "",
    location: "",
    date: "",
    passcode: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const snap = await getDocs(
      query(collection(db, "events"), orderBy("createdAt", "desc"))
    );
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function createEvent(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.location || !form.date || !form.passcode) {
      setError("All fields required.");
      return;
    }
    if (form.passcode.length < 4) {
      setError("Passcode must be at least 4 characters.");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "events"), {
        ...form,
        status: "active",
        ticketCount: 0,
        createdAt: serverTimestamp(),
      });
      setForm({ name: "", location: "", date: "", passcode: "" });
      await loadEvents();
    } catch (err) {
      setError("Failed to create event.");
    }
    setCreating(false);
  }

  async function toggleEventStatus(event) {
    const newStatus = event.status === "active" ? "closed" : "active";
    await updateDoc(doc(db, "events", event.id), { status: newStatus });
    await loadEvents();
  }

  return (
    <div style={styles.panel}>
      <h2 style={styles.heading}>📍 Events Manager</h2>

      {/* CREATE EVENT FORM */}
      <form onSubmit={createEvent} style={styles.form}>
        <h3 style={styles.subheading}>Create New Event</h3>
        <input
          style={styles.input}
          placeholder="Event Name (e.g. Gala at The Ritz)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Location / Venue"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <input
          style={styles.input}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Passcode (valets use this to join)"
          value={form.passcode}
          onChange={(e) =>
            setForm({ ...form, passcode: e.target.value.toUpperCase() })
          }
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.btn} type="submit" disabled={creating}>
          {creating ? "Creating..." : "➕ Create Event"}
        </button>
      </form>

      {/* EVENT LIST */}
      <h3 style={{ ...styles.subheading, marginTop: 24 }}>All Events</h3>
      {events.length === 0 && (
        <p style={styles.muted}>No events yet. Create one above.</p>
      )}
      {events.map((ev) => (
        <div
          key={ev.id}
          style={{
            ...styles.card,
            borderLeft: `4px solid ${ev.status === "active" ? "#22c55e" : "#6b7280"}`,
            background: activeEventId === ev.id ? "#1e293b" : styles.card.background,
          }}
        >
          <div style={styles.cardRow}>
            <div>
              <strong style={{ color: "#f1f5f9" }}>{ev.name}</strong>
              <p style={styles.muted}>
                📍 {ev.location} &nbsp;|&nbsp; 📅 {ev.date}
              </p>
              <p style={styles.muted}>
                🔑 Passcode: <code style={styles.code}>{ev.passcode}</code>
                &nbsp;|&nbsp; Status:{" "}
                <span
                  style={{
                    color: ev.status === "active" ? "#22c55e" : "#9ca3af",
                  }}
                >
                  {ev.status}
                </span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
              <button
                style={styles.btnSmall}
                onClick={() => onSelectEvent(ev)}
              >
                View Tickets
              </button>
              <button
                style={{
                  ...styles.btnSmall,
                  background: ev.status === "active" ? "#7f1d1d" : "#14532d",
                }}
                onClick={() => toggleEventStatus(ev)}
              >
                {ev.status === "active" ? "Close Event" : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── VALET: Join event with passcode ────────────────────────
export function ValetJoinEvent({ onJoined }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function joinEvent(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "events"),
          where("passcode", "==", passcode.toUpperCase()),
          where("status", "==", "active")
        )
      );
      if (snap.empty) {
        setError("Invalid passcode or event is closed.");
        setLoading(false);
        return;
      }
      const ev = { id: snap.docs[0].id, ...snap.docs[0].data() };
      // Save to localStorage so it persists the session
      localStorage.setItem("vltd_event", JSON.stringify(ev));
      onJoined(ev);
    } catch (err) {
      setError("Error joining event.");
    }
    setLoading(false);
  }

  return (
    <div style={styles.panel}>
      <h2 style={styles.heading}>🎟 Join Event</h2>
      <p style={styles.muted}>Enter the passcode your manager gave you.</p>
      <form onSubmit={joinEvent} style={styles.form}>
        <input
          style={{ ...styles.input, textAlign: "center", fontSize: 24, letterSpacing: 8 }}
          placeholder="PASSCODE"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value.toUpperCase())}
          maxLength={12}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.btn} type="submit" disabled={loading}>
          {loading ? "Joining..." : "Join Event"}
        </button>
      </form>
    </div>
  );
}

// ── HOOK: Get current event from localStorage ──────────────
export function useCurrentEvent() {
  const [event, setEvent] = useState(() => {
    try {
      const stored = localStorage.getItem("vltd_event");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  function setCurrentEvent(ev) {
    if (ev) {
      localStorage.setItem("vltd_event", JSON.stringify(ev));
    } else {
      localStorage.removeItem("vltd_event");
    }
    setEvent(ev);
  }

  return [event, setCurrentEvent];
}

// ── HELPER: Get next ticket number for an event ───────────
// Call this when creating a ticket instead of the daily counter
export async function getNextEventTicketNumber(eventId) {
  const evRef = doc(db, "events", eventId);
  // We read, increment, write — for production use a transaction
  const snap = await getDocs(
    query(collection(db, "tickets"), where("eventId", "==", eventId))
  );
  const count = snap.size + 1;
  return String(count).padStart(4, "0");
}

// ── STYLES ─────────────────────────────────────────────────
const styles = {
  panel: {
    background: "#0f172a",
    minHeight: "100vh",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
    color: "#f1f5f9",
  },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 16, color: "#f1f5f9" },
  subheading: { fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#94a3b8" },
  form: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 },
  input: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "12px 16px",
    color: "#f1f5f9",
    fontSize: 16,
    outline: "none",
  },
  btn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSmall: {
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  card: {
    background: "#1e293b",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  muted: { color: "#94a3b8", fontSize: 13, margin: "4px 0" },
  error: { color: "#f87171", fontSize: 14, margin: 0 },
  code: {
    background: "#0f172a",
    padding: "2px 6px",
    borderRadius: 4,
    fontFamily: "monospace",
    color: "#fbbf24",
  },
};
