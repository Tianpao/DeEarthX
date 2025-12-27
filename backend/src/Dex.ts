import fs from "node:fs";
import p from "node:path";
import websocket, { WebSocketServer } from "ws";
import { yauzl_promise } from "./utils/yauzl.promise.js";
import { pipeline } from "node:stream/promises";
import { platform, what_platform } from "./platform/index.js";
import { DeEarth } from "./utils/DeEarth.js";
import { dinstall, mlsetup } from "./modloader/index.js";
import config from "./utils/config.js";
import { execPromise } from "./utils/utils.js";
import { MessageWS } from "./utils/ws.js";
import { debug } from "./utils/logger.js";

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
      const { contain, info } = await this._getinfo(buffer).catch((e) => {
        throw new Error(e);
      });
      const plat = what_platform(contain);
      debug(plat);
      debug(info);
      const mpname = info.name;
      const unpath = `./instance/${mpname}`;
      await Promise.all([
        this._unzip(buffer, mpname),
        await platform(plat).downloadfile(info, unpath, this.message),
      ]).catch((e) => {
        throw new Error(e);
      }); // 解压和下载
      this.message.statusChange(); //改变状态
      await new DeEarth(`${unpath}/mods`, `./.rubbish/${mpname}`)
        .Main()
        .catch((e) => {
          throw new Error(e);
        });
      this.message.statusChange(); //改变状态(DeEarth筛选模组完毕)
      const mlinfo = await platform(plat)
        .getinfo(info)
        .catch((e) => {
          throw new Error(e);
        });
      if (dser) {
        await mlsetup(
          mlinfo.loader,
          mlinfo.minecraft,
          mlinfo.loader_version,
          unpath
        ).catch((e) => {
          throw new Error(e);
        }); //安装服务端
      }
      if (!dser) {
        dinstall(
          mlinfo.loader,
          mlinfo.minecraft,
          mlinfo.loader_version,
          unpath
        ).catch((e) => {
          throw new Error(e);
        });
      }
      const latest = Date.now();
      this.message.finish(first, latest); //完成
      if (config.oaf) {
        await execPromise(`start ${p.join("./instance")}`).catch((e) => {
          throw new Error(e);
        });
      }
      //await this._unzip(buffer);
    } catch (e) {
      const err = e as Error;
      this.message.handleError(err);
    }
  }

  private async _getinfo(buffer: Buffer) {
    const important_name = ["manifest.json", "modrinth.index.json"];
    let contain: string = "";
    let info: any = {};
    const zip = await yauzl_promise(buffer);
    for await (const entry of zip) {
      if (important_name.includes(entry.fileName)) {
        contain = entry.fileName;
        info = JSON.parse((await entry.ReadEntry).toString());
        break;
      }
    }
    return { contain, info };
  }

  private async _unzip(buffer: Buffer, instancename: string) {
    /* 解压Zip */
    const zip = await yauzl_promise(buffer);
    let index = 1;
    for await (const entry of zip) {
      const ew = entry.fileName.endsWith("/");
      if (ew) {
        await fs.promises.mkdir(
          `./instance/${instancename}/${entry.fileName}`,
          {
            recursive: true,
          }
        );
      }
      if (!ew && entry.fileName.startsWith("overrides/")) {
        const dirPath = `./instance/${instancename}/${entry.fileName
          .substring(0, entry.fileName.lastIndexOf("/"))
          .replace("overrides/", "")}`;
        if (this._ublack(entry.fileName)) {
          index++;
          continue;
        }
        await fs.promises.mkdir(dirPath, { recursive: true });
        const stream = await entry.openReadStream;
        const write = fs.createWriteStream(
          `./instance/${instancename}/${entry.fileName.replace(
            "overrides/",
            ""
          )}`
        );
        await pipeline(stream, write);
      }
      this.message.unzip(entry.fileName, zip.length, index);
      // this.ws.send(
      //   JSON.stringify({
      //     status: "unzip",
      //     result: { name: entry.fileName, total: zip.length, current: index },
      //   })
      // );
      index++;
    }
    /* 解压完成 */
  }

  private _ublack(filename: string) {
    if (filename === "overrides/") {
      return true;
    }
    if (
      filename.includes("shaderpacks") ||
      filename.includes("essential") ||
      filename.includes("resourcepacks") ||
      filename === "overrides/options.txt"
    ) {
      return true;
    }
  }
}
