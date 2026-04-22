// src/components/SupervisorView.jsx
// PROPS:
//   user         — { name, role }
//   tickets      — live Firestore ticket array for current event
//   onSignOut    — sign out / menu handler
//   onNewTicket  — createTicket function from App.js
//   onViewTicket — (ticket) => { setActiveTicket(t); setView("ticket"); }
//   onClockIn    — clockIn from App.js
//   onClockOut   — clockOut from App.js
//   isClockedIn  — boolean

import React, { useMemo, useState, useEffect } from "react";

const ACCENT  = "#C8F04B";
const BG      = "#0D0D0D";
const CARD    = "#161616";
const BORDER  = "#242424";
const RED     = "#e74c3c";
const ORANGE  = "#FFB400";

// ── Helpers ─────────────────────────────────────────────────────────────────

function toMs(val) {
  if (!val) return null;
  if (typeof val === "number") return val;
  if (val.toMillis) return val.toMillis();
  if (val.seconds)  return val.seconds * 1000;
  return new Date(val).getTime();
}

function isMissingInfo(t) {
  return !t.make || !t.color || !t.spot;
}

function getWaitMs(t) {
  const start = toMs(t.retrievingAt);
  if (!start) return 0;
  return Date.now() - start;
}

function formatWaitMin(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "< 1 min" : `${m} min`;
}

function formatTime(val) {
  const ms = toMs(val);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getPriority(t) {
  if (isMissingInfo(t))              return 0;
  if (getWaitMs(t) > 5 * 60 * 1000) return 1;
  if (t.status === "retrieving")     return 2;
  if (t.status === "parked")         return 3;
  return 4;
}

function isAttention(t) {
  return isMissingInfo(t) || getWaitMs(t) > 5 * 60 * 1000;
}

function ticketNum(t) {
  return "#" + String(t.ticketNum || t.id || "0").padStart(4, "0");
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

const IconCar = ({ color = ACCENT, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11l1.5-4.5h11L19 11"/>
    <rect x="2" y="11" width="20" height="7" rx="2"/>
    <circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
    <path d="M2 15h20"/>
  </svg>
);

const IconKey = ({ color = ORANGE, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="12" r="4.5"/>
    <path d="M12 12h9M17 10v4"/>
  </svg>
);

const IconAlert = ({ color = RED, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v5M12 16.5v.5"/>
  </svg>
);

const IconClock = ({ color = RED, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 3"/>
  </svg>
);

const IconChevron = ({ color = "#444" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

// ── Status pill config ───────────────────────────────────────────────────────

const STATUS = {
  parked:     { label: "PARKED",     bg: "rgba(200,240,75,0.15)",  color: ACCENT,  dot: ACCENT },
  retrieving: { label: "RETRIEVING", bg: "rgba(255,180,0,0.15)",   color: ORANGE,  dot: ORANGE },
  ticketed:   { label: "TICKETED",   bg: "rgba(255,255,255,0.07)", color: "#777",  dot: ORANGE },
  delivered:  { label: "DELIVERED",  bg: "rgba(255,255,255,0.04)", color: "#555",  dot: "#333" },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SupervisorView({
  user        = {},
  tickets     = [],
  onSignOut,
  onNewTicket,
  onViewTicket,
  onClockIn,
  onClockOut,
  isClockedIn = false,
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const active    = useMemo(() => tickets.filter(t => t.status !== "delivered"), [tickets]);
  const delivered = useMemo(() => tickets.filter(t => t.status === "delivered"), [tickets]);

  const attention = useMemo(() =>
    active.filter(isAttention).sort((a, b) => {
      const am = isMissingInfo(a) ? 0 : 1;
      const bm = isMissingInfo(b) ? 0 : 1;
      if (am !== bm) return am - bm;
      return getWaitMs(b) - getWaitMs(a);
    }), [active]);

  const sorted = useMemo(() =>
    [...active].sort((a, b) => getPriority(a) - getPriority(b)),
    [active]);

  const fullName = user?.name
    ? user.name.toUpperCase()
    : "SUPERVISOR";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${BG}; }

        .sv { min-height: 100vh; background: ${BG}; color: #fff; font-family: 'Barlow', sans-serif; display: flex; flex-direction: column; max-width: 430px; margin: 0 auto; position: relative; }

        /* ── Header ── */
        .sv-hdr { padding: 14px 18px 12px; display: flex; align-items: center; justify-content: space-between; background: ${BG}; gap: 8px; }
        .sv-hdr-l { display: flex; align-items: center; gap: 12px; }
        .sv-burger { background: none; border: none; cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 5px; }
        .sv-burger span { display: block; width: 21px; height: 2px; background: #fff; border-radius: 2px; }
        .sv-logo { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 900; color: ${ACCENT}; letter-spacing: 1px; line-height: 1; }
        .sv-sub { font-size: 10px; color: #555; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; font-weight: 600; }
        .sv-sub b { color: #888; font-weight: 600; }
        .sv-hdr-r { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .sv-clk-lbl { font-size: 10px; color: #444; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; white-space: nowrap; }
        .sv-clk-btn { background: ${ACCENT}; color: ${BG}; border: none; border-radius: 6px; padding: 9px 15px; font-family: 'Barlow', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .sv-clk-btn.out { background: transparent; border: 1px solid #2a2a2a; color: #555; }

        /* ── Body ── */
        .sv-body { flex: 1; overflow-y: auto; padding: 14px 14px 90px; }

        /* ── New Ticket ── */
        .sv-new { width: 100%; background: ${ACCENT}; color: ${BG}; border: none; border-radius: 12px; padding: 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 19px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 14px; -webkit-tap-highlight-color: transparent; }
        .sv-new:active { opacity: 0.88; }
        .sv-new-ico { width: 28px; height: 28px; border-radius: 50%; background: ${BG}; color: ${ACCENT}; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 400; line-height: 1; flex-shrink: 0; padding-bottom: 1px; }

        /* ── Stats Row ── */
        .sv-stats { background: ${CARD}; border-radius: 12px; display: flex; margin-bottom: 14px; overflow: hidden; }
        .sv-stat { flex: 1; padding: 14px 8px 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; }
        .sv-stat + .sv-stat::before { content: ''; position: absolute; left: 0; top: 16%; height: 68%; width: 1px; background: ${BORDER}; }
        .sv-stat-ico { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; }
        .sv-stat-lbl { font-size: 9px; font-weight: 700; color: #555; letter-spacing: 1.5px; text-transform: uppercase; }
        .sv-stat-val { font-family: 'Barlow Condensed', sans-serif; font-size: 34px; font-weight: 900; line-height: 1; }
        .sv-stat-sub { font-size: 9px; color: #3a3a3a; }

        /* ── Needs Attention card ── */
        .sv-attn-wrap { background: ${CARD}; border-radius: 12px; overflow: hidden; margin-bottom: 18px; }
        .sv-attn-hdr { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 10px; border-bottom: 1px solid ${BORDER}; }
        .sv-attn-title { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
        .sv-attn-bar { width: 3px; height: 15px; background: ${RED}; border-radius: 2px; }
        .sv-attn-viewall { font-size: 12px; color: ${ACCENT}; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 3px; }
        .sv-attn-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .sv-attn-row + .sv-attn-row { border-top: 1px solid ${BORDER}; }
        .sv-attn-row:active { background: rgba(255,255,255,0.03); }
        .sv-attn-ico { width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .sv-attn-main { flex: 1; min-width: 0; }
        .sv-attn-num { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; }
        .sv-attn-desc { font-size: 11px; color: #555; margin-top: 1px; }
        .sv-attn-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .sv-attn-wait { font-size: 13px; font-weight: 700; color: ${RED}; }

        /* ── Section label ── */
        .sv-sec-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #777; margin-bottom: 8px; padding: 0 2px; }

        /* ── Ticket group card ── */
        .sv-grp { background: ${CARD}; border-radius: 12px; overflow: hidden; margin-bottom: 18px; }
        .sv-row { display: flex; align-items: center; gap: 11px; padding: 12px 14px; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.1s; }
        .sv-row + .sv-row { border-top: 1px solid ${BORDER}; }
        .sv-row:active { background: rgba(255,255,255,0.03); }
        .sv-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .sv-row-main { flex: 1; min-width: 0; }
        .sv-row-num { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; }
        .sv-row-sub { font-size: 11px; color: #555; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sv-row-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .sv-pill { border-radius: 20px; padding: 4px 10px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .sv-time { font-size: 11px; color: #444; }

        /* ── Delivered row ── */
        .sv-del-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .sv-del-row + .sv-del-row { border-top: 1px solid ${BORDER}; }
        .sv-del-row:active { background: rgba(255,255,255,0.03); }
        .sv-del-num { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; }
        .sv-del-sub { font-size: 11px; color: #444; margin-top: 2px; }
        .sv-del-pill { display: inline-block; border-radius: 6px; padding: 4px 10px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.05); color: #555; border: 1px solid #2a2a2a; }

        /* ── Bottom Nav ── */
        .sv-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: #0a0a0a; border-top: 1px solid ${BORDER}; display: flex; align-items: center; justify-content: space-around; padding: 10px 0 20px; z-index: 100; }
        .sv-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; padding: 4px 12px; -webkit-tap-highlight-color: transparent; }
        .sv-nav-lbl { font-size: 10px; color: #444; font-weight: 600; letter-spacing: 0.5px; }
        .sv-nav-lbl.active { color: ${ACCENT}; }
        .sv-nav-plus { width: 52px; height: 52px; border-radius: 50%; background: ${ACCENT}; display: flex; align-items: center; justify-content: center; margin-top: -22px; box-shadow: 0 4px 20px rgba(200,240,75,0.35); cursor: pointer; -webkit-tap-highlight-color: transparent; }

        .sv-empty { text-align: center; padding: 28px; color: #2e2e2e; font-size: 12px; letter-spacing: 1px; }

        @keyframes sv-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .sv-body > * { animation: sv-in 0.2s ease both; }
      `}</style>

      <div className="sv">

        {/* Header */}
        <div className="sv-hdr">
          <div className="sv-hdr-l">
            <button className="sv-burger" onClick={onSignOut}>
              <span /><span /><span />
            </button>
            <div>
              <div className="sv-logo">VLTD</div>
              <div className="sv-sub"><b>{fullName}</b> • SUPERVISOR</div>
            </div>
          </div>
          <div className="sv-hdr-r">
            {!isClockedIn && <span className="sv-clk-lbl">NOT CLOCKED IN ›</span>}
            <button
              className={`sv-clk-btn${isClockedIn ? " out" : ""}`}
              onClick={isClockedIn ? onClockOut : onClockIn}
            >
              {isClockedIn ? "CLOCK OUT" : "CLOCK IN"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="sv-body">

          {/* New Ticket */}
          <button className="sv-new" onClick={onNewTicket}>
            <span className="sv-new-ico">+</span>
            NEW TICKET
          </button>

          {/* Stats */}
          <div className="sv-stats">
            <div className="sv-stat">
              <div className="sv-stat-ico" style={{ background: "rgba(200,240,75,0.1)" }}>
                <IconCar color={ACCENT} size={20} />
              </div>
              <div className="sv-stat-lbl">ACTIVE</div>
              <div className="sv-stat-val">{active.length}</div>
              <div className="sv-stat-sub">Today</div>
            </div>
            <div className="sv-stat">
              <div className="sv-stat-ico" style={{ background: "rgba(255,180,0,0.1)" }}>
                <IconKey color={ORANGE} size={20} />
              </div>
              <div className="sv-stat-lbl">RETRIEVING</div>
              <div className="sv-stat-val" style={{ color: active.filter(t => t.status === "retrieving").length > 0 ? ORANGE : "#fff" }}>
                {active.filter(t => t.status === "retrieving").length}
              </div>
              <div className="sv-stat-sub">Now</div>
            </div>
            <div className="sv-stat">
              <div className="sv-stat-ico" style={{ background: "rgba(231,76,60,0.1)" }}>
                <IconAlert color={RED} size={20} />
              </div>
              <div className="sv-stat-lbl">ATTENTION</div>
              <div className="sv-stat-val" style={{ color: attention.length > 0 ? RED : "#fff" }}>
                {attention.length}
              </div>
              <div className="sv-stat-sub">Needs attention</div>
            </div>
          </div>

          {/* Needs Attention */}
          {attention.length > 0 && (
            <div className="sv-attn-wrap">
              <div className="sv-attn-hdr">
                <div className="sv-attn-title">
                  <span className="sv-attn-bar" />
                  NEEDS ATTENTION
                </div>
                <div className="sv-attn-viewall">View all ›</div>
              </div>
              {attention.map(t => {
                const missing = isMissingInfo(t);
                const waitMs  = getWaitMs(t);
                return (
                  <div key={t.id} className="sv-attn-row" onClick={() => onViewTicket?.(t)}>
                    <div className="sv-attn-ico"><IconClock color={RED} size={28} /></div>
                    <div className="sv-attn-main">
                      <div className="sv-attn-num">{ticketNum(t)}</div>
                      <div className="sv-attn-desc">
                        {missing ? "Missing information" : `Waiting > ${formatWaitMin(waitMs)}`}
                      </div>
                    </div>
                    <div className="sv-attn-right">
                      {!missing && <span className="sv-attn-wait">{formatWaitMin(waitMs)}</span>}
                      <IconChevron color="#444" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Today */}
          <div className="sv-sec-lbl">ACTIVE TODAY ({sorted.length})</div>
          {sorted.length === 0
            ? <div className="sv-empty">No active tickets</div>
            : (
              <div className="sv-grp">
                {sorted.map(t => {
                  const cfg = STATUS[t.status] || STATUS.ticketed;
                  const by  = t.createdBy || t.parkedBy || "";
                  return (
                    <div key={t.id} className="sv-row" onClick={() => onViewTicket?.(t)}>
                      <span className="sv-dot" style={{ background: cfg.dot }} />
                      <div className="sv-row-main">
                        <div className="sv-row-num">{ticketNum(t)}</div>
                        <div className="sv-row-sub">{cfg.label.charAt(0) + cfg.label.slice(1).toLowerCase()}{by ? ` • ${by}` : ""}</div>
                      </div>
                      <div className="sv-row-right">
                        <span className="sv-pill" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        <span className="sv-time">{formatTime(t.time)}</span>
                        <IconChevron />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }

          {/* Delivered Today */}
          {delivered.length > 0 && (
            <>
              <div className="sv-sec-lbl">DELIVERED TODAY ({delivered.length})</div>
              <div className="sv-grp">
                {delivered.map(t => (
                  <div key={t.id} className="sv-del-row" onClick={() => onViewTicket?.(t)}>
                    <div>
                      <div className="sv-del-num">{ticketNum(t)}</div>
                      <div className="sv-del-sub">
                        {[t.color, t.make, t.model].filter(Boolean).join(" ") || "No details"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}>
                      <div>
                        <div className="sv-del-pill">DELIVERED</div>
                        <div className="sv-time" style={{ marginTop: 3 }}>{formatTime(t.deliveredAt || t.time)}</div>
                      </div>
                      <IconChevron />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>

        {/* Bottom Nav */}
        <nav className="sv-nav">
          <div className="sv-nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span className="sv-nav-lbl active">Dashboard</span>
          </div>
          <div className="sv-nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>
            </svg>
            <span className="sv-nav-lbl">Tickets</span>
          </div>
          <div className="sv-nav-plus" onClick={onNewTicket}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div className="sv-nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="sv-nav-lbl">Alerts</span>
          </div>
          <div className="sv-nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
            </svg>
            <span className="sv-nav-lbl">More</span>
          </div>
        </nav>

      </div>
    </>
  );
}
