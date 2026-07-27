import { useState, useRef, useEffect, useCallback } from "react";

interface SpeechRecognitionResult {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
}

interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export function useSpeechRecognition(
  onResult?: (transcript: string) => void,
  lang = "en-US",
): SpeechRecognitionResult {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Always-fresh lang ref — recognition reads this at call time so accent changes
  // take effect on the very next mic press without requiring hook recreaton.
  const langRef = useRef(lang);
  langRef.current = lang;

  // When true, a silent timeout on onend triggers an auto-restart.
  // Set to true on startListening, false on stopListening / any error / final result.
  const shouldRestartRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    isListeningRef.current = false;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("browser_unsupported");
      return;
    }
    if (isListeningRef.current) return;

    shouldRestartRef.current = true;
    setError(null);
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");

    // Inner setup function — defined here so auto-restart closures can call it
    // without requiring an external ref.
    function setupAndStart() {
      if (!shouldRestartRef.current) return;

      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = langRef.current;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) {
          // Got a result — stop the auto-restart cycle
          shouldRestartRef.current = false;
          finalTranscriptRef.current += final;
          setTranscript(finalTranscriptRef.current);
        }
        setInterimTranscript(interim);
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
        setInterimTranscript("");

        const finalResult = finalTranscriptRef.current.trim();
        if (finalResult) {
          onResultRef.current?.(finalResult);
        } else if (shouldRestartRef.current) {
          // Chrome ~5s no-speech timeout or ~60s continuous-mode kill:
          // restart silently so the mic stays live.
          setTimeout(() => {
            if (!shouldRestartRef.current) return;
            finalTranscriptRef.current = "";
            setupAndStart();
          }, 300);
        }
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        isListeningRef.current = false;
        setIsListening(false);
        setInterimTranscript("");

        if (event.error === "not-allowed" || event.error === "permission-denied") {
          shouldRestartRef.current = false;
          setError("mic_denied");
        } else if (event.error === "no-speech") {
          // onend will fire next — if shouldRestart is still true, it will
          // restart silently. Only show the error if we're NOT restarting.
          if (!shouldRestartRef.current) setError("no_speech");
        } else if (event.error === "aborted") {
          shouldRestartRef.current = false;
          setError("aborted");
        } else if (event.error === "network") {
          shouldRestartRef.current = false;
          setError("network_error");
        } else {
          shouldRestartRef.current = false;
          setError("unknown");
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        isListeningRef.current = false;
        setIsListening(false);
        shouldRestartRef.current = false;
        setError("unknown");
      }
    }

    setupAndStart();
  }, [isSupported]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}
