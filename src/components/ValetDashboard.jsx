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
  input: { width: "100%", background: "#111", border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "13px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none", boxSizing: "border-box" },
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

export default function ValetDashboard({
  valetName, valetRole, currentEvent,
  tickets, todayTickets,
  clockedIn, clockInTime,
  isOnline, loading,
  search, showSearch,
  onClockIn, onClockOut,
  onCreateTicket, onSearch, onToggleSearch,
  onShowSummary, onManualTicket,
  onSelectTicket, onLeaveEvent, onSignOut,
}) {
  const filteredTickets = search ? tickets.filter(t => {
    const s = search.toLowerCase();
    return (t.plate || "").toLowerCase().includes(s) || (t.car || "").toLowerCase().includes(s) ||
      (t.customerName || "").toLowerCase().includes(s) || (t.ticketNum || "").includes(s) ||
      (t.spot || "").toLowerCase().includes(s) || (t.color || "").toLowerCase().includes(s);
  }) : [];

  const deliveredCount = todayTickets.filter(t => t.status === "delivered").length;
  const activeTickets = tickets.filter(t => t.status !== "delivered" && t.date === today());
  const retrievingTickets = tickets.filter(t => t.status === "retrieving");
  const displayTickets = search ? filteredTickets : activeTickets.filter(t => t.status !== "retrieving");

  return (
    <div style={S.app}>
      {!isOnline && (
        <div style={{ background: "#ff444422", borderBottom: "1px solid #ff444433", padding: "10px 16px", textAlign: "center", fontSize: "11px", color: "#ff4444", letterSpacing: "1px" }}>
          NO CONNECTION - Changes will sync when back online
        </div>
      )}
      <div style={S.header}>
        <div>
          <div style={S.logo}>VLTD</div>
          <div style={S.sub}>
            {valetName.toUpperCase()} - {valetRole === "manager" ? "MGR" : valetRole === "supervisor" ? "SUPERVISOR" : "VALET"}
            {currentEvent ? ` - ${currentEvent.name.toUpperCase()}` : ""}
          </div>
        </div>
        <div style={{ fontSize: "10px", color: "#888" }}>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      <div style={{ padding: "8px 16px", background: clockedIn ? "#0a1a00" : "#111", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "10px", color: clockedIn ? ACCENT : "#555" }}>
          {clockedIn ? `CLOCKED IN - ${new Date(clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "NOT CLOCKED IN"}
        </div>
        <button
          onClick={clockedIn ? onClockOut : onClockIn}
          style={{ background: clockedIn ? "#ff444422" : "#C8F04B22", color: clockedIn ? "#ff4444" : ACCENT, border: `1px solid ${clockedIn ? "#ff444433" : ACCENT + "44"}`, borderRadius: "8px", padding: "5px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}
        >
          {clockedIn ? "CLOCK OUT" : "CLOCK IN"}
        </button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        {(!clockedIn && valetRole !== "manager") ? (
          <div style={{ background: "#ff444411", border: "1px solid #ff444433", borderRadius: "14px", padding: "14px", textAlign: "center" }}>
            <div style={{ color: "#ff4444", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>CLOCK IN REQUIRED</div>
            <div style={{ color: "#ff444488", fontSize: "11px" }}>Clock in to create tickets</div>
          </div>
        ) : (
          <button onClick={onCreateTicket} disabled={loading}
            style={{ background: ACCENT, color: "#000", border: "none", borderRadius: "14px", padding: "16px", width: "100%", fontFamily: "sans-serif", fontSize: "16px", fontWeight: 900, cursor: "pointer", letterSpacing: "2px", opacity: loading ? 0.6 : 1, boxShadow: "0 4px 20px rgba(200,240,75,0.3)" }}>
            {loading ? "CREATING..." : "+ NEW TICKET"}
          </button>
        )}
      </div>

      <div style={{ padding: "10px 16px 0", display: "flex", gap: "8px" }}>
        <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "11px" }} onClick={onToggleSearch}>Search</button>
        <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "11px" }} onClick={onShowSummary}>Summary</button>
        {valetRole === "manager" && <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "11px" }} onClick={() => onSelectTicket("__manager__")}>Manager</button>}
      </div>
      <div style={{ padding: "6px 16px 0" }}>
        <button style={{ ...S.btnOutline, width: "100%", padding: "10px", fontSize: "11px", textAlign: "center" }} onClick={onManualTicket}>
          + MANUAL TICKET ENTRY
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: "10px 16px 0" }}>
          <input style={{ ...S.input, marginBottom: 0 }} placeholder="Search plate, name, car, spot..." value={search} onChange={e => onSearch(e.target.value)} autoFocus />
        </div>
      )}

      <div style={S.content}>
        {retrievingTickets.length > 0 && !search && (
          <>
            <div style={{ fontSize: "10px", color: "#ffcc00", letterSpacing: "2px", marginBottom: "12px" }}>RETRIEVING NOW - {retrievingTickets.length}</div>
            {retrievingTickets.map(t => (
              <div key={t.id} style={{ ...S.card, borderColor: "#ffcc0044", cursor: "pointer" }} onClick={() => onSelectTicket(t)}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "22px", fontFamily: "sans-serif", fontWeight: 900, color: "#ffcc00" }}>#{t.ticketNumber || t.paperTicketNum || t.ticketNum}</div>
                    <div style={{ fontSize: "12px", color: "#777" }}>{t.color} {t.car} - Spot {t.spot}</div>
                    {t.customerName && <div style={{ fontSize: "11px", color: ACCENT, marginTop: "4px" }}>{t.customerName}</div>}
                  </div>
                  <div style={S.badge("retrieving")}>RETRIEVING</div>
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ fontSize: "10px", color: "#666", letterSpacing: "2px", marginBottom: "12px" }}>
          {search ? `RESULTS - ${filteredTickets.length}` : `ACTIVE TODAY - ${activeTickets.length}`}
        </div>

        {displayTickets.length === 0 && (
          <div style={{ color: "#333", fontSize: "13px", textAlign: "center", padding: "40px 0" }}>
            {search ? "No tickets found." : "No active tickets. Tap + NEW."}
          </div>
        )}

        {displayTickets.filter(t => t.status !== "retrieving").map(t => (
          <div key={t.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => onSelectTicket(t)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "22px", fontFamily: "sans-serif", fontWeight: 900, color: "#fff" }}>#{t.ticketNumber || t.paperTicketNum || t.ticketNum}</div>
                <div style={{ fontSize: "12px", color: "#777", marginBottom: "4px" }}>{t.color} {t.car}{t.spot ? ` - ${t.spot}` : ""}</div>
                <div style={{ fontSize: "10px", color: "#555" }}>{t.createdBy}{t.parkedBy ? ` - Parked: ${t.parkedBy}` : ""}</div>
                {t.customerName && <div style={{ fontSize: "11px", color: ACCENT, marginTop: "4px" }}>{t.customerName}</div>}
              </div>
              <div style={S.badge(t.status)}>{t.status?.toUpperCase()}</div>
            </div>
          </div>
        ))}

        {!search && tickets.filter(t => t.status === "delivered" && t.date === today()).length > 0 && (
          <>
            <div style={{ fontSize: "10px", color: "#333", letterSpacing: "2px", margin: "20px 0 12px" }}>DELIVERED TODAY - {deliveredCount}</div>
            {tickets.filter(t => t.status === "delivered" && t.date === today()).map(t => (
              <div key={t.id} style={{ ...S.card, opacity: 0.45, cursor: "pointer" }} onClick={() => onSelectTicket(t)}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontFamily: "sans-serif", fontWeight: 700, color: "#fff" }}>#{t.ticketNumber || t.paperTicketNum || t.ticketNum}</div>
                    <div style={{ fontSize: "12px", color: "#555" }}>{t.color} {t.car}</div>
                    {t.tip > 0 && <div style={{ fontSize: "11px", color: ACCENT }}>${t.tip} tip - {t.rating}/5</div>}
                  </div>
                  <div style={S.badge("delivered")}>DELIVERED</div>
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: "24px", borderTop: `1px solid ${BORDER}`, paddingTop: "16px", display: "flex", gap: "8px" }}>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={onLeaveEvent}>Leave Event</button>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={onSignOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
