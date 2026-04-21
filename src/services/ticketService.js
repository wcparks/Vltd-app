import { db } from "../config/firebase";
import { collection, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { getNextTicketNumber } from "./eventService";

export async function createManualTicketService({
  form,
  valetName,
  currentEvent,
  tipAmount,
  paymentMethod,
  ticketId,
  initialData
}) {
  console.log("CREATE INPUT:", {
    form,
    valetName,
    currentEvent,
    tipAmount,
    paymentMethod,
    ticketId,
    initialData
  });

  try {
    console.log("CREATE TICKET INPUT:", { form, valetName, currentEvent, tipAmount, paymentMethod, ticketId, initialData });

    const carString = [form.make, form.model].filter(Boolean).join(' ');

    if (ticketId) {
      // EDIT MODE — update existing ticket
      await updateDoc(doc(db, 'tickets', ticketId), {
        paperTicketNum: form.paperTicketNum || '',
        plate: form.plate,
        car: carString,
        make: form.make,
        model: form.model,
        color: form.color,
        spot: form.spot,
        damage: form.damage,
        notes: form.notes,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        tip: tipAmount,
        tipPaymentMethod: paymentMethod,
      });

      return {
        id: ticketId,
        num: initialData?.paperTicketNum || initialData?.ticketNum,
        code: initialData?.confirmCode
      };

    } else {
      // CREATE MODE
      let num, code;

      if (currentEvent && currentEvent.id) {
        num = await getNextTicketNumber(currentEvent.id);
        code = `VLT-${currentEvent.id.slice(0, 6)}-${num}`;
      } else {
        num = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
        code = `LOC-${num}-${Date.now()}`;
      }

      console.log("WRITING TICKET:", {
        form,
        valetName,
        currentEvent,
        tipAmount,
        paymentMethod
      });

      console.log("CREATING TICKET WITH:", form);

      const docRef = await addDoc(collection(db, 'tickets'), {
        ticketNum: num,
        confirmCode: code,
        paperTicketNum: form.paperTicketNum || '',
        date: new Date().toISOString().slice(0, 10),
        eventId: currentEvent?.id || "LOCATION",
        eventName: currentEvent?.name || null,
        createdBy: valetName,
        loggedBy: valetName,
        parkedBy: valetName,
        retrievedBy: '',
        plate: form.plate,
        car: carString,
        make: form.make,
        model: form.model,
        color: form.color,
        spot: form.spot,
        damage: form.damage,
        notes: form.notes,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        photoURL: '',
        photos: [],
        spotPhotoURL: '',
        status: 'parked',
        tip: tipAmount,
        tipPaymentMethod: paymentMethod,
        rating: 0,
        review: '',
        isManual: true,
        type: "manual",
        time: serverTimestamp(),
      });

      return {
        id: docRef.id,
        num: form.paperTicketNum || num,
        code
      };
    }

  } catch (err) {
    console.error("SERVICE ERROR:", err);
    console.error("ERROR CODE:", err.code);
    console.error("ERROR MESSAGE:", err.message);
    throw err;
  }
}
