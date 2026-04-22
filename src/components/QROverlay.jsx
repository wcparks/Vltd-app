import { QRCodeSVG as QRCode } from "qrcode.react";

const ticketURL = (code) => `https://valet-app-woad.vercel.app/ticket?code=${encodeURIComponent(code)}`;

export default function QROverlay({ ticket, currentEvent, onFillDetails, onSkip }) {
  const qrSize = Math.min(window.innerWidth, window.innerHeight) - 120;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "32px 20px 24px", zIndex: 100 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "11px", color: "#bbb", letterSpacing: "4px", marginBottom: "6px" }}>VLTD</div>
        <div style={{ fontSize: "56px", fontFamily: "sans-serif", fontWeight: 900, color: "#000", lineHeight: 1 }}>#{ticket.num}</div>
        {currentEvent && <div style={{ fontSize: "12px", color: "#aaa", marginTop: "4px" }}>{currentEvent.name}</div>}
      </div>
      <QRCode value={ticketURL(ticket.code)} size={qrSize} level="H" />
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ textAlign: "center", fontSize: "10px", color: "#bbb", letterSpacing: "2px", marginBottom: "4px" }}>CUSTOMER SCANS TO TRACK CAR</div>
        <button
          style={{ background: "#000", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "1px" }}
          onClick={onFillDetails}
        >
          FILL IN CAR DETAILS
        </button>
        <button
          style={{ background: "transparent", color: "#888", border: "1px solid #ddd", borderRadius: "12px", padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontSize: "12px", cursor: "pointer", textAlign: "center" }}
          onClick={onSkip}
        >
          SKIP - DO LATER
        </button>
      </div>
    </div>
  );
}
