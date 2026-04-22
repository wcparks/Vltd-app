import { useEffect, useState, useRef } from "react";
import { db, storage, messaging, auth, onMessage } from "./config/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import EmailLogin from "./components/EmailLogin";
import PinLogin from "./components/PinLogin";
import RetrievingAlert from "./components/RetrievingAlert";
import QROverlay from "./components/QROverlay";
import ShiftSummary from "./components/ShiftSummary";
import TicketView from "./components/TicketView";
import TicketDetailsForm from "./components/TicketDetailsForm";
import EventManager from "./components/EventManager";
import CashierView from "./components/cashierView";
import ReviewsPage from "./components/ReviewsPage";
import EmployeeProfiles, { incrementStat } from "./components/EmployeeProfiles";
import PrivacyPage from "./components/PrivacyPage";
import ValetManager from "./components/ValetManager";
import LocationManager from "./components/LocationManager";
import ManualTicket from "./components/ManualTicket";
import ManagerDashboard from "./components/ManagerDashboard";
import EmployeeDashboard from "./components/EmployeeDashboard";
import { sendWhatsApp } from "./services/notifyService";

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
  btn: { background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px", letterSpacing: "1px" },
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

function today() { return new Date().toISOString().slice(0, 10); }
const ticketURL = (code) => `https://valet-app-woad.vercel.app/ticket?code=${encodeURIComponent(code)}`;

export default function App() {
  const [valetName, setValetName] = useState(localStorage.getItem("valetName") || "");
  const [valetRole, setValetRole] = useState(localStorage.getItem("valetRole") || "");
  const [tickets, setTickets] = useState([]);
  const [logins, setLogins] = useState([]);
  const [view, setView] = useState("dashboard");
  const [subView, setSubView] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [newTicket, setNewTicket] = useState(null);
  const [carDetails, setCarDetails] = useState({ make: "", model: "", color: "", plate: "" });
  const [form, setForm] = useState({ spot: "", damage: "" });
  const [ticketPhotos, setTicketPhotos] = useState([]);
  const [formPhoto, setFormPhoto] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [retrievingAlert, setRetrievingAlert] = useState(null);
  const [clockedIn, setClockedIn] = useState(() => localStorage.getItem("clockedIn") === "true");
  const [clockInTime, setClockInTime] = useState(() => localStorage.getItem("clockInTime") || null);
  const [currentEvent, setCurrentEvent] = useState(() => {
    try { return JSON.parse(localStorage.getItem("currentEvent")) || null; } catch { return null; }
  });
  const prevTicketsRef = useRef({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showManualTicket, setShowManualTicket] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [spotPhoto, setSpotPhoto] = useState("");

  const [authUser, setAuthUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        localStorage.removeItem("valetName");
        localStorage.removeItem("valetRole");
        localStorage.removeItem("currentEvent");
        localStorage.removeItem("clockedIn");
        localStorage.removeItem("clockInTime");
        setValetName("");
        setValetRole("");
        setCurrentEvent(null);
        setClockedIn(false);
        setClockInTime(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const q = query(collection(db, "tickets"), orderBy("time", "desc"));
    return onSnapshot(q, (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentEvent) {
        data = data.filter(t => t.eventId === currentEvent.id);
      } else {
        data = data.filter(t => !t.eventId);
      }
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
  }, [authUser, currentEvent]);

  useEffect(() => {
    if (!authUser) return;
    const q = query(collection(db, "logins"), orderBy("time", "desc"));
    return onSnapshot(q, (snap) => setLogins(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [authUser]);

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

  const clockIn = async () => {
    const time = new Date().toISOString();
    localStorage.setItem("clockedIn", "true");
    localStorage.setItem("clockInTime", time);
    setClockedIn(true);
    setClockInTime(time);
    await addDoc(collection(db, "clockEvents"), {
      name: valetName, role: valetRole,
      eventId: currentEvent?.id || null,
      eventName: currentEvent?.name || null,
      type: "in", time: serverTimestamp(), date: today()
    }).catch(() => {});
  };

  const clockOut = async () => {
    const inTime = new Date(clockInTime);
    const outTime = new Date();
    const hours = ((outTime - inTime) / 3600000).toFixed(2);
    localStorage.setItem("clockedIn", "false");
    localStorage.removeItem("clockInTime");
    setClockedIn(false);
    setClockInTime(null);
    await addDoc(collection(db, "clockEvents"), {
      name: valetName, role: valetRole,
      eventId: currentEvent?.id || null,
      eventName: currentEvent?.name || null,
      type: "out", time: serverTimestamp(), date: today(),
      hoursWorked: parseFloat(hours)
    }).catch(() => {});
    alert(`Shift complete! You worked ${hours} hours.`);
  };

  const handleJoinEvent = (event) => {
    if (event?.__managerTools) {
      setView("manager");
      setSubView(null);
      return;
    }
    setCurrentEvent(event);
    localStorage.setItem("currentEvent", JSON.stringify(event));
    setView("dashboard");
  };

  const signOut = async () => {
    if (clockedIn) { alert("Please clock out before signing out."); return; }
    localStorage.removeItem("valetName");
    localStorage.removeItem("valetRole");
    localStorage.removeItem("currentEvent");
    setValetName(""); setValetRole(""); setCurrentEvent(null);
    await firebaseSignOut(auth);
  };

  const leaveEvent = async () => {
    if (clockedIn && valetRole !== "manager") await clockOut();
    localStorage.removeItem("currentEvent");
    setCurrentEvent(null);
    setTickets([]);
  };

  const createTicket = async () => {
    setLoading(true);
    try {
      const num = String((tickets || []).filter(t => t.date === today()).length + 1).padStart(4, "0");
      const code = currentEvent
        ? `VLT-${currentEvent.id.slice(0, 6)}-${num}`
        : `VLT-${today()}-${num}`;
      const docRef = await addDoc(collection(db, "tickets"), {
        ticketNum: num, confirmCode: code, date: today(),
        eventId: currentEvent?.id || null,
        eventName: currentEvent?.name || null,
        createdBy: valetName, parkedBy: "", retrievedBy: "",
        plate: "", car: "", make: "", model: "", color: "",
        spot: "", damage: "", photoURL: "", photos: [],
        customerName: "", customerPhone: "",
        status: "ticketed", tip: 0, rating: 0, review: "",
        type: "digital",
        time: serverTimestamp(),
      });
      setNewTicket({ code, num, id: docRef.id });
      setTicketPhotos([]);
      setFormPhoto("");
      setSpotPhoto("");
      setShowQR(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveDetails = async () => {
    if (!activeTicket || saving) return;
    if (!activeTicket.id) { alert("Ticket ID missing — cannot save."); return; }
    setSaving(true);
    try {
      const carString = [carDetails.make, carDetails.model].filter(Boolean).join(" ");
      await updateDoc(doc(db, "tickets", activeTicket.id), {
        plate: carDetails.plate || "",
        car: carString || "",
        make: carDetails.make || "",
        model: carDetails.model || "",
        color: carDetails.color || "",
        spot: form.spot || "",
        damage: form.damage || "",
        parkedBy: valetName,
        status: "parked",
      });

      incrementStat(valetName, "parked").catch(() => {});
      if (activeTicket.customerPhone) {
        sendWhatsApp({
          type: "ticket_created",
          phone: activeTicket.customerPhone,
          ticketNumber: activeTicket.ticketNum,
          customerName: activeTicket.customerName,
          ticketUrl: ticketURL(activeTicket.confirmCode),
          venueName: currentEvent?.name || "Valet",
        }).catch(() => {});
      }

      const withTimeout = (promise, ms) =>
        Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

      const uploadOnePhoto = async (photo) => {
        if (photo.url) return photo;
        try {
          const path = `photos/${activeTicket.id}/${Date.now()}_${photo.label || "photo"}.jpg`;
          const blob = await (await fetch(photo.dataUrl)).blob();
          const storageRef = ref(storage, path);
          await withTimeout(uploadBytes(storageRef, blob, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" }), 10000);
          const url = await withTimeout(getDownloadURL(storageRef), 5000);
          return { url, label: photo.label, type: photo.type, isDamage: photo.isDamage, notes: photo.notes };
        } catch (err) {
          console.error("Photo upload failed:", err);
          return null;
        }
      };

      const uploadedPhotos = (await Promise.all(ticketPhotos.map(uploadOnePhoto))).filter(Boolean);

      let uploadedSpotPhotoURL = activeTicket.spotPhotoURL || "";
      if (spotPhoto && !spotPhoto.startsWith("https://")) {
        try {
          const spotPath = `photos/${activeTicket.id}/spot.jpg`;
          const blob = await (await fetch(spotPhoto)).blob();
          const storageRef = ref(storage, spotPath);
          await withTimeout(uploadBytes(storageRef, blob, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" }), 10000);
          uploadedSpotPhotoURL = await withTimeout(getDownloadURL(storageRef), 5000);
        } catch (err) {
          console.error("Spot upload failed:", err);
        }
      }

      if (uploadedPhotos.length > 0 || uploadedSpotPhotoURL) {
        const coverPhotoURL = uploadedPhotos[0]?.url || formPhoto || activeTicket.photoURL || "";
        await updateDoc(doc(db, "tickets", activeTicket.id), {
          photoURL: coverPhotoURL,
          photos: uploadedPhotos,
          spotPhotoURL: uploadedSpotPhotoURL,
        }).catch(err => console.warn("Photo patch failed:", err));
      }
    } catch (e) {
      alert("Error saving ticket details. Check connection.");
    } finally {
      setSaving(false);
      setView("dashboard");
      setCarDetails({ make: "", model: "", color: "", plate: "" });
      setForm({ spot: "", damage: "" });
      setTicketPhotos([]);
      setFormPhoto("");
      setSpotPhoto("");
    }
  };

  const markDelivered = async (id) => {
    try {
      await updateDoc(doc(db, "tickets", id), {
        status: "delivered",
        deliveredAt: Date.now(),
        retrievedBy: valetName,
      });
      incrementStat(valetName, "retrieved").catch(() => {});
      const ticket = tickets.find(t => t.id === id);
      if (activeTicket && activeTicket.id === id) {
        setActiveTicket(prev => ({ ...prev, status: "delivered", retrievedBy: valetName }));
      }
      if (ticket?.customerPhone) {
        sendWhatsApp({
          type: "car_ready",
          phone: ticket.customerPhone,
          ticketNumber: ticket.ticketNum,
          customerName: ticket.customerName,
          ticketUrl: ticketURL(ticket.confirmCode),
          valetName,
        }).catch(() => {});
      }
    } catch (e) {
      alert("Error updating ticket. Try again.");
    }
  };

  const deleteTicket = async (id) => {
    if (valetRole !== "manager") { alert("Only managers can delete tickets."); return; }
    if (window.confirm("Delete this ticket?")) {
      try { await deleteDoc(doc(db, "tickets", id)); } catch (e) {}
      setActiveTicket(null);
      setView("dashboard");
    }
  };

  const handleFillDetails = (ticket) => {
    setCarDetails({ make: ticket.make || "", model: ticket.model || "", color: ticket.color || "", plate: ticket.plate || "" });
    setForm({ spot: ticket.spot || "", damage: ticket.damage || "" });
    setTicketPhotos(ticket.photos || []);
    setFormPhoto(ticket.photoURL || "");
    setView("details");
  };

  const handleStartRetrieval = async (ticket) => {
    await updateDoc(doc(db, "tickets", ticket.id), { status: "retrieving", retrievedBy: valetName });
    try {
      await fetch("/api/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "car_requested", channel: "whatsapp", phone: ticket?.customerPhone || "", ticketNum: ticket.ticketNum, car: ticket.car, color: ticket.color, spot: ticket.spot, customerName: ticket.customerName, eventId: ticket?.eventId || null }),
      });
    } catch (e) {}
    setView("dashboard");
  };

  const handleEditTicket = (ticket) => {
    if (ticket.type === "manual" || ticket.isManual) {
      setEditTicket(ticket);
      setShowManualTicket(true);
      setView("dashboard");
    } else {
      setCarDetails({ make: ticket.make || "", model: ticket.model || "", color: ticket.color || "", plate: ticket.plate || "" });
      setForm({ spot: ticket.spot || "", damage: ticket.damage || "" });
      setTicketPhotos(ticket.photos || []);
      setFormPhoto(ticket.photoURL || "");
      setSpotPhoto(ticket.spotPhotoURL || "");
      setView("details");
    }
  };

  const handleShowQR = (ticket) => {
    setNewTicket({ code: ticket.confirmCode, num: ticket.ticketNum, id: ticket.id });
    setShowQR(true);
  };

  // -- Auth gate ----------------------------------------------
  if (window.location.pathname === "/ticket") { window.location.replace("https://valet-app-woad.vercel.app/ticket.html" + window.location.search); return null; }
  if (authUser === undefined) {
    return (
      <div style={{ background: "#0D0D0D", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#444", fontSize: "10px", letterSpacing: "2px", fontFamily: "'DM Mono', monospace" }}>LOADING...</div>
      </div>
    );
  }

  if (authUser === null) return <EmailLogin />;

  // -- Computed values ----------------------------------------
  const filteredTickets = search ? tickets.filter(t => {
    const s = search.toLowerCase();
    return (t.plate || "").toLowerCase().includes(s) || (t.car || "").toLowerCase().includes(s) ||
      (t.customerName || "").toLowerCase().includes(s) || (t.ticketNum || "").includes(s) ||
      (t.spot || "").toLowerCase().includes(s) || (t.color || "").toLowerCase().includes(s);
  }) : [];

  const todayTickets = tickets.filter(t => t.date === today());
  const totalTips = todayTickets.reduce((sum, t) => sum + (t.tip || 0), 0);
  const ratedTickets = todayTickets.filter(t => t.rating > 0);
  const avgRating = ratedTickets.length > 0 ? (ratedTickets.reduce((sum, t) => sum + t.rating, 0) / ratedTickets.length).toFixed(1) : "--";
  const deliveredCount = todayTickets.filter(t => t.status === "delivered").length;
  const activeCount = todayTickets.filter(t => t.status !== "delivered").length;

  // -- Special routes -----------------------------------------
  if (window.location.pathname === "/privacy") return <PrivacyPage />;
  if (window.location.pathname === "/reviews") return <ReviewsPage isManager={valetRole === "manager"} />;
  if (window.location.pathname === "/ticket") { window.location.replace(window.location.href.replace("/ticket", "/ticket.html")); return null; }

  // -- PIN login ----------------------------------------------
  if (!valetName) return <PinLogin onSuccess={(name, role) => { setValetName(name); setValetRole(role); }} />;

  // -- Join screen --------------------------------------------
  if (view === "join") return (
    <EmployeeDashboard
      valetName={valetName} valetRole={valetRole}
      onJoinEvent={handleJoinEvent} onSignOut={signOut}
      clockedIn={clockedIn} onClockIn={clockIn} onClockOut={clockOut} clockInTime={clockInTime}
    />
  );

  if (!currentEvent) {
    if (valetRole === "manager" && view === "manager") {
      // fall through to manager view
    } else {
      return (
        <EmployeeDashboard
          valetName={valetName} valetRole={valetRole}
          onJoinEvent={handleJoinEvent} onSignOut={signOut}
          clockedIn={clockedIn} onClockIn={clockIn} onClockOut={clockOut} clockInTime={clockInTime}
        />
      );
    }
  }

  if (valetRole === "cashier") return <CashierView eventId={currentEvent?.id} staffName={valetName} onLogout={signOut} />;

  if (retrievingAlert) return <RetrievingAlert ticket={retrievingAlert} onDismiss={() => setRetrievingAlert(null)} />;

  if (showQR && newTicket) return (
    <QROverlay
      ticket={newTicket}
      currentEvent={currentEvent}
      onFillDetails={() => {
        setShowQR(false);
        setTimeout(() => {
          const t = tickets.find(t => t.confirmCode === newTicket.code);
          if (t) { setActiveTicket(t); handleFillDetails(t); }
          else setView("dashboard");
        }, 500);
      }}
      onSkip={() => { setShowQR(false); setNewTicket(null); }}
    />
  );

  if (showShiftSummary) return (
    <ShiftSummary
      todayTickets={todayTickets}
      totalTips={totalTips}
      avgRating={avgRating}
      deliveredCount={deliveredCount}
      activeCount={activeCount}
      valetRole={valetRole}
      currentEvent={currentEvent}
      onBack={() => setShowShiftSummary(false)}
    />
  );

  if (view === "details" && activeTicket) return (
    <TicketDetailsForm
      ticket={activeTicket}
      carDetails={carDetails}
      setCarDetails={setCarDetails}
      form={form}
      setForm={setForm}
      ticketPhotos={ticketPhotos}
      setTicketPhotos={setTicketPhotos}
      spotPhoto={spotPhoto}
      setSpotPhoto={setSpotPhoto}
      saving={saving}
      onSave={saveDetails}
      onBack={() => setView("dashboard")}
    />
  );

  const liveTicket = activeTicket ? (tickets.find(t => t.id === activeTicket.id) || activeTicket) : null;

  if (view === "ticket" && liveTicket) return (
    <TicketView
      ticket={liveTicket}
      valetRole={valetRole}
      onBack={() => setView("dashboard")}
      onFillDetails={handleFillDetails}
      onStartRetrieval={handleStartRetrieval}
      onMarkDelivered={(id) => { markDelivered(id); setView("dashboard"); }}
      onDelete={deleteTicket}
      onShowQR={handleShowQR}
      onEdit={handleEditTicket}
    />
  );

  // -- Manager view -------------------------------------------
  if (view === "manager") {
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
          <button style={S.btnOutline} onClick={() => { setView(currentEvent ? "dashboard" : "join"); setSubView(null); }}>Back</button>
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
            <div key={t.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
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

  // -- Manual ticket ------------------------------------------
  if (showManualTicket) return (
    <ManualTicket
      valetName={valetName} valetRole={valetRole} currentEvent={currentEvent}
      onClose={() => { setShowManualTicket(false); setEditTicket(null); }}
      ticketId={editTicket?.id || null}
      initialData={editTicket}
    />
  );

  // -- Dashboard ----------------------------------------------
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
          onClick={clockedIn ? clockOut : clockIn}
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
          <button onClick={createTicket} disabled={loading}
            style={{ background: ACCENT, color: "#000", border: "none", borderRadius: "14px", padding: "16px", width: "100%", fontFamily: "sans-serif", fontSize: "16px", fontWeight: 900, cursor: "pointer", letterSpacing: "2px", opacity: loading ? 0.6 : 1, boxShadow: "0 4px 20px rgba(200,240,75,0.3)" }}>
            {loading ? "CREATING..." : "+ NEW TICKET"}
          </button>
        )}
      </div>

      <div style={{ padding: "10px 16px 0", display: "flex", gap: "8px" }}>
        <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "11px" }} onClick={() => setShowSearch(!showSearch)}>Search</button>
        <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "11px" }} onClick={() => setShowShiftSummary(true)}>Summary</button>
        {valetRole === "manager" && <button style={{ ...S.btnOutline, flex: 1, padding: "10px", fontSize: "11px" }} onClick={() => { setView("manager"); setSubView(null); }}>Manager</button>}
      </div>
      <div style={{ padding: "6px 16px 0" }}>
        <button style={{ ...S.btnOutline, width: "100%", padding: "10px", fontSize: "11px", textAlign: "center" }} onClick={() => setShowManualTicket(true)}>
          + MANUAL TICKET ENTRY
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: "10px 16px 0" }}>
          <input style={{ ...S.input, marginBottom: 0 }} placeholder="Search plate, name, car, spot..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
      )}

      <div style={S.content}>
        {retrievingTickets.length > 0 && !search && (
          <>
            <div style={{ fontSize: "10px", color: "#ffcc00", letterSpacing: "2px", marginBottom: "12px" }}>RETRIEVING NOW - {retrievingTickets.length}</div>
            {retrievingTickets.map(t => (
              <div key={t.id} style={{ ...S.card, borderColor: "#ffcc0044", cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
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
          <div key={t.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
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
              <div key={t.id} style={{ ...S.card, opacity: 0.45, cursor: "pointer" }} onClick={() => { setActiveTicket(t); setView("ticket"); }}>
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
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={leaveEvent}>Leave Event</button>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={signOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
