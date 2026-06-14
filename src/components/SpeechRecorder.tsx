"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { isSpeechRecognitionSupported, createArabicSpeechRecognizer } from "@/lib/speechAnalysis";

interface SpeechRecorderProps {
  onRecordingComplete: (spokenText: string) => void;
  disabled?: boolean;
}

type RecordingStatus = "idle" | "recording" | "processing";

export default function SpeechRecorder({
  onRecordingComplete,
  disabled = false,
}: SpeechRecorderProps) {
  const t = useTranslations();
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recognizedText, setRecognizedText] = useState("");
  const [browserSupport, setBrowserSupport] = useState(true);

  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    setBrowserSupport(isSpeechRecognitionSupported());
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (recognizerRef.current) {
        try { recognizerRef.current.abort(); } catch {}
      }
    };
  }, []);

  const startTimer = () => {
    setElapsedTime(0);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(() => {
    setError(null);
    setRecognizedText("");
    setStatus("idle");

    if (!browserSupport) {
      setError("Web Speech API is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognizer = createArabicSpeechRecognizer();
    if (!recognizer) {
      setError("Could not create speech recognizer.");
      return;
    }

    recognizerRef.current = recognizer;
    let finalText = "";

    recognizer.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        }
      }
      setRecognizedText(finalText.trim());
    };

    recognizer.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        setError("لم يتم اكتشاف كلام. تأكد من الميكروفون.");
      } else if (event.error === "aborted") {
        // User stopped, that's fine
      } else if (event.error === "audio-capture") {
        setError("لا يمكن الوصول إلى الميكروفون. تحقق من الصلاحيات.");
      } else if (event.error === "not-allowed") {
        setError("تم رفض الإذن للميكروفون. سمح في إعدادات المتصفح.");
      } else {
        setError(`خطأ في التعرف: ${event.error}`);
      }
      stopTimer();
      setStatus("idle");
    };

    recognizer.onend = () => {
      stopTimer();
      if (status === "recording") {
        // Auto-stopped (e.g., silence timeout) — keep showing recorded text
        setStatus("idle");
      }
    };

    try {
      recognizer.start();
      setStatus("recording");
      startTimer();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      setError("Could not start speech recognition.");
    }
  }, [browserSupport, status]);

  const stopRecording = useCallback(() => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch {}
    }
    stopTimer();
    setStatus("processing");

    // Send the transcribed text for analysis
    if (recognizedText.trim()) {
      onRecordingComplete(recognizedText.trim());
    }

    // Reset after a brief moment
    setTimeout(() => {
      setStatus("idle");
    }, 500);
  }, [recognizedText, onRecordingComplete]);

  const resetRecording = () => {
    setRecognizedText("");
    setStatus("idle");
    setError(null);
    setElapsedTime(0);
  };

  if (!browserSupport) {
    return (
      <div className="space-y-5">
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-center">
          {t("speech.browserNotSupported") || "Web Speech API غير مدعوم في هذا المتصفح. استخدم Chrome أو Edge."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex justify-center gap-3">
        {status !== "recording" && (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-surface-800 border border-surface-700/50 text-surface-200 text-sm font-medium hover:bg-surface-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            {t("speech.startRecording")}
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={stopRecording}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all animate-pulse"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              {t("speech.stopRecording")} ({formatTime(elapsedTime)})
            </button>
          </>
        )}
      </div>

      {/* Recognized text display */}
      {recognizedText && (
        <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-sm text-center" dir="rtl">
          <p className="font-arabic">{recognizedText}</p>
        </div>
      )}

      {status === "processing" && (
        <div className="text-center text-sm text-gray-400">
          جاري التحليل...
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {(recognizedText || status === "idle") && status !== "recording" && status !== "processing" && recognizedText && (
        <div className="flex justify-center">
          <button
            onClick={resetRecording}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 border border-surface-700/50 text-surface-300 text-xs font-medium hover:bg-surface-700/60 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            {t("speech.recordAgain")}
          </button>
        </div>
      )}
    </div>
  );
}
