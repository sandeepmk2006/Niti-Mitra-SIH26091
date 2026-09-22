/**
 * @fileoverview AuthContext — Global React Authentication Provider
 * Manages user session state and profile throughout the app lifecycle.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { AuthService, ProfileUpdate, UserProfile } from "../services/AuthService";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (phoneNumber: string, passcode: string) => Promise<void>;
  signUp: (
    fullName: string,
    phoneNumber: string,
    passcode: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** Save name and/or preferences to Firestore and update `user` in place. */
  updateProfile: (update: ProfileUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  signUp: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChangedListener(
      async (firebaseUser) => {
        if (firebaseUser) {
          const profile = await AuthService.getUserProfile(firebaseUser.uid);
          // On sign-up this listener can fire before the profile document is written; keep the
          // profile signUp()/login() already set rather than overwriting it with the fallback.
          setUser((current) =>
            profile ??
            (current?.uid === firebaseUser.uid
              ? current
              : {
                  uid: firebaseUser.uid,
                  fullName: "Entrepreneur",
                  phoneNumber: firebaseUser.email
                    ? firebaseUser.email.split("@")[0]
                    : "",
                  preferences: null,
                })
          );
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const login = async (phoneNumber: string, passcode: string) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.login(phoneNumber, passcode);
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    fullName: string,
    phoneNumber: string,
    passcode: string
  ) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.signUp(
        fullName,
        phoneNumber,
        passcode
      );
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (update: ProfileUpdate) => {
    if (!user) return;
    await AuthService.updateUserProfile(user.uid, update);
    setUser((current) =>
      current
        ? {
            ...current,
            ...(update.fullName !== undefined ? { fullName: update.fullName.trim() } : {}),
            ...(update.preferences !== undefined ? { preferences: update.preferences ?? {} } : {}),
          }
        : current
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signUp,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
