"use client";

/**
 * Sign-up only creates the account; the business details typed there are kept
 * in this tab's session storage so onboarding can pre-fill them after email
 * verification. Nothing sensitive is stored, and failures are ignored.
 */
export type OnboardingDraft = { businessName: string; category: string; city: string };

const KEY = "smeconnect:onboarding-draft";

export function saveOnboardingDraft(draft: OnboardingDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable (private mode); onboarding just starts empty */
  }
}

export function readOnboardingDraft(): Partial<OnboardingDraft> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Partial<OnboardingDraft>;
  } catch {
    return {};
  }
}

export function clearOnboardingDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
