import { useEffect, useState } from "react";
import type { Mood } from "./moods";

export type ReggieMoodInput = {
  isFocused: boolean;
  hasFieldError: boolean;
  isSubmitting: boolean;
  /** An ApiError code ("duplicate_registration", "event_full", "network", ...), if the last submit failed. */
  serverError?: string;
  /** Optional: change this (e.g. the joined error codes) to replay the error reaction for a new error. */
  errorKey?: unknown;
};

/** How long Reggie stays upset before going back to "typing". */
export const ERROR_MOOD_MS = 2500;

/** Persistent server states with their own pose; everything else is a short "error" reaction. */
const SERVER_MOODS: Record<string, Mood> = {
  duplicate_registration: "confused",
  event_full: "sad",
  network: "confused",
  not_found: "confused",
};

/**
 * Derives Reggie's mood from form state (Implementation Plan §7.2):
 * submitting -> loading; duplicate -> confused; full -> sad; field/server error -> error for 2.5s,
 * then typing; focused -> typing; otherwise idle.
 */
export function useReggieMood({ isFocused, hasFieldError, isSubmitting, serverError, errorKey }: ReggieMoodInput): Mood {
  const transientServerError = serverError !== undefined && !(serverError in SERVER_MOODS);
  const errorActive = hasFieldError || transientServerError;
  const [upset, setUpset] = useState(false);

  useEffect(() => {
    if (!errorActive) {
      setUpset(false);
      return;
    }
    setUpset(true);
    const t = window.setTimeout(() => setUpset(false), ERROR_MOOD_MS);
    return () => window.clearTimeout(t);
  }, [errorActive, errorKey, serverError]);

  if (isSubmitting) return "loading";
  if (serverError && serverError in SERVER_MOODS) return SERVER_MOODS[serverError];
  if (errorActive && upset) return "error";
  if (errorActive || isFocused) return "typing";
  return "idle";
}

export default useReggieMood;
