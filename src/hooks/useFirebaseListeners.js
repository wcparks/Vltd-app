import { useEffect, useRef } from "react";
import { db, messaging, auth, onMessage } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { playAlert } from "../utils/playAlert";

export function useFirebaseListeners({
  authUser, valetName, currentEvent, tickets,
  setAuthUser, setValetName, setValetRole, setCurrentEvent,
  setClockedIn, setClockInTime, setIsOnline, setTickets, setLogins, setRetrievingAlert,
}) {
  const prevTicketsRef = useRef({});

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
}
