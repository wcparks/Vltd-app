// ============================================================
// FILE: src/CashierView.js
// PURPOSE: Cashier role — sees delivered tickets, confirms tips,
//          shows receipts, views shift totals
// USAGE: Render when role === "cashier" after PIN login
//
// ADD TO App.js PIN CHECK:
//   const CASHIER_PIN = "7777"; // change this
//   if (pin === CASHIER_PIN) setRole("cashier");
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function CashierView({ eventId, valetName = "Cashier" }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);

  useEffect(() => {
    loadDeliveredTickets();
    // Refresh every 30 seconds
    const interval = setInterval(loadDeliveredTickets, 30000);
    return () => clearInterval(interval);
  }, [eventId]);

  async function loadDeliveredTickets() {
    setLoading(true);
    try {
      let q = query(
        collection(db, "tickets"),
        where("status", "in", ["retrieved", "delivered"]),
        orderBy("retrievedAt", "desc")
      );
      // If event-based, filter by eventId
      if (eventId) {
        q = query(
          collection(db, "tickets"),
          where("eventId", "==", eventId),
          where("status", "in", ["retrieved", "delivered"]),
          orderBy("retrievedAt", "desc")
        );
      }
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTickets(data);
      calcShiftSummary(data);
    } catch (err) {
      console.error("Error loading tickets:", err);
    }
    setLoading(false);
  }

  function calcShiftSummary(data) {
    const confirmed = data.filter((t) => t.tipConfirmed);
    const totalTips = confirmed.reduce((sum, t) => sum + (parseFloat(t.tipAmount) || 0), 0);
    const perValet = {};
    confirmed.forEach((t) => {
      const name = t.valetName || "Unknown";
      if (!perValet[name]) perValet[name] = { tips: 0, cars: 0 };
      perValet[name].tips += parseFloat(t.tipAmount) || 0;
      perValet[name].cars += 1;
    });
    setShiftSummary({
      totalCars: data.length,
      confirmedTips: confirmed.length,
      totalTips,
      perValet,
    });
  }

  async function confirmTip(ticket, amount) {
    await updateDoc(doc(db, "tickets", ticket.id), {
      tipAmount: amount,
      tipConfirmed: true,
      tipConfirmedAt: serverTimestamp(),
      tipConfirmedBy: valetName,
    });
    await loadDeliveredTickets();
    if (receipt?.id === ticket.id) {
      setReceipt({ ...receipt, tipAmount: amount, tipConfirmed: true });
    }
  }

  function showReceipt(ticket) {
    setReceipt(ticket);
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.muted}>Loading tickets...</p>
      </div>
    );
  }

  // RECEIPT MODAL
  if (receipt) {
    return (
      <div style={styles.page}>
        <div style={styles.receiptCard}>
          <div style={styles.receiptHeader}>
            <span style={styles.logo}>VLTD</span>
            <h2 style={styles.receiptTitle}>Receipt</h2>
            <p style={styles.receiptSub}>Ticket #{receipt.ticketNumber}</p>
          </div>

          <div style={styles.receiptRow}>
            <span>Customer</span>
            <span>{receipt.customerName || "Anonymous"}</span>
          </div>
          <div style={styles.receiptRow}>
            <span>Vehicle</span>
            <span>
              {receipt.color} {receipt.make} {receipt.model}
            </span>
          </div>
          <div style={styles.receiptRow}>
            <span>Plate</span>
            <span style={styles.plate}>{receipt.plate}</span>
          </div>
          <div style={styles.receiptRow}>
            <span>Valet</span>
            <span>{receipt.valetName}</span>
          </div>

          <div style={styles.receiptDivider} />

          <div style={styles.receiptRow}>
            <span>Parking Fee</span>
            <span>{receipt.parkingFee ? `$${receipt.parkingFee}` : "—"}</span>
          </div>
          <div style={styles.receiptRow}>
            <span>Tip</span>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>
              {receipt.tipAmount ? `$${receipt.tipAmount}` : "—"}
            </span>
          </div>
          <div style={{ ...styles.receiptRow, ...styles.totalRow }}>
            <span>Total</span>
            <span>
              $
              {(
                (parseFloat(receipt.parkingFee) || 0) +
                (parseFloat(receipt.tipAmount) || 0)
              ).toFixed(2)}
            </span>
          </div>

          <div style={styles.receiptDivider} />

          {/* TIP CONFIRMATION */}
          {!receipt.tipConfirmed && (
            <div>
              <p style={styles.muted}>Confirm tip payment:</p>
              <div style={styles.tipBtns}>
                {["2", "5", "10", "20"].map((amt) => (
                  <button
                    key={amt}
                    style={styles.tipBtn}
                    onClick={() => confirmTip(receipt, amt)}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <TipCustomInput onConfirm={(amt) => confirmTip(receipt, amt)} />
            </div>
          )}

          {receipt.tipConfirmed && (
            <div style={styles.confirmedBadge}>✅ Tip Confirmed: ${receipt.tipAmount}</div>
          )}

          <button
            style={{ ...styles.btn, marginTop: 20, background: "#334155" }}
            onClick={() => setReceipt(null)}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.heading}>💼 Cashier View</h1>
        <button style={styles.refreshBtn} onClick={loadDeliveredTickets}>
          🔄 Refresh
        </button>
      </div>

      {/* SHIFT SUMMARY */}
      {shiftSummary && (
        <div style={styles.summaryCard}>
          <h3 style={styles.summaryTitle}>Shift Summary</h3>
          <div style={styles.summaryGrid}>
            <StatBox label="Cars Delivered" value={shiftSummary.totalCars} />
            <StatBox label="Tips Confirmed" value={shiftSummary.confirmedTips} />
            <StatBox
              label="Total Tips"
              value={`$${shiftSummary.totalTips.toFixed(2)}`}
              accent
            />
          </div>

          {/* Per-valet breakdown */}
          {Object.keys(shiftSummary.perValet).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={styles.muted}>Per Valet:</p>
              {Object.entries(shiftSummary.perValet).map(([name, data]) => (
                <div key={name} style={styles.valetRow}>
                  <span style={{ color: "#f1f5f9" }}>{name}</span>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>
                    {data.cars} cars · ${data.tips.toFixed(2)} tips
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TICKET LIST */}
      <h2 style={{ ...styles.heading, fontSize: 16, marginTop: 20, marginBottom: 12 }}>
        Delivered Tickets ({tickets.length})
      </h2>

      {tickets.length === 0 && (
        <p style={styles.muted}>No delivered tickets yet.</p>
      )}

      {tickets.map((ticket) => (
        <div key={ticket.id} style={styles.ticketCard}>
          <div style={styles.ticketTop}>
            <div>
              <span style={styles.ticketNum}>#{ticket.ticketNumber}</span>
              <span style={styles.carInfo}>
                {ticket.color} {ticket.make} {ticket.model}
              </span>
              <span style={styles.plate}>{ticket.plate}</span>
            </div>
            <div style={styles.ticketRight}>
              {ticket.tipConfirmed ? (
                <span style={styles.tipConfirmed}>✅ ${ticket.tipAmount}</span>
              ) : (
                <span style={styles.tipPending}>💵 Tip Pending</span>
              )}
            </div>
          </div>
          <div style={styles.ticketMeta}>
            <span>👤 {ticket.customerName || "Anonymous"}</span>
            <span>🅿️ {ticket.valetName}</span>
          </div>
          <button
            style={styles.receiptBtn}
            onClick={() => showReceipt(ticket)}
          >
            Show Receipt / Confirm Tip
          </button>
        </div>
      ))}
    </div>
  );
}

function TipCustomInput({ onConfirm }) {
  const [custom, setCustom] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <input
        style={{
          flex: 1,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 8,
          padding: "10px 14px",
          color: "#f1f5f9",
          fontSize: 16,
        }}
        type="number"
        placeholder="Custom $"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        min="0"
        max="500"
      />
      <button
        style={{
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
        }}
        onClick={() => {
          if (custom && parseFloat(custom) > 0) onConfirm(custom);
        }}
      >
        ✓ Confirm
      </button>
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={styles.statBox}>
      <span style={{ ...styles.statValue, color: accent ? "#22c55e" : "#f1f5f9" }}>
        {value}
      </span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    minHeight: "100vh",
    padding: 16,
    fontFamily: "system-ui, sans-serif",
    color: "#f1f5f9",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: 700, margin: 0, color: "#f1f5f9" },
  refreshBtn: {
    background: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
  },
  summaryCard: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 15, fontWeight: 600, color: "#94a3b8", margin: "0 0 12px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  statBox: {
    background: "#0f172a",
    borderRadius: 8,
    padding: "12px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 11, color: "#64748b", textAlign: "center" },
  valetRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid #0f172a",
  },
  ticketCard: {
    background: "#1e293b",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  ticketTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  ticketNum: {
    display: "block",
    fontSize: 20,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  carInfo: { display: "block", color: "#94a3b8", fontSize: 13 },
  plate: {
    display: "inline-block",
    background: "#0f172a",
    color: "#fbbf24",
    fontFamily: "monospace",
    fontWeight: 700,
    fontSize: 14,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: 2,
  },
  ticketRight: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  tipConfirmed: { color: "#22c55e", fontWeight: 700, fontSize: 14 },
  tipPending: { color: "#fbbf24", fontSize: 13 },
  ticketMeta: {
    display: "flex",
    gap: 16,
    color: "#64748b",
    fontSize: 12,
    marginBottom: 10,
  },
  receiptBtn: {
    width: "100%",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  receiptCard: {
    background: "#1e293b",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    margin: "0 auto",
  },
  receiptHeader: { textAlign: "center", marginBottom: 20 },
  logo: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 6,
    color: "#64748b",
    display: "block",
  },
  receiptTitle: { fontSize: 24, fontWeight: 700, margin: "8px 0 4px", color: "#f1f5f9" },
  receiptSub: { color: "#64748b", fontSize: 14, margin: 0 },
  receiptRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    color: "#cbd5e1",
    fontSize: 15,
    borderBottom: "1px solid #0f172a",
  },
  totalRow: {
    fontSize: 18,
    fontWeight: 700,
    color: "#f1f5f9",
    borderBottom: "none",
  },
  receiptDivider: { borderTop: "1px dashed #334155", margin: "12px 0" },
  tipBtns: { display: "flex", gap: 8, marginTop: 8 },
  tipBtn: {
    flex: 1,
    background: "#0f172a",
    color: "#f1f5f9",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "12px 0",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmedBadge: {
    background: "#14532d",
    color: "#86efac",
    borderRadius: 8,
    padding: "12px 16px",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 700,
  },
  btn: {
    width: "100%",
    border: "none",
    borderRadius: 8,
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    color: "#fff",
  },
  muted: { color: "#64748b", fontSize: 13 },
};
