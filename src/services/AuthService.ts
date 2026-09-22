/**
 * @fileoverview AuthService — Firebase Authentication & Firestore User Management
 * Enables authentication using Full Name, 10-digit Mobile Number, and a 6-digit Passcode.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, DocumentData } from "firebase/firestore";

import { auth, db } from "./firebase";
import { PreferenceAnswers, sanitizeAnswers } from "./preferences";

export interface UserProfile {
  uid: string;
  fullName: string;
  phoneNumber: string;
  createdAt?: string;
  /** Null until the user has been through the preferences questionnaire once. */
  preferences: PreferenceAnswers | null;
}

export type ProfileUpdate = Partial<Pick<UserProfile, "fullName" | "preferences">>;

function profileFromDoc(uid: string, data: DocumentData, fallbackPhone = ""): UserProfile {
  return {
    uid,
    fullName: data.fullName || "Entrepreneur",
    phoneNumber: data.phoneNumber || fallbackPhone,
    createdAt: data.createdAt,
    preferences: data.preferences ? sanitizeAnswers(data.preferences) : null,
  };
}

/** Why an auth call failed — screens map this to a translated message. */
export type AuthErrorReason =
  | "phone-in-use"
  | "invalid-credentials"
  | "network"
  | "too-many-requests"
  | "unknown";

export class AuthError extends Error {
  constructor(
    readonly reason: AuthErrorReason,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function toAuthError(error: unknown): AuthError {
  const err = error as { code?: string; message?: string };
  switch (err.code) {
    case "auth/email-already-in-use":
      return new AuthError("phone-in-use", "Mobile number is already registered.");
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return new AuthError("invalid-credentials", "Incorrect mobile number or passcode.");
    case "auth/network-request-failed":
      return new AuthError("network", "Network request failed.");
    case "auth/too-many-requests":
      return new AuthError("too-many-requests", "Too many attempts.");
    default:
      return new AuthError("unknown", err.message || "Authentication failed.");
  }
}

export class AuthService {
  /**
   * Converts a 10-digit phone number into a internal email domain format
   * required by Firebase Auth (e.g. 9876543210 -> 9876543210@sih26091.app).
   */
  public static formatPhoneToEmail(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      throw new Error("Please enter a valid 10-digit mobile number.");
    }
    const tenDigits = cleaned.slice(-10);
    return `${tenDigits}@sih26091.app`;
  }

  /**
   * Sanitizes 10-digit phone number for display/storage.
   */
  public static cleanPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      throw new Error("Mobile number must be at least 10 digits.");
    }
    return cleaned.slice(-10);
  }

  /**
   * Register a new micro-entrepreneur user with Name, Mobile Number, and 6-digit Passcode.
   * Creates Firebase Auth credentials and stores user profile in Firestore `users/{uid}`.
   */
  public static async signUp(
    fullName: string,
    phoneNumber: string,
    passcode: string
  ): Promise<UserProfile> {
    if (!fullName || fullName.trim().length === 0) {
      throw new Error("Full name is required.");
    }

    if (!passcode || passcode.trim().length !== 6 || !/^\d{6}$/.test(passcode)) {
      throw new Error("Passcode must be exactly 6 digits.");
    }

    const cleanPhone = this.cleanPhoneNumber(phoneNumber);
    const emailAlias = this.formatPhoneToEmail(cleanPhone);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailAlias,
        passcode
      );
      const user = userCredential.user;

      // 2. Prepare user profile document
      const userProfile: UserProfile = {
        uid: user.uid,
        fullName: fullName.trim(),
        phoneNumber: cleanPhone,
        createdAt: new Date().toISOString(),
        preferences: null,
      };

      // 3. Save to Firestore under `users/{uid}` (preferences are written later by the questionnaire)
      const { preferences: _unset, ...stored } = userProfile;
      await setDoc(doc(db, "users", user.uid), {
        ...stored,
        updatedAt: serverTimestamp(),
      });

      return userProfile;
    } catch (error: unknown) {
      throw toAuthError(error);
    }
  }

  /**
   * Login using Mobile Number and 6-digit Passcode.
   */
  public static async login(
    phoneNumber: string,
    passcode: string
  ): Promise<UserProfile> {
    if (!passcode || passcode.trim().length !== 6 || !/^\d{6}$/.test(passcode)) {
      throw new Error("Passcode must be a 6-digit code.");
    }

    const cleanPhone = this.cleanPhoneNumber(phoneNumber);
    const emailAlias = this.formatPhoneToEmail(cleanPhone);

    try {
      // 1. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        emailAlias,
        passcode
      );
      const user = userCredential.user;

      // 2. Fetch profile from Firestore
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      if (profileDoc.exists()) {
        return profileFromDoc(user.uid, profileDoc.data(), cleanPhone);
      }

      // Fallback profile if Firestore doc doesn't exist yet
      return {
        uid: user.uid,
        fullName: "Entrepreneur",
        phoneNumber: cleanPhone,
        preferences: null,
      };
    } catch (error: unknown) {
      throw toAuthError(error);
    }
  }

  /**
   * Log out the current user.
   */
  public static async logout(): Promise<void> {
    await firebaseSignOut(auth);
  }

  /**
   * Fetch current user profile from Firestore.
   */
  public static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const profileDoc = await getDoc(doc(db, "users", uid));
      if (profileDoc.exists()) {
        return profileFromDoc(uid, profileDoc.data());
      }
      return null;
    } catch (error) {
      console.error("[AuthService] Error fetching user profile:", error);
      return null;
    }
  }

  /**
   * Update the editable parts of the profile (name, preferences). The phone number is the login
   * identity and is deliberately not editable.
   */
  public static async updateUserProfile(uid: string, update: ProfileUpdate): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (update.fullName !== undefined) data.fullName = update.fullName.trim();
    if (update.preferences !== undefined) {
      data.preferences = update.preferences ?? {};
      data.preferencesUpdatedAt = serverTimestamp();
    }
    await setDoc(doc(db, "users", uid), data, { merge: true });
  }

  /**
   * Subscribe to auth state changes.
   */
  public static onAuthStateChangedListener(
    callback: (user: User | null) => void
  ) {
    return onAuthStateChanged(auth, callback);
  }
}
