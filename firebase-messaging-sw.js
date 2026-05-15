importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCoLb5irRmwJIyBVxC2T46saECG5ZXKXJU",
  authDomain: "wc-valet-app.firebaseapp.com",
  projectId: "wc-valet-app",
  storageBucket: "wc-valet-app.firebasestorage.app",
  messagingSenderId: "425991585304",
  appId: "1:425991585304:web:83a95246daa77b2e5a0d6d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'vltd-retrieval',
    requireInteraction: true,
  });
});
