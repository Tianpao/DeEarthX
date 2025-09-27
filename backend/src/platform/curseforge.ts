import got from "got";
import { WebSocket } from "ws";
import { join } from "node:path";
import { Wfastdownload, Utils } from "../utils/utils.js";
import { modpack_info, XPlatform } from "./index.js";

export interface CurseForgeManifest {
  minecraft: {
    version: string;
    modLoaders: Array<{ id: string }>;
  };
  files: Array<{ projectID: number; fileID: number }>;
}

export class CurseForge implements XPlatform {
  private utils: Utils;
  constructor() {
    this.utils = new Utils();
  }
  async getinfo(manifest: object): Promise<modpack_info> {
    let result: modpack_info = Object.create({});
    const local_manifest = manifest as CurseForgeManifest;
    if (result && local_manifest)
      result.minecraft = local_manifest.minecraft.version;
    const id = local_manifest.minecraft.modLoaders[0].id;
    const loader_all = id.match(/(.*)-/) as RegExpMatchArray;
    result.loader = loader_all[1];
    result.loader_version = id.replace(loader_all[0], "");
    return result;
  }

  async downloadfile(manifest: object, path: string, ws:WebSocket): Promise<void> {
    const local_manifest = manifest as CurseForgeManifest;
    if (local_manifest.files.length === 0){
      return;
    }
    const FileID = JSON.stringify({
      fileIds: local_manifest.files.map(
        (file: { fileID: number }) => file.fileID
      ),
    });
    let tmp: [string, string] | string[][] = [];
    await got
      .post(this.utils.curseforge_url + "/v1/mods/files", {
        body: FileID,
        headers: {
          "Content-Type": "application/json",
          "x-api-key":
            "$2a$10$ydk0TLDG/Gc6uPMdz7mad.iisj2TaMDytVcIW4gcVP231VKngLBKy",
          "User-Agent": "DeEarthX",
        },
      })
      .json()
      .then((res: any) => {
        res.data.forEach(
          (e: { fileName: string; downloadUrl: null | string }) => {
            if (e.fileName.endsWith(".zip") || e.downloadUrl == null) {
              return;
            }
            const unpath = join(path + "/mods/", e.fileName);
            const url = e.downloadUrl.replace("https://edge.forgecdn.net", this.utils.curseforge_Durl)
            tmp.push([url, unpath])
            // if (usemirror) {
            //   tmp.push([
            //     "https://mod.mcimirror.top" + new URL(e.downloadUrl).pathname,
            //     unpath,
            //   ]);
            // } else {
            //   tmp.push([e.downloadUrl, unpath]);
            // }
          }
        );
      });
    await Wfastdownload(tmp as unknown as [string, string],ws); //下载文件
  }
}
