import { useEffect, useMemo, useState } from "react";

const WORK_SECONDS = 25 * 60;
const REST_SECONDS = 5 * 60;
const STORAGE_KEY = "pomodoro-completions";

type Mode = "work" | "rest";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remain = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remain}`;
}

function loadCompletions(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is number => typeof item === "number");
  } catch {
    return [];
  }
}

function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
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
  const [completions, setCompletions] = useState<number[]>(() => loadCompletions());

  const modeLabel = useMemo(() => {
    return mode === "work" ? "工作中" : "休息中";
  }, [mode]);

  const { todayCount, weekCount } = useMemo(() => {
    const startOfToday = getStartOfToday().getTime();
    const startOfWeek = getStartOfWeek().getTime();

    let today = 0;
    let week = 0;

    for (const timestamp of completions) {
      if (timestamp >= startOfWeek) week += 1;
      if (timestamp >= startOfToday) today += 1;
    }

    return { todayCount: today, weekCount: week };
  }, [completions]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
  }, [completions]);

  useEffect(() => {
    if (!isRunning) return;

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) return prev - 1;

        if (mode === "work") {
          setCompletions((prevCompletions) => [...prevCompletions, Date.now()]);
        }

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

      <p className="hint">今日完成：{todayCount} 个</p>
      <p className="hint">本周完成：{weekCount} 个</p>
      <p className="hint">默认工作 25 分钟，休息 5 分钟。</p>
    </main>
  );
}
