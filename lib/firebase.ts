// Import functions to initialize Firebase app
// initializeApp: creates a new Firebase app instance
// getApp / getApps: used to avoid initializing Firebase more than once
import { initializeApp, getApp, getApps } from "firebase/app";

// Import Firebase Authentication utilities
// initializeAuth: initializes Firebase Auth manually (needed for React Native)
// getReactNativePersistence: enables persistent login using AsyncStorage
import { initializeAuth, getReactNativePersistence } from "firebase/auth";

// Import Firestore database initializer
import { getFirestore } from "firebase/firestore";

// AsyncStorage is used to store auth session locally on the device
// This keeps the user logged in even after closing the app
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import Firebase Storage initializer (used for images)
import { getStorage } from "firebase/storage";

// Firebase project configuration
// These values identify our Firebase project (JoDonate)
// They are safe to expose in frontend apps (Firebase security rules protect data)
const firebaseConfig = {
  apiKey: "AIzaSyAbykpTru6dU1aqwfVcYDuJgocsljREo-A",
  authDomain: "jodonate-6bf5a.firebaseapp.com",
  projectId: "jodonate-6bf5a",
  storageBucket: "jodonate-6bf5a.firebasestorage.app",
  messagingSenderId: "513182868684",
  appId: "1:513182868684:web:0bc931351410be4a2f4e69",
};

// Initialize Firebase app
// getApps().length checks if Firebase was already initialized
// This prevents crashes caused by initializing Firebase more than once
export const app = getApps().length
  ? getApp()                 // If already initialized, reuse existing app
  : initializeApp(firebaseConfig); // Otherwise, initialize a new app

// Initialize Firebase Authentication
// We explicitly initialize auth to use AsyncStorage persistence
// This is required in React Native (unlike web)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore database
// Firestore is used to store users, items, requests, notifications, etc.
export const db = getFirestore(app);

// Initialize Firebase Storage
// Used to store uploaded item images
export const storage = getStorage(app);

/*This file initializes and configures Firebase services for the app.
It sets up Firebase Authentication with persistent login using AsyncStorage,
Firestore database for data storage, and Firebase Storage for image uploads.
The configuration ensures Firebase is only initialized once to prevent errors.
*/