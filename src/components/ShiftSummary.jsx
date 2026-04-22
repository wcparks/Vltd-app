const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const BORDER = "#2a2a2a";
const CARD = "#161616";

function today() { return new Date().toISOString().slice(0, 10); }

export default function ShiftSummary({ todayTickets, totalTips, avgRating, deliveredCount, activeCount, valetRole, currentEvent, onBack }) {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: BG, zIndex: 10 }}>
        <div>
          <div style={{ fontFamily: "sans-serif", fontSize: "20px", fontWeight: 900, color: ACCENT }}>VLTD</div>
          <div style={{ fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" }}>SHIFT SUMMARY</div>
        </div>
        <button style={{ background: "transparent", color: "#aaa", border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontSize: "12px", cursor: "pointer" }} onClick={onBack}>Back</button>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: "10px", color: "#666", letterSpacing: "2px", marginBottom: "16px" }}>{today()}{currentEvent ? ` - ${currentEvent.name}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "TOTAL CARS", value: todayTickets.length },
            { label: "ACTIVE", value: activeCount },
            { label: "DELIVERED", value: deliveredCount },
            { label: "TOTAL TIPS", value: `$${totalTips}` },
            { label: "AVG RATING", value: avgRating + "/5" },
            { label: "VALETS", value: [...new Set(todayTickets.map(t => t.createdBy))].length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontFamily: "sans-serif", fontWeight: 900, color: ACCENT }}>{value}</div>
              <div style={{ fontSize: "9px", color: "#666", letterSpacing: "1.5px", marginTop: "6px" }}>{label}</div>
            </div>
          ))}
        </div>
        {valetRole === "manager" && (
          <>
            <div style={{ fontSize: "10px", color: "#666", letterSpacing: "2px", marginBottom: "12px" }}>BY VALET</div>
            {[...new Set(todayTickets.map(t => t.createdBy))].map(name => {
              const vt = todayTickets.filter(t => t.createdBy === name);
              const tips = vt.reduce((s, t) => s + (t.tip || 0), 0);
              const rated = vt.filter(t => t.rating > 0);
              const avg = rated.length > 0 ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : "--";
              return (
                <div key={name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "15px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700 }}>{name}</div>
                      <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>{vt.length} cars - ${tips} tips - {avg}/5</div>
                    </div>
                    <div style={{ fontSize: "22px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900 }}>{vt.length}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
