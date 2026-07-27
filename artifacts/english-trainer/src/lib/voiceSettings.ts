export type AccentPref = "auto" | "british" | "american";

export interface VoiceSettings {
  autoSpeak: boolean;
  accentPreference: AccentPref;
  speakRate: number; // 0.6 – 1.4
  voiceURI: string;
}

const STORAGE_KEY = "speakup_voice_settings";

export const VOICE_DEFAULTS: VoiceSettings = {
  autoSpeak: true,
  accentPreference: "auto",
  speakRate: 0.95,
  voiceURI: "",
};

export function getVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // p may be an older shape with voiceEnabled — handle gracefully
      const p = JSON.parse(raw) as Partial<VoiceSettings> & { voiceEnabled?: boolean };
      return {
        autoSpeak:
          typeof p.autoSpeak === "boolean" ? p.autoSpeak
          : typeof p.voiceEnabled === "boolean" ? p.voiceEnabled
          : VOICE_DEFAULTS.autoSpeak,
        accentPreference:
          p.accentPreference === "auto" ||
          p.accentPreference === "british" ||
          p.accentPreference === "american"
            ? p.accentPreference
            : VOICE_DEFAULTS.accentPreference,
        speakRate:
          typeof p.speakRate === "number" &&
          p.speakRate >= 0.6 &&
          p.speakRate <= 1.4
            ? p.speakRate
            : VOICE_DEFAULTS.speakRate,
        voiceURI: typeof p.voiceURI === "string" ? p.voiceURI : "",
      };
    }
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
  return { ...VOICE_DEFAULTS };
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // unavailable
  }
}
