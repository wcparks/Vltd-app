import { useState } from "react";
import EventManager from "./EventManager";
import EmployeeProfiles from "./EmployeeProfiles";
import ReviewsPage from "./ReviewsPage";
import ManagerDashboard from "./ManagerDashboard";
import LocationManager from "./LocationManager";
import ValetManager from "./ValetManager";

const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const CARD = "#161616";
const BORDER = "#2a2a2a";

const S = {
  app: { background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" },
  header: { paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0D0D0D", zIndex: 10 },
  logo: { fontFamily: "sans-serif", fontSize: "20px", fontWeight: 900, color: ACCENT },
  sub: { fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" },
  content: { padding: "12px 16px" },
  btnOutline: { background: "transparent", color: "#aaa", border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontSize: "12px", cursor: "pointer" },
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", marginBottom: "12px" },
  badge: (s) => ({
    display: "inline-block", padding: "4px 10px", borderRadius: "20px", fontSize: "9px", letterSpacing: "1px",
    background: s === "parked" ? "#1a2a0a" : s === "retrieving" ? "#1a1500" : s === "delivered" ? "#111" : "#1a1a2a",
    color: s === "parked" ? ACCENT : s === "retrieving" ? "#ffcc00" : s === "delivered" ? "#555" : "#aaa",
    border: `1px solid ${s === "parked" ? ACCENT + "44" : s === "retrieving" ? "#ffcc0044" : "#33333344"}`
  }),
};

function today() { return new Date().toISOString().slice(0, 10); }

export default function ManagerView({
  valetName, valetRole, currentEvent,
  tickets, todayTickets, logins,
  onBack, onSelectTicket,
}) {
  const [subView, setSubView] = useState(null);

  if (subView === "events") return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>EVENTS</div></div>
        <button style={S.btnOutline} onClick={() => setSubView(null)}>Back</button>
      </div>
      <div style={S.content}><EventManager /></div>
    </div>
  );

  if (subView === "employees") return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TEAM</div></div>
        <button style={S.btnOutline} onClick={() => setSubView(null)}>Back</button>
      </div>
      <div style={S.content}><EmployeeProfiles /></div>
    </div>
  );

  if (subView === "reviews") return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>REVIEWS</div></div>
        <button style={S.btnOutline} onClick={() => setSubView(null)}>Back</button>
      </div>
      <ReviewsPage isManager={true} />
    </div>
  );

  if (subView === "dashboard") return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>DASHBOARD</div></div>
        <button style={S.btnOutline} onClick={() => setSubView(null)}>Back</button>
      </div>
      <div style={S.content}><ManagerDashboard tickets={tickets} todayTickets={todayTickets} /></div>
    </div>
  );

  if (subView === "locations") return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>LOCATIONS</div></div>
        <button style={S.btnOutline} onClick={() => setSubView(null)}>Back</button>
      </div>
      <div style={S.content}><LocationManager managerName={valetName} managerRole={valetRole} /></div>
    </div>
  );

  if (subView === "staff") return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>STAFF PINS</div></div>
        <button style={S.btnOutline} onClick={() => setSubView(null)}>Back</button>
      </div>
      <div style={S.content}><ValetManager /></div>
    </div>
  );

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>MANAGER</div></div>
        <button style={S.btnOutline} onClick={onBack}>Back</button>
      </div>
      <div style={S.content}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          {[{ label: "Dashboard", key: "dashboard" }, { label: "Events", key: "events" }, { label: "Locations", key: "locations" }].map(({ label, key }) => (
            <button key={key} style={{ ...S.btnOutline, padding: "12px 6px", fontSize: "11px", textAlign: "center" }} onClick={() => setSubView(key)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "20px" }}>
          {[{ label: "Team", key: "employees" }, { label: "Reviews", key: "reviews" }, { label: "Staff PINs", key: "staff" }].map(({ label, key }) => (
            <button key={key} style={{ ...S.btnOutline, padding: "12px 6px", fontSize: "11px", textAlign: "center" }} onClick={() => setSubView(key)}>{label}</button>
          ))}
        </div>

        <div style={{ fontSize: "10px", color: "#666", letterSpacing: "2px", marginBottom: "12px" }}>VALETS TODAY</div>
        {[...new Set(todayTickets.map(t => t.createdBy))].map(name => {
          const vt = todayTickets.filter(t => t.createdBy === name);
          const tips = vt.reduce((s, t) => s + (t.tip || 0), 0);
          const rated = vt.filter(t => t.rating > 0);
          const avg = rated.length > 0 ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : "--";
          return (
            <div key={name} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "16px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "4px" }}>{name}</div>
                  <div style={{ fontSize: "11px", color: "#666" }}>{vt.length} cars - ${tips} tips - {avg}/5</div>
                </div>
                <div style={{ fontSize: "28px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900 }}>{vt.length}</div>
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: "10px", color: "#666", letterSpacing: "2px", margin: "20px 0 12px" }}>ALL TICKETS TODAY</div>
        {todayTickets.map(t => (
          <div key={t.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => onSelectTicket(t)}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "16px", fontFamily: "sans-serif", fontWeight: 700, color: "#fff" }}>#{t.ticketNumber || t.paperTicketNum || t.ticketNum}</div>
                <div style={{ fontSize: "11px", color: "#666" }}>{t.color} {t.car} - {t.createdBy}</div>
                {t.eventName && <div style={{ fontSize: "10px", color: "#444" }}>{t.eventName}</div>}
                {t.customerName && <div style={{ fontSize: "11px", color: ACCENT }}>{t.customerName}</div>}
              </div>
              <div style={S.badge(t.status)}>{t.status?.toUpperCase()}</div>
            </div>
          </div>
        ))}
        {todayTickets.length === 0 && <div style={{ color: "#333", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>No tickets today.</div>}

        <div style={{ fontSize: "10px", color: "#666", letterSpacing: "2px", margin: "20px 0 12px" }}>LOGIN LOG TODAY</div>
        {logins.filter(l => l.date === today()).map(l => (
          <div key={l.id} style={{ ...S.card, padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "14px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700 }}>{l.name}</div>
                <div style={{ fontSize: "10px", color: "#666", marginTop: "3px" }}>{l.role?.toUpperCase()} - {l.time?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "--"}</div>
              </div>
              <div style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "9px", background: l.role === "manager" ? "#C8F04B22" : "#1a1a2a", color: l.role === "manager" ? ACCENT : "#aaa", border: `1px solid ${l.role === "manager" ? "#C8F04B44" : "#33333344"}` }}>{l.role?.toUpperCase()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
