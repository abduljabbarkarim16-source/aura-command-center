/**
 * UserProfileMemoryService — AURA Phase 3G (Milestone 3)
 *
 * Structured, persistent identity for the user (name, preferred name, voice
 * preference, UI prefs, autonomy preference). Survives restarts.
 *
 * The `name` is mirrored into AuraPersonalityService.userName so it flows into
 * the system prompt automatically — one source of truth for the spoken name.
 *
 * Acceptance: "Remember my name is Karim" -> setName('Karim'); later
 * getDisplayName() returns 'Karim' and survives an app restart.
 */

import type { UserProfile, VoicePreference, AutonomyPreference } from '../../types/aura-memory';
import { auraPersonalityService } from '../personality/AuraPersonalityService';
import { capabilityRegistryService } from '../capabilities/CapabilityRegistryService';

const STORAGE_KEY = 'aura.userProfile';

type ProfileListener = (profile: UserProfile) => void;

function nowIso(): string { return new Date().toISOString(); }

class UserProfileMemoryServiceImpl {
  private profile: UserProfile;
  private listeners = new Set<ProfileListener>();

  constructor() {
    this.profile = this.load();
    // If a name exists only in personality config, import it.
    try {
      const personalityName = auraPersonalityService.getConfig().userName?.trim();
      if (!this.profile.name && personalityName) {
        this.profile.name = personalityName;
        this.save();
      }
    } catch { /* personality optional */ }
    this.registerCapability();
  }

  private load(): UserProfile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { uiPreferences: {}, updatedAt: nowIso(), ...(JSON.parse(raw) as Partial<UserProfile>) } as UserProfile;
    } catch { /* ignore */ }
    return { uiPreferences: {}, updatedAt: nowIso() };
  }

  private save() {
    this.profile.updatedAt = nowIso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile)); } catch { /* full */ }
    this.notify();
  }

  private registerCapability() {
    try {
      capabilityRegistryService.setStatus('memory.userProfile', 'available',
        this.profile.name ? `Profile present (name: ${this.profile.name}).` : 'Profile slot ready (no name yet).');
    } catch { /* optional */ }
  }

  subscribe(fn: ProfileListener): () => void {
    this.listeners.add(fn);
    fn({ ...this.profile });
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = { ...this.profile };
    for (const fn of this.listeners) fn(snap);
  }

  get(): UserProfile { return { ...this.profile }; }

  /** Preferred name, falling back to name. */
  getDisplayName(): string | undefined {
    return this.profile.preferredName || this.profile.name || undefined;
  }

  setName(name: string) {
    const clean = name.trim().slice(0, 80);
    if (!clean) return;
    this.profile.name = clean;
    // Mirror into personality so the system prompt addresses the user by name.
    try { auraPersonalityService.setUserName(clean); } catch { /* ignore */ }
    this.save();
    this.registerCapability();
  }

  setPreferredName(name: string) {
    this.profile.preferredName = name.trim().slice(0, 80) || undefined;
    this.save();
  }

  setVoicePreference(pref: VoicePreference) {
    this.profile.voicePreference = pref;
    this.save();
  }

  setAutonomyPreference(pref: AutonomyPreference) {
    this.profile.autonomyPreference = pref;
    this.save();
  }

  setUiPreference(key: string, value: string) {
    this.profile.uiPreferences = { ...this.profile.uiPreferences, [key]: value };
    this.save();
  }

  removeUiPreference(key: string) {
    const { [key]: _drop, ...rest } = this.profile.uiPreferences;
    void _drop;
    this.profile.uiPreferences = rest;
    this.save();
  }

  clear() {
    this.profile = { uiPreferences: {}, updatedAt: nowIso() };
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.notify();
  }

  /** Short, speakable summary of who AURA thinks the user is. */
  summary(): string {
    const p = this.profile;
    if (!p.name && !p.preferredName && Object.keys(p.uiPreferences).length === 0 && !p.voicePreference) {
      return "I don't have a profile saved for you yet.";
    }
    const bits: string[] = [];
    if (p.preferredName && p.preferredName !== p.name) bits.push(`You prefer to be called ${p.preferredName}${p.name ? ` (name: ${p.name})` : ''}.`);
    else if (p.name) bits.push(`Your name is ${p.name}.`);
    if (p.voicePreference) bits.push(`Voice preference: ${p.voicePreference}.`);
    if (p.autonomyPreference) bits.push(`Autonomy: ${p.autonomyPreference}.`);
    const uiKeys = Object.keys(p.uiPreferences);
    if (uiKeys.length) bits.push(`UI prefs: ${uiKeys.map(k => `${k}=${p.uiPreferences[k]}`).join(', ')}.`);
    return bits.join(' ');
  }
}

export const userProfileMemoryService = new UserProfileMemoryServiceImpl();
