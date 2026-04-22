import { useEffect, useMemo, useState } from "react";

const WORK_SECONDS = 25 * 60;
const REST_SECONDS = 5 * 60;
const TASK_TITLE_KEY = "pomodoro-task-title";
const TASK_RECORDS_KEY = "pomodoro-task-records";
const DEFAULT_TASK_TITLE = "专注任务";

type Mode = "work" | "rest";
type TaskRecord = {
  id: string;
  title: string;
  completedAt: number;
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remain = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remain}`;
}

function loadTaskTitle(): string {
  try {
    const raw = window.localStorage.getItem(TASK_TITLE_KEY);
    if (!raw) return DEFAULT_TASK_TITLE;
    return raw.trim() || DEFAULT_TASK_TITLE;
  } catch {
    return DEFAULT_TASK_TITLE;
  }
}

function loadTaskRecords(): TaskRecord[] {
  try {
    const raw = window.localStorage.getItem(TASK_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TaskRecord =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.completedAt === "number"
    );
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
  const [taskTitle, setTaskTitle] = useState<string>(() => loadTaskTitle());
  const [taskRecords, setTaskRecords] = useState<TaskRecord[]>(() => loadTaskRecords());

  const modeLabel = useMemo(() => {
    return mode === "work" ? "工作中" : "休息中";
  }, [mode]);

  const { todayCount, weekCount } = useMemo(() => {
    const startOfToday = getStartOfToday().getTime();
    const startOfWeek = getStartOfWeek().getTime();

    let today = 0;
    let week = 0;

    for (const record of taskRecords) {
      if (record.completedAt >= startOfWeek) week += 1;
      if (record.completedAt >= startOfToday) today += 1;
    }

    return { todayCount: today, weekCount: week };
  }, [taskRecords]);

  useEffect(() => {
    window.localStorage.setItem(TASK_TITLE_KEY, taskTitle);
  }, [taskTitle]);

  useEffect(() => {
    window.localStorage.setItem(TASK_RECORDS_KEY, JSON.stringify(taskRecords));
  }, [taskRecords]);

  useEffect(() => {
    if (!isRunning) return;

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) return prev - 1;

        if (mode === "work") {
          const title = taskTitle.trim() || DEFAULT_TASK_TITLE;
          setTaskRecords((prevRecords) => [
            {
              id: crypto.randomUUID(),
              title,
              completedAt: Date.now()
            },
            ...prevRecords
          ]);
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
  }, [isRunning, mode, taskTitle]);

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
      <h1 className="app-title">
        <span className="app-title-icon" aria-hidden="true">
          🍅
        </span>
        <span>番茄钟</span>
      </h1>
      <label className="task-label">
        任务标题
        <input
          className="task-input"
          value={taskTitle}
          onChange={(event) => setTaskTitle(event.target.value)}
          placeholder="输入当前任务标题"
        />
      </label>
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

      <section className="records">
        <h2>任务记录</h2>
        {taskRecords.length === 0 ? (
          <p className="empty-records">还没有完成记录</p>
        ) : (
          <ul className="record-list">
            {taskRecords.slice(0, 8).map((record) => (
              <li key={record.id} className="record-item">
                <span>{record.title}</span>
                <time>{new Date(record.completedAt).toLocaleString("zh-CN")}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
