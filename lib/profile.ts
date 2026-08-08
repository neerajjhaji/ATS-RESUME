"use client";

import type { MasterProfile } from "@/types";

export const PROFILE_KEY = "agent-master-profile";

export const DEFAULT_PROFILE: MasterProfile = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  yearsExperience: "",
  noticePeriod: "",
  currentCtc: "",
  expectedCtc: "",
  workAuth: "",
  linkedinUrl: "",
  portfolioUrl: "",
};

export function loadProfile(): MasterProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: MasterProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
