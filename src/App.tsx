import { useEffect, useMemo, useState } from "react";

const WORK_SECONDS = 25 * 60;
const REST_SECONDS = 5 * 60;

type Mode = "work" | "rest";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remain = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remain}`;
}

let alertAudio: HTMLAudioElement | null = null;

async function playAlertTone(): Promise<void> {
  try {
    if (!alertAudio) {
      const base64Sound = await fetch("/alert.wav").then((res) => res.text());
      alertAudio = new Audio(`data:audio/wav;base64,${base64Sound.trim()}`);
    }

    alertAudio.currentTime = 0;
    await alertAudio.play();
  } catch {
    // If audio playback fails (autoplay policy, decode errors), ignore silently.
  }
}

function notify(): void {
  if (typeof Notification === "undefined") {
    globalThis.alert("时间到了，该休息了！");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification("番茄钟", { body: "时间到了，该休息了！" });
    return;
  }

  globalThis.alert("时间到了，该休息了！");
}

export default function App() {
  const [mode, setMode] = useState<Mode>("work");
  const [remainingSeconds, setRemainingSeconds] = useState<number>(WORK_SECONDS);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const modeLabel = useMemo(() => {
    return mode === "work" ? "工作中" : "休息中";
  }, [mode]);

  useEffect(() => {
    if (!isRunning) return;

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) return prev - 1;

        const nextMode: Mode = mode === "work" ? "rest" : "work";
        const nextDuration = nextMode === "work" ? WORK_SECONDS : REST_SECONDS;

        setMode(nextMode);
        setIsRunning(false);
        void playAlertTone();
        notify();
        return nextDuration;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning, mode]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // Ignore permission request errors, fallback to alert.
      });
    }
  }, []);

  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);
  const reset = () => {
    setIsRunning(false);
    setMode("work");
    setRemainingSeconds(WORK_SECONDS);
  };

  return (
    <main className="container">
      <h1>番茄钟</h1>
      <p className="mode">{modeLabel}</p>
      <p className="time">{formatTime(remainingSeconds)}</p>

      <div className="actions">
        <button onClick={start} disabled={isRunning}>
          开始
        </button>
        <button onClick={pause} disabled={!isRunning}>
          暂停
        </button>
        <button onClick={reset}>重置</button>
      </div>

      <p className="hint">默认工作 25 分钟，休息 5 分钟。</p>
    </main>
  );
}
