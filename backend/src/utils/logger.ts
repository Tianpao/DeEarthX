import { formatLevel, formatTime, colorize, COLORS } from "./colors.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
}

const log = (level: LogLevel, message: string, meta?: any) => {
  const timestamp = formatTime();
  const levelTag = formatLevel(level);
  
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
