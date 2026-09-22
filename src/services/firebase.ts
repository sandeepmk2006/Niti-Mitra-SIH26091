/**
 * @fileoverview Central Firebase Service Initialization
 * Provides shared instances of Firebase App, Auth, Firestore, and Functions.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { Auth, Persistence, getAuth, initializeAuth } from "firebase/auth";
import { Firestore, getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";

// ──────────────────────────────────────────────
// Firebase Project Credentials Config
// ──────────────────────────────────────────────

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCDu_USTN3DIF_lwj7o9mOegxcbPQ8rsmc",
  authDomain: "business-idea-7956c.firebaseapp.com",
  projectId: "business-idea-7956c",
  storageBucket: "business-idea-7956c.firebasestorage.app",
  messagingSenderId: "1046644548641",
  appId: "1:1046644548641:web:f1991b4379b6cdb2fb6f60",
  measurementId: "G-NYFQD19DHG",
};

export const FUNCTIONS_REGION = "asia-south1";

// initializeAuth / initializeFirestore may only run once per app, so on a Fast Refresh re-run
// (app already exists) fall back to the getters, which return the already-configured instances.
const isFirstInit = getApps().length === 0;

// Singleton Firebase App instance
export const app: FirebaseApp = isFirstInit ? initializeApp(FIREBASE_CONFIG) : getApp();

// getReactNativePersistence only exists in the React Native build of firebase/auth (the one Metro
// resolves on device), and the default typings don't declare it.
const { getReactNativePersistence } = FirebaseAuth as unknown as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

function createAuth(): Auth {
  if (!isFirstInit || Platform.OS === "web" || !getReactNativePersistence) {
    return getAuth(app);
  }
  // Without this, React Native auth is in-memory only and users are logged out on every launch.
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

// Firebase services
export const auth: Auth = createAuth();
export const db: Firestore = isFirstInit
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app);
export const functions: Functions = getFunctions(app, FUNCTIONS_REGION);
