import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCoLb5irRmwJIyBVxC2T46saECG5ZXKXJU",
  authDomain: "wc-valet-app.firebaseapp.com",
  projectId: "wc-valet-app",
  storageBucket: "wc-valet-app.firebasestorage.app",
  messagingSenderId: "425991585304",
  appId: "1:425991585304:web:83a95246daa77b2e5a0d6d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);
export const auth = getAuth(app);

export const requestNotificationPermission = async (valetName) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, {
      vapidKey: "BDYw7Bgw6svDyLaGPDMrFc1m-D97GV3R2G4QLHUnORkrBv9c5hsvFA3zps-EhcxXqDs-oqtoZywi0ndVApfTmEkH0"
    });
    return token;
  } catch (e) {
    console.error("Notification permission error:", e);
    return null;
  }
};

export { onMessage };
