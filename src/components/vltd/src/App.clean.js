import { useEffect, useState, useRef } from "react";
import { db, messaging, requestNotificationPermission, onMessage } from "./firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, where
} from "firebase/firestore";
import { QRCodeSVG as QRCode } from "qrcode.react";

// -- New feature imports ------------------------------------
import EventJoin from "./components/EventJoin";
import EventManager from "./components/EventManager";
import CashierView from "./components/CashierView";
import PhotoCapture, { PhotoViewer } from "./components/PhotoCapture";
import CarAutocomplete from "./components/CarAutocomplete";
import ReviewsPage from "./components/ReviewsPage";
import EmployeeProfiles, { upsertEmployee, incrementStat, updateRating } from "./components/EmployeeProfiles";
import PrivacyPage from "./components/PrivacyPage";
import { getNextTicketNumber } from "./events";
import { sendWhatsApp } from "./notify";

const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const CARD = "#161616";
const BORDER = "#2a2a2a";
const MANAGER_PIN = "0000";
const VALET_PIN = "1111";
const CASHIER_PIN = "2222"; // <- change this to whatever you want

const S = {
  app: { background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" },
  header: { padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontFamily: "sans-serif", fontSize: "20px", fontWeight: 900, color: ACCENT },
  sub: { fontSize: "9px", color: "#555", letterSpacing: "2px", marginTop: "2px" },
  content: { padding: "20px" },
  input: { width: "100%", background: "#111", border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "12px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "13px", marginBottom: "10px", outline: "none", boxSizing: "border-box" },
  btn: { background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "14px", width: "100%", fontFamily: "sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer", marginBottom: "8px", letterSpacing: "1px" },
  btnRed: { background: "#ff444422", color: "#ff4444", border: "1px solid #ff444433", borderRadius: "12px", padding: "14px", width: "100%", fontFamily: "sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" },
  btnOutline: { background: "transparent", color: "#666", border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontSize: "11px", cursor: "pointer" },
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", marginBottom: "12px" },
  label: { fontSize: "8px", color: "#555", letterSpacing: "2px", marginBottom: "6px" },
  badge: (s) => ({
    display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "9px", letterSpacing: "1px",
    background: s === "parked" ? "#1a2a0a" : s === "retrieving" ? "#1a1500" : s === "delivered" ? "#111" : "#1a1a2a",
    color: s === "parked" ? ACCENT : s === "retrieving" ? "#ffcc00" : s === "delivered" ? "#444" : "#aaa",
    border: `1px solid ${s === "parked" ? ACCENT + "44" : s === "retrieving" ? "#ffcc0044" : "#33333344"}`
  }),
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "24px" },
};

function today() { return new Date().toISOString().slice(0, 10); }

function processImage(file, ticketId, onDone) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const MAX = 800;
    let w = img.width, h = img.height;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const photo = canvas.toDataURL("image/jpeg", 0.7);
    URL.revokeObjectURL(url);
    onDone(photo);
    if (ticketId) updateDoc(doc(db, "tickets", ticketId), { photoURL: photo }).catch(() => {});
  };
  img.onerror = () => { URL.revokeObjectURL(url); onDone(null); };
  img.src = url;
}

export default function App() {
  const [valetName, setValetName] = useState(localStorage.getItem("valetName") || "");
  const [valetRole, setValetRole] = useState(localStorage.getItem("valetRole") || "");
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [tickets, setTickets] = useState([]);
  const [logins, setLogins] = useState([]);
  const [view, setView] = useState("dashboard");
  const [activeTicket, setActiveTicket] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [newTicket, setNewTicket] = useState(null);

  // -- carDetails replaces separate plate/car/color fields --
  const [carDetails, setCarDetails] = useState({ make: "", model: "", color: "", plate: "" });
  const [form, setForm] = useState({ spot: "", damage: "" });
  const [ticketPhotos, setTicketPhotos] = useState([]); // multi-photo array
  const [formPhoto, setFormPhoto] = useState("");       // cover photo (backwards compat)

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [retrievingAlert, setRetrievingAlert] = useState(null);

  // -- Event / location state --------------------------------
  const [currentEvent, setCurrentEvent] = useState(() => {
    try { return JSON.parse(localStorage.getItem("currentEvent")) || null; } catch { return null; }
  });

  // -- View routing for new pages ----------------------------
  // e.g. "reviews", "employees", "eventManager"
  const [subView, setSubView] = useState(null);

  const photoRef = useRef();
  const formPhotoRef = useRef();
  const prevTicketsRef = useRef({});

  // -- Ticket listener -- scoped to event if valet/cashier ---
  useEffect(() => {
    let q;
    if (valetRole === "manager") {
      q = query(collection(db, "tickets"), orderBy("time", "desc"));
    } else if (currentEvent) {
      q = query(
        collection(db, "tickets"),
        where("eventId", "==", currentEvent.id),
        orderBy("time", "desc")
      );
    } else {
      // Not in an event yet -- show nothing
      setTickets([]);
      return;
    }
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.forEach(ticket => {
        const prev = prevTicketsRef.current[ticket.id];
        if (prev && prev.status !== "retrieving" && ticket.status === "retrieving") {
          playAlert();
          setRetrievingAlert(ticket);
          setTimeout(() => setRetrievingAlert(null), 8000);
        }
      });
      const newRef = {};
      data.forEach(t => newRef[t.id] = t);
      prevTicketsRef.current = newRef;
      setTickets(data);
    });
  }, [valetRole, currentEvent]);

  useEffect(() => {
    const q = query(collection(db, "logins"), orderBy("time", "desc"));
    return onSnapshot(q, (snap) => {
      setLogins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (!valetName) return;
    try {
      const unsub = onMessage(messaging, (payload) => {
        playAlert();
        const t = tickets.find(t => t.confirmCode === payload.data?.confirmCode);
        if (t) setRetrievingAlert(t);
        else setRetrievingAlert({ ticketNum: payload.data?.ticketNum || "??", car: payload.notification?.body || "", color: "", spot: "", customerName: "" });
        setTimeout(() => setRetrievingAlert(null), 8000);
      });
      return () => unsub();
    } catch (e) {}
  }, [valetName, tickets]);

  function playAlert() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.15, 0.3].forEach((time, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 600 + (i * 100);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.12);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + 0.12);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  }

  // -- LOGIN -------------------------------------------------
  const login = async () => {
    if (!nameInput.trim()) return;
    const role = pinInput === MANAGER_PIN ? "manager"
      : pinInput === VALET_PIN ? "valet"
      : pinInput === CASHIER_PIN ? "cashier"
      : null;
    if (!role) { setPinError("Incorrect PIN. Contact your manager."); return; }

    await addDoc(collection(db, "logins"), {
      name: nameInput.trim(), role, time: serverTimestamp(), date: today()
    });

    // Create/update employee profile for valet and cashier
    if (role === "valet" || role === "cashier") {
      await upsertEmployee(nameInput.trim()).catch(() => {});
    }

    try {
      const token = await requestNotificationPermission(nameInput.trim());
      if (token) await addDoc(collection(db, "valetTokens"), {
        name: nameInput.trim(), role, token, date: today(), time: serverTimestamp()
      });
    } catch (e) {}

    localStorage.setItem("valetName", nameInput.trim());
    localStorage.setItem("valetRole", role);
    setValetName(nameInput.trim());
    setValetRole(role);
  };

  // -- JOIN EVENT (called by EventJoin component) ------------
  const handleJoinEvent = (event) => {
    setCurrentEvent(event);
    localStorage.setItem("currentEvent", JSON.stringify(event));
  };

  // -- SIGN OUT ----------------------------------------------
  const signOut = () => {
    localStorage.removeItem("valetName");
    localStorage.removeItem("valetRole");
    localStorage.removeItem("currentEvent");
    setValetName(""); setValetRole(""); setCurrentEvent(null);
  };

  // -- CREATE TICKET -----------------------------------------
  const createTicket = async () => {
    setLoading(true);
    let num, code;

    if (currentEvent) {
      // Per-event sequential number
      num = await getNextTicketNumber(currentEvent.id);
      code = `VLT-${currentEvent.id.slice(0, 6)}-${num}`;
    } else {
      // Manager creating outside of event -- fallback to date-based
      num = String((tickets || []).filter(t => t.date === today()).length + 1).padStart(4, "0");
      code = `VLT-${today()}-${num}`;
    }

    const docRef = await addDoc(collection(db, "tickets"), {
      ticketNum: num,
      confirmCode: code,
      date: today(),
      eventId: currentEvent?.id || null,
      eventName: currentEvent?.name || null,
      createdBy: valetName,
      parkedBy: "",
      plate: "", car: "", color: "", spot: "", damage: "",
      photoURL: "",
      photos: [],       // multi-photo array
      customerName: "", customerPhone: "",
      status: "ticketed",
      tip: 0, rating: 0, review: "",
      time: serverTimestamp(),
    });

    setNewTicket({ code, num, id: docRef.id, photoURL: "" });
    setLoading(false);
    setShowCamera(false);
    setShowQR(true); // go straight to QR -- camera is now in details form via PhotoCapture
  };

  // -- SAVE DETAILS ------------------------------------------
  const saveDetails = async () => {
    if (!activeTicket) return;

    // Build the car string from CarAutocomplete for backwards compat display
    const carString = [carDetails.make, carDetails.model].filter(Boolean).join(" ");
    const coverPhoto = ticketPhotos[0]?.dataUrl || formPhoto || activeTicket.photoURL || "";

    await updateDoc(doc(db, "tickets", activeTicket.id), {
      plate: carDetails.plate || form.plate || "",
      car: carString || form.car || "",
      make: carDetails.make || "",
      model: carDetails.model || "",
      color: carDetails.color || form.color || "",
      spot: form.spot || "",
      damage: form.damage || "",
      photoURL: coverPhoto,
      photos: ticketPhotos,
      parkedBy: valetName,
      status: "parked",
    });

    // Track stat
    await incrementStat(valetName, "parked").catch(() => {});

    // WhatsApp the customer if they have a phone
    if (activeTicket.customerPhone) {
      await sendWhatsApp({
        type: "ticket_created",
        phone: activeTicket.customerPhone,
        ticketNumber: activeTicket.ticketNum,
        customerName: activeTicket.customerName,
        ticketUrl: ticketURL(activeTicket.confirmCode),
        venueName: currentEvent?.name || "Valet",
      });
    }

    setView("dashboard");
    setCarDetails({ make: "", model: "", color: "", plate: "" });
    setForm({ spot: "", damage: "" });
    setTicketPhotos([]);
    setFormPhoto("");
  };

  const markRetrieving = async (id) => {
    await updateDoc(doc(db, "tickets", id), { status: "retrieving" });
    try {
      const ticket = tickets.find(t => t.id === id);
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketNum: ticket?.ticketNum, car: ticket?.car,
          color: ticket?.color, spot: ticket?.spot,
          customerName: ticket?.customerName,
        }),
      });
    } catch (e) { console.error("notify failed:", e); }
  };

  const markDelivered = async (id) => {
    await updateDoc(doc(db, "tickets", id), { status: "delivered", deliveredAt: Date.now() });
    // Track retrieved stat for the valet who retrieved it
    await incrementStat(valetName, "retrieved").catch(() => {});

    // WhatsApp the customer
    const ticket = tickets.find(t => t.id === id);
    if (ticket?.customerPhone) {
      await sendWhatsApp({
        type: "car_ready",
        phone: ticket.customerPhone,
        ticketNumber: ticket.ticketNum,
        customerName: ticket.customerName,
        ticketUrl: ticketURL(ticket.confirmCode),
        valetName,
      });
    }
  };

  const deleteTicket = async (id) => {
    if (valetRole !== "manager") { alert("Only managers can delete tickets."); return; }
    if (window.confirm("Delete this ticket?")) {
      await deleteDoc(doc(db, "tickets", id));
      setView("dashboard");
    }
  };

  const ticketURL = (code) => `https://valet-app-woad.vercel.app/ticket?code=${encodeURIComponent(code)}`;

  const filteredTickets = search ? tickets.filter(t => {
    const s = search.toLowerCase();
    return (t.plate || "").toLowerCase().includes(s) || (t.car || "").toLowerCase().includes(s) ||
      (t.customerName || "").toLowerCase().includes(s) || (t.ticketNum || "").includes(s) ||
      (t.spot || "").toLowerCase().includes(s) || (t.color || "").toLowerCase().includes(s);
  }) : [];

  const todayTickets = tickets.filter(t => t.date === today());
  const totalTips = todayTickets.reduce((sum, t) => sum + (t.tip || 0), 0);
  const ratedTickets = todayTickets.filter(t => t.rating > 0);
  const avgRating = ratedTickets.length > 0
    ? (ratedTickets.reduce((sum, t) => sum + t.rating, 0) / ratedTickets.length).toFixed(1) : "--";
  const deliveredCount = todayTickets.filter(t => t.status === "delivered").length;
  const activeCount = todayTickets.filter(t => t.status !== "delivered").length;

  // -- ROUTE: /privacy ---------------------------------------
  if (window.location.pathname === "/privacy") return <PrivacyPage />;

  // -- ROUTE: /reviews (public) ------------------------------
  if (window.location.pathname === "/reviews") return <ReviewsPage isManager={valetRole === "manager"} />;

  // ---------------------------------------------------------
  // LOGIN SCREEN
  // ---------------------------------------------------------
  if (!valetName) return (
    <div style={{ ...S.app, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", minHeight: "100vh" }}>
      <div style={{ ...S.logo, fontSize: "36px", marginBottom: "8px" }}>VLTD</div>
      <div style={{ ...S.sub, marginBottom: "48px" }}>VALET - REDEFINED</div>
      <div style={{ width: "100%", maxWidth: "320px" }}>
        <div style={S.label}>YOUR NAME</div>
        <input style={S.input} placeholder="Enter your name..." value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <div style={S.label}>ACCESS PIN</div>
        <input style={S.input} placeholder="Enter PIN..." type="password" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(""); }} onKeyDown={e => e.key === "Enter" && login()} />
        {pinError && <div style={{ color: "#ff4444", fontSize: "11px", marginBottom: "10px" }}>{pinError}</div>}
        <button style={S.btn} onClick={login}>START SHIFT</button>
      </div>
    </div>
  );

  // ---------------------------------------------------------
  // EVENT JOIN -- valet/cashier must join an event before anything
  // Manager skips this and sees all events
  // ---------------------------------------------------------
  if ((valetRole === "valet" || valetRole === "cashier") && !currentEvent) {
    return <EventJoin onJoin={handleJoinEvent} />;
  }

  // ---------------------------------------------------------
  // CASHIER VIEW -- full separate UI
  // ---------------------------------------------------------
  if (valetRole === "cashier") {
    return <CashierView eventId={currentEvent?.id} onLogout={signOut} />;
  }

  // ---------------------------------------------------------
  // RETRIEVING ALERT
  // ---------------------------------------------------------
  if (retrievingAlert) return (
    <div style={{ ...S.overlay, background: "#0a1a00" }}>
      <div style={{ fontSize: "64px", marginBottom: "16px" }}></div>
      <div style={{ fontFamily: "sans-serif", fontSize: "24px", color: ACCENT, fontWeight: 900, marginBottom: "8px", textAlign: "center" }}>CAR REQUESTED!</div>
      <div style={{ fontSize: "40px", fontFamily: "sans-serif", fontWeight: 900, color: "#fff", marginBottom: "8px" }}>#{retrievingAlert.ticketNum}</div>
      <div style={{ fontSize: "14px", color: "#bbb", marginBottom: "4px" }}>{retrievingAlert.color} {retrievingAlert.car}</div>
      <div style={{ fontSize: "12px", color: "#777", marginBottom: "4px" }}>Spot: {retrievingAlert.spot || "--"}</div>
      {retrievingAlert.customerName && <div style={{ fontSize: "12px", color: ACCENT, marginBottom: "24px" }}> {retrievingAlert.customerName}</div>}
      <button style={{ ...S.btn, maxWidth: "280px" }} onClick={() => setRetrievingAlert(null)}>GOT IT - ON MY WAY</button>
    </div>
  );

  // ---------------------------------------------------------
  // QR OVERLAY -- shown right after ticket creation
  // ---------------------------------------------------------
  if (showQR && newTicket) return (
    <div style={S.overlay}>
      <div style={{ ...S.logo, fontSize: "24px", marginBottom: "4px" }}>VLTD</div>
      <div style={{ ...S.sub, marginBottom: "12px" }}>TICKET #{newTicket.num}</div>
      {currentEvent && (
        <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px", letterSpacing: "1px" }}>
           {currentEvent.name}
        </div>
      )}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", marginBottom: "16px" }}>
        <QRCode value={ticketURL(newTicket.code)} size={200} />
      </div>
      <div style={{ fontSize: "10px", color: "#555", marginBottom: "6px", letterSpacing: "1.5px" }}>CUSTOMER SCANS THIS</div>
      <div style={{ fontSize: "28px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900, marginBottom: "24px" }}>#{newTicket.num}</div>
      <button style={{ ...S.btn, maxWidth: "280px" }} onClick={() => {
        setShowQR(false);
        const t = tickets.find(t => t.confirmCode === newTicket.code);
        if (t) {
          setActiveTicket(t);
          setCarDetails({ make: t.make || "", model: t.model || "", color: t.color || "", plate: t.plate || "" });
          setForm({ spot: t.spot || "", damage: t.damage || "" });
          setTicketPhotos(t.photos || []);
          setFormPhoto(t.photoURL || "");
          setView("details");
        } else setView("dashboard");
      }}>FILL IN CAR DETAILS </button>
      <button style={{ ...S.btnOutline, marginTop: "10px" }} onClick={() => { setShowQR(false); setNewTicket(null); }}>SKIP - DO LATER</button>
    </div>
  );

  // ---------------------------------------------------------
  // SHIFT SUMMARY
  // ---------------------------------------------------------
  if (showShiftSummary) return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>SHIFT SUMMARY</div></div>
        <button style={S.btnOutline} onClick={() => setShowShiftSummary(false)>&larr; Back</button>
      </div>
      <div style={S.content}>
        <div style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "16px" }}>{today()}{currentEvent ? ` - ${currentEvent.name}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "TOTAL CARS", value: todayTickets.length },
            { label: "ACTIVE", value: activeCount },
            { label: "DELIVERED", value: deliveredCount },
            { label: "TOTAL TIPS", value: `$${totalTips}` },
            { label: "AVG RATING", value: `${avgRating}*` },
            { label: "VALETS", value: [...new Set(todayTickets.map(t => t.createdBy))].length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontFamily: "sans-serif", fontWeight: 900, color: ACCENT }}>{value}</div>
              <div style={{ fontSize: "8px", color: "#555", letterSpacing: "1.5px", marginTop: "6px" }}>{label}</div>
            </div>
          ))}
        </div>
        {valetRole === "manager" && (
          <>
            <div style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "12px" }}>BY VALET</div>
            {[...new Set(todayTickets.map(t => t.createdBy))].map(name => {
              const vt = todayTickets.filter(t => t.createdBy === name);
              const tips = vt.reduce((s, t) => s + (t.tip || 0), 0);
              const rated = vt.filter(t => t.rating > 0);
              const avg = rated.length > 0 ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : "--";
              return (
                <div key={name} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "14px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700 }}>{name}</div>
                      <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>{vt.length} cars - ${tips} tips - {avg}*</div>
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

  // ---------------------------------------------------------
  // DETAILS FORM -- now uses CarAutocomplete + PhotoCapture
  // ---------------------------------------------------------
  if (view === "details" && activeTicket) return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TICKET #{activeTicket.ticketNum}</div></div>
        <button style={S.btnOutline} onClick={() => setView("dashboard")>&larr; Back</button>
      </div>
      <div style={S.content}>
        {/* Car details -- replaces old plate/car/color inputs */}
        <div style={{ marginBottom: "16px" }}>
          <div style={S.label}>VEHICLE DETAILS</div>
          {/* CarAutocomplete renders on a light bg -- wrap it */}
          <div style={{ background: "#111", borderRadius: "12px", padding: "14px", border: `1px solid ${BORDER}` }}>
            <CarAutocomplete value={carDetails} onChange={setCarDetails} />
          </div>
        </div>

        {/* Spot */}
        <div style={S.label}>PARKING SPOT</div>
        <input style={S.input} placeholder="e.g. B-14" value={form.spot} onChange={e => setForm({ ...form, spot: e.target.value })} />

        {/* Damage notes */}
        <div style={S.label}>DAMAGE NOTES</div>
        <input style={S.input} placeholder="Any existing damage..." value={form.damage} onChange={e => setForm({ ...form, damage: e.target.value })} />

        {/* Multi-photo -- replaces single photo */}
        <div style={{ background: "#111", borderRadius: "12px", padding: "14px", border: `1px solid ${BORDER}`, marginBottom: "12px" }}>
          <PhotoCapture onChange={setTicketPhotos} />
        </div>

        <button style={S.btn} onClick={saveDetails}> SAVE & MARK PARKED</button>
      </div>
    </div>
  );

  // ---------------------------------------------------------
  // TICKET DETAIL -- now shows PhotoViewer
  // ---------------------------------------------------------
  if (view === "ticket" && activeTicket) return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TICKET #{activeTicket.ticketNum}</div></div>
        <button style={S.btnOutline} onClick={() => setView("dashboard")>&larr; Back</button>
      </div>
      <div style={S.content}>
        <div style={{ background: "#C8F04B15", border: `1px solid ${ACCENT}44`, borderRadius: "14px", padding: "16px", textAlign: "center", marginBottom: "16px" }}>
          <div style={S.label}>TICKET #</div>
          <div style={{ fontSize: "40px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900 }}>{activeTicket.ticketNum}</div>
          <div style={{ ...S.badge(activeTicket.status), marginTop: "8px" }}>{activeTicket.status?.toUpperCase()}</div>
          {activeTicket.eventName && (
            <div style={{ fontSize: "10px", color: "#555", marginTop: "6px", letterSpacing: "1px" }}> {activeTicket.eventName}</div>
          )}
        </div>

        {/* Photo viewer -- shows all photos if available, falls back to single */}
        {activeTicket.photos?.length > 0
          ? <div style={{ marginBottom: "12px" }}><PhotoViewer photos={activeTicket.photos} /></div>
          : activeTicket.photoURL
            ? <img src={activeTicket.photoURL} alt="car" style={{ width: "100%", borderRadius: "12px", marginBottom: "12px", maxHeight: "200px", objectFit: "cover" }} />
            : null
        }

        <div style={S.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              { label: "PLATE", value: activeTicket.plate || "--", large: true },
              { label: "SPOT", value: activeTicket.spot || "--" },
              { label: "CAR", value: activeTicket.car || "--" },
              { label: "COLOR", value: activeTicket.color || "--" },
              { label: "CREATED BY", value: activeTicket.createdBy },
              { label: "PARKED BY", value: activeTicket.parkedBy || "--" },
            ].map(({ label, value, large }) => (
              <div key={label}>
                <div style={S.label}>{label}</div>
                <div style={{ color: "#bbb", fontSize: large ? "14px" : "12px", fontWeight: large ? 700 : 400 }}>{value}</div>
              </div>
            ))}
            {activeTicket.customerName && <div style={{ gridColumn: "span 2" }}><div style={S.label}>CUSTOMER</div><div style={{ color: ACCENT, fontSize: "12px" }}>{activeTicket.customerName}</div></div>}
            {activeTicket.customerPhone && <div style={{ gridColumn: "span 2" }}><div style={S.label}>PHONE</div><div style={{ color: "#bbb", fontSize: "12px" }}>{activeTicket.customerPhone}</div></div>}
            {activeTicket.rating > 0 && <div><div style={S.label}>RATING</div><div style={{ color: ACCENT, fontSize: "12px" }}>{"*".repeat(activeTicket.rating)} ({activeTicket.rating}/5)</div></div>}
            {activeTicket.tip > 0 && <div><div style={S.label}>TIP</div><div style={{ color: ACCENT, fontSize: "14px", fontWeight: 700 }}>${activeTicket.tip}</div></div>}
          </div>
          {activeTicket.damage && <div style={{ marginTop: "12px" }}><div style={S.label}>DAMAGE NOTES</div><div style={{ color: "#888", fontSize: "11px" }}>{activeTicket.damage}</div></div>}
          {activeTicket.review && <div style={{ marginTop: "12px" }}><div style={S.label}>CUSTOMER REVIEW</div><div style={{ color: "#888", fontSize: "11px", fontStyle: "italic" }}>"{activeTicket.review}"</div></div>}
        </div>

        <div style={{ background: "#fff", padding: "14px", borderRadius: "14px", textAlign: "center", marginBottom: "12px" }}>
          <QRCode value={ticketURL(activeTicket.confirmCode)} size={160} />
          <div style={{ fontSize: "9px", color: "#999", marginTop: "8px" }}>SHOW TO CUSTOMER</div>
        </div>

        {activeTicket.status === "ticketed" && (
          <button style={S.btn} onClick={() => {
            setCarDetails({ make: activeTicket.make || "", model: activeTicket.model || "", color: activeTicket.color || "", plate: activeTicket.plate || "" });
            setForm({ spot: activeTicket.spot || "", damage: activeTicket.damage || "" });
            setTicketPhotos(activeTicket.photos || []);
            setFormPhoto(activeTicket.photoURL || "");
            setView("details");
          }}> FILL IN DETAILS</button>
        )}
        {activeTicket.status === "parked" && (
          <button style={{ ...S.btn, background: "#ffcc00", color: "#000" }} onClick={() => { markRetrieving(activeTicket.id); setView("dashboard"); }}> START RETRIEVAL</button>
        )}
        {activeTicket.status === "retrieving" && (
          <button style={S.btn} onClick={() => { markDelivered(activeTicket.id); setView("dashboard"); }}> MARK DELIVERED</button>
        )}
        {valetRole === "manager" && (
          <button style={S.btnRed} onClick={() => deleteTicket(activeTicket.id)}> DELETE TICKET</button>
        )}
        <div style={{ marginTop: "8px" }}>
          <button style={S.btnOutline} onClick={() => {
            setNewTicket({ code: activeTicket.confirmCode, num: activeTicket.ticketNum, id: activeTicket.id, photoURL: activeTicket.photoURL || "" });
            setShowQR(true);
          }}>Show QR Code</button>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------
  // MANAGER VIEW -- now includes Events, Employees, Reviews tabs
  // ---------------------------------------------------------
  if (view === "manager") {
    // Sub-views inside manager
    if (subView === "events") return (
      <div style={S.app}>
        <div style={S.header}>
          <div><div style={S.logo}>VLTD</div><div style={S.sub}>EVENTS</div></div>
          <button style={S.btnOutline} onClick={() => setSubView(null)>&larr; Back</button>
        </div>
        <div style={S.content}><EventManager /></div>
      </div>
    );

    if (subView === "employees") return (
      <div style={S.app}>
        <div style={S.header}>
          <div><div style={S.logo}>VLTD</div><div style={S.sub}>TEAM</div></div>
          <button style={S.btnOutline} onClick={() => setSubView(null)>&larr; Back</button>
        </div>
        <div style={S.content}><EmployeeProfiles /></div>
      </div>
    );

    if (subView === "reviews") return (
      <div style={S.app}>
        <div style={S.header}>
          <div><div style={S.logo}>VLTD</div><div style={S.sub}>REVIEWS</div></div>
          <button style={S.btnOutline} onClick={() => setSubView(null)>&larr; Back</button>
        </div>
        <ReviewsPage isManager={true} />
      </div>
    );

    return (
      <div style={S.app}>
        <div style={S.header}>
          <div><div style={S.logo}>VLTD</div><div style={S.sub}>MANAGER VIEW</div></div>
          <button style={S.btnOutline} onClick={() => { setView("dashboard"); setSubView(null); }>&larr; Back</button>
        </div>
        <div style={S.content}>
          {/* Manager quick-nav */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "20px" }}>
            {[
              { label: " Events", key: "events" },
              { label: "? Team", key: "employees" },
              { label: "* Reviews", key: "reviews" },
            ].map(({ label, key }) => (
              <button key={key} style={{ ...S.btnOutline, padding: "12px 8px", fontSize: "11px", textAlign: "center" }} onClick={() => setSubView(key)}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "12px" }}>VALETS ON SHIFT TODAY</div>
          {[...new Set(todayTickets.map(t => t.createdBy))].map(name => {
            const vt = todayTickets.filter(t => t.createdBy === name);
            const tips = vt.reduce((s, t) => s + (t.tip || 0), 0);
            const rated = vt.filter(t => t.rating > 0);
            const avg = rated.length > 0 ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : "--";
            const active = vt.filter(t => t.status !== "delivered").length;
            return (
              <div key={name} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "16px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "4px" }}>{name}</div>
                    <div style={{ fontSize: "10px", color: "#555" }}>{vt.length} total - {active} active</div>
                    <div style={{ fontSize: "10px", color: ACCENT, marginTop: "4px" }}>${tips} tips - {avg}*</div>
                  </div>
                  <div style={{ fontSize: "28px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900 }}>{vt.length}</div>
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", margin: "20px 0 12px" }}>ALL TICKETS TODAY</div>
          {todayTickets.map(t => (
            <div key={t.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "16px", fontFamily: "sans-serif", fontWeight: 700, color: "#fff" }}>#{t.ticketNum}</div>
                  <div style={{ fontSize: "10px", color: "#555" }}>{t.color} {t.car} - {t.createdBy}</div>
                  {t.eventName && <div style={{ fontSize: "9px", color: "#444" }}> {t.eventName}</div>}
                  {t.customerName && <div style={{ fontSize: "10px", color: ACCENT }}> {t.customerName}</div>}
                </div>
                <div style={S.badge(t.status)}>{t.status?.toUpperCase()}</div>
              </div>
            </div>
          ))}
          {todayTickets.length === 0 && <div style={{ color: "#333", fontSize: "12px", textAlign: "center", padding: "32px 0" }}>No tickets today yet.</div>}

          <div style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", margin: "20px 0 12px" }}>LOGIN LOG TODAY</div>
          {logins.filter(l => l.date === today()).length === 0 && <div style={{ color: "#333", fontSize: "12px", textAlign: "center", padding: "16px 0" }}>No logins today.</div>}
          {logins.filter(l => l.date === today()).map(l => (
            <div key={l.id} style={{ ...S.card, padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "13px", color: "#fff", fontFamily: "sans-serif", fontWeight: 700 }}>{l.name}</div>
                  <div style={{ fontSize: "9px", color: "#555", marginTop: "3px" }}>{l.role?.toUpperCase()} - {l.time?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "--"}</div>
                </div>
                <div style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "9px", background: l.role === "manager" ? "#C8F04B22" : "#1a1a2a", color: l.role === "manager" ? ACCENT : "#aaa", border: `1px solid ${l.role === "manager" ? "#C8F04B44" : "#33333344"}` }}>{l.role?.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------
  const activeTickets = tickets.filter(t => t.status !== "delivered" && t.date === today());
  const retrievingTickets = tickets.filter(t => t.status === "retrieving");
  const displayTickets = search ? filteredTickets : activeTickets.filter(t => t.status !== "retrieving");

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div>
          <div style={S.logo}>VLTD</div>
          <div style={S.sub}>
            {valetName.toUpperCase()} - {valetRole === "manager" ? "MANAGER" : "VALET"}
            {currentEvent ? ` - ${currentEvent.name.toUpperCase()}` : ""}
          </div>
        </div>
        <button onClick={createTicket} disabled={loading} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: "20px", padding: "10px 20px", fontFamily: "sans-serif", fontSize: "11px", fontWeight: 700, cursor: "pointer", letterSpacing: "1px", opacity: loading ? 0.6 : 1 }}>
          {loading ? "..." : "+ NEW TICKET"}
        </button>
      </div>
      <div style={{ padding: "12px 20px 0", display: "flex", gap: "8px" }}>
        <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "10px" }} onClick={() => setShowSearch(!showSearch)}> Search</button>
        <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "10px" }} onClick={() => setShowShiftSummary(true)}> Summary</button>
        {valetRole === "manager" && <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "10px" }} onClick={() => { setView("manager"); setSubView(null); }}> Manager</button>}
      </div>
      {showSearch && (
        <div style={{ padding: "12px 20px 0" }}>
          <input style={{ ...S.input, marginBottom: 0 }} placeholder="Search plate, name, car, spot..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
      )}
      <div style={S.content}>
        {retrievingTickets.length > 0 && !search && (
          <>
            <div style={{ fontSize: "9px", color: "#ffcc00", letterSpacing: "2px", marginBottom: "12px" }}> RETRIEVING NOW -- {retrievingTickets.length}</div>
            {retrievingTickets.map(t => (
              <div key={t.id} style={{ ...S.card, borderColor: "#ffcc0044", cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "22px", fontFamily: "sans-serif", fontWeight: 900, color: "#ffcc00" }}>#{t.ticketNum}</div>
                    <div style={{ fontSize: "11px", color: "#777" }}>{t.color} {t.car} - Spot {t.spot}</div>
                    {t.customerName && <div style={{ fontSize: "10px", color: ACCENT, marginTop: "4px" }}> {t.customerName}</div>}
                  </div>
                  <div style={S.badge("retrieving")}>RETRIEVING</div>
                </div>
              </div>
            ))}
          </>
        )}
        <div style={{ fontSize: "9px", color: "#555", letterSpacing: "2px", marginBottom: "12px" }}>
          {search ? `RESULTS -- ${filteredTickets.length}` : `ACTIVE TODAY -- ${activeTickets.length}`}
        </div>
        {displayTickets.length === 0 && (
          <div style={{ color: "#333", fontSize: "12px", textAlign: "center", padding: "40px 0" }}>
            {search ? "No tickets found." : "No active tickets. Tap + NEW TICKET."}
          </div>
        )}
        {displayTickets.filter(t => t.status !== "retrieving").map(t => (
          <div key={t.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "22px", fontFamily: "sans-serif", fontWeight: 900, color: "#fff" }}>#{t.ticketNum}</div>
                <div style={{ fontSize: "11px", color: "#777", marginBottom: "4px" }}>{t.color} {t.car}{t.spot ? ` - ${t.spot}` : ""}</div>
                <div style={{ fontSize: "9px", color: "#444" }}>{t.createdBy}{t.parkedBy ? ` - Parked: ${t.parkedBy}` : ""}</div>
                {t.customerName && <div style={{ fontSize: "10px", color: ACCENT, marginTop: "4px" }}> {t.customerName}</div>}
              </div>
              <div style={S.badge(t.status)}>{t.status?.toUpperCase()}</div>
            </div>
          </div>
        ))}
        {!search && tickets.filter(t => t.status === "delivered" && t.date === today()).length > 0 && (
          <>
            <div style={{ fontSize: "9px", color: "#333", letterSpacing: "2px", margin: "20px 0 12px" }}>DELIVERED TODAY -- {deliveredCount}</div>
            {tickets.filter(t => t.status === "delivered" && t.date === today()).map(t => (
              <div key={t.id} style={{ ...S.card, opacity: 0.4, cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontFamily: "sans-serif", fontWeight: 700, color: "#fff" }}>#{t.ticketNum}</div>
                    <div style={{ fontSize: "11px", color: "#555" }}>{t.color} {t.car}</div>
                    {t.tip > 0 && <div style={{ fontSize: "10px", color: ACCENT }}> ${t.tip} - {"*".repeat(t.rating)}</div>}
                  </div>
                  <div style={S.badge("delivered")}>DELIVERED</div>
                </div>
              </div>
            ))}
          </>
        )}
        <div style={{ marginTop: "24px", borderTop: `1px solid ${BORDER}`, paddingTop: "16px" }}>
          <button style={S.btnOutline} onClick={signOut}>Sign Out ({valetName})</button>
        </div>
      </div>
    </div>
  );
}
