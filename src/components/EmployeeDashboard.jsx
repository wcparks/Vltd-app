import { useState, useEffect } from "react";
import { db } from "../config/firebase";
import {
  collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, getDoc
} from "firebase/firestore";
import EventJoin from "./EventJoin";

const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const CARD = "#161616";
const BORDER = "#2a2a2a";

export default function EmployeeDashboard({
  valetName, valetRole, onJoinEvent, onSignOut,
  clockedIn, onClockIn, onClockOut, clockInTime
}) {
  const [activeEvents, setActiveEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [whoIsWorking, setWhoIsWorking] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [showJoin, setShowJoin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(valetRole === "manager" ? "today" : "schedule");
  const [requestNote, setRequestNote] = useState("");
  const [requestingEvent, setRequestingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [myLocations, setMyLocations] = useState([]);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [clockWindowStatus, setClockWindowStatus] = useState("not_scheduled"); // 'too_early' | 'open' | 'too_late' | 'not_scheduled'

  function today() { return new Date().toISOString().slice(0, 10); }

  // Active events
  useEffect(() => {
    const q = query(collection(db, "events"), where("active", "==", true));
    const unsub = onSnapshot(
      q,
      snap => {
        setActiveEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, []);

  // All events (for upcoming tab)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "events"),
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Upcoming = future dates (active or not)
        const upcoming = all
          .filter(e => e.date >= today())
          .sort((a, b) => a.date.localeCompare(b.date));
        setUpcomingEvents(upcoming);
      },
      (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, []);

  // My availability requests
  useEffect(() => {
    const q = query(collection(db, "availability"), where("valetName", "==", valetName));
    const unsub = onSnapshot(
      q,
      snap => {
        setMyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, [valetName]);

  // Who is working today
  useEffect(() => {
    const q = query(collection(db, "logins"), where("date", "==", today()));
    const unsub = onSnapshot(
      q,
      snap => {
        const all = snap.docs.map(d => d.data());
        const map = {};
        all.forEach(l => { map[l.name] = l; });
        setWhoIsWorking(Object.values(map).filter(l => l.role !== "manager"));
      },
      (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, []);

  // My stats
  useEffect(() => {
    const id = valetName.toLowerCase().replace(/\s+/g, "_");
    const unsub = onSnapshot(
      collection(db, "employees"),
      snap => {
        const me = snap.docs.find(d => d.id === id);
        if (me) setMyStats(me.data());
      },
      (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, [valetName]);

  // Check scheduled locations using date-keyed weekSchedule (next 14 days)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "locations"),
      snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const todayStr = new Date().toISOString().slice(0, 10);

      // Build next 14 days (starting tomorrow)
      const next14 = [];
      for (let i = 1; i <= 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        next14.push(d.toISOString().slice(0, 10));
      }

      // Find all shifts where this employee is assigned in next 14 days
      const upcomingShifts = [];
      all.forEach(loc => {
        if (!loc.active) return;
        const ws = loc.weekSchedule || {};
        next14.forEach(dateKey => {
          const daySchedule = ws[dateKey];
          if (!daySchedule?.active) return;
          if ((daySchedule.staff || []).some(s => s.name === valetName)) {
            upcomingShifts.push({
              locationId: loc.id,
              locationName: loc.name,
              address: loc.address,
              dateKey,
              startTime: daySchedule.startTime,
              endTime: daySchedule.endTime,
              staff: daySchedule.staff,
            });
          }
        });
      });

      upcomingShifts.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      setMyLocations(upcomingShifts);

      // Today's shift for clock-in check
      const todayShifts = all.flatMap(loc => {
        if (!loc.active) return [];
        const daySchedule = loc.weekSchedule?.[todayStr];
        if (!daySchedule?.active) return [];
        if (!(daySchedule.staff || []).some(s => s.name === valetName)) return [];
        return [{ ...daySchedule, locationName: loc.name }];
      });

      setIsScheduledToday(todayShifts.length > 0);

      if (todayShifts.length > 0) {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const parseTime = t => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const startMins = parseTime(todayShifts[0]?.startTime);
        const endMins = parseTime(todayShifts[0]?.endTime);
        if (startMins !== null && endMins !== null) {
          if (nowMins < startMins - 5) setClockWindowStatus("too_early");
          else if (nowMins > endMins) setClockWindowStatus("too_late");
          else setClockWindowStatus("open");
        } else {
          setClockWindowStatus("open");
        }
      } else {
        setClockWindowStatus("not_scheduled");
      }
    },
    (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, [valetName]);

  async function requestAvailability(event) {
    setSubmitting(true);
    try {
      // Check if already requested
      const existing = myRequests.find(r => r.eventId === event.id);
      if (existing) { alert("You already requested this event."); return; }
      await addDoc(collection(db, "availability"), {
        valetName,
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
        eventLocation: event.location,
        status: "pending",
        note: requestNote.trim(),
        requestedAt: Date.now(),
        time: serverTimestamp(),
      });
      setRequestingEvent(null);
      setRequestNote("");
      alert("Request sent! Your manager will confirm your spot.");
    } catch (e) {
      alert("Error sending request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function getMyRequestForEvent(eventId) {
    return myRequests.find(r => r.eventId === eventId);
  }

  if (showJoin) {
    return <EventJoin onJoin={(event) => { setShowJoin(false); onJoinEvent(event); }} onBack={() => setShowJoin(false)} />;
  }

  if (requestingEvent) {
    return (
      <div style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace", padding: 20 }}>
        <button onClick={() => setRequestingEvent(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0 }}>
          &larr; Back
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{requestingEvent.name}</div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 24 }}>{requestingEvent.location} - {requestingEvent.date}</div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#999', letterSpacing: '2px', marginBottom: 8 }}>ADD A NOTE (OPTIONAL)</div>
          <textarea
            style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", resize: 'none', outline: 'none' }}
            rows={3}
            placeholder="Any notes for your manager..."
            value={requestNote}
            onChange={e => setRequestNote(e.target.value)}
          />
        </div>

        <button
          onClick={() => requestAvailability(requestingEvent)}
          disabled={submitting}
          style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 12, padding: 15, width: '100%', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '1px', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'SENDING...' : "I'M AVAILABLE"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "sans-serif", fontSize: "22px", fontWeight: 900, color: ACCENT }}>VLTD</div>
          <div style={{ fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" }}>
            {valetName.toUpperCase()} - {valetRole.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {valetRole === "manager" && (
            <button onClick={() => onJoinEvent({ __managerTools: true })} style={{ background: "#C8F04B22", border: `1px solid ${ACCENT}44`, color: ACCENT, borderRadius: "8px", padding: "6px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
              MGR TOOLS
            </button>
          )}
          <button onClick={onSignOut} style={{ background: "transparent", border: `1px solid ${BORDER}`, color: "#999", borderRadius: "8px", padding: "6px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Manager join prompt banner */}
      {valetRole === "manager" && (
        <div style={{ background: "#0a1a00", borderBottom: `1px solid ${ACCENT}33`, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: ACCENT, letterSpacing: "1px" }}>TAP AN EVENT OR LOCATION BELOW TO JOIN AND START CREATING TICKETS</div>
        </div>
      )}

      {/* Clock in bar */}
      <div style={{ padding: "10px 16px", background: clockedIn ? "#0a1a00" : "#111", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "10px", color: clockedIn ? ACCENT : "#555" }}>
            {clockedIn ? `ON SHIFT SINCE ${new Date(clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "NOT CLOCKED IN"}
          </div>
          {!clockedIn && clockWindowStatus === "not_scheduled" && (
            <div style={{ fontSize: "9px", color: "#ff4444", marginTop: 2 }}>Not scheduled today</div>
          )}
          {!clockedIn && clockWindowStatus === "too_early" && myLocations.length > 0 && (
            <div style={{ fontSize: "9px", color: "#ffcc00", marginTop: 2 }}>
              Opens at {(() => { const t = myLocations[0]?.startTime; if (!t) return "--"; const [h,m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m}${hr >= 12 ? "pm" : "am"}`; })()}
            </div>
          )}
          {!clockedIn && clockWindowStatus === "too_late" && (
            <div style={{ fontSize: "9px", color: "#ff4444", marginTop: 2 }}>Shift has ended — contact manager</div>
          )}
          {clockedIn && myLocations.length > 0 && (
            <div style={{ fontSize: "9px", color: ACCENT, marginTop: 2 }}>{myLocations[0].locationName}</div>
          )}
        </div>
        {clockedIn ? (
          <button onClick={onClockOut} style={{ background: "#ff444422", color: "#ff4444", border: "1px solid #ff444433", borderRadius: "8px", padding: "5px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
            CLOCK OUT
          </button>
        ) : clockWindowStatus === "open" ? (
          <button onClick={onClockIn} style={{ background: "#C8F04B22", color: ACCENT, border: `1px solid ${ACCENT + "44"}`, borderRadius: "8px", padding: "5px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
            CLOCK IN
          </button>
        ) : clockWindowStatus === "too_early" ? (
          <div style={{ background: "#ffcc0011", color: "#ffcc00", border: "1px solid #ffcc0033", borderRadius: "8px", padding: "5px 12px", fontSize: "10px", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            TOO EARLY
          </div>
        ) : clockWindowStatus === "too_late" ? (
          <div style={{ background: "#ff444411", color: "#ff4444", border: "1px solid #ff444433", borderRadius: "8px", padding: "5px 12px", fontSize: "10px", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            SHIFT ENDED
          </div>
        ) : (
          <div style={{ background: "#ff444411", color: "#ff4444", border: "1px solid #ff444433", borderRadius: "8px", padding: "5px 12px", fontSize: "10px", fontFamily: "'DM Mono', monospace" }}>
            NOT SCHEDULED
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 0" }}>
        {["schedule", "today"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "9px", background: tab === t ? ACCENT : "transparent", color: tab === t ? "#000" : "#666", border: `1px solid ${tab === t ? ACCENT : BORDER}`, borderRadius: 8, fontSize: 10, fontWeight: tab === t ? 700 : 400, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>
            {t === "today" ? "Today" : "My Schedule"}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>
        {/* TODAY TAB */}
        {tab === "today" && (
          <>
            {/* My stats */}
            {myStats && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "9px", color: "#999", letterSpacing: "2px", marginBottom: "10px" }}>MY STATS (ALL TIME)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "PARKED", value: myStats.totalParked || 0 },
                    { label: "RATING", value: myStats.totalRatings > 0 ? myStats.avgRating : "--" },
                    { label: "TIPS", value: `$${(myStats.totalTips || 0).toFixed(0)}` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "22px", fontFamily: "sans-serif", fontWeight: 900, color: ACCENT }}>{value}</div>
                      <div style={{ fontSize: "8px", color: "#888", letterSpacing: "1.5px", marginTop: "3px" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active events - manager taps to join directly, staff uses passcode */}
            <div style={{ fontSize: "9px", color: "#999", letterSpacing: "2px", marginBottom: "10px" }}>ACTIVE EVENTS</div>
            {loading && <div style={{ color: "#777", fontSize: "12px", padding: "16px 0" }}>Loading...</div>}
            {!loading && activeEvents.length === 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px", textAlign: "center", marginBottom: "14px" }}>
                <div style={{ color: "#777", fontSize: "12px" }}>No active events right now.</div>
                {valetRole === "manager" && <div style={{ color: "#333", fontSize: "11px", marginTop: "6px" }}>Create one in Manager → Events.</div>}
              </div>
            )}
            {activeEvents.map(ev => (
              <div key={ev.id} style={{ background: CARD, border: `1px solid ${ACCENT}33`, borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "15px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "4px" }}>{ev.name}</div>
                    <div style={{ fontSize: "11px", color: "#999" }}>{ev.location} - {ev.date}</div>
                    {ev.startTime && ev.endTime && (
                      <div style={{ fontSize: "10px", color: ACCENT, marginTop: 2 }}>
                        {(() => { const fmt = t => { if (!t) return "--"; const [h,m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m}${hr >= 12 ? "pm" : "am"}`; }; return `${fmt(ev.startTime)} – ${fmt(ev.endTime)}`; })()}
                      </div>
                    )}
                  </div>
                  {valetRole === "manager" && (
                    <button onClick={() => onJoinEvent(ev)} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 10 }}>
                      JOIN
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* My locations today */}
            {myLocations.filter(s => s.dateKey === new Date().toISOString().slice(0,10)).length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "9px", color: "#999", letterSpacing: "2px", marginBottom: "10px" }}>MY LOCATIONS TODAY</div>
                {myLocations.filter(s => s.dateKey === new Date().toISOString().slice(0,10)).map((shift, idx) => {
                  const fmt = (t) => { if (!t) return "--"; const [h,m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m}${hr >= 12 ? "pm" : "am"}`; };
                  return (
                    <div key={idx} style={{ background: CARD, border: `1px solid ${ACCENT}33`, borderRadius: "12px", padding: "12px 14px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{shift.locationName}</div>
                          <div style={{ fontSize: "11px", color: "#999", marginTop: 2 }}>{shift.address}</div>
                          <div style={{ fontSize: "10px", color: ACCENT, marginTop: 2 }}>{fmt(shift.startTime)} - {fmt(shift.endTime)}</div>
                          {shift.staff?.length > 0 && (
                            <div style={{ fontSize: "9px", color: "#666", marginTop: 2 }}>{shift.staff.map(s => s.name).join(", ")}</div>
                          )}
                        </div>
                        <button onClick={() => onJoinEvent({ id: shift.locationId, name: shift.locationName, isLocation: true, ...shift })}
                          style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 10 }}>
                          JOIN
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manager also sees ALL active locations to join */}
            {valetRole === "manager" && (
              <ManagerLocationPicker onJoinLocation={onJoinEvent} />
            )}

            {valetRole !== "manager" && (
              <button onClick={() => setShowJoin(true)} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "16px", letterSpacing: "1px" }}>
                JOIN EVENT WITH PASSCODE
              </button>
            )}

            {/* Who is working */}
            {whoIsWorking.length > 0 && (
              <>
                <div style={{ fontSize: "9px", color: "#999", letterSpacing: "2px", marginBottom: "10px" }}>WORKING TODAY - {whoIsWorking.length}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {whoIsWorking.map(w => (
                    <div key={w.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "20px", padding: "6px 14px", fontSize: "12px", color: "#ccc" }}>
                      {w.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* SCHEDULE TAB */}
        {tab === "schedule" && (
          <>
            {myLocations.length > 0 ? (
              <>
                <div style={{ fontSize: "9px", color: ACCENT, letterSpacing: "2px", marginBottom: "10px" }}>MY UPCOMING SHIFTS</div>
                {myLocations.map((shift, idx) => {
                  const fmt = (t) => { if (!t) return "--"; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? "pm" : "am"}`; };
                  const d = new Date(shift.dateKey + "T00:00:00");
                  const dayLabel = d.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" });
                  return (
                    <div key={idx} style={{ background: "#0a1a00", border: `1px solid ${ACCENT}44`, borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
                      <div style={{ fontSize: "12px", color: ACCENT, fontWeight: 700, marginBottom: "4px" }}>{dayLabel}</div>
                      <div style={{ fontSize: "15px", color: "#fff", fontWeight: 700 }}>{shift.locationName}</div>
                      <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{shift.address}</div>
                      <div style={{ fontSize: "13px", color: ACCENT, marginTop: "6px" }}>{fmt(shift.startTime)} – {fmt(shift.endTime)}</div>
                      {shift.staff?.length > 0 && (
                        <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
                          Team: {shift.staff.map(s => s.name).join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "24px", textAlign: "center", marginBottom: "14px" }}>
                <div style={{ color: "#777", fontSize: "12px" }}>No shifts scheduled in the next 2 weeks.</div>
                <div style={{ color: "#333", fontSize: "11px", marginTop: "6px" }}>Contact your manager.</div>
              </div>
            )}

            {/* Upcoming events */}
            <div style={{ fontSize: "9px", color: "#999", letterSpacing: "2px", marginBottom: "10px", marginTop: myLocations.length > 0 ? "16px" : 0 }}>UPCOMING EVENTS</div>
            {upcomingEvents.length === 0 && (
              <div style={{ color: "#777", fontSize: "12px", textAlign: "center", padding: 32 }}>No upcoming events posted yet.</div>
            )}
            {upcomingEvents.map(ev => {
              const myReq = getMyRequestForEvent(ev.id);
              return (
                <div key={ev.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "14px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "15px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "4px" }}>{ev.name}</div>
                      <div style={{ fontSize: "11px", color: "#999" }}>{ev.location}</div>
                      <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{ev.date}</div>
                      {ev.notes && <div style={{ fontSize: "11px", color: "#777", marginTop: "4px", fontStyle: "italic" }}>"{ev.notes}"</div>}
                      {ev.spotsNeeded && <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>{ev.spotsNeeded} valets needed</div>}
                    </div>
                    <div style={{ marginLeft: 10 }}>
                      {!myReq && !ev.shiftClosed && (
                        <button onClick={() => setRequestingEvent(ev)}
                          style={{ background: "#C8F04B22", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "8px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                          I'm Available
                        </button>
                      )}
                      {myReq?.status === "pending" && (
                        <div style={{ background: "#ffcc0011", color: "#ffcc00", border: "1px solid #ffcc0033", borderRadius: 8, padding: "6px 12px", fontSize: 10, textAlign: "center" }}>PENDING</div>
                      )}
                      {myReq?.status === "confirmed" && (
                        <div style={{ background: "#C8F04B22", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: "6px 12px", fontSize: 10, textAlign: "center", fontWeight: 700 }}>CONFIRMED</div>
                      )}
                      {myReq?.status === "denied" && (
                        <div style={{ background: "#ff444411", color: "#ff4444", border: "1px solid #ff444433", borderRadius: 8, padding: "6px 12px", fontSize: 10, textAlign: "center" }}>DENIED</div>
                      )}
                    </div>
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

// -- Manager-only: shows all active locations to join directly --
function ManagerLocationPicker({ onJoinLocation }) {
  const [locs, setLocs] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "locations"),
      snap => {
        setLocs(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.active));
      },
      (error) => { console.error("SNAPSHOT ERROR:", error); }
    );
    return unsub;
  }, []);

  if (locs.length === 0) return null;

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "9px", color: "#999", letterSpacing: "2px", marginBottom: "10px" }}>ACTIVE LOCATIONS</div>
      {locs.map(loc => (
        <div key={loc.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{loc.name}</div>
              <div style={{ fontSize: "11px", color: "#999", marginTop: 2 }}>{loc.address}</div>
            </div>
            <button
              onClick={() => onJoinLocation({ id: loc.id, name: loc.name, isLocation: true })}
              style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 10 }}
            >
              JOIN
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
