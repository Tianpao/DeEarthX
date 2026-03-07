import got, { Got } from "got";
import { logger } from "../../utils/logger.js";
import { IFilterStrategy, IFileInfo, IDexpubCheckResult } from "../types.js";

export class DexpubFilterStrategy implements IFilterStrategy {
  name = "DexpubFilter";
  private got: Got;

  constructor() {
    this.got = got.extend({
      prefixUrl: "https://galaxy.tianpao.top/",
      headers: {
        "User-Agent": "DeEarthX",
      },
      responseType: "json",
    });
  }

  async filter(files: IFileInfo[]): Promise<string[]> {
    const result = await this.checkDexpubForClientMods(files);
    logger.info("Galaxy Square 检查完成", { 服务端模组: result.serverMods, 客户端模组: result.clientMods });
    return result.clientMods;
  }

  private async checkDexpubForClientMods(files: IFileInfo[]): Promise<IDexpubCheckResult> {
    const clientMods: string[] = [];
    const serverMods: string[] = [];
    const modIds: string[] = [];
    const map: Map<string, string> = new Map();

    try {
      for (const file of files) {
        for (const info of file.infos) {
          try {
            const config = JSON.parse(info.data);
            const keys = Object.keys(config);
            
            if (keys.includes("id")) {
              modIds.push(config.id);
              map.set(config.id, file.filename);
            } else if (keys.includes("mods")) {
              modIds.push(config.mods[0].modId);
              map.set(config.mods[0].modId, file.filename);
            }
          } catch (error: any) {
            logger.error("检查模组信息文件失败，文件名: " + file.filename, error);
          }
        }
      }

      const modIdToIsTypeMod = await this.got.post(`api/mod/check`, {
        json: {
          modids: modIds,
        }
      }).json<{ [modId: string]: boolean }>();

      const modIdToIsTypeModKeys = Object.keys(modIdToIsTypeMod);
      
      for (const modId of modIdToIsTypeModKeys) {
        const mapData = map.get(modId);
        if (!mapData) continue;

        if (modIdToIsTypeMod[modId]) {
          clientMods.push(mapData);
        } else {
          serverMods.push(mapData);
        }
      }
    } catch (error: any) {
      logger.error("Dexpub 检查失败", error);
    }

    return { serverMods, clientMods };
  }

  async getServerMods(files: IFileInfo[]): Promise<string[]> {
    const result = await this.checkDexpubForClientMods(files);
    return result.serverMods;
  }
}
