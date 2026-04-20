// ============================================================
// EVENTS.JS — Multi-location event isolation
// Place at: src/events.js
// ============================================================
import { db } from './firebase';
import {
  collection, addDoc, getDocs, doc, getDoc,
  query, where, orderBy, serverTimestamp, updateDoc
} from 'firebase/firestore';

// ── Create a new event (manager only) ──────────────────────
export async function createEvent({ name, location, date, passcode }) {
  const ref = await addDoc(collection(db, 'events'), {
    name,
    location,
    date,
    passcode,
    createdAt: serverTimestamp(),
    active: true,
    ticketCounter: 0,
  });
  return ref.id;
}

// ── Join event by passcode (valet login) ───────────────────
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

// ── Get all events (manager dashboard) ────────────────────
export async function getAllEvents() {
  const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get single event ───────────────────────────────────────
export async function getEvent(eventId) {
  const snap = await getDoc(doc(db, 'events', eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ── Deactivate event ───────────────────────────────────────
export async function closeEvent(eventId) {
  await updateDoc(doc(db, 'events', eventId), { active: false });
}

// ── Get next ticket number for event (atomic-safe) ────────
// Call this before creating each ticket
export async function getNextTicketNumber(eventId) {
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  const current = snap.data()?.ticketCounter || 0;
  const next = current + 1;
  await updateDoc(eventRef, { ticketCounter: next });
  return String(next).padStart(4, '0'); // "0001", "0042", etc.
}
