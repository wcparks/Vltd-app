import { db, storage } from "../config/firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { incrementStat } from "../components/EmployeeProfiles";
import { sendWhatsApp } from "../services/notifyService";

function today() { return new Date().toISOString().slice(0, 10); }
const ticketURL = (code) => `https://valet-app-woad.vercel.app/ticket?code=${encodeURIComponent(code)}`;

export function useTickets({
  tickets, valetName, valetRole, currentEvent,
  activeTicket, saving, carDetails, form, ticketPhotos, formPhoto, spotPhoto,
  setLoading, setSaving, setView, setShowQR, setNewTicket, setActiveTicket,
  setCarDetails, setForm, setTicketPhotos, setFormPhoto, setSpotPhoto,
  setShowManualTicket, setEditTicket,
}) {
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

  return {
    createTicket,
    saveDetails,
    markDelivered,
    deleteTicket,
    handleFillDetails,
    handleStartRetrieval,
    handleEditTicket,
    handleShowQR,
  };
}
