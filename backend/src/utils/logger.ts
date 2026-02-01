import * as fs from 'fs';
import * as path from 'path';

const env = process.env.DEBUG;
const isDebug = env === "true";

// 日志级别枚举
type LogLevel = "debug" | "info" | "warn" | "error";

// 日志文件路径
const logsDir = path.join(process.cwd(), 'logs');
let logFilePath: string | null = null;

/**
 * 获取Asia/Shanghai时区的格式化时间
 */
function getShanghaiTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const shanghaiOffset = 8;
  return new Date(utc + (3600000 * shanghaiOffset));
}

/**
 * 格式化时间为字符串
 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 生成日志文件名，处理同一天多次打开的情况
 */
function generateLogFileName(): string {
  const now = getShanghaiTime();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = String(now.getHours()).padStart(2, '0') + 
                  String(now.getMinutes()).padStart(2, '0') + 
                  String(now.getSeconds()).padStart(2, '0');
  return `${dateStr}_${timeStr}.log`;
}

/**
 * 初始化日志文件
 */
function initLogFile() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  logFilePath = path.join(logsDir, generateLogFileName());
}

/**
 * 写入日志到文件
 */
function writeToFile(logMessage: string) {
  if (!logFilePath) {
    initLogFile();
  }
  if (logFilePath) {
    fs.appendFileSync(logFilePath, logMessage + '\n', 'utf-8');
  }
}

/**
 * 日志记录器
 * @param level 日志级别
 * @param msg 日志内容
 * @param data 附加数据（可选）
 */
function log(level: LogLevel, msg: string | Error, data?: any) {
  const shanghaiTime = getShanghaiTime();
  const timestamp = formatTimestamp(shanghaiTime);
  const prefix = `[${level.toUpperCase()}] [${timestamp}]`;
  
  // 确保只在调试模式下输出debug日志
  if (level === "debug" && !isDebug) return;
  
  let logMessage = '';
  
  if (msg instanceof Error) {
    const errorMsg = `${prefix} ${msg.message}`;
    const stackMsg = msg.stack || '';
    const dataMsg = data ? `${prefix} Data: ${JSON.stringify(data, null, 2)}` : '';
    
    console.error(errorMsg);
    console.error(stackMsg);
    if (data) console.error(`${prefix} Data:`, data);
    
    logMessage = errorMsg + '\n' + stackMsg;
    if (data) logMessage += '\n' + dataMsg;
  } else {
    const logFunc = level === "error" ? console.error : 
                   level === "warn" ? console.warn : 
                   console.log;
    
    const outputMsg = `${prefix} ${msg}`;
    const dataMsg = data ? `${prefix} Data: ${JSON.stringify(data, null, 2)}` : '';
    
    logFunc(outputMsg);
    if (data) logFunc(`${prefix} Data:`, data);
    
    logMessage = outputMsg;
    if (data) logMessage += '\n' + dataMsg;
  }
  
  writeToFile(logMessage);
}

export const logger = {
  debug: (msg: string | Error, data?: any) => log("debug", msg, data),
  info: (msg: string | Error, data?: any) => log("info", msg, data),
  warn: (msg: string | Error, data?: any) => log("warn", msg, data),
  error: (msg: string | Error, data?: any) => log("error", msg, data)
};

// 保持向后兼容
export const debug = logger.debug;
