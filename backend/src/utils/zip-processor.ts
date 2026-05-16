import fs from "node:fs";
import p from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import archiver from "archiver";
import { yauzl_promise } from "./ziplib.js";
import { logger } from "./logger.js";
import { getAppDir } from "./utils.js";

const BLACKLISTED_PATHS = [
  "overrides/options.txt",
  "overrides/shaderpacks",
  "overrides/essential",
  "overrides/resourcepacks",
  "overrides/PCL",
  "overrides/CustomSkinLoader"
];

export function isBlacklistedEntry(filename: string): boolean {
  if (filename === "overrides/" || filename === "overrides") {
    return true;
  }

  return BLACKLISTED_PATHS.some(item => {
    const normalizedItem = item.endsWith("/") ? item : item + "/";
    const normalizedFilename = filename.endsWith("/") ? filename : filename + "/";
    return normalizedFilename === normalizedItem || normalizedFilename.startsWith(normalizedItem);
  });
}

export async function extractMrpackFromZip(buffer: Buffer, filename?: string): Promise<Buffer> {
  if (!filename || !filename.endsWith('.zip')) {
    logger.debug("文件名无效或非 ZIP 格式，直接返回原始缓冲区", { 文件名: filename });
    return buffer;
  }

  const startTime = Date.now();
  const bufferSize = buffer.length;
  logger.info("开始处理整合包", { 文件名: filename, 文件大小: `${(bufferSize / 1024 / 1024).toFixed(2)} MB` });

  try {
    const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (err, zipfile) => {
        if (err) {
          logger.error("解析 ZIP 文件失败", { 文件名: filename, 错误: err.message });
          reject(err);
          return;
        }
        logger.debug("ZIP 文件解析成功", { 文件名: filename });
        resolve(zipfile);
      });
    });

    logger.info("检测到 PCL 整合包格式，尝试提取 modpack.mrpack 文件");

    return new Promise((resolve, reject) => {
      let mrpackBuffer: Buffer | null = null;
      let hasProcessed = false;
      let entryCount = 0;

      zip.on('entry', (entry: yauzl.Entry) => {
        entryCount++;

        if (hasProcessed) {
          zip.readEntry();
          return;
        }

        if (entry.fileName === 'modpack.mrpack') {
          logger.info("找到 modpack.mrpack 文件，开始读取", { 文件大小: `${(entry.uncompressedSize / 1024).toFixed(2)} KB` });
          hasProcessed = true;
          zip.openReadStream(entry, (err, stream) => {
            if (err) {
              logger.error("打开 modpack.mrpack 读取流失败", { 错误: err.message });
              zip.close();
              reject(err);
              return;
            }

            const chunks: Buffer[] = [];
            let bytesRead = 0;

            stream.on('data', (chunk) => {
              bytesRead += chunk.length;
              chunks.push(chunk);
            });

            stream.on('end', () => {
              mrpackBuffer = Buffer.concat(chunks);
              const duration = Date.now() - startTime;
              logger.info("modpack.mrpack 提取成功", {
                原始大小: `${(bufferSize / 1024 / 1024).toFixed(2)} MB`,
                提取大小: `${(mrpackBuffer.length / 1024).toFixed(2)} KB`,
                耗时: `${duration}ms`
              });
              zip.close();
              resolve(mrpackBuffer);
            });

            stream.on('error', (err) => {
              logger.error("读取 modpack.mrpack 数据失败", { 错误: err.message });
              zip.close();
              reject(err);
            });
          });
        } else {
          zip.readEntry();
        }
      });

      zip.on('end', () => {
        if (!hasProcessed) {
          const duration = Date.now() - startTime;
          logger.warn("未找到 modpack.mrpack 文件，使用原始缓冲区", {
            扫描条目数: entryCount,
            耗时: `${duration}ms`
          });
          zip.close();
          resolve(buffer);
        }
      });

      zip.on('error', (err) => {
        logger.error("ZIP 文件处理异常", { 错误: err.message });
        zip.close();
        reject(err);
      });

      zip.readEntry();
    });
  } catch (e) {
    const err = e as Error;
    const duration = Date.now() - startTime;
    logger.error("处理整合包失败，使用原始缓冲区", {
      文件名: filename,
      错误: err.message,
      耗时: `${duration}ms`
    });
    return buffer;
  }
}

export type UnzipProgressCallback = (filename: string, total: number, current: number) => void;

export async function processZipEntries(buffer: Buffer, onUnzip?: UnzipProgressCallback) {
  if (buffer.length === 0) {
    throw new Error("zip 数据为空");
  }
  const zip = await yauzl_promise(buffer);
  let index = 0;
  const _getinfo = async () => {
    const importantFiles = ["manifest.json", "modrinth.index.json"];
    for await (const entry of zip) {
      if (importantFiles.includes(entry.fileName)) {
        const content = await entry.ReadEntry;
        const info = JSON.parse(content.toString());
        logger.debug("找到关键文件", { fileName: entry.fileName, info });
        return { contain: entry.fileName, info };
      }
      index++;
    }
    throw new Error("整合包中未找到清单文件");
  }
  if (index === zip.length) {
    throw new Error("整合包中未找到清单文件");
  }
  const _unzip = async (instancename: string) => {
    logger.info("开始解压流程", { 实例名称: instancename });
    const instancePath = p.join(getAppDir(), "instance", instancename);
    let idx = 1;
    for await (const entry of zip) {
      const isDir = entry.fileName.endsWith("/");
      logger.info(`进度: ${idx}/${zip.length}, 文件: ${entry.fileName}`);

      if (!entry.fileName.startsWith("overrides/")) {
        logger.info("跳过非 overrides 文件", entry.fileName);
        onUnzip?.(entry.fileName, zip.length, idx);
        idx++;
        continue;
      }

      if (entry.fileName === "overrides/") {
        logger.info("跳过 overrides 目录", entry.fileName);
        onUnzip?.(entry.fileName, zip.length, idx);
        idx++;
        continue;
      }

      if (isBlacklistedEntry(entry.fileName)) {
        logger.info("跳过黑名单文件", entry.fileName);
        onUnzip?.(entry.fileName, zip.length, idx);
        idx++;
        continue;
      }

      if (isDir) {
        let targetPath = entry.fileName.replace("overrides/", "");
        await fs.promises.mkdir(p.join(instancePath, targetPath), {
          recursive: true,
        });
      } else {
        let targetPath = entry.fileName.replace("overrides/", "");

        const dirPath = p.join(instancePath, targetPath.substring(0, targetPath.lastIndexOf("/")));
        await fs.promises.mkdir(dirPath, { recursive: true });

        const fullPath = p.join(instancePath, targetPath);
        if (fs.existsSync(fullPath)) {
          logger.info("文件已存在，跳过解压", targetPath);
        } else {
          const stream = await entry.openReadStream;
          const write = fs.createWriteStream(fullPath);
          await pipeline(stream, write);
        }
      }
      onUnzip?.(entry.fileName, zip.length, idx);
      idx++;
    }
    logger.info("解压流程完成", { 实例名称: instancename, 总文件数: zip.length });
  }
  return { _getinfo, _unzip };
}

export async function createZipArchive(sourcePath: string, outputFileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputPath = p.join(getAppDir(), "instance", `${outputFileName}.zip`);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      logger.info(`打包成功: ${outputPath} (${archive.pointer()} 字节)`);
      resolve();
    });

    archive.on('error', (err: Error) => {
      logger.error('打包失败', err);
      reject(err);
    });

    archive.on('warning', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        logger.warn('打包警告', err);
      } else {
        reject(err);
      }
    });

    archive.pipe(output);
    archive.directory(sourcePath, false);
    archive.finalize();
  });
}
