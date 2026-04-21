// ============================================================
// EVENTS.JS -- Multi-location event isolation
// Place at: src/events.js
// ============================================================
import { db } from '../config/firebase';
import {
  collection, addDoc, getDocs, doc, getDoc,
  query, where, orderBy, serverTimestamp, updateDoc, runTransaction
} from 'firebase/firestore';

// -- Create a new event (manager only) ----------------------
export async function createEvent({ name, location, date, passcode, startTime, endTime, spotsNeeded, notes }) {
  const ref = await addDoc(collection(db, 'events'), {
    name, location, date, passcode,
    startTime: startTime || '',
    endTime: endTime || '',
    spotsNeeded: parseInt(spotsNeeded) || 4,
    notes: notes || '',
    createdAt: serverTimestamp(),
    active: true,
    ticketCounter: 0,
    ticketCounterDate: new Date().toISOString().slice(0, 10),
  });
  return ref.id;
}

// -- Join event by passcode ---------------------------------
export async function joinEventByPasscode(passcode) {
  const q = query(
    collection(db, 'events'),
    where('passcode', '==', passcode.trim().toUpperCase()),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

// -- Get all events -----------------------------------------
export async function getAllEvents() {
  const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// -- Get single event ---------------------------------------
export async function getEvent(eventId) {
  const snap = await getDoc(doc(db, 'events', eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// -- Deactivate event ---------------------------------------
export async function closeEvent(eventId) {
  await updateDoc(doc(db, 'events', eventId), { active: false, closedAt: serverTimestamp() });
}

// -- ATOMIC ticket number for EVENT -------------------------
// Uses transaction - two valets can NEVER get the same number
// Resets daily, continues from last number within same day
export async function getNextTicketNumber(eventId) {
  const today = new Date().toISOString().slice(0, 10);
  const eventRef = doc(db, 'events', eventId);
  const nextNum = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(eventRef);
    if (!snap.exists()) {
      if (eventId === "LOCATION") {
        return null;
      }
      throw new Error('Event not found');
    }
    const data = snap.data();
    const storedDate = data.ticketCounterDate || '';
    const current = storedDate === today ? (data.ticketCounter || 0) : 0;
    const next = current + 1;
    transaction.update(eventRef, { ticketCounter: next, ticketCounterDate: today });
    return next;
  });
  return String(nextNum).padStart(4, '0');
}

// -- ATOMIC ticket number for LOCATION ----------------------
export async function getNextLocationTicketNumber(locationId) {
  const today = new Date().toISOString().slice(0, 10);
  const locationRef = doc(db, 'locations', locationId);
  const nextNum = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(locationRef);
    if (!snap.exists()) throw new Error('Location not found');
    const data = snap.data();
    const storedDate = data.ticketCounterDate || '';
    const current = storedDate === today ? (data.ticketCounter || 0) : 0;
    const next = current + 1;
    transaction.update(locationRef, { ticketCounter: next, ticketCounterDate: today });
    return next;
  });
  return String(nextNum).padStart(4, '0');
}
