import { MessageWS } from "../utils/ws.js";
import { CurseForge } from "./curseforge.js";
import { Modrinth } from "./modrinth.js";;

export interface XPlatform {
  getinfo(manifest: object): Promise<modpack_info>;
  downloadfile(manifest: object,path:string,ws:MessageWS): Promise<void>;
}

export interface modpack_info {
  minecraft: string;
  loader: string;
  loader_version: string;
}

export function platform(plat: string | undefined): XPlatform {
  let platform: XPlatform = Object.create({});
  switch (plat) {
    case "curseforge":
      platform = new CurseForge();
      break;
    case "modrinth":
      platform = new Modrinth();
      break;
    // case "mcbbs":
    //   platform = new MCBBS();
    //   break;
  }
  return platform;
}

export function what_platform(dud_files: string | "manifest.json" | "modrinth.index.json") {
  switch (dud_files) {
    case "manifest.json":
      return "curseforge";
    case "modrinth.index.json":
      return "modrinth";
    default:
      return undefined
  }
}
