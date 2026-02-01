import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAbykpTru6dU1aqwfVcYDuJgocsljREo-A",
  authDomain: "jodonate-6bf5a.firebaseapp.com",
  projectId: "jodonate-6bf5a",
  storageBucket: "jodonate-6bf5a.firebasestorage.app",
  messagingSenderId: "513182868684",
  appId: "1:513182868684:web:0bc931351410be4a2f4e69",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// ✅ Firestore
export const db = getFirestore(app);
export const storage = getStorage(app);
