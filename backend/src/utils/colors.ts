// ANSI 颜色码
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  
  // 前景色
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  
  // 背景色（可选）
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
} as const;

// 日志级别对应的颜色
const LEVEL_COLORS: Record<string, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  info: COLORS.green,
  debug: COLORS.cyan,
};

// 是否支持彩色输出（检测终端）
const supportsColor = () => {
  if (process.env.FORCE_COLOR === "0") return false;
  if (process.env.FORCE_COLOR === "1") return true;
  return process.stdout.isTTY;
};

// 格式化颜色文本
export const colorize = (text: string, color: string): string => {
  if (!supportsColor()) return text;
  return `${color}${text}${COLORS.reset}`;
};

// 格式化日志级别标签
export const formatLevel = (level: string): string => {
  const color = LEVEL_COLORS[level.toLowerCase()] || COLORS.white;
  const label = `[${level.toUpperCase()}]`;
  return colorize(label, COLORS.bright + color);
};

// 格式化时间戳
export const formatTime = (): string => {
  const now = new Date();
  const time = now.toISOString().replace("T", " ").slice(0, 19);
  return colorize(time, COLORS.dim);
};

export { COLORS };
