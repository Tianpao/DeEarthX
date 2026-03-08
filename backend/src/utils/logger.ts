import { formatLevel, formatTime, colorize, COLORS } from "./colors.js";
import * as fs from "fs";
import * as path from "path";

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
}

function getAppDir(): string {
  const execPath = process.execPath;
  const cwd = process.cwd();
  
  const isDevelopment = execPath.toLowerCase().includes('node.exe') && 
                        !cwd.toLowerCase().includes('program files') &&
                        !cwd.toLowerCase().includes('nodejs');
  
  if (isDevelopment) {
    return cwd;
  }
  
  return path.dirname(execPath);
}

const logsDir = path.join(getAppDir(), "logs");

const ensureLogsDir = () => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

const generateLogFileName = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const timestamp = Date.now();
  return `${year}-${month}-${day}-${timestamp}.log`;
};

const logFilePath = path.join(logsDir, generateLogFileName());

const writeToFile = (level: LogLevel, message: string, meta?: any) => {
  const timestamp = formatTime();
  let metaStr = "";
  if (meta) {
    try {
      const metaContent = typeof meta === "object" 
        ? JSON.stringify(meta) 
        : String(meta);
      metaStr = ` ${metaContent}`;
    } catch {
      metaStr = " [元数据解析错误]";
    }
  }
  const logLine = `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}\n`;
  fs.appendFileSync(logFilePath, logLine, "utf-8");
};

ensureLogsDir();

const log = (level: LogLevel, message: string, meta?: any) => {
  const timestamp = formatTime();
  const levelTag = formatLevel(level);
  
  writeToFile(level, message, meta);
  
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
