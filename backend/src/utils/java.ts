import fs from "node:fs";
import { exec } from "node:child_process";
import { logger } from "./logger.js";

export interface JavaVersion {
  major: number;
  minor: number;
  patch: number;
  fullVersion: string;
  vendor: string;
  runtimeVersion?: string;
}

export interface JavaCheckResult {
  exists: boolean;
  version?: JavaVersion;
  error?: string;
}

export function version_compare(v1: string, v2: string): number {
  const a = v1.split(".").map(Number);
  const b = v2.split(".").map(Number);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export async function checkJava(javaPath?: string): Promise<JavaCheckResult> {
  try {
    const javaCmd = javaPath || "java";
    const output = await new Promise<string>((resolve, reject) => {
      exec(`${javaCmd} -version`, (err, stdout, stderr) => {
        if (err) {
          logger.error("Java 检查失败", err);
          reject(new Error("Java not found"));
          return;
        }
        resolve(stderr);
      });
    });

    logger.debug(`Java version output: ${output}`);

    const versionRegex = /version "(\d+)(\.(\d+))?(\.(\d+))?/;
    const vendorRegex = /(Java\(TM\)|OpenJDK).*Runtime Environment.*by (.*)/;

    const versionMatch = output.match(versionRegex);
    const vendorMatch = output.match(vendorRegex);

    if (!versionMatch) {
      return {
        exists: true,
        error: "解析 Java 版本失败",
      };
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = versionMatch[3] ? parseInt(versionMatch[3], 10) : 0;
    const patch = versionMatch[5] ? parseInt(versionMatch[5], 10) : 0;

    const versionInfo: JavaVersion = {
      major,
      minor,
      patch,
      fullVersion: versionMatch[0].replace("version ", ""),
      vendor: vendorMatch ? vendorMatch[2] : "Unknown",
    };

    logger.info(`检测到 Java: ${JSON.stringify(versionInfo)}`);

    return {
      exists: true,
      version: versionInfo,
    };
  } catch (error) {
    logger.error("Java 检查异常", error as Error);
    return {
      exists: false,
      error: (error as Error).message,
    };
  }
}

export async function detectJavaPaths(): Promise<string[]> {
  const javaPaths: string[] = [];

  const windowsPaths = [
    "C:\\Program Files\\Java\\",
    "C:\\Program Files (x86)\\Java\\",
    "C:\\Program Files\\Eclipse Adoptium\\",
    "C:\\Program Files\\Eclipse Foundation\\",
    "C:\\Program Files\\Microsoft\\",
    "C:\\Program Files\\Amazon Corretto\\",
    "C:\\Program Files\\BellSoft\\",
    "C:\\Program Files\\Zulu\\",
    "C:\\Program Files\\Semeru\\",
    "C:\\Program Files\\Oracle\\",
    "C:\\Program Files\\RedHat\\",
  ];

  for (const basePath of windowsPaths) {
    try {
      if (fs.existsSync(basePath)) {
        const versions = fs.readdirSync(basePath);
        for (const version of versions) {
          const javaExe = `${basePath}${version}\\bin\\java.exe`;
          if (fs.existsSync(javaExe)) {
            javaPaths.push(javaExe);
          }
        }
      }
    } catch {
      // Directory might not be readable
    }
  }

  try {
    const pathOutput = await new Promise<string>((resolve, reject) => {
      exec("where java", (err, stdout) => {
        if (err) { resolve(""); return; }
        resolve(stdout);
      });
    });

    for (const p of pathOutput.split('\n').filter(p => p.trim())) {
      if (!javaPaths.includes(p.trim())) {
        javaPaths.push(p.trim());
      }
    }
  } catch {
    // `where` not available
  }

  return [...new Set(javaPaths)];
}
