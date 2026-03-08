import pMap from "p-map";
import config from "./config.js";
import got from "got";
import pRetry from "p-retry";
import fs from "node:fs";
import fse from "fs-extra";
import { SpawnOptions, exec, spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { MessageWS } from "./ws.js";
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

export class Utils {
  public modrinth_url: string;
  public curseforge_url: string;
  public curseforge_Durl: string;
  public modrinth_Durl: string;
  
  constructor() {
    this.modrinth_url = "https://api.modrinth.com";
    this.curseforge_url = "https://api.curseforge.com";
    this.modrinth_Durl = "https://cdn.modrinth.com";
    this.curseforge_Durl = "https://edge.forgecdn.net";
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
        error: "解析 Java 版本失败"
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

    logger.info(`检测到 Java: ${JSON.stringify(versionInfo)}`);

    return {
      exists: true,
      version: versionInfo
    };
  } catch (error) {
    logger.error("Java 检查异常", error as Error);
    return {
      exists: false,
      error: (error as Error).message
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
    } catch (error) {
    }
  }

  try {
    const pathOutput = await new Promise<string>((resolve, reject) => {
      exec("where java", (err, stdout, stderr) => {
        if (err) {
          resolve("");
          return;
        }
        resolve(stdout);
      });
    });

    const wherePaths = pathOutput.split('\n').filter(p => p.trim() !== '');
    for (const path of wherePaths) {
      if (!javaPaths.includes(path.trim())) {
        javaPaths.push(path.trim());
      }
    }
  } catch (error) {
  }

  return [...new Set(javaPaths)];
}

function safeLog(level: 'debug' | 'error', message: string): void {
  try {
    if (level === 'debug') {
      logger.debug(message);
    } else {
      logger.error(message);
    }
  } catch (err) {
    console.error(`[logger fallback] ${level}: ${message}`, err);
  }
}

export function execPromise(cmd: string, options?: SpawnOptions): Promise<number> {
  safeLog('debug', `执行命令: ${cmd}`);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, {
      ...options,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout?.on('data', (chunk: unknown) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      safeLog('debug', text.trim());
    });

    child.stderr?.on('data', (chunk: unknown) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      safeLog('error', text.trim());
    });

    child.on('error', (err) => {
      safeLog('error', `命令执行错误: ${cmd}`);
      reject(err);
    });

    child.on('close', (code) => {
      safeLog('debug', `命令执行完成，退出码: ${code}`);
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

export function calculateSHA1(filePath: string): string {
  const hash = crypto.createHash('sha1');
  const fileBuffer = fs.readFileSync(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex').toLowerCase();
}

export function verifySHA1(filePath: string, expectedHash: string): boolean {
  const actualHash = calculateSHA1(filePath);
  const expectedHashLower = expectedHash.toLowerCase();
  const isMatch = actualHash === expectedHashLower;

  if (!isMatch) {
    logger.error(`文件哈希验证失败: ${filePath}`);
    logger.error(`期望: ${expectedHashLower}`);
    logger.error(`实际: ${actualHash}`);
  } else {
    logger.debug(`文件哈希验证成功: ${filePath} (sha1: ${actualHash})`);
  }

  return isMatch;
}

interface DownloadOptions {
  url: string;
  filePath: string;
  expectedHash?: string;
  forceDownload?: boolean;
}

async function chunkedDownload(url: string, filePath: string, chunkSize = 5 * 1024 * 1024, concurrency = 4): Promise<void> {
  logger.debug(`开始分块下载 ${url}，块大小: ${chunkSize / 1024 / 1024}MB，并发数: ${concurrency}`);

  const isBMCLAPI = url.includes('bmclapi2');

  if (isBMCLAPI) {
    logger.debug(`检测到 BMCLAPI 下载，使用普通下载: ${url}`);
    const res = await got.get(url, {
      responseType: "buffer",
      headers: { "user-agent": "DeEarthX" },
      followRedirect: true,
    });
    fse.outputFileSync(filePath, res.rawBody);
    return;
  }

  const tempDir = `${filePath}.chunks`;
  await fse.ensureDir(tempDir);

  try {
    const response = await got.head(url, {
      headers: { "user-agent": "DeEarthX" },
      followRedirect: true,
      timeout: { request: 30000 }
    });

    const fileSize = parseInt(response.headers['content-length'] || '0', 10);
    const acceptRanges = response.headers['accept-ranges'];

    if (fileSize <= chunkSize || acceptRanges !== 'bytes') {
      logger.debug(`文件较小或服务器不支持分块下载，使用普通下载: ${url}`);
      const res = await got.get(url, {
        responseType: "buffer",
        headers: { "user-agent": "DeEarthX" },
        followRedirect: true,
      });
      fse.outputFileSync(filePath, res.rawBody);
      return;
    }

    const totalChunks = Math.ceil(fileSize / chunkSize);
    logger.debug(`文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB，分 ${totalChunks} 个块下载`);

    let supportsChunkedDownload = true;
    let currentConcurrency = Math.min(concurrency, totalChunks);
    let rate429Count = 0;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const downloadChunk = async (chunkIndex: number): Promise<void> => {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize - 1, fileSize - 1);
      const chunkPath = `${tempDir}/chunk_${chunkIndex}`;

      logger.debug(`下载块 ${chunkIndex + 1}/${totalChunks}: bytes ${start}-${end}`);

      let retryCount = 0;
      const maxRetries = 5;

      while (retryCount < maxRetries) {
        try {
          const res = await got.get(url, {
            responseType: "buffer",
            headers: {
              "user-agent": "DeEarthX",
              "Range": `bytes=${start}-${end}`
            },
            followRedirect: true,
            timeout: { request: 60000 }
          });

          if (res.statusCode === 206) {
            fse.writeFileSync(chunkPath, res.rawBody);
            return;
          } else if (res.statusCode === 200) {
            supportsChunkedDownload = false;
            throw new Error('服务器不支持 Range 请求');
          } else if (res.statusCode === 429) {
            rate429Count++;
            
            const retryAfter = res.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(5000 * Math.pow(2, retryCount), 60000);
            
            logger.warn(`遇到 429 错误，等待 ${waitTime / 1000} 秒后重试 (${retryCount + 1}/${maxRetries})`);
            await sleep(waitTime);
            retryCount++;
            continue;
          } else {
            supportsChunkedDownload = false;
            throw new Error(`服务器返回状态码 ${res.statusCode}，不支持分块下载`);
          }
        } catch (error: any) {
          if (error.response?.statusCode === 429) {
            rate429Count++;
            
            const retryAfter = error.response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(5000 * Math.pow(2, retryCount), 60000);
            
            logger.warn(`遇到 429 错误，等待 ${waitTime / 1000} 秒后重试 (${retryCount + 1}/${maxRetries})`);
            await sleep(waitTime);
            retryCount++;
            continue;
          }
          
          if (error.response?.statusCode) {
            supportsChunkedDownload = false;
            logger.warn(`Range 请求失败，状态码: ${error.response.statusCode}`);
            throw new Error(`服务器返回状态码 ${error.response.statusCode}，不支持分块下载`);
          }
          
          if (error.message.includes('Range') || error.message.includes('不支持')) {
            supportsChunkedDownload = false;
          }
          throw error;
        }
      }
      
      throw new Error(`下载块失败，已重试 ${maxRetries} 次`);
    };

    const chunks = Array.from({ length: totalChunks }, (_, i) => i);
    
    try {
      await pMap(chunks, downloadChunk, { concurrency: currentConcurrency });
    } catch (error: any) {
      if (!supportsChunkedDownload) {
        logger.warn(`服务器不支持分块下载，切换到普通下载: ${url}`);
        await fse.remove(tempDir);
        const res = await got.get(url, {
          responseType: "buffer",
          headers: { "user-agent": "DeEarthX" },
          followRedirect: true,
        });
        fse.outputFileSync(filePath, res.rawBody);
        return;
      }
      
      if (rate429Count > 0) {
        const newConcurrency = Math.max(1, Math.floor(currentConcurrency / 2));
        logger.warn(`检测到 ${rate429Count} 次 429 错误，降低并发数从 ${currentConcurrency} 到 ${newConcurrency}，重新下载`);
        
        await fse.remove(tempDir);
        await fse.ensureDir(tempDir);
        
        rate429Count = 0;
        currentConcurrency = newConcurrency;
        
        await pMap(chunks, downloadChunk, { concurrency: currentConcurrency });
      } else {
        throw error;
      }
    }

    if (supportsChunkedDownload) {
      logger.debug(`所有块下载完成，开始合并文件`);
      const writeStream = fs.createWriteStream(filePath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `${tempDir}/chunk_${i}`;
        const chunkBuffer = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuffer);
        fs.unlinkSync(chunkPath);
      }

      writeStream.end();
      await new Promise((resolve) => writeStream.on('finish', resolve));

      logger.debug(`文件合并完成: ${filePath}`);
    }
  } finally {
    await fse.remove(tempDir);
  }
}

async function downloadFile(url: string, filePath: string, expectedHash?: string, forceDownload = false, useChunked = false) {
  await pRetry(
    async () => {
      if (fs.existsSync(filePath) && !forceDownload) {
        logger.debug(`文件已存在，跳过: ${filePath}`);
        if (expectedHash && !verifySHA1(filePath, expectedHash)) {
          logger.warn(`已存在文件哈希不匹配，将重新下载: ${filePath}`);
          fs.unlinkSync(filePath);
        } else {
          return;
        }
      }

      logger.debug(`正在下载 ${url} 到 ${filePath}`);
      try {
        await fse.ensureDir(path.dirname(filePath));
        
        if (useChunked) {
          await chunkedDownload(url, filePath);
        } else {
          const res = await got.get(url, {
            responseType: "buffer",
            headers: { "user-agent": "DeEarthX" },
            followRedirect: true,
          });
          fse.outputFileSync(filePath, res.rawBody);
        }
        
        logger.debug(`下载 ${url} 成功`);

        if (expectedHash && !verifySHA1(filePath, expectedHash)) {
          throw new Error(`文件哈希验证失败，下载的文件可能已损坏`);
        }
      } catch (error) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        throw error;
      }
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        logger.warn(`${url} 下载失败，正在重试 (${error.attemptNumber}/3)`);
      }
    }
  );
}

interface DownloadItem {
  url: string;
  filePath: string;
  expectedHash?: string;
}

export async function fastdownload(data: [string, string] | string[][], enableHashVerify = true) {
  let downloadList: Array<[string, string, string?]>;

  if (Array.isArray(data[0])) {
    downloadList = (data as string[][]).map((item): [string, string, string?] =>
      item.length >= 3 ? [item[0], item[1], item[2]] : [item[0], item[1]]
    );
  } else {
    const singleItem = data as [string, string];
    downloadList = [[singleItem[0], singleItem[1]]];
  }

  logger.info(`开始快速下载 ${downloadList.length} 个文件${enableHashVerify ? '（启用 hash 验证）' : ''}`);

  return await pMap(
    downloadList,
    async (item: [string, string, string?]) => {
      const [url, filePath, expectedHash] = item;
      try {
        await downloadFile(url, filePath, enableHashVerify ? expectedHash : undefined);
      } catch (error) {
        logger.error(`Failed to download ${url} after 3 attempts`, error);
        throw error;
      }
    },
    { concurrency: 16 }
  );
}

export async function Wfastdownload(data: string[][], ws: MessageWS, enableHashVerify = true, useChunked = false) {
  logger.info(`开始 Web 下载 ${data.length} 个文件${enableHashVerify ? '（启用 hash 验证）' : ''}${useChunked ? '（启用分块下载）' : ''}`);
  const completed = new Set<number>();
  return await pMap(
    data,
    async (item: string[], index: number) => {
      const [url, filePath, expectedHash] = item;
      try {
        await downloadFile(url, filePath, enableHashVerify ? expectedHash : undefined, false, useChunked);
        if (!completed.has(index)) {
          completed.add(index);
          ws.download(data.length, completed.size, filePath);
        }
      } catch (error) {
        logger.error(`${url} 下载失败，已重试 3 次`, error);
        throw error;
      }
    },
    { concurrency: 24 }
  );
}
