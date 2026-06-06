import got from "got";
import { IFilterStrategy, IFileInfo } from "../types.js";
import { logger } from "../../utils/logger.js";
import { getMirrorUrls } from "../../utils/download.js";

interface McmodResult {
  clientSide: string;
  serverSide: string;
}

export class McmodFilter implements IFilterStrategy {
  name = "McmodFilter";
  private urls: ReturnType<typeof getMirrorUrls>;

  constructor() {
    this.urls = getMirrorUrls();
  }

  async filter(files: IFileInfo[]): Promise<string[]> {
    const projectIdMap = await this.resolveProjectIds(files);

    if (projectIdMap.size === 0) {
      logger.info("Mcmod: 未解析到任何 CurseForge projectID");
      return [];
    }

    const uniqueProjectIds = [...new Set(projectIdMap.values())];
    const mcmodResults = await this.queryMcmodApi(uniqueProjectIds);

    const clientMods: string[] = [];
    for (const [filename, projectId] of projectIdMap) {
      const result = mcmodResults.get(projectId);
      if (result && result.clientSide === "required" && result.serverSide === "unsupported") {
        clientMods.push(filename);
        logger.debug("Mcmod API 标记为客户端模组", {
          filename,
          projectId,
          clientSide: result.clientSide,
          serverSide: result.serverSide,
        });
      }
    }

    logger.info("Mcmod 筛选完成", { 客户端模组数: clientMods.length });
    return clientMods;
  }

  private async resolveProjectIds(files: IFileInfo[]): Promise<Map<string, number>> {
    const projectIdMap = new Map<string, number>();
    const fingerprintMap = new Map<number, string>();

    const fingerprints: number[] = [];
    for (const file of files) {
      if (file.murmur2 != null) {
        fingerprints.push(file.murmur2);
        fingerprintMap.set(file.murmur2, file.filename);
      }
    }

    if (fingerprints.length === 0) return projectIdMap;

    const cfMap = await this.queryCurseForgeFingerprint(fingerprints);

    for (const [fp, projectId] of cfMap) {
      const filename = fingerprintMap.get(fp);
      if (filename) {
        projectIdMap.set(filename, projectId);
      }
    }

    logger.info(`Mcmod: 通过指纹解析到 ${projectIdMap.size} 个 projectID (共 ${fingerprints.length} 个文件)`);
    return projectIdMap;
  }

  private async queryCurseForgeFingerprint(fingerprints: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (fingerprints.length === 0) return result;

    try {
      const baseUrl = this.urls.curseforge_url;
      const response = await got.post(`${baseUrl}/v1/fingerprints/432`, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-key": "$2a$10$ydk0TLDG/Gc6uPMdz7mad.iisj2TaMDytVcIW4gcVP231VKngLBKy",
        },
        json: { fingerprints },
        timeout: { request: 15000 },
      }).json<any>();

      const exactMatches = response?.data?.exactMatches;
      if (Array.isArray(exactMatches)) {
        for (const match of exactMatches) {
          const fingerprint = match.file?.fileFingerprint;
          const modId = match.file?.modId;
          if (fingerprint != null && modId != null) {
            result.set(fingerprint, modId);
          }
        }
      }
    } catch (error: any) {
      logger.error("CurseForge 指纹查询失败", { error: error.message });
    }

    return result;
  }

  private async queryMcmodApi(projectIds: number[]): Promise<Map<number, McmodResult>> {
    const result = new Map<number, McmodResult>();
    if (projectIds.length === 0) return result;

    try {
      const response = await got.post("https://galaxy.tianpao.top/mcmod/query", {
        headers: {
          "User-Agent": "DeEarthX",
          "Content-Type": "application/json",
        },
        json: { curseforge_ids: projectIds },
        timeout: { request: 15000 },
      }).json<any[]>();

      if (Array.isArray(response)) {
        for (const item of response) {
          const cfId = item.curseforgeIds?.[0] ?? item.curseforge_id ?? item.id;
          if (cfId != null) {
            result.set(cfId, {
              clientSide: item.clientSide ?? "required",
              serverSide: item.serverSide ?? "required",
            });
          }
        }
      }
    } catch (error: any) {
      logger.error("MCMOD API 查询失败", { error: error.message });
    }

    return result;
  }
}
