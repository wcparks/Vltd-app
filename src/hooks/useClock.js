import { db } from "../config/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function today() { return new Date().toISOString().slice(0, 10); }

export function useClock({ valetName, valetRole, currentEvent, clockedIn, clockInTime, setClockedIn, setClockInTime }) {
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

  return { clockIn, clockOut };
}
