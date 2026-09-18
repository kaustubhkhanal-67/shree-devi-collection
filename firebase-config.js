// Free Firebase Spark connection for order records. Customer images and
// payment screenshots intentionally stay in the browser and are not uploaded.
const shreeFirebaseConfig = {
  apiKey: "AIzaSyAbJoNNQOGASESCc3AKFFVB8Cyy1l9CY5s",
  authDomain: "shree-devi-collection.firebaseapp.com",
  projectId: "shree-devi-collection",
  storageBucket: "shree-devi-collection.firebasestorage.app",
  messagingSenderId: "38078024672",
  appId: "1:38078024672:web:7c58b8108913e80fd13985",
  measurementId: "G-GP74LDZ0L7"
};

window.shreeFirebaseReady = (async () => {
  const [{ initializeApp }, firestore, auth] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js")
  ]);
  const app = initializeApp(shreeFirebaseConfig);
  const db = firestore.getFirestore(app);
  const authClient = auth.getAuth(app);
  try { await auth.signInAnonymously(authClient); } catch (error) { console.warn("Firebase anonymous sign-in is not enabled yet.", error); }
  return { db, ...firestore };
})();
