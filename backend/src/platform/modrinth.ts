import fs from "node:fs";
import { WebSocket } from "ws";
import { Wfastdownload, Utils } from "../utils/utils.js";
import { modpack_info, XPlatform } from "./index.js";
import { join } from "node:path";

interface ModrinthManifest {
  files: Array<{ path: string; downloads: string[]; fileSize: number; }>;
  dependencies: {
    minecraft: string;
    forge: string;
    neoforge: string;
    "fabric-loader": string;
    [key: string]: string;
  };
}

export class Modrinth implements XPlatform {
  private utils: Utils;
  constructor() {
    this.utils = new Utils();
  }
  async getinfo(manifest: object): Promise<modpack_info> {
    let result: modpack_info = Object.create({});
    const local_manifest = manifest as ModrinthManifest;
    const depkey = Object.keys(local_manifest.dependencies);
    const loader = ["forge", "neoforge", "fabric-loader"];
    result.minecraft = local_manifest.dependencies.minecraft;
    for (let i = 0; i < depkey.length; i++) {
      const key = depkey[i];
      if (key !== "minecraft" && loader.includes(key)) {
        result.loader = key;
        result.loader_version = local_manifest.dependencies[key];
      }
    }
    return result;
  }
  async downloadfile(manifest: object,path:string,ws:WebSocket): Promise<void> {
    const index = manifest as ModrinthManifest;
    let tmp: [string, string][] = []
    index.files.forEach(async (e: { path: string; downloads: string[]; fileSize: number;}) => {
        if (e.path.endsWith(".zip")) {
            return;
          }
    const url = e.downloads[0].replace("https://cdn.modrinth.com",this.utils.modrinth_Durl)
    const unpath = join(path,e.path)
    tmp.push([e.downloads[0],unpath])
    // if (usemirror){
    //     tmp.push(["https://mod.mcimirror.top"+new URL(e.downloads[0]).pathname,unpath,String(e.fileSize)])
    // }else{
    //     tmp.push([e.downloads[0],unpath,String(e.fileSize)])
    // }
    });
    await Wfastdownload(tmp as unknown as [string, string],ws)
  }
}
