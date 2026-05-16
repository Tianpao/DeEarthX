import { SpawnOptions, spawn } from "node:child_process";
import { logger } from "./logger.js";

export function mavenToUrl(
  coordinate: { split(sep: string): string[] },
  base = "maven"
) {
  const [g, a, v, ce] = coordinate.split(":");
  const [c, e = "jar"] = (ce || "").split("@");
  return `${base.replace(/\/$/, "")}/${g.replace(
    /\./g,
    "/"
  )}/${a}/${v}/${a}-${v}${c ? "-" + c : ""}.${e}`;
}

export function execPromise(cmd: string, options?: SpawnOptions): Promise<number> {
  logger.debug(`执行命令: ${cmd}`);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, {
      ...options,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout?.on('data', (chunk: unknown) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      logger.debug(text.trim());
    });

    child.stderr?.on('data', (chunk: unknown) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      logger.error(text.trim());
    });

    child.on('error', (err) => {
      logger.error(`命令执行错误: ${cmd}`);
      reject(err);
    });

    child.on('close', (code) => {
      logger.debug(`命令执行完成，退出码: ${code}`);
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}
