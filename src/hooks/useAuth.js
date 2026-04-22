import { auth } from "../config/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";

export function useAuth({ valetName, valetRole, clockedIn, clockOut, setValetName, setValetRole, setCurrentEvent, setView, setTickets }) {
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

  return { handleJoinEvent, signOut, leaveEvent };
}
