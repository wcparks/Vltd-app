import { QRCodeSVG as QRCode } from "qrcode.react";
import { PhotoViewer, SpotPhotoViewer } from "./PhotoCapture";

const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const CARD = "#161616";
const BORDER = "#2a2a2a";

const ticketURL = (code) => `https://valet-app-woad.vercel.app/ticket?code=${encodeURIComponent(code)}`;

const S = {
  app: { background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" },
  header: { paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: BG, zIndex: 10 },
  logo: { fontFamily: "sans-serif", fontSize: "20px", fontWeight: 900, color: ACCENT },
  sub: { fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" },
  content: { padding: "12px 16px" },
  btn: { background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px", letterSpacing: "1px" },
  btnRed: { background: "#ff444422", color: "#ff4444", border: "1px solid #ff444433", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" },
  btnOutline: { background: "transparent", color: "#aaa", border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontSize: "12px", cursor: "pointer" },
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", marginBottom: "12px" },
  label: { fontSize: "9px", color: "#aaa", letterSpacing: "2px", marginBottom: "6px" },
  badge: (s) => ({
    display: "inline-block", padding: "4px 10px", borderRadius: "20px", fontSize: "9px", letterSpacing: "1px",
    background: s === "parked" ? "#1a2a0a" : s === "retrieving" ? "#1a1500" : s === "delivered" ? "#111" : "#1a1a2a",
    color: s === "parked" ? ACCENT : s === "retrieving" ? "#ffcc00" : s === "delivered" ? "#555" : "#aaa",
    border: `1px solid ${s === "parked" ? ACCENT + "44" : s === "retrieving" ? "#ffcc0044" : "#33333344"}`
  }),
};

export default function TicketView({ ticket, valetRole, onBack, onFillDetails, onStartRetrieval, onMarkDelivered, onDelete, onShowQR, onEdit }) {
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TICKET #{ticket.ticketNumber || ticket.paperTicketNum || ticket.ticketNum}</div></div>
        <button style={S.btnOutline} onClick={onBack}>Back</button>
      </div>
      <div style={S.content}>
        <div style={{ background: "#C8F04B15", border: `1px solid ${ACCENT}44`, borderRadius: "14px", padding: "16px", textAlign: "center", marginBottom: "16px" }}>
          <div style={S.label}>TICKET #</div>
          <div style={{ fontSize: "44px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900 }}>{ticket.ticketNumber || ticket.paperTicketNum || ticket.ticketNum}</div>
          <div style={{ ...S.badge(ticket.status), marginTop: "8px" }}>{ticket.status?.toUpperCase()}</div>
          {ticket.eventName && <div style={{ fontSize: "10px", color: "#555", marginTop: "6px" }}>{ticket.eventName}</div>}
        </div>

        {ticket.photos?.length > 0
          ? <div style={{ marginBottom: "12px" }}><PhotoViewer photos={ticket.photos} /></div>
          : ticket.photoURL
            ? <SpotPhotoViewer url={ticket.photoURL} label="Vehicle Photo" />
            : null}

        <SpotPhotoViewer url={ticket.spotPhotoURL} label="Park Location Photo" />

        <div style={S.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              { label: "PLATE", value: ticket.plate || "--", large: true },
              { label: "SPOT", value: ticket.spot || "--" },
              { label: "CAR", value: ticket.car || "--" },
              { label: "COLOR", value: ticket.color || "--" },
              { label: "CREATED BY", value: ticket.createdBy || "--" },
              { label: "PARKED BY", value: ticket.parkedBy || "--" },
              { label: "RETRIEVED BY", value: ticket.retrievedBy || "--" },
            ].map(({ label, value, large }) => (
              <div key={label}>
                <div style={S.label}>{label}</div>
                <div style={{ color: "#ccc", fontSize: large ? "15px" : "13px", fontWeight: large ? 700 : 400 }}>{value}</div>
              </div>
            ))}
            {ticket.customerName && <div style={{ gridColumn: "span 2" }}><div style={S.label}>CUSTOMER</div><div style={{ color: ACCENT, fontSize: "13px" }}>{ticket.customerName}</div></div>}
            {ticket.customerPhone && <div style={{ gridColumn: "span 2" }}><div style={S.label}>PHONE</div><div style={{ color: "#ccc", fontSize: "13px" }}>{ticket.customerPhone}</div></div>}
            {ticket.rating > 0 && <div><div style={S.label}>RATING</div><div style={{ color: ACCENT, fontSize: "13px" }}>{ticket.rating}/5</div></div>}
            {ticket.tip > 0 && <div><div style={S.label}>TIP</div><div style={{ color: ACCENT, fontSize: "15px", fontWeight: 700 }}>${ticket.tip}</div></div>}
          </div>
          {ticket.damage && <div style={{ marginTop: "12px" }}><div style={S.label}>DAMAGE NOTES</div><div style={{ color: "#888", fontSize: "12px" }}>{ticket.damage}</div></div>}
          {ticket.review && <div style={{ marginTop: "12px" }}><div style={S.label}>CUSTOMER REVIEW</div><div style={{ color: "#888", fontSize: "12px", fontStyle: "italic" }}>"{ticket.review}"</div></div>}
        </div>

        <div style={{ background: "#fff", padding: "14px", borderRadius: "14px", textAlign: "center", marginBottom: "12px" }}>
          <QRCode value={ticketURL(ticket.confirmCode)} size={160} level="H" />
          <div style={{ fontSize: "10px", color: "#999", marginTop: "8px" }}>SHOW TO CUSTOMER</div>
        </div>

        {ticket.status === "ticketed" && (
          <button style={S.btn} onClick={() => onFillDetails(ticket)}>FILL IN DETAILS</button>
        )}
        {ticket.status === "parked" && (
          <button style={{ ...S.btn, background: "#ffcc00", color: "#000" }} onClick={() => onStartRetrieval(ticket)}>START RETRIEVAL</button>
        )}
        {ticket.status === "retrieving" && (
          <button style={S.btn} onClick={() => onMarkDelivered(ticket.id)}>MARK DELIVERED</button>
        )}
        {valetRole === "manager" && (
          <button style={S.btnRed} onClick={() => onDelete(ticket.id)}>DELETE TICKET</button>
        )}
        <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={() => onShowQR(ticket)}>Show QR Code</button>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={() => onEdit(ticket)}>Edit Ticket</button>
        </div>
      </div>
    </div>
  );
}
