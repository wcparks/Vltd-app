const ACCENT = "#C8F04B";

export default function RetrievingAlert({ ticket, onDismiss }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a1a00", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "24px" }}>
      <div style={{ fontSize: "60px", marginBottom: "16px" }}>!</div>
      <div style={{ fontFamily: "sans-serif", fontSize: "22px", color: ACCENT, fontWeight: 900, marginBottom: "8px", textAlign: "center" }}>CAR REQUESTED!</div>
      <div style={{ fontSize: "40px", fontFamily: "sans-serif", fontWeight: 900, color: "#fff", marginBottom: "8px" }}>#{ticket.ticketNum}</div>
      <div style={{ fontSize: "15px", color: "#ccc", marginBottom: "4px" }}>{ticket.color} {ticket.car}</div>
      <div style={{ fontSize: "13px", color: "#777", marginBottom: "4px" }}>Spot: {ticket.spot || "--"}</div>
      {ticket.customerName && <div style={{ fontSize: "13px", color: ACCENT, marginBottom: "24px" }}>{ticket.customerName}</div>}
      <button
        style={{ background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", maxWidth: "280px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "1px" }}
        onClick={onDismiss}
      >
        GOT IT - ON MY WAY
      </button>
    </div>
  );
}
