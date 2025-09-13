import { CurseForgeManifest } from "./curseforge.js";
import { modpack_info, XPlatform } from "./index.js";

interface MCBBSManifest extends CurseForgeManifest {}

export class MCBBS implements XPlatform {
  async getinfo(manifest: object): Promise<modpack_info> {
    const result: modpack_info = Object.create({});
    const local_manifest = manifest as MCBBSManifest;
    if (result && local_manifest)
      result.minecraft = local_manifest.minecraft.version;
    const id = local_manifest.minecraft.modLoaders[0].id;
    const loader_all = id.match(/(.*)-/) as RegExpMatchArray;
    result.loader = loader_all[1];
    result.loader_version = id.replace(loader_all[0], "");
    return result;
  }

  async downloadfile(urls: [string, string]): Promise<void> {}
}
