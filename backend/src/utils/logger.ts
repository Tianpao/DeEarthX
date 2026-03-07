import { formatLevel, formatTime, colorize, COLORS } from "./colors.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
}

interface Logger {
  debug: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
}

// 日志缓冲区
const logBuffer: LogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

const log = (level: LogLevel, message: string, meta?: any) => {
  const timestamp = formatTime();
  const levelTag = formatLevel(level);
  
  // 添加到缓冲区
  const logEntry: LogEntry = {
    timestamp,
    level,
    message,
    meta
  };
  
  logBuffer.push(logEntry);
  
  // 保持缓冲区大小
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
  
  // 格式化元数据（如果有）
  let metaStr = "";
  if (meta) {
    try {
      const metaContent = typeof meta === "object" 
        ? JSON.stringify(meta) 
        : String(meta);
      metaStr = ` ${colorize(metaContent, COLORS.dim)}`;
    } catch {
      metaStr = ` ${colorize("[元数据解析错误]", COLORS.red)}`;
    }
  }
  
  // 错误级别加粗显示
  const msg = level === "error" 
    ? colorize(message, COLORS.bright) 
    : message;
  
  console.log(`${timestamp} ${levelTag} ${msg}${metaStr}`);
};

export const logger: Logger = {
  debug: (msg, meta) => log("debug", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
};

// 获取日志缓冲区
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

// 清空日志缓冲区
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}
