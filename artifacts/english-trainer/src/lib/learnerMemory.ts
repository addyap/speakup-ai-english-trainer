export interface LearnerProfile {
  deviceId: string;
  estimatedLevel: string | null;
  errorTags: string[];
  preferredFeedbackLanguage: string;
  preferredInterfaceLanguage: string;
  recentScenarios: string[];
  totalSessions: number;
  totalPracticeTurns: number;
  lastUpdated: number;
}

const STORAGE_KEY = "speakup_learner_profile";

function generateDeviceId(): string {
  return `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function getLearnerProfile(): LearnerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LearnerProfile>;
      return {
        deviceId: typeof p.deviceId === "string" ? p.deviceId : generateDeviceId(),
        estimatedLevel: typeof p.estimatedLevel === "string" ? p.estimatedLevel : null,
        errorTags: Array.isArray(p.errorTags) ? p.errorTags.slice(0, 10) : [],
        preferredFeedbackLanguage: typeof p.preferredFeedbackLanguage === "string" ? p.preferredFeedbackLanguage : "English",
        preferredInterfaceLanguage: typeof p.preferredInterfaceLanguage === "string" ? p.preferredInterfaceLanguage : "English",
        recentScenarios: Array.isArray(p.recentScenarios) ? p.recentScenarios.slice(0, 5) : [],
        totalSessions: typeof p.totalSessions === "number" ? p.totalSessions : 0,
        totalPracticeTurns: typeof p.totalPracticeTurns === "number" ? p.totalPracticeTurns : 0,
        lastUpdated: typeof p.lastUpdated === "number" ? p.lastUpdated : Date.now(),
      };
    }
  } catch {
    // localStorage unavailable or data corrupted
  }
  const fresh: LearnerProfile = {
    deviceId: generateDeviceId(),
    estimatedLevel: null,
    errorTags: [],
    preferredFeedbackLanguage: "English",
    preferredInterfaceLanguage: "English",
    recentScenarios: [],
    totalSessions: 0,
    totalPracticeTurns: 0,
    lastUpdated: Date.now(),
  };
  saveLearnerProfile(fresh);
  return fresh;
}

export function saveLearnerProfile(profile: LearnerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // storage unavailable
  }
}

export function updateLearnerLanguages(feedbackLang: string, interfaceLang: string): void {
  const profile = getLearnerProfile();
  saveLearnerProfile({
    ...profile,
    preferredFeedbackLanguage: feedbackLang,
    preferredInterfaceLanguage: interfaceLang,
    lastUpdated: Date.now(),
  });
}

export function updateAfterSession(
  estimatedLevel: string,
  improvements: string[],
  scenario: string,
): void {
  const profile = getLearnerProfile();

  const newTags = extractErrorTags(improvements);
  const combinedTags = [...newTags, ...profile.errorTags]
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 10);

  const recentScenarios = [
    scenario,
    ...profile.recentScenarios.filter((s) => s !== scenario),
  ].slice(0, 5);

  saveLearnerProfile({
    ...profile,
    estimatedLevel,
    errorTags: combinedTags,
    recentScenarios,
    totalSessions: profile.totalSessions + 1,
    totalPracticeTurns: profile.totalPracticeTurns + 1,
    lastUpdated: Date.now(),
  });
}

function extractErrorTags(improvements: string[]): string[] {
  const tags: string[] = [];
  for (const imp of improvements) {
    const match = imp.match(/instead of ['"]([^'"]{1,40})['"]/i);
    if (match) {
      tags.push(match[1].trim().toLowerCase());
    }
  }
  return tags;
}

export function buildMemoryNote(profile: LearnerProfile): string {
  const parts: string[] = [];
  if (profile.estimatedLevel) {
    parts.push(`Estimated level from previous sessions: ${profile.estimatedLevel}`);
  }
  if (profile.errorTags.length > 0) {
    parts.push(`Recent recurring errors: ${profile.errorTags.slice(0, 5).join(", ")}`);
  }
  if (profile.recentScenarios.length > 0) {
    parts.push(`Recently practised scenarios: ${profile.recentScenarios.join(", ")}`);
  }
  if (parts.length === 0) return "";
  return parts.join("\n");
}
