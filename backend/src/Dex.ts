import fs from "node:fs";
import p from "node:path";
import websocket, { WebSocketServer } from "ws";
//import { yauzl_promise } from "./utils/yauzl.promise.js";
import { pipeline } from "node:stream/promises";
import { platform, what_platform } from "./platform/index.js";
import { DeEarth } from "./utils/DeEarth.js";
import { dinstall, mlsetup } from "./modloader/index.js";
import config from "./utils/config.js";
import { execPromise } from "./utils/utils.js";
import { MessageWS } from "./utils/ws.js";
import { logger } from "./utils/logger.js";
import { yauzl_promise } from "./utils/ziplib.js";
import yauzl from "yauzl";

export class Dex {
  wsx!: WebSocketServer;
  message!: MessageWS;
  constructor(ws: WebSocketServer) {
    this.wsx = ws;
    this.wsx.on("connection", (e) => {
      this.message = new MessageWS(e);
    });
  }

  public async Main(buffer: Buffer, dser: boolean, filename?: string) {
    try {
      const first = Date.now();
      const processedBuffer = await this._processModpack(buffer, filename);
      const zps = await this._zips(processedBuffer);
      const { contain, info } = await zps._getinfo();
      if (!contain || !info) {
        logger.error("Modpack info is empty");
        this.message.handleError(new Error("It seems that the modpack is not a valid modpack."));
        return;
      }
      const plat = what_platform(contain);
      logger.debug("Platform detected", plat);
      logger.debug("Modpack info", info);
      const mpname = info.name;
      const unpath = `./instance/${mpname}`;
      // 解压和下载（并行处理）
      await Promise.all([
        zps._unzip(mpname),
        platform(plat).downloadfile(info, unpath, this.message)
      ]).catch(e => {
        console.log(e);
      });
      this.message.statusChange(); //改变状态
      await new DeEarth(`${unpath}/mods`, `./.rubbish/${mpname}`).Main();
      this.message.statusChange(); //改变状态(DeEarth筛选模组完毕)
      const mlinfo = await platform(plat).getinfo(info);
      if (dser) {
        await mlsetup(
          mlinfo.loader,
          mlinfo.minecraft,
          mlinfo.loader_version,
          unpath
        ); // 安装服务端
      } else {
        dinstall(
          mlinfo.loader,
          mlinfo.minecraft,
          mlinfo.loader_version,
          unpath
        );
      }
      const latest = Date.now();
      this.message.finish(first, latest); //完成
      if (config.oaf) {
        await execPromise(`start ${p.join("./instance")}`);
      }

      logger.info(`Task completed in ${latest - first}ms`);
    } catch (e) {
      const err = e as Error;
      logger.error("Main process failed", err);
      this.message.handleError(err);
    }
  }

  private async _processModpack(buffer: Buffer, filename?: string): Promise<Buffer> {
    if (!filename || !filename.endsWith('.zip')) {
      return buffer;
    }

    try {
      const zip = await (new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(zipfile);
        });
      }) as Promise<yauzl.ZipFile>);
      logger.info("Modpack zip file detected,It is a PCL packege,try to extract modpack.mrpack");
      return new Promise((resolve, reject) => {
        let mrpackBuffer: Buffer | null = null;
        let hasProcessed = false;

        zip.on('entry', (entry: yauzl.Entry) => {
          if (hasProcessed || !entry.fileName.endsWith('modpack.mrpack')) {
            zip.readEntry();
            return;
          }

          if (entry.fileName === 'modpack.mrpack') {
            hasProcessed = true;
            zip.openReadStream(entry, (err, stream) => {
              if (err) {
                zip.close();
                reject(err);
                return;
              }

              const chunks: Buffer[] = [];
              stream.on('data', (chunk) => {
                chunks.push(chunk);
              });
              stream.on('end', () => {
                mrpackBuffer = Buffer.concat(chunks);
                zip.close();
                resolve(mrpackBuffer);
              });
              stream.on('error', (err) => {
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
            zip.close();
            resolve(buffer);
          }
        });

        zip.on('error', (err) => {
          zip.close();
          reject(err);
        });

        zip.readEntry();
      });
    } catch (e) {
      logger.warn('Failed to check for modpack.mrpack, using original buffer', e);
      return buffer;
    }
  }

  private async _zips(buffer: Buffer) {
    if (buffer.length === 0) {
      throw new Error("zip buffer is empty");
    }
    const zip = await yauzl_promise(buffer);
    let index = 0;
    const _getinfo = async () => {
      const importantFiles = ["manifest.json", "modrinth.index.json"];
      for await (const entry of zip) {
        if (importantFiles.includes(entry.fileName)) {
          const content = await entry.ReadEntry;
          const info = JSON.parse(content.toString());
          logger.debug("Found important file", { fileName: entry.fileName, info });
          return { contain: entry.fileName, info };
        }
        index++;
      }
      throw new Error("No manifest file found in modpack");
    }
    if (index === zip.length) {
      throw new Error("No manifest file found in modpack");
    }
    const _unzip = async (instancename: string) => {
      logger.info("Starting unzip process", { instancename });
      const instancePath = `./instance/${instancename}`;
      let index = 1;
      for await (const entry of zip) {
        const isDir = entry.fileName.endsWith("/");
        logger.info(`index: ${index}, fileName: ${entry.fileName}`);

        // 只解压 overrides/ 目录下的内容，跳过其他所有文件和目录
        if (!entry.fileName.startsWith("overrides/")) {
          logger.info("Skip non-overrides file", entry.fileName);
          this.message.unzip(entry.fileName, zip.length, index);
          index++;
          continue;
        }

        // 跳过 overrides 目录本身
        if (entry.fileName === "overrides/") {
          logger.info("Skip overrides directory", entry.fileName);
          this.message.unzip(entry.fileName, zip.length, index);
          index++;
          continue;
        }

        // 跳过黑名单文件/目录
        if (this._ublack(entry.fileName)) {
          logger.info("Skip blacklist file", entry.fileName);
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

          // 创建目标目录
          const dirPath = `${instancePath}/${targetPath.substring(0, targetPath.lastIndexOf("/"))}`;
          await fs.promises.mkdir(dirPath, { recursive: true });

          // 解压文件
          const stream = await entry.openReadStream;
          const write = fs.createWriteStream(`${instancePath}/${targetPath}`);
          await pipeline(stream, write);
        }
        this.message.unzip(entry.fileName, zip.length, index);
        index++;
      }
      logger.info("Unzip process completed", { instancename, totalFiles: zip.length });
    }
    return { _getinfo, _unzip };
  }

  /**
   * 检查文件是否在解压黑名单中
   * @param filename 文件名
   * @returns 是否在黑名单中
   */
  private _ublack(filename: string): boolean {
    const blacklist = [
      "overrides/options.txt",
      "overrides/shaderpacks",
      "overrides/essential",
      "overrides/resourcepacks",
      "overrides/PCL",
      "overrides/CustomSkinLoader"
    ];

    // 跳过 overrides/ 目录本身
    if (filename === "overrides/" || filename === "overrides") {
      return true;
    }

    // 统一处理：确保黑名单项和文件名都以 / 结尾进行比较
    return blacklist.some(item => {
      const normalizedItem = item.endsWith("/") ? item : item + "/";
      const normalizedFilename = filename.endsWith("/") ? filename : filename + "/";
      return normalizedFilename === normalizedItem || normalizedFilename.startsWith(normalizedItem);
    });
  }
}
