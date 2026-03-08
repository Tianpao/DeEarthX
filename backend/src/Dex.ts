import fs from "node:fs";
import p from "node:path";
import websocket, { WebSocketServer } from "ws";
import { pipeline } from "node:stream/promises";
import { platform, what_platform } from "./platform/index.js";
import { ModFilterService } from "./dearth/index.js";
import { dinstall, mlsetup } from "./modloader/index.js";
import { Config } from "./utils/config.js";
import { execPromise } from "./utils/utils.js";
import { MessageWS } from "./utils/ws.js";
import { logger } from "./utils/logger.js";
import { yauzl_promise } from "./utils/ziplib.js";
import yauzl from "yauzl";
import archiver from "archiver";

export class Dex {
  wsx!: WebSocketServer;
  message!: MessageWS;
  
  constructor(ws: WebSocketServer) {
    this.wsx = ws;
    this.wsx.on("connection", (e) => {
      this.message = new MessageWS(e);
    });
  }

  public async Main(buffer: Buffer, dser: boolean, filename?: string, template?: string) {
    try {
      const first = Date.now();
      await this.processModpack(buffer, filename, first, dser, template);
    } catch (e) {
      const err = e as Error;
      logger.error("主流程执行失败", err);
      this.message.handleError(err);
    }
  }

  private async processModpack(buffer: Buffer, filename: string | undefined, startTime: number, isServerMode: boolean, template?: string) {
    const processedBuffer = await this._processModpack(buffer, filename);
    const zps = await this._zips(processedBuffer);
    const { contain, info } = await zps._getinfo();
    
    if (!contain || !info) {
      logger.error("整合包信息为空");
      this.message.handleError(new Error("该整合包似乎不是有效的整合包。"));
      return;
    }
    
    const plat = what_platform(contain);
    logger.debug("检测到平台", { 平台: plat });
    logger.debug("整合包信息", info);
    
    const mpname = info.name;
    const unpath = `./instance/${mpname}`;
    
    await this.parallelTasks(zps, mpname, plat, info, unpath);
    await this.filterMods(unpath, mpname);
    await this.installModLoader(plat, info, unpath, isServerMode, template);
    await this.completeTask(startTime, unpath, mpname, isServerMode);
  }

  private async parallelTasks(zps: any, mpname: string, plat: string | undefined, info: any, unpath: string) {
    await Promise.all([
      zps._unzip(mpname),
      platform(plat).downloadfile(info, unpath, this.message)
    ]).catch(e => {
      logger.error("并行任务执行异常", e);
    });
    this.message.statusChange();
  }

  private async filterMods(unpath: string, mpname: string) {
    const config = Config.getConfig();
    await new ModFilterService(`${unpath}/mods`, `./.rubbish/${mpname}`, config.filter, this.message).filter();
    this.message.statusChange();
  }

  private async installModLoader(plat: string | undefined, info: any, unpath: string, isServerMode: boolean, template?: string) {
    const mlinfo = await platform(plat).getinfo(info);
    if (isServerMode) {
      await mlsetup(
        mlinfo.loader,
        mlinfo.minecraft,
        mlinfo.loader_version,
        unpath,
        this.message,
        template
      )
    } else {
      dinstall(
        mlinfo.loader,
        mlinfo.minecraft,
        mlinfo.loader_version,
        unpath
      );
    }
  }

  private async completeTask(startTime: number, unpath: string, mpname: string, isServerMode: boolean) {
    const config = Config.getConfig();
    const latest = Date.now();
    const duration = latest - startTime;
    
    if (isServerMode) {
      this.message.serverInstallComplete(unpath, duration);
    } else {
      this.message.finish(startTime, latest);
    }

    if (!isServerMode && config.autoZip) {
      await this._createZip(unpath, mpname);
    }

    if (config.oaf) {
      await execPromise(`start ${p.join("./instance")}`);
    }

    logger.info(`任务完成，耗时 ${duration}ms`);
  }

  private async _processModpack(buffer: Buffer, filename?: string): Promise<Buffer> {
    if (!filename || !filename.endsWith('.zip')) {
      logger.debug("文件名无效或非 ZIP 格式，直接返回原始缓冲区", { 文件名: filename });
      return buffer;
    }

    const startTime = Date.now();
    const bufferSize = buffer.length;
    logger.info("开始处理整合包", { 文件名: filename, 文件大小: `${(bufferSize / 1024 / 1024).toFixed(2)} MB` });

    try {
      const zip = await (new Promise<yauzl.ZipFile>((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (err, zipfile) => {
          if (err) {
            logger.error("解析 ZIP 文件失败", { 文件名: filename, 错误: err.message });
            reject(err);
            return;
          }
          logger.debug("ZIP 文件解析成功", { 文件名: filename });
          resolve(zipfile);
        });
      }));

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

  private async _zips(buffer: Buffer) {
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
      const instancePath = `./instance/${instancename}`;
      let index = 1;
      for await (const entry of zip) {
        const isDir = entry.fileName.endsWith("/");
        logger.info(`进度: ${index}/${zip.length}, 文件: ${entry.fileName}`);

        if (!entry.fileName.startsWith("overrides/")) {
          logger.info("跳过非 overrides 文件", entry.fileName);
          this.message.unzip(entry.fileName, zip.length, index);
          index++;
          continue;
        }

        if (entry.fileName === "overrides/") {
          logger.info("跳过 overrides 目录", entry.fileName);
          this.message.unzip(entry.fileName, zip.length, index);
          index++;
          continue;
        }

        if (this._ublack(entry.fileName)) {
          logger.info("跳过黑名单文件", entry.fileName);
          this.message.unzip(entry.fileName, zip.length, index);
          index++;
          continue;
        }

        if (isDir) {
          let targetPath = entry.fileName.replace("overrides/", "");
          await fs.promises.mkdir(`${instancePath}/${targetPath}`, {
            recursive: true,
          });
        } else {
          let targetPath = entry.fileName.replace("overrides/", "");

          const dirPath = `${instancePath}/${targetPath.substring(0, targetPath.lastIndexOf("/"))}`;
          await fs.promises.mkdir(dirPath, { recursive: true });

          const fullPath = `${instancePath}/${targetPath}`;
          if (fs.existsSync(fullPath)) {
            logger.info("文件已存在，跳过解压", targetPath);
          } else {
            const stream = await entry.openReadStream;
            const write = fs.createWriteStream(fullPath);
            await pipeline(stream, write);
          }
        }
        this.message.unzip(entry.fileName, zip.length, index);
        index++;
      }
      logger.info("解压流程完成", { 实例名称: instancename, 总文件数: zip.length });
    }
    return { _getinfo, _unzip };
  }

  private _ublack(filename: string): boolean {
    const blacklist = [
      "overrides/options.txt",
      "overrides/shaderpacks",
      "overrides/essential",
      "overrides/resourcepacks",
      "overrides/PCL",
      "overrides/CustomSkinLoader"
    ];

    if (filename === "overrides/" || filename === "overrides") {
      return true;
    }

    return blacklist.some(item => {
      const normalizedItem = item.endsWith("/") ? item : item + "/";
      const normalizedFilename = filename.endsWith("/") ? filename : filename + "/";
      return normalizedFilename === normalizedItem || normalizedFilename.startsWith(normalizedItem);
    });
  }

  private async _createZip(sourcePath: string, mpname: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const outputPath = `./instance/${mpname}.zip`;
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      output.on('close', () => {
        logger.info(`打包成功: ${outputPath} (${archive.pointer()} 字节)`);
        this.message.info(`服务端已打包: ${mpname}.zip`);
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
}
