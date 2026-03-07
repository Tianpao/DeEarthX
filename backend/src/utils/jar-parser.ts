import { IInfoFile, IMixinFile } from "../mod-filter/types.js";
import { Azip } from "./ziplib.js";
import toml from "smol-toml";

export class JarParser {
  static async extractModInfo(jarData: Buffer): Promise<IInfoFile[]> {
    const infos: IInfoFile[] = [];
    const zipEntries = Azip(jarData);
    
    for (const entry of zipEntries) {
      try {
        if (entry.entryName.endsWith("neoforge.mods.toml") || entry.entryName.endsWith("mods.toml")) {
          const data = await entry.getData();
          infos.push({ name: entry.entryName, data: JSON.stringify(toml.parse(data.toString())) });
        } else if (entry.entryName.endsWith("fabric.mod.json")) {
          const data = await entry.getData();
          infos.push({ name: entry.entryName, data: data.toString() });
        }
      } catch (error: any) {
        continue;
      }
    }

    return infos;
  }

  static async extractMixins(jarData: Buffer): Promise<IMixinFile[]> {
    const mixins: IMixinFile[] = [];
    const zipEntries = Azip(jarData);

    for (const entry of zipEntries) {
      if (entry.entryName.endsWith(".mixins.json") && !entry.entryName.includes("/")) {
        try {
          const data = await entry.getData();
          mixins.push({ name: entry.entryName, data: data.toString() });
        } catch (error: any) {
          continue;
        }
      }
    }

    return mixins;
  }
}
