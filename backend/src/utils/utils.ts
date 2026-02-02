import pMap from "p-map";
import config from "./config.js";
import got from "got";
import pRetry from "p-retry";
import fs from "node:fs";
import fse from "fs-extra";
import { WebSocket } from "ws";
import { ExecOptions, exec, spawn} from "node:child_process";

/**
 * Java版本信息接口
 */
export interface JavaVersion {
  major: number;
  minor: number;
  patch: number;
  fullVersion: string;
  vendor: string;
  runtimeVersion?: string;
}

/**
 * Java检测结果接口
 */
export interface JavaCheckResult {
  exists: boolean;
  version?: JavaVersion;
  error?: string;
}
import { MessageWS } from "./ws.js";
import { logger } from "./logger.js";

export class Utils {
  public modrinth_url: string;
  public curseforge_url: string;
  public curseforge_Durl: string;
  public modrinth_Durl: string;
  constructor() {
    this.modrinth_url = "https://api.modrinth.com";
    this.curseforge_url = "https://api.curseforge.com";
    this.modrinth_Durl = "https://cdn.modrinth.com";
    this.curseforge_Durl = "https://media.forgecdn.net";
    if (config.mirror.mcimirror) {
      this.modrinth_url = "https://mod.mcimirror.top/modrinth";
      this.curseforge_url = "https://mod.mcimirror.top/curseforge";
      this.modrinth_Durl = "https://mod.mcimirror.top";
      this.curseforge_Durl = "https://mod.mcimirror.top";
    }
  }
}

export function mavenToUrl(
  coordinate: { split: (arg0: string) => [any, any, any, any] },
  base = "maven"
) {
  const [g, a, v, ce] = coordinate.split(":");
  const [c, e = "jar"] = (ce || "").split("@");
  return `${base.replace(/\/$/, "")}/${g.replace(
    /\./g,
    "/"
  )}/${a}/${v}/${a}-${v}${c ? "-" + c : ""}.${e}`;
}

export function version_compare(v1: string, v2: string) {
  const v1_arr = v1.split(".");
  const v2_arr = v2.split(".");
  for (let i = 0; i < v1_arr.length; i++) {
    if (v1_arr[i] !== v2_arr[i]) {
      return v1_arr[i] > v2_arr[i] ? 1 : -1;
    }
  }
  return 0;
}

/**
 * 检测Java是否安装并获取版本信息
 * @returns Java检测结果
 */
export async function checkJava(): Promise<JavaCheckResult> {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      exec("java -version", (err, stdout, stderr) => {
        if (err) {
          logger.error("Java check failed", err);
          reject(new Error("Java not found"));
          return;
        }
        // Java版本信息输出在stderr中
        resolve(stderr);
      });
    });

    logger.debug(`Java version output: ${output}`);
    
    // 解析Java版本信息
    const versionRegex = /version "(\d+)(\.(\d+))?(\.(\d+))?/;
    const vendorRegex = /(Java\(TM\)|OpenJDK).*Runtime Environment.*by (.*)/;
    
    const versionMatch = output.match(versionRegex);
    const vendorMatch = output.match(vendorRegex);
    
    if (!versionMatch) {
      return {
        exists: true,
        error: "Failed to parse Java version"
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
      vendor: vendorMatch ? vendorMatch[2] : "Unknown"
    };
    
    logger.info(`Java detected: ${JSON.stringify(versionInfo)}`);
    
    return {
      exists: true,
      version: versionInfo
    };
  } catch (error) {
    logger.error("Java check error", error as Error);
    return {
      exists: false,
      error: (error as Error).message
    };
  }
}

export function execPromise(cmd:string,options?:ExecOptions){
  logger.debug(`Executing command: ${cmd}`);
  return new Promise<number>((resolve,reject)=>{
    const args = cmd.split(' ');
    const command = args.shift() || '';
    
    const child = spawn(command, args, {
      ...options,
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Command execution failed: ${cmd}`);
        logger.debug(`Stderr: ${stderr}`);
        reject(new Error(`Command failed with exit code ${code}`));
        return;
      }
      if (stdout) logger.debug(`Command stdout: ${stdout}`);
      if (stderr) logger.debug(`Command stderr: ${stderr}`);
      logger.debug(`Command completed with exit code: ${code}`);
      resolve(code || 0);
    });
    
    child.on('error', (err) => {
      logger.error(`Command execution error: ${cmd}`, err);
      reject(err);
    });
  })
}

export async function fastdownload(data: [string, string]|string[][]) {
  // 确保downloadList始终是[string, string][]类型
  const downloadList: [string, string][] = Array.isArray(data[0]) 
    ? (data as string[][]).map(item => item as [string, string]) 
    : [data as [string, string]];
  logger.info(`Starting fast download of ${downloadList.length} files`);
  
  return await pMap(
    downloadList,
    async (item: [string, string]) => {
      const [url, filePath] = item;
      try {
        await pRetry(
          async () => {
            if (!fs.existsSync(filePath)) {
              logger.debug(`Downloading ${url} to ${filePath}`);
              const res = await got.get(url, {
                responseType: "buffer",
                headers: { "user-agent": "DeEarthX" },
              });
              fse.outputFileSync(filePath, res.rawBody);
              logger.debug(`Downloaded ${url} successfully`);
            } else {
              logger.debug(`File already exists, skipping: ${filePath}`);
            }
          },
          { retries: 3, onFailedAttempt: (error) => {
              logger.warn(`Download attempt failed for ${url}, retrying (${error.attemptNumber}/3)`);
            }}
        );
      } catch (error) {
        logger.error(`Failed to download ${url} after 3 attempts`, error);
        throw error;
      }
    },
    { concurrency: 16 }
  );
}

export async function Wfastdownload(data: string[][], ws: MessageWS) {
  logger.info(`Starting web download of ${data.length} files`);
  let index = 0;
  return await pMap(
    data,
    async (item: string[], idx: number) => {
      const [url, filePath] = item;
      try {
        await pRetry(
          async () => {
            if (!fs.existsSync(filePath)) {
              logger.debug(`Downloading ${url} to ${filePath}`);
              const res = await got.get(url, {
                responseType: "buffer",
                headers: { "user-agent": "DeEarthX" },
              });
              fse.outputFileSync(filePath, res.rawBody);
              logger.debug(`Downloaded ${url} successfully`);
            } else {
              logger.debug(`File already exists, skipping: ${filePath}`);
            }
            
            // 更新下载进度
            ws.download(data.length, ++index, filePath);
          },
          { retries: 3, onFailedAttempt: (error) => {
              logger.warn(`Download attempt failed for ${url}, retrying (${error.attemptNumber}/3)`);
            }}
        );
      } catch (error) {
        logger.error(`Failed to download ${url} after 3 attempts`, error);
        throw error;
      }
    },
    { concurrency: 16 }
  );
}