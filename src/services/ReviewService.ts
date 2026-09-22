/**
 * @fileoverview One-time app review (1–5 stars + optional comment), stored at
 * /users/{uid}/feedback/review. Collect all reviews with a `feedback` collection-group query.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "./firebase";
import type { LanguageCode } from "../i18n/languages";

export interface AppReview {
  /** First name only, shown on the reviews dashboard. */
  name: string;
  rating: number;
  comment: string;
  language: LanguageCode;
  appVersion: string;
  createdAt: number;
}

const reviewRef = (uid: string) => doc(db, "users", uid, "feedback", "review");

export async function getReview(uid: string): Promise<AppReview | null> {
  const snapshot = await getDoc(reviewRef(uid));
  return snapshot.exists() ? (snapshot.data() as AppReview) : null;
}

/** Saves the review unless one already exists (a user reviews once). Returns the stored review. */
export async function submitReview(uid: string, review: Omit<AppReview, "createdAt">): Promise<AppReview> {
  const existing = await getReview(uid);
  if (existing) return existing;
  const stored: AppReview = {
    name: review.name.trim().split(/\s+/)[0] ?? "",
    rating: Math.min(5, Math.max(1, Math.round(review.rating))),
    comment: review.comment.trim().slice(0, 1000),
    language: review.language,
    appVersion: review.appVersion,
    createdAt: Date.now(),
  };
  await setDoc(reviewRef(uid), stored);
  return stored;
}
