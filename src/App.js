import { useEffect, useState, useRef } from "react";
import { db, storage, messaging, auth, requestNotificationPermission, onMessage } from "./config/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, where, getDoc, getDocs
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { QRCodeSVG as QRCode } from "qrcode.react";

import EventJoin from "./components/EventJoin";
import EventManager from "./components/EventManager";
import CashierView from "./components/CashierView";
import PhotoCapture, { PhotoViewer, SpotPhotoViewer } from "./components/PhotoCapture";
import CarAutocomplete from "./components/CarAutocomplete";
import ReviewsPage from "./components/ReviewsPage";
import EmployeeProfiles, { upsertEmployee, incrementStat } from "./components/EmployeeProfiles";
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
const MANAGER_PIN = "0711";
const VALET_PIN = "1111";
const CASHIER_PIN = "2222";

const S = {
  app: { background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" },
  header: { paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0D0D0D", zIndex: 10 },
  logo: { fontFamily: "sans-serif", fontSize: "20px", fontWeight: 900, color: ACCENT },
  sub: { fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" },
  content: { padding: "12px 16px" },
  input: { width: "100%", background: "#111", border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "13px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none", boxSizing: "border-box" },
  btn: { background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px", letterSpacing: "1px" },
  btnRed: { background: "#ff444422", color: "#ff4444", border: "1px solid #ff444433", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" },
  btnOutline: { background: "transparent", color: "#aaa", border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontSize: "12px", cursor: "pointer" },
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px", marginBottom: "12px" },
  label: { fontSize: "9px", color: "#aaa", letterSpacing: "2px", marginBottom: "6px" },
  badge: (s) => ({
    display: "inline-block", padding: "4px 10px", borderRadius: "20px", fontSize: "9px", letterSpacing: "1px",
    background: s === "parked" ? "#1a2a0a" : s === "retrieving" ? "#1a1500" : s === "delivered" ? "#111" : "#1a1a2a",
    color: s === "parked" ? ACCENT : s === "retrieving" ? "#ffcc00" : s === "delivered" ? "#555" : "#aaa",
    border: `1px solid ${s === "parked" ? ACCENT + "44" : s === "retrieving" ? "#ffcc0044" : "#33333344"}`
  }),
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "24px" },
};

function today() { return new Date().toISOString().slice(0, 10); }

// -- NHTSA plate lookup -------------------------------------
// NOTE: NHTSA VIN API is free but requires VIN not plate.
// For plate-to-VIN we use a simple approach: snap photo,
// read plate via browser OCR (experimental), then lookup.
// For now the plate photo auto-fills plate field only.
// Full plate-to-VIN lookup requires a paid API -- flagged for future.

export default function App() {
  const [valetName, setValetName] = useState(localStorage.getItem("valetName") || "");
  const [valetRole, setValetRole] = useState(localStorage.getItem("valetRole") || "");
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
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
  const spotPhotoRef = useRef(null);

  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = logged out
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // -- Ticket listener (only when authenticated) --------------
  useEffect(() => {
    if (!authUser) return;
    const q = query(
      collection(db, "tickets"),
      orderBy("time", "desc")
    );
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

  // -- Clock in/out -------------------------------------------
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

  // -- Login -- checks Firebase valetAccounts first, falls back to hardcoded --
  const login = async () => {
    if (!nameInput.trim()) return;
    let role = null;
    let resolvedName = nameInput.trim();

// Check manager PIN first — must match BOTH name and PIN
const MANAGER_NAMES = ["ivan m", "malynda m"];
if (pinInput === MANAGER_PIN) {
  if (MANAGER_NAMES.includes(nameInput.trim().toLowerCase())) {
    role = "manager";
  } else {
    setPinError("Incorrect name or PIN. Contact your manager.");
    return;
  }
}
 else {
      // Check Firebase valetAccounts for matching PIN
      try {
        const q = query(collection(db, "valetAccounts"), where("pin", "==", pinInput), where("active", "==", true));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const account = snap.docs[0].data();
          role = account.role;
          resolvedName = account.name; // use the name from the account
        }
      } catch (e) {
        // Firebase lookup failed -- fall back to hardcoded
        role = pinInput === VALET_PIN ? "valet" : pinInput === CASHIER_PIN ? "cashier" : null;
      }
      // Fallback to hardcoded if no Firebase account found
      if (!role) {
        role = pinInput === VALET_PIN ? "valet" : pinInput === CASHIER_PIN ? "cashier" : null;
      }
      // supervisor is only via Firebase accounts, no hardcoded fallback
    }

    if (!role) { setPinError("Incorrect PIN. Contact your manager."); return; }
    await addDoc(collection(db, "logins"), { name: resolvedName, role, time: serverTimestamp(), date: today() });
    if (role !== "manager") await upsertEmployee(resolvedName).catch(() => {});
    try {
      const token = await requestNotificationPermission(resolvedName);
      if (token) await addDoc(collection(db, "valetTokens"), { name: resolvedName, role, token, date: today(), time: serverTimestamp() });
    } catch (e) {}
    localStorage.setItem("valetName", resolvedName);
    localStorage.setItem("valetRole", role);
    setValetName(resolvedName);
    setValetRole(role);
  };

  const handleJoinEvent = (event) => {
    if (event?.__managerTools) {
      setView("manager");
      setSubView(null);
      return;
    }
    setCurrentEvent(event);
    localStorage.setItem("currentEvent", JSON.stringify(event));
    setView("dashboard"); // explicitly navigate to dashboard after joining
  };

  const signOut = async () => {
    if (clockedIn) { alert("Please clock out before signing out."); return; }
    localStorage.removeItem("valetName");
    localStorage.removeItem("valetRole");
    localStorage.removeItem("currentEvent");
    setValetName(""); setValetRole(""); setCurrentEvent(null);
    await firebaseSignOut(auth);
  };

  // Leave event/location — clocks out non-managers, returns to join screen
  const leaveEvent = async () => {
    if (clockedIn && valetRole !== "manager") {
      // Auto clock out when leaving event
      await clockOut();
    }
    localStorage.removeItem("currentEvent");
    setCurrentEvent(null);
    setTickets([]);
  };

  // -- Create ticket ------------------------------------------
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
      console.error("FULL ERROR:", e);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // -- Save details -- two-step: text first, then photos async --
  const saveDetails = async () => {
    console.log("saveDetails called", { activeTicket, carDetails, form, ticketPhotos, spotPhoto });
    if (!activeTicket || saving) return;
    if (!activeTicket.id) { alert("Ticket ID missing — cannot save."); return; }
    setSaving(true);
    try {
      const carString = [carDetails.make, carDetails.model].filter(Boolean).join(" ");

      // STEP 1 — Save text fields immediately so ticket is never lost
      console.log("saveDetails — step 1: saving text fields", { plate: carDetails.plate, make: carDetails.make, model: carDetails.model, color: carDetails.color, spot: form.spot, damage: form.damage });
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

      // Non-blocking side effects after text save
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

      // STEP 2 — Attempt photo uploads with a 10s timeout; never block navigation
      console.log('Starting save, photos:', ticketPhotos.length, 'spotPhoto:', !!spotPhoto);
      const withTimeout = (promise, ms) =>
        Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

      const uploadOnePhoto = async (photo) => {
        if (photo.url) return photo;
        try {
          const path = `photos/${activeTicket.id}/${Date.now()}_${photo.label || "photo"}.jpg`;
          console.log('[DEBUG] Starting upload:', path);
          const blob = await (await fetch(photo.dataUrl)).blob();
          const storageRef = ref(storage, path);
          await withTimeout(uploadBytes(storageRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' }), 10000);
          const url = await withTimeout(getDownloadURL(storageRef), 5000);
          console.log('[DEBUG] Upload success:', url);
          return { url, label: photo.label, type: photo.type, isDamage: photo.isDamage, notes: photo.notes };
        } catch (err) {
          console.error('[DEBUG] Upload failed — code:', err.code, '| message:', err.message, '| full:', err);
          alert(`[DEBUG] Photo upload failed\nCode: ${err.code}\nMessage: ${err.message}`);
          return null; // drop failed photo rather than saving giant base64
        }
      };

      const uploadedPhotos = (await Promise.all(ticketPhotos.map(uploadOnePhoto))).filter(Boolean);

      let uploadedSpotPhotoURL = activeTicket.spotPhotoURL || "";
      if (spotPhoto && !spotPhoto.startsWith("https://")) {
        try {
          const spotPath = `photos/${activeTicket.id}/spot.jpg`;
          console.log('[DEBUG] Starting upload:', spotPath);
          const blob = await (await fetch(spotPhoto)).blob();
          const storageRef = ref(storage, spotPath);
          await withTimeout(uploadBytes(storageRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' }), 10000);
          uploadedSpotPhotoURL = await withTimeout(getDownloadURL(storageRef), 5000);
          console.log('[DEBUG] Upload success:', uploadedSpotPhotoURL);
        } catch (err) {
          console.error('[DEBUG] Spot upload failed — code:', err.code, '| message:', err.message, '| full:', err);
          alert(`[DEBUG] Spot photo upload failed\nCode: ${err.code}\nMessage: ${err.message}`);
        }
      }

      // STEP 3 — Patch photo URLs into Firestore if any uploads succeeded
      if (uploadedPhotos.length > 0 || uploadedSpotPhotoURL) {
        const coverPhotoURL = uploadedPhotos[0]?.url || formPhoto || activeTicket.photoURL || "";
        console.log("saveDetails — step 3: patching photos", { photoCount: uploadedPhotos.length, coverPhotoURL });
        await updateDoc(doc(db, "tickets", activeTicket.id), {
          photoURL: coverPhotoURL,
          photos: uploadedPhotos,
          spotPhotoURL: uploadedSpotPhotoURL,
        }).catch(err => console.warn("Photo patch failed:", err));
      }
    } catch (e) {
      console.error("saveDetails error", e);
      alert("Error saving ticket details. Check connection.");
    } finally {
      // ALWAYS fires — can never get stuck on "SAVING..."
      setSaving(false);
      setView("dashboard");
      setCarDetails({ make: "", model: "", color: "", plate: "" });
      setForm({ spot: "", damage: "" });
      setTicketPhotos([]);
      setFormPhoto("");
      setSpotPhoto("");
    }
  };

  const markRetrieving = async (id) => {
    await updateDoc(doc(db, "tickets", id), { status: "retrieving" });
    try {
      const ticket = tickets.find(t => t.id === id);
      await fetch("/api/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "car_requested", channel: "whatsapp", phone: ticket?.customerPhone || "", ticketNum: ticket?.ticketNum, car: ticket?.car, color: ticket?.color, spot: ticket?.spot, customerName: ticket?.customerName, eventId: ticket?.eventId || null }),
      });
    } catch (e) {}
  };

  // -- Mark delivered -- BUG: add retrievedBy -----------------
  const markDelivered = async (id) => {
    try {
      await updateDoc(doc(db, "tickets", id), {
        status: "delivered",
        deliveredAt: Date.now(),
        retrievedBy: valetName,
      });
      incrementStat(valetName, "retrieved").catch(() => {});
      const ticket = tickets.find(t => t.id === id);
      // Update local activeTicket state so it shows immediately
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

  // -- Delete -- BUG 3 FIX: force view reset after delete -----
  const deleteTicket = async (id) => {
    if (valetRole !== "manager") { alert("Only managers can delete tickets."); return; }
    if (window.confirm("Delete this ticket?")) {
      try {
        await deleteDoc(doc(db, "tickets", id));
      } catch (e) {}
      // Always navigate regardless
      setActiveTicket(null);
      setView("dashboard");
    }
  };

  // -- Auth gate: ABSOLUTE FIRST returns ----------------------
   if (window.location.pathname === "/ticket") { window.location.replace(window.location.href.replace("/ticket", "/ticket.html")); return null; }
   if (authUser === undefined) {
    return (
      <div style={{ background: "#0D0D0D", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#444", fontSize: "10px", letterSpacing: "2px", fontFamily: "'DM Mono', monospace" }}>LOADING...</div>
      </div>
    );
  }

  if (authUser === null) {
    return (
      <div style={{ background: "#0D0D0D", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ fontFamily: "sans-serif", fontSize: "26px", fontWeight: 900, color: "#C8F04B", marginBottom: "4px" }}>VLTD</div>
        <div style={{ fontSize: "9px", color: "#555", letterSpacing: "3px", marginBottom: "40px" }}>VALET MANAGEMENT</div>
        <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
          <input
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: "#111", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "14px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: "#111", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "14px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none" }}
          />
          {loginError && (
            <div style={{ color: "#ff4444", fontSize: "11px", marginBottom: "10px", padding: "10px", background: "#ff444411", borderRadius: "8px" }}>
              {loginError}
            </div>
          )}
          <button
            type="submit"
            disabled={loginLoading}
            style={{ background: "#C8F04B", color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "1px", opacity: loginLoading ? 0.6 : 1 }}
          >
            {loginLoading ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </form>
      </div>
    );
  }

  const ticketURL = (code) => `https://valet-app-woad.vercel.app/ticket?code=${encodeURIComponent(code)}`;

  // -- Computed view state (only runs when authenticated) -----
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

  // -- Route: special pages -----------------------------------
  if (window.location.pathname === "/privacy") return <PrivacyPage />;
  if (window.location.pathname === "/reviews") return <ReviewsPage isManager={valetRole === "manager"} />;
  if (window.location.pathname === "/ticket") { window.location.replace(window.location.href.replace("/ticket", "/ticket.html")); return null; }

  // -- Login --------------------------------------------------
  if (!valetName) return (
    <div style={{ ...S.app, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", minHeight: "100vh" }}>
      <div style={{ ...S.logo, fontSize: "40px", marginBottom: "6px" }}>VLTD</div>
      <div style={{ ...S.sub, marginBottom: "48px" }}>VALET - REDEFINED</div>
      <div style={{ width: "100%", maxWidth: "320px" }}>
        <div style={S.label}>YOUR NAME</div>
        <input style={S.input} placeholder="Enter your name..." value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <div style={S.label}>ACCESS PIN</div>
        <input style={S.input} placeholder="Enter PIN..." type="password" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(""); }} onKeyDown={e => e.key === "Enter" && login()} />
        {pinError && <div style={{ color: "#ff4444", fontSize: "12px", marginBottom: "10px" }}>{pinError}</div>}
        <button style={S.btn} onClick={login}>START SHIFT</button>
      </div>
    </div>
  );

  // -- Return to join screen ----------------------------------
  if (view === "join") return (
    <EmployeeDashboard
      valetName={valetName}
      valetRole={valetRole}
      onJoinEvent={handleJoinEvent}
      onSignOut={signOut}
      clockedIn={clockedIn}
      onClockIn={clockIn}
      onClockOut={clockOut}
      clockInTime={clockInTime}
    />
  );

  // -- Everyone must join event/location first ----------------
  // Exception: manager can access manager tools without joining
  if (!currentEvent) {
    if (valetRole === "manager" && view === "manager") {
      // Fall through to manager view below
    } else {
      return (
        <EmployeeDashboard
          valetName={valetName}
          valetRole={valetRole}
          onJoinEvent={handleJoinEvent}
          onSignOut={signOut}
          clockedIn={clockedIn}
          onClockIn={clockIn}
          onClockOut={clockOut}
          clockInTime={clockInTime}
        />
      );
    }
  }

  // -- Cashier ------------------------------------------------
  if (valetRole === "cashier") {
    return <CashierView eventId={currentEvent?.id} onLogout={signOut} />;
  }

  // -- Retrieving alert ---------------------------------------
  if (retrievingAlert) return (
    <div style={{ ...S.overlay, background: "#0a1a00" }}>
      <div style={{ fontSize: "60px", marginBottom: "16px" }}>!</div>
      <div style={{ fontFamily: "sans-serif", fontSize: "22px", color: ACCENT, fontWeight: 900, marginBottom: "8px", textAlign: "center" }}>CAR REQUESTED!</div>
      <div style={{ fontSize: "40px", fontFamily: "sans-serif", fontWeight: 900, color: "#fff", marginBottom: "8px" }}>#{retrievingAlert.ticketNum}</div>
      <div style={{ fontSize: "15px", color: "#ccc", marginBottom: "4px" }}>{retrievingAlert.color} {retrievingAlert.car}</div>
      <div style={{ fontSize: "13px", color: "#777", marginBottom: "4px" }}>Spot: {retrievingAlert.spot || "--"}</div>
      {retrievingAlert.customerName && <div style={{ fontSize: "13px", color: ACCENT, marginBottom: "24px" }}>{retrievingAlert.customerName}</div>}
      <button style={{ ...S.btn, maxWidth: "280px" }} onClick={() => setRetrievingAlert(null)}>GOT IT - ON MY WAY</button>
    </div>
  );

  // -- QR overlay -- full screen, level H ---------------------
  if (showQR && newTicket) {
    const qrSize = Math.min(window.innerWidth, window.innerHeight) - 120;
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "32px 20px 24px", zIndex: 100 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "#bbb", letterSpacing: "4px", marginBottom: "6px" }}>VLTD</div>
          <div style={{ fontSize: "56px", fontFamily: "sans-serif", fontWeight: 900, color: "#000", lineHeight: 1 }}>#{newTicket.num}</div>
          {currentEvent && <div style={{ fontSize: "12px", color: "#aaa", marginTop: "4px" }}>{currentEvent.name}</div>}
        </div>
        <QRCode value={ticketURL(newTicket.code)} size={qrSize} level="H" />
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ textAlign: "center", fontSize: "10px", color: "#bbb", letterSpacing: "2px", marginBottom: "4px" }}>CUSTOMER SCANS TO TRACK CAR</div>
          <button style={{ ...S.btn, background: "#000", color: "#fff" }} onClick={() => {
            setShowQR(false);
            // BUG 2 FIX: use a short delay to let Firestore catch up
            setTimeout(() => {
              const t = tickets.find(t => t.confirmCode === newTicket.code);
              if (t) {
                setActiveTicket(t);
                setCarDetails({ make: t.make || "", model: t.model || "", color: t.color || "", plate: t.plate || "" });
                setForm({ spot: t.spot || "", damage: t.damage || "" });
                setTicketPhotos(t.photos || []);
                setView("details");
              } else {
                // Ticket not in local state yet -- navigate anyway, it will appear
                setView("dashboard");
              }
            }, 500);
          }}>FILL IN CAR DETAILS</button>
          <button style={{ ...S.btnOutline, textAlign: "center", color: "#888", borderColor: "#ddd" }} onClick={() => { setShowQR(false); setNewTicket(null); }}>SKIP - DO LATER</button>
        </div>
      </div>
    );
  }

  // -- Shift summary ------------------------------------------
  if (showShiftSummary) return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>SHIFT SUMMARY</div></div>
        <button style={S.btnOutline} onClick={() => setShowShiftSummary(false)}>Back</button>
      </div>
      <div style={S.content}>
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
                <div key={name} style={S.card}>
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

  // -- Details form -------------------------------------------
  if (view === "details" && activeTicket) return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TICKET #{activeTicket.ticketNum}</div></div>
        <button style={S.btnOutline} onClick={() => setView("dashboard")}>Back</button>
      </div>
      <div style={S.content}>
        <div style={{ marginBottom: "16px" }}>
          <div style={S.label}>VEHICLE DETAILS</div>
          <div style={{ background: "#111", borderRadius: "12px", padding: "14px", border: `1px solid ${BORDER}` }}>
            <CarAutocomplete value={carDetails} onChange={setCarDetails} />
          </div>
        </div>
        <div style={S.label}>PARKING SPOT</div>
        <input style={S.input} placeholder="e.g. B-14" value={form.spot} onChange={e => setForm({ ...form, spot: e.target.value })} />
        <div style={S.label}>DAMAGE NOTES</div>
        <input style={S.input} placeholder="Any existing damage..." value={form.damage} onChange={e => setForm({ ...form, damage: e.target.value })} />
        <div style={{ background: "#111", borderRadius: "12px", padding: "14px", border: `1px solid ${BORDER}`, marginBottom: "12px" }}>
          <PhotoCapture onChange={setTicketPhotos} />
        </div>

        {/* Spot/Location photo */}
        <div style={{ marginBottom: "12px" }}>
          <div style={S.label}>PARK LOCATION PHOTO</div>
          <input ref={spotPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
            const file = e.target.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX = 800; let w = img.width, h = img.height;
              if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
              canvas.width = w; canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              setSpotPhoto(canvas.toDataURL("image/jpeg", 0.7));
              URL.revokeObjectURL(url);
            };
            img.src = url;
            e.target.value = "";
          }} />
          {spotPhoto ? (
            <div style={{ position: "relative" }}>
              <img src={spotPhoto} alt="spot" style={{ width: "100%", borderRadius: 10, maxHeight: 140, objectFit: "cover" }} />
              <button type="button" onClick={() => setSpotPhoto("")} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: 10, width: 24, height: 24, fontSize: 12, cursor: "pointer" }}>x</button>
            </div>
          ) : (
            <button type="button" onClick={() => spotPhotoRef.current?.click()} style={{ ...S.btnOutline, width: "100%", padding: "12px", textAlign: "center" }}>
              + ADD LOCATION PHOTO
            </button>
          )}
        </div>

        <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={saveDetails} disabled={saving}>
          {saving ? "SAVING..." : "SAVE & MARK PARKED"}
        </button>
      </div>
    </div>
  );

  // -- Ticket detail ------------------------------------------
  // Always use live ticket data from Firestore snapshot
  const liveTicket = activeTicket ? (tickets.find(t => t.id === activeTicket.id) || activeTicket) : null;

  if (view === "ticket" && liveTicket) {
    const activeTicket = liveTicket; // shadow with live version
    return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TICKET #{activeTicket.ticketNumber || activeTicket.paperTicketNum || activeTicket.ticketNum}</div></div>
        <button style={S.btnOutline} onClick={() => setView("dashboard")}>Back</button>
      </div>
      <div style={S.content}>
        <div style={{ background: "#C8F04B15", border: `1px solid ${ACCENT}44`, borderRadius: "14px", padding: "16px", textAlign: "center", marginBottom: "16px" }}>
          <div style={S.label}>TICKET #</div>
          <div style={{ fontSize: "44px", color: ACCENT, fontFamily: "sans-serif", fontWeight: 900 }}>{activeTicket.ticketNumber || activeTicket.paperTicketNum || activeTicket.ticketNum}</div>
          <div style={{ ...S.badge(activeTicket.status), marginTop: "8px" }}>{activeTicket.status?.toUpperCase()}</div>
          {activeTicket.eventName && <div style={{ fontSize: "10px", color: "#555", marginTop: "6px" }}>{activeTicket.eventName}</div>}
        </div>

        {activeTicket.photos?.length > 0
          ? <div style={{ marginBottom: "12px" }}><PhotoViewer photos={activeTicket.photos} /></div>
          : activeTicket.photoURL
            ? <SpotPhotoViewer url={activeTicket.photoURL} label="Vehicle Photo" />
            : null}

        <SpotPhotoViewer url={activeTicket.spotPhotoURL} label="Park Location Photo" />

        <div style={S.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              { label: "PLATE", value: activeTicket.plate || "--", large: true },
              { label: "SPOT", value: activeTicket.spot || "--" },
              { label: "CAR", value: activeTicket.car || "--" },
              { label: "COLOR", value: activeTicket.color || "--" },
              { label: "CREATED BY", value: activeTicket.createdBy || "--" },
              { label: "PARKED BY", value: activeTicket.parkedBy || "--" },
              { label: "RETRIEVED BY", value: activeTicket.retrievedBy || "--" },
            ].map(({ label, value, large }) => (
              <div key={label}>
                <div style={S.label}>{label}</div>
                <div style={{ color: "#ccc", fontSize: large ? "15px" : "13px", fontWeight: large ? 700 : 400 }}>{value}</div>
              </div>
            ))}
            {activeTicket.customerName && <div style={{ gridColumn: "span 2" }}><div style={S.label}>CUSTOMER</div><div style={{ color: ACCENT, fontSize: "13px" }}>{activeTicket.customerName}</div></div>}
            {activeTicket.customerPhone && <div style={{ gridColumn: "span 2" }}><div style={S.label}>PHONE</div><div style={{ color: "#ccc", fontSize: "13px" }}>{activeTicket.customerPhone}</div></div>}
            {activeTicket.rating > 0 && <div><div style={S.label}>RATING</div><div style={{ color: ACCENT, fontSize: "13px" }}>{activeTicket.rating}/5</div></div>}
            {activeTicket.tip > 0 && <div><div style={S.label}>TIP</div><div style={{ color: ACCENT, fontSize: "15px", fontWeight: 700 }}>${activeTicket.tip}</div></div>}
          </div>
          {activeTicket.damage && <div style={{ marginTop: "12px" }}><div style={S.label}>DAMAGE NOTES</div><div style={{ color: "#888", fontSize: "12px" }}>{activeTicket.damage}</div></div>}
          {activeTicket.review && <div style={{ marginTop: "12px" }}><div style={S.label}>CUSTOMER REVIEW</div><div style={{ color: "#888", fontSize: "12px", fontStyle: "italic" }}>"{activeTicket.review}"</div></div>}
        </div>

        <div style={{ background: "#fff", padding: "14px", borderRadius: "14px", textAlign: "center", marginBottom: "12px" }}>
          <QRCode value={ticketURL(activeTicket.confirmCode)} size={160} level="H" />
          <div style={{ fontSize: "10px", color: "#999", marginTop: "8px" }}>SHOW TO CUSTOMER</div>
        </div>

        {activeTicket.status === "ticketed" && (
          <button style={S.btn} onClick={() => {
            setCarDetails({ make: activeTicket.make || "", model: activeTicket.model || "", color: activeTicket.color || "", plate: activeTicket.plate || "" });
            setForm({ spot: activeTicket.spot || "", damage: activeTicket.damage || "" });
            setTicketPhotos(activeTicket.photos || []);
            setFormPhoto(activeTicket.photoURL || "");
            setView("details");
          }}>FILL IN DETAILS</button>
        )}
        {activeTicket.status === "parked" && (
          <button style={{ ...S.btn, background: "#ffcc00", color: "#000" }} onClick={async () => {
            await updateDoc(doc(db, "tickets", activeTicket.id), { status: "retrieving", retrievedBy: valetName });
            try {
              await fetch("/api/notify", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "car_requested", channel: "whatsapp", phone: activeTicket?.customerPhone || "", ticketNum: activeTicket.ticketNum, car: activeTicket.car, color: activeTicket.color, spot: activeTicket.spot, customerName: activeTicket.customerName, eventId: activeTicket?.eventId || null }),
              });
            } catch (e) {}
            setView("dashboard");
          }}>START RETRIEVAL</button>
        )}
        {activeTicket.status === "retrieving" && (
          <button style={S.btn} onClick={() => { markDelivered(activeTicket.id); setView("dashboard"); }}>MARK DELIVERED</button>
        )}
        {valetRole === "manager" && (
          <button style={S.btnRed} onClick={() => deleteTicket(activeTicket.id)}>DELETE TICKET</button>
        )}
        <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={() => {
            setNewTicket({ code: activeTicket.confirmCode, num: activeTicket.ticketNum, id: activeTicket.id });
            setShowQR(true);
          }}>Show QR Code</button>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={() => {
            if (activeTicket.type === "manual" || activeTicket.isManual) {
              setEditTicket(activeTicket);
              setShowManualTicket(true);
              setView("dashboard");
            } else {
              setCarDetails({ make: activeTicket.make || "", model: activeTicket.model || "", color: activeTicket.color || "", plate: activeTicket.plate || "" });
              setForm({ spot: activeTicket.spot || "", damage: activeTicket.damage || "" });
              setTicketPhotos(activeTicket.photos || []);
              setFormPhoto(activeTicket.photoURL || "");
              setSpotPhoto(activeTicket.spotPhotoURL || "");
              setView("details");
            }
          }}>Edit Ticket</button>
        </div>
      </div>
    </div>
  );
  } // end liveTicket block

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

  // -- Manual ticket entry ------------------------------------
  if (showManualTicket) {
    return <ManualTicket valetName={valetName} valetRole={valetRole} currentEvent={currentEvent} onClose={() => { setShowManualTicket(false); setEditTicket(null); }} ticketId={editTicket?.id || null} initialData={editTicket} />;
  }

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

      {/* Clock in/out bar */}
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

      {/* Big NEW TICKET - clocked in required for non-managers */}
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
