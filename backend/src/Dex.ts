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

export class Dex {
  wsx!: WebSocketServer;
  message!: MessageWS;
  constructor(ws: WebSocketServer) {
    this.wsx = ws;
    this.wsx.on("connection", (e) => {
      this.message = new MessageWS(e);
    });
  }

  public async Main(buffer: Buffer, dser: boolean) {
    try {
      const first = Date.now();
      const zps = await this._zps(buffer);
      const { contain, info } = await zps._getinfo();
      const plat = what_platform(contain);
      logger.debug("Platform detected", plat);
      logger.debug("Modpack info", info);
      const mpname = info.name;
      const unpath = `./instance/${mpname}`;
      // 解压和下载（并行处理）
      await Promise.all([
        zps._unzip(mpname),
        platform(plat).downloadfile(info, unpath, this.message)
      ]).catch(e=>{
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

  private async _zps(buffer: Buffer) {
    const zip = await yauzl_promise(buffer);
    const _getinfo = async () => {
      const importantFiles = ["manifest.json", "modrinth.index.json"];
      for await (const entry of zip) {
        if (importantFiles.includes(entry.fileName)) {
          const content = await entry.ReadEntry;
          const info = JSON.parse(content.toString());
          logger.debug("Found important file", { fileName: entry.fileName, info });
          return { contain: entry.fileName, info };
        }
      }
      throw new Error("No manifest file found in modpack");
    }

    const _unzip = async (instancename: string) => {
      logger.info("Starting unzip process", { instancename });
      const instancePath = `./instance/${instancename}`;
      let index = 1;
      for await (const entry of zip) {
        const isDir = entry.fileName.endsWith("/");
        console.log(index, entry.fileName);
        if (isDir) {
          await fs.promises.mkdir(`${instancePath}/${entry.fileName}`, {
            recursive: true,
          });
        } else if (entry.fileName.startsWith("overrides/")) {
          // 跳过黑名单文件
          if (this._ublack(entry.fileName)) {
            console.log("Skip blacklist file", entry.fileName);
            index++;
            continue;
          }
          // 创建目标目录
          const targetPath = entry.fileName.replace("overrides/", "");
          const dirPath = `${instancePath}/${targetPath.substring(0, targetPath.lastIndexOf("/"))}`;
          await fs.promises.mkdir(dirPath, { recursive: true });
          // 解压文件
          const stream = await entry.openReadStream;
          console.log(entry.fileName);
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
    if (filename === "overrides/") return true;
    const blacklist = [
      "overrides/options.txt",
      "shaderpacks",
      "essential",
      "resourcepacks"
    ];
    
    return blacklist.some(item => filename.includes(item));
  }
}
