import { useEffect, useState, useRef } from "react";
import { db, messaging, auth, onMessage } from "./config/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import {
  collection, addDoc, onSnapshot, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { useTickets } from "./hooks/useTickets";

import EmailLogin from "./components/EmailLogin";
import PinLogin from "./components/PinLogin";
import RetrievingAlert from "./components/RetrievingAlert";
import QROverlay from "./components/QROverlay";
import ShiftSummary from "./components/ShiftSummary";
import TicketView from "./components/TicketView";
import TicketDetailsForm from "./components/TicketDetailsForm";
import CashierView from "./components/CashierView";
import ManagerView from "./components/ManagerView";
import ReviewsPage from "./components/ReviewsPage";
import PrivacyPage from "./components/PrivacyPage";
import ManualTicket from "./components/ManualTicket";
import EmployeeDashboard from "./components/EmployeeDashboard";
import ValetDashboard from "./components/ValetDashboard";

function today() { return new Date().toISOString().slice(0, 10); }

export default function App() {
  const [valetName, setValetName] = useState(localStorage.getItem("valetName") || "");
  const [valetRole, setValetRole] = useState(localStorage.getItem("valetRole") || "");
  const [tickets, setTickets] = useState([]);
  const [logins, setLogins] = useState([]);
  const [view, setView] = useState("dashboard");
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

  const { createTicket, saveDetails, markDelivered, deleteTicket, handleFillDetails, handleStartRetrieval, handleEditTicket, handleShowQR } = useTickets({
    tickets, valetName, valetRole, currentEvent,
    activeTicket, saving, carDetails, form, ticketPhotos, formPhoto, spotPhoto,
    setLoading, setSaving, setView, setShowQR, setNewTicket, setActiveTicket,
    setCarDetails, setForm, setTicketPhotos, setFormPhoto, setSpotPhoto,
    setShowManualTicket, setEditTicket,
  });

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
  if (view === "manager") return (
    <ManagerView
      valetName={valetName}
      valetRole={valetRole}
      currentEvent={currentEvent}
      tickets={tickets}
      todayTickets={todayTickets}
      logins={logins}
      onBack={() => { setView(currentEvent ? "dashboard" : "join"); }}
      onSelectTicket={(t) => { setActiveTicket(t); setView("ticket"); }}
    />
  );

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
  return (
    <ValetDashboard
      valetName={valetName}
      valetRole={valetRole}
      currentEvent={currentEvent}
      tickets={tickets}
      todayTickets={todayTickets}
      clockedIn={clockedIn}
      clockInTime={clockInTime}
      isOnline={isOnline}
      loading={loading}
      search={search}
      showSearch={showSearch}
      onClockIn={clockIn}
      onClockOut={clockOut}
      onCreateTicket={createTicket}
      onSearch={setSearch}
      onToggleSearch={() => setShowSearch(prev => !prev)}
      onShowSummary={() => setShowShiftSummary(true)}
      onManualTicket={() => setShowManualTicket(true)}
      onSelectTicket={(t) => {
        if (t === "__manager__") { setView("manager"); return; }
        setActiveTicket(t);
        setView("ticket");
      }}
      onLeaveEvent={leaveEvent}
      onSignOut={signOut}
    />
  );
}
