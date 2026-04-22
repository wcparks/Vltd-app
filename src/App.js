import { useState } from "react";
import { useTickets } from "./hooks/useTickets";
import { useClock } from "./hooks/useClock";
import { useAuth } from "./hooks/useAuth";
import { useFirebaseListeners } from "./hooks/useFirebaseListeners";

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
import SupervisorView from "./components/SupervisorView";

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showManualTicket, setShowManualTicket] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [spotPhoto, setSpotPhoto] = useState("");

  const [authUser, setAuthUser] = useState(undefined);

  useFirebaseListeners({
    authUser, valetName, currentEvent, tickets,
    setAuthUser, setValetName, setValetRole, setCurrentEvent,
    setClockedIn, setClockInTime, setIsOnline, setTickets, setLogins, setRetrievingAlert,
  });

  const { clockIn, clockOut } = useClock({
    valetName, valetRole, currentEvent, clockedIn, clockInTime, setClockedIn, setClockInTime,
  });

  const { handleJoinEvent, signOut, leaveEvent } = useAuth({
    valetName, valetRole, clockedIn, clockOut,
    setValetName, setValetRole, setCurrentEvent, setView, setTickets,
  });

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

  if (valetRole === "supervisor") return <SupervisorView user={{ name: valetName, role: valetRole }} tickets={tickets} onSignOut={signOut} onNewTicket={createTicket} onViewTicket={(t) => { setActiveTicket(t); setView("ticket"); }} onClockIn={clockIn} onClockOut={clockOut} isClockedIn={clockedIn} />;
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
