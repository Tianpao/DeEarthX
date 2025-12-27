const env = process.env.DEBUG;
const isDebug = env === "true";

// 日志级别枚举
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志记录器
 * @param level 日志级别
 * @param msg 日志内容
 * @param data 附加数据（可选）
 */
function log(level: LogLevel, msg: string | Error, data?: any) {
  const timestamp = new Date().toLocaleString();
  const prefix = `[${level.toUpperCase()}] [${timestamp}]`;
  
  // 确保只在调试模式下输出debug日志
  if (level === "debug" && !isDebug) return;
  
  if (msg instanceof Error) {
    console.error(`${prefix} ${msg.message}`);
    console.error(msg.stack);
    if (data) console.error(`${prefix} Data:`, data);
  } else {
    const logFunc = level === "error" ? console.error : 
                   level === "warn" ? console.warn : 
                   console.log;
    
    logFunc(`${prefix} ${msg}`);
    if (data) logFunc(`${prefix} Data:`, data);
  }
}

export const logger = {
  debug: (msg: string | Error, data?: any) => log("debug", msg, data),
  info: (msg: string | Error, data?: any) => log("info", msg, data),
  warn: (msg: string | Error, data?: any) => log("warn", msg, data),
  error: (msg: string | Error, data?: any) => log("error", msg, data)
};

// 保持向后兼容
export const debug = logger.debug;
