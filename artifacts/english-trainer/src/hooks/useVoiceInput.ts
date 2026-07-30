import { useState, useRef, useCallback, useEffect } from "react";

// Records microphone audio and transcribes it via /api/stt (OpenAI), a
// reliable cross-browser replacement for the Web Speech recognition API.
// Drop-in for useSpeechRecognition: same field names consumed by ConversationView,
// plus `isTranscribing` for the brief server round-trip after recording stops.

interface VoiceInputResult {
  isListening: boolean;      // actively recording
  isTranscribing: boolean;   // recording stopped, awaiting transcription
  isSupported: boolean;
  error: string | null;
  interimTranscript: string; // always "" (no live transcript with server STT)
  startListening: () => void;
  stopListening: () => void;
}

const SILENCE_MS = 1150;    // stop after this much silence once speech is detected
const MAX_MS = 30_000;      // hard cap on a single utterance
const SILENCE_LEVEL = 0.012;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const prefs = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return prefs.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result);
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceInput(onResult?: (transcript: string, audio?: Blob) => void): VoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const spokeRef = useRef(false);          // has the user actually spoken this take
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  const teardownMonitors = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (maxTimerRef.current !== null) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (audioCtxRef.current) { try { void audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
    silenceStartRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    teardownMonitors();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  }, [teardownMonitors]);

  const transcribe = useCallback(async (blob: Blob) => {
    if (cancelledRef.current) return;
    setIsTranscribing(true);
    try {
      const b64 = await blobToBase64(blob);
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mime: blob.type, lang: "en" }),
      });
      if (!res.ok) throw new Error(`stt ${res.status}`);
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (cancelledRef.current) return;
      if (text) onResultRef.current?.(text, blob);
      else setError("no_speech");
    } catch {
      if (!cancelledRef.current) setError("network_error");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // Voice-activity monitor: auto-stops after SILENCE_MS of quiet once the user
  // has actually spoken.
  const setupSilenceDetection = useCallback((stream: MediaStream) => {
    try {
      const AC = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();
        if (rms > SILENCE_LEVEL) {
          spokeRef.current = true;
          silenceStartRef.current = null;
        } else if (spokeRef.current) {
          if (silenceStartRef.current === null) silenceStartRef.current = now;
          else if (now - silenceStartRef.current > SILENCE_MS) { stopListening(); return; }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // If Web Audio isn't available, rely on the max-duration cap / manual stop.
    }
  }, [stopListening]);

  const startListening = useCallback(async () => {
    if (!isSupported) { setError("browser_unsupported"); return; }
    if (recorderRef.current && recorderRef.current.state === "recording") return;
    setError(null);
    cancelledRef.current = false;
    spokeRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? "mic_denied" : "unknown");
      return;
    }
    streamRef.current = stream;

    const mime = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      teardownMonitors();
      releaseStream();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (cancelledRef.current) return;
      if (!spokeRef.current || blob.size < 1200) { setError("no_speech"); return; }
      void transcribe(blob);
    };
    recorder.onerror = () => { teardownMonitors(); releaseStream(); setIsListening(false); setError("unknown"); };

    recorderRef.current = recorder;
    recorder.start();
    setIsListening(true);
    setupSilenceDetection(stream);
    maxTimerRef.current = setTimeout(() => stopListening(), MAX_MS);
  }, [isSupported, stopListening, teardownMonitors, releaseStream, transcribe, setupSilenceDetection]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      teardownMonitors();
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* ignore */ } }
      releaseStream();
    };
  }, [teardownMonitors, releaseStream]);

  return { isListening, isTranscribing, isSupported, error, interimTranscript: "", startListening, stopListening };
}
