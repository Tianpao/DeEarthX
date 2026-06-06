import fs from "node:fs";
import p from "node:path";
import { platform, what_platform } from "./platform/index.js";
import { ModFilterService } from "./dearth/index.js";
import { dinstall, mlsetup } from "./modloader/index.js";
import { Config } from "./utils/config.js";
import { execPromise } from "./utils/utils.js";
import { getAppDir } from "./utils/appdir.js";
import { MessageWS } from "./utils/socketio.js";
import { logger } from "./utils/logger.js";
import { extractMrpackFromZip, processZipEntries, createZipArchive } from "./utils/zip-processor.js";
import { Server } from "socket.io";

export class Dex {
  message!: MessageWS;
  io: Server;

  constructor(io: Server) {
    this.io = io;
    this.io.on("connection", (socket) => {
      this.message = new MessageWS(socket);
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

  public async MainFromPath(filePath: string, dser: boolean, template?: string) {
    try {
      const first = Date.now();
      const filename = p.basename(filePath);
      const buffer = fs.readFileSync(filePath);
      await this.processModpack(buffer, filename, first, dser, template);
    } catch (e) {
      const err = e as Error;
      logger.error("主流程执行失败", err);
      this.message.handleError(err);
    }
  }

  private async processModpack(buffer: Buffer, filename: string | undefined, startTime: number, isServerMode: boolean, template?: string) {
    const processedBuffer = await extractMrpackFromZip(buffer, filename);
    const zps = await processZipEntries(processedBuffer, (f, t, i) => this.message.unzip(f, t, i));
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
    const unpath = p.join(getAppDir(), "instance", mpname);

    await this.parallelTasks(zps, mpname, plat, info, unpath);
    await this.filterMods(unpath, mpname);
    await this.installModLoader(plat, info, unpath, isServerMode, template);
    await this.completeTask(startTime, unpath, mpname, isServerMode);
  }

  private async parallelTasks(zps: any, mpname: string, plat: string | undefined, info: any, unpath: string) {
    await Promise.all([
      zps._unzip(mpname),
      platform(plat).downloadfile(info, unpath, this.message)
    ]);
    this.message.statusChange();
  }

  private async filterMods(unpath: string, mpname: string) {
    const config = Config.getConfig();
    await new ModFilterService(p.join(unpath, "mods"), p.join(getAppDir(), ".rubbish", mpname), config.filter, this.message).filter();
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
      await createZipArchive(unpath, mpname);
      this.message.info(`服务端已打包: ${mpname}.zip`);
    }

    if (config.oaf) {
      await execPromise(`start ${p.join(getAppDir(), "instance")}`);
    }

    logger.info(`任务完成，耗时 ${duration}ms`);
  }
}
