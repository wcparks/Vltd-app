// src/components/SupervisorView.jsx
// Supervisor dashboard — matches VLTD app aesthetic from screenshot
// Smart auto-sorting: missing info → waiting too long → retrieving → parked → ticketed
//
// PROPS:
//   user         — { name, role } from auth state
//   tickets      — live Firestore ticket array for current event
//   onSignOut    — sign out handler
//   onNewTicket  — handler to create new ticket (same as valet flow)
//   onViewTicket — handler to open TicketView.jsx with a ticket
//   onClockIn    — clock in handler
//   onClockOut   — clock out handler
//   isClockedIn  — boolean

import React, { useMemo, useState, useEffect } from "react";

const ACCENT   = "#C8F04B";
const BG       = "#0D0D0D";
const CARD_BG  = "#161616";
const BORDER   = "#222";

// ── Helpers ────────────────────────────────────────────────────────────────

function toMs(val) {
  if (!val) return null;
  if (typeof val === "number") return val;
  if (val.toMillis) return val.toMillis();
  if (val.seconds)  return val.seconds * 1000;
  return new Date(val).getTime();
}

function isMissingInfo(ticket) {
  return !ticket.make || !ticket.color || !ticket.spot;
}

function getWaitMs(ticket) {
  const start = toMs(ticket.retrievingAt);
  if (!start) return 0;
  return Date.now() - start;
}

function formatWait(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1 min";
  return `${mins} min`;
}

function formatTime(val) {
  const ms = toMs(val);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getPriority(ticket) {
  if (isMissingInfo(ticket))                        return 0;
  if (getWaitMs(ticket) > 5 * 60 * 1000)           return 1;
  if (ticket.status === "retrieving")               return 2;
  if (ticket.status === "parked")                   return 3;
  return 4; // ticketed
}

function isAttention(ticket) {
  return isMissingInfo(ticket) || getWaitMs(ticket) > 5 * 60 * 1000;
}

const STATUS_CONFIG = {
  parked:     { label: "PARKED",     bg: "rgba(200,240,75,0.15)",  color: ACCENT,    dot: ACCENT },
  retrieving: { label: "RETRIEVING", bg: "rgba(255,180,0,0.12)",   color: "#FFB400", dot: "#FFB400" },
  ticketed:   { label: "TICKETED",   bg: "rgba(255,255,255,0.06)", color: "#888",    dot: "#FFB400" },
  delivered:  { label: "DELIVERED",  bg: "rgba(255,255,255,0.05)", color: "#555",    dot: "#333" },
};

// ── Root Component ──────────────────────────────────────────────────────────

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
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const activeTickets    = useMemo(() => tickets.filter(t => t.status !== "delivered"), [tickets]);
  const deliveredTickets = useMemo(() => tickets.filter(t => t.status === "delivered"), [tickets]);

  const attentionTickets = useMemo(() =>
    activeTickets
      .filter(isAttention)
      .sort((a, b) => {
        const aMissing = isMissingInfo(a) ? 0 : 1;
        const bMissing = isMissingInfo(b) ? 0 : 1;
        if (aMissing !== bMissing) return aMissing - bMissing;
        return getWaitMs(b) - getWaitMs(a);
      }),
    [activeTickets]
  );

  const sortedActive = useMemo(() =>
    [...activeTickets].sort((a, b) => getPriority(a) - getPriority(b)),
    [activeTickets]
  );

  const stats = {
    active:     activeTickets.length,
    retrieving: activeTickets.filter(t => t.status === "retrieving").length,
    attention:  attentionTickets.length,
  };

  const displayName = user?.name
    ? user.name.charAt(0).toUpperCase() + user.name.slice(1).toLowerCase()
    : "Supervisor";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sv { min-height: 100vh; background: ${BG}; color: #fff; font-family: 'Barlow', sans-serif; display: flex; flex-direction: column; max-width: 480px; margin: 0 auto; }

        .sv-header { padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${BORDER}; background: #0a0a0a; gap: 12px; }
        .sv-header-left { display: flex; align-items: center; gap: 14px; }
        .sv-menu { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; }
        .sv-menu span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; }
        .sv-brand-name { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: ${ACCENT}; letter-spacing: 1px; line-height: 1; }
        .sv-brand-sub { font-size: 10px; font-weight: 600; color: #555; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
        .sv-brand-sub b { color: #888; font-weight: 600; }

        .sv-clock { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .sv-clock-label { font-size: 10px; font-weight: 600; color: #444; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; }
        .sv-clock-btn { background: ${ACCENT}; color: ${BG}; border: none; border-radius: 6px; padding: 8px 14px; font-family: 'Barlow', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .sv-clock-btn.out { background: transparent; border: 1px solid #2a2a2a; color: #555; }

        .sv-body { flex: 1; overflow-y: auto; padding: 16px 14px 100px; }

        .sv-new-btn { width: 100%; background: ${ACCENT}; color: ${BG}; border: none; border-radius: 10px; padding: 15px; font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
        .sv-new-btn:active { opacity: 0.88; }
        .sv-new-icon { width: 26px; height: 26px; border-radius: 50%; background: ${BG}; color: ${ACCENT}; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; line-height: 1; flex-shrink: 0; }

        .sv-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 20px; }
        .sv-stat { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 8px; text-align: center; }
        .sv-stat-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; margin: 0 auto 6px; }
        .sv-stat-val { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; line-height: 1; }
        .sv-stat-lbl { font-size: 9px; font-weight: 700; color: #555; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; }
        .sv-stat-sub { font-size: 9px; color: #3a3a3a; margin-top: 2px; }

        .sv-sec-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .sv-sec-title { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
        .sv-sec-bar { width: 3px; height: 14px; border-radius: 2px; }
        .sv-sec-count { font-size: 12px; color: #555; font-weight: 400; font-family: 'Barlow', sans-serif; }

        .sv-ticket { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 11px; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.1s; }
        .sv-ticket:active { background: #1c1c1c; }
        .sv-ticket.attn { border-color: rgba(192,57,43,0.45); }
        .sv-tdot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .sv-tmain { flex: 1; min-width: 0; }
        .sv-tnum { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; }
        .sv-tsub { font-size: 11px; color: #555; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sv-tsub.warn { color: #c0392b; }
        .sv-tright { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .sv-pill { border-radius: 20px; padding: 3px 9px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .sv-ttime { font-size: 11px; color: #444; }
        .sv-tchev { color: #2e2e2e; font-size: 16px; margin-left: 2px; }

        .sv-del { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .sv-del:active { background: #1c1c1c; }
        .sv-del-pill { display: inline-block; border-radius: 6px; padding: 4px 10px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.05); color: #555; border: 1px solid #222; }

        .sv-empty { text-align: center; padding: 24px; color: #2e2e2e; font-size: 12px; letter-spacing: 1px; }

        @keyframes sv-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .sv-body > * { animation: sv-in 0.2s ease both; }
      `}</style>

      <div className="sv">

        {/* Header */}
        <div className="sv-header">
          <div className="sv-header-left">
            <button className="sv-menu" onClick={onSignOut} title="Sign out">
              <span /><span /><span />
            </button>
            <div>
              <div className="sv-brand-name">VLTD</div>
              <div className="sv-brand-sub"><b>{displayName}</b> • SUPERVISOR</div>
            </div>
          </div>
          <div className="sv-clock">
            {!isClockedIn && <span className="sv-clock-label">NOT CLOCKED IN ›</span>}
            <button
              className={`sv-clock-btn${isClockedIn ? " out" : ""}`}
              onClick={isClockedIn ? onClockOut : onClockIn}
            >
              {isClockedIn ? "CLOCK OUT" : "CLOCK IN"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="sv-body">

          {/* New Ticket */}
          <button className="sv-new-btn" onClick={onNewTicket}>
            <span className="sv-new-icon">+</span>
            NEW TICKET
          </button>

          {/* Stats */}
          <div className="sv-stats">
            <div className="sv-stat">
              <div className="sv-stat-icon" style={{ background: "rgba(200,240,75,0.1)" }}>🚗</div>
              <div className="sv-stat-val">{stats.active}</div>
              <div className="sv-stat-lbl">Active</div>
              <div className="sv-stat-sub">Today</div>
            </div>
            <div className="sv-stat">
              <div className="sv-stat-icon" style={{ background: "rgba(255,180,0,0.1)" }}>🔑</div>
              <div className="sv-stat-val" style={{ color: stats.retrieving > 0 ? "#FFB400" : "#fff" }}>{stats.retrieving}</div>
              <div className="sv-stat-lbl">Retrieving</div>
              <div className="sv-stat-sub">Now</div>
            </div>
            <div
              className="sv-stat"
              style={{ borderColor: stats.attention > 0 ? "rgba(192,57,43,0.4)" : BORDER }}
            >
              <div className="sv-stat-icon" style={{ background: "rgba(192,57,43,0.1)" }}>⚠</div>
              <div className="sv-stat-val" style={{ color: stats.attention > 0 ? "#e74c3c" : "#fff" }}>{stats.attention}</div>
              <div className="sv-stat-lbl">Attention</div>
              <div className="sv-stat-sub">Needs attention</div>
            </div>
          </div>

          {/* Needs Attention */}
          {attentionTickets.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="sv-sec-hd">
                <div className="sv-sec-title">
                  <span className="sv-sec-bar" style={{ background: "#c0392b" }} />
                  NEEDS ATTENTION
                </div>
              </div>
              {attentionTickets.map(t => (
                <TicketRow key={t.id} ticket={t} attention onTap={() => onViewTicket?.(t)} />
              ))}
            </div>
          )}

          {/* Active Today */}
          <div style={{ marginBottom: 20 }}>
            <div className="sv-sec-hd">
              <div className="sv-sec-title">
                <span className="sv-sec-bar" style={{ background: ACCENT }} />
                ACTIVE TODAY
                <span className="sv-sec-count">({sortedActive.length})</span>
              </div>
            </div>
            {sortedActive.length === 0
              ? <div className="sv-empty">No active tickets</div>
              : sortedActive.map(t => (
                  <TicketRow key={t.id} ticket={t} onTap={() => onViewTicket?.(t)} />
                ))
            }
          </div>

          {/* Delivered Today */}
          {deliveredTickets.length > 0 && (
            <div>
              <div className="sv-sec-hd">
                <div className="sv-sec-title">
                  <span className="sv-sec-bar" style={{ background: "#2a2a2a" }} />
                  DELIVERED TODAY
                  <span className="sv-sec-count">({deliveredTickets.length})</span>
                </div>
              </div>
              {deliveredTickets.map(t => (
                <div key={t.id} className="sv-del" onClick={() => onViewTicket?.(t)}>
                  <div>
                    <div className="sv-tnum">#{String(t.ticketNum || t.id || "0000").padStart(4, "0")}</div>
                    <div className="sv-tsub">
                      {[t.color, t.make, t.model].filter(Boolean).join(" ") || "No details"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="sv-del-pill">DELIVERED</div>
                    <div className="sv-ttime" style={{ marginTop: 3 }}>{formatTime(t.deliveredAt || t.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── TicketRow ───────────────────────────────────────────────────────────────

function TicketRow({ ticket, attention = false, onTap }) {
  const missing  = isMissingInfo(ticket);
  const waitMs   = getWaitMs(ticket);
  const longWait = waitMs > 5 * 60 * 1000;
  const cfg      = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.ticketed;
  const numStr   = "#" + String(ticket.ticketNum || ticket.id || "0000").padStart(4, "0");

  let subText = [ticket.color, ticket.make, ticket.model].filter(Boolean).join(" ") || "No details";
  let subWarn = false;

  if (missing)        { subText = "Missing information"; subWarn = true; }
  else if (longWait)  { subText = `Waiting > ${formatWait(waitMs)}`;  subWarn = true; }

  const byName = ticket.createdBy || ticket.parkedBy || "";

  return (
    <div className={`sv-ticket${attention ? " attn" : ""}`} onClick={onTap}>
      <span className="sv-tdot" style={{ background: cfg.dot }} />
      <div className="sv-tmain">
        <div className="sv-tnum">{numStr}</div>
        <div className={`sv-tsub${subWarn ? " warn" : ""}`}>
          {subText}{byName ? ` • ${byName}` : ""}
        </div>
      </div>
      <div className="sv-tright">
        <span className="sv-pill" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
        <span className="sv-ttime">{formatTime(ticket.time)}</span>
      </div>
      <span className="sv-tchev">›</span>
    </div>
  );
}
