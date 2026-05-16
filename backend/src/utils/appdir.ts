import path from "node:path";

export function getAppDir(): string {
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
