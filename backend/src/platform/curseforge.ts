import got, { Got } from "got";
import { join } from "node:path";
import { Wfastdownload, MirrorUrls, getMirrorUrls } from "../utils/download.js";
import { modpack_info, XPlatform } from "./index.js";
import { MessageWS } from "../utils/socketio.js";
import { logger } from "../utils/logger.js";

export interface CurseForgeManifest {
  minecraft: {
    version: string;
    modLoaders: Array<{ id: string }>;
  };
  files: Array<{ projectID: number; fileID: number }>;
}

export class CurseForge implements XPlatform {
  private urls: MirrorUrls;
  private apiGot: Got;

  constructor() {
    this.urls = getMirrorUrls();
    this.apiGot = got.extend({
      prefixUrl: "https://api.curseforge.com",
      headers: {
        "User-Agent": "DeEarthX",
        "x-api-key": "$2a$10$ydk0TLDG/Gc6uPMdz7mad.iisj2TaMDytVcIW4gcVP231VKngLBKy",
        "Content-Type": "application/json",
      }
    });
  }

  async getinfo(manifest: object): Promise<modpack_info> {
    let result: modpack_info = Object.create({});
    const local_manifest = manifest as CurseForgeManifest;
    if (result && local_manifest)
      result.minecraft = local_manifest.minecraft.version;
    const id = local_manifest.minecraft.modLoaders[0].id;
    const loader_all = id.match(/^([^-]+)-(.*)$/) as RegExpMatchArray;
    result.loader = loader_all[1];
    result.loader_version = loader_all[2];
    return result;
  }

  async downloadfile(manifest: object, path: string, ws: MessageWS): Promise<void> {
    const local_manifest = manifest as CurseForgeManifest;
    if (local_manifest.files.length === 0) {
      return;
    }
    let tmp: string[][] = [];
    try {
      const res: any = await this.apiGot
        .post("v1/mods/files", {
          json: {
            fileIds: local_manifest.files.map(f => f.fileID),
          },
        })
        .json();

      res.data.forEach(
        (e: { fileName: string; downloadUrl: null | string }) => {
          if (e.fileName.endsWith(".zip") || e.downloadUrl == null) {
            return;
          }
          const unpath = join(path + "/mods/", e.fileName);
          const url = e.downloadUrl.replace("https://edge.forgecdn.net", this.urls.curseforge_Durl);
          tmp.push([url, unpath]);
        }
      );
    } catch (err) {
      logger.error("获取 CurseForge 文件信息失败", err as Error);
      throw err;
    }
    if (tmp.length === 0) {
      logger.warn("CurseForge: 没有找到可下载的文件");
      return;
    }
    await Wfastdownload(tmp, ws, true, true);
  }
}
