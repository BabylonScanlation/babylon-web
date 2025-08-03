import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAee_aheDnkdht9I_eagReWAP25-IaMPtY",
  authDomain: "babylon-scanlation-users.firebaseapp.com",
  projectId: "babylon-scanlation-users",
  storageBucket: "babylon-scanlation-users.firebasestorage.app",
  messagingSenderId: "1091956230989",
  appId: "1:1091956230989:web:6184d7f256976c1e570504"
};

// Initialize Firebase App only once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export the initialized services directly
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();