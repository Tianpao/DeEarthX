import { CurseForge } from "./curseforge.js";
import { MCBBS } from "./mcbbs.js";
import { Modrinth } from "./modrinth.js";

export interface XPlatform {
  getinfo(manifest: object): Promise<modpack_info>;
  downloadfile(manifest: object,path:string): Promise<void>;
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
    case "mcbbs":
      platform = new MCBBS();
      break;
  }
  return platform;
}

export function what_platform(dud_files: Array<string>) {
  if (dud_files.includes("mcbbs.packmeta")) {
    return "mcbbs";
  } else if (dud_files.includes("manifest.json")) {
    return "curseforge";
  } else if (dud_files.includes("modrinth.index.json")) {
    return "modrinth";
  } else {
    return undefined;
  }
}
