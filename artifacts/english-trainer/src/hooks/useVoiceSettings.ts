import { useState, useCallback } from "react";
import {
  type VoiceSettings,
  getVoiceSettings,
  saveVoiceSettings,
} from "@/lib/voiceSettings";

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());

  const updateSettings = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveVoiceSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
