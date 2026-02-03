import fs from "node:fs";
import crypto from "node:crypto";
import { Azip } from "./ziplib.js";
import got, { Got } from "got";
import { Utils } from "./utils.js";
import config from "./config.js";
import { logger } from "./logger.js";
import toml from "smol-toml";

interface IMixinFile {
  name: string;
  data: string;
}

interface IInfoFile {
  name: string;
  data: string;
}

interface IFileInfo {
  filename: string;
  hash: string;
  mixins: IMixinFile[];
  infos: IInfoFile[];
}

interface IHashResponse {
  [hash: string]: { project_id: string };
}

interface IProjectInfo {
  id: string;
  client_side: string;
  server_side: string;
}

interface checkDexpubForClientMods {
  serverMods: string[];
  clientMods: string[];
}

export class DeEarth {
  private movePath: string;
  private modsPath: string;
  private files: IFileInfo[];
  private utils: Utils;
  private got: Got;

  constructor(modsPath: string, movePath: string) {
    this.utils = new Utils();
    this.movePath = movePath;
    this.modsPath = modsPath;
    this.files = [];
    this.got = got.extend({
      prefixUrl: "https://galaxy.tianpao.top/",
      headers: {
        "User-Agent": "DeEarthX",
      },
      responseType: "json",
    });
    logger.debug("DeEarth instance created", { modsPath, movePath });
  }

  async Main(): Promise<void> {
    logger.info("Starting DeEarth process");

    if (!fs.existsSync(this.movePath)) {
      logger.debug("Creating target directory", { path: this.movePath });
      fs.mkdirSync(this.movePath, { recursive: true });
    }

    await this.getFilesInfo();
    const clientSideMods = await this.identifyClientSideMods();
    await this.moveClientSideMods(clientSideMods);

    logger.info("DeEarth process completed");
  }

  private async identifyClientSideMods(): Promise<string[]> { // 识别客户端Mod主函数
    const clientMods: string[] = [];

    if (config.filter.hashes) {
      logger.info("Starting hash check for client-side mods");
      clientMods.push(...await this.checkHashesForClientMods());
    }

    if (config.filter.mixins) {
      logger.info("Starting mixins check for client-side mods");
      clientMods.push(...await this.checkMixinsForClientMods());
    }

    if (config.filter.dexpub) {
      logger.info("Starting dexpub check for client-side mods");
      const dexpubMods = await this.checkDexpubForClientMods();
      const serverModsListSet = new Set(dexpubMods.serverMods);
      for(let i=clientMods.length - 1;i>=0;i--){
        if (serverModsListSet.has(clientMods[i])){
          clientMods.splice(i,1);
        }
      }
      clientMods.push(...dexpubMods.clientMods);

      logger.info("Galaxy Square check completed", { serverMods: dexpubMods.serverMods, clientMods: dexpubMods.clientMods });
    }

    const uniqueMods = [...new Set(clientMods)];
    logger.info("Client-side mods identified", { count: uniqueMods.length, mods: uniqueMods });
    return uniqueMods;
  }

  private async checkDexpubForClientMods(): Promise<checkDexpubForClientMods> {
    const clientMods: string[] = [];
    const serverMods: string[] = [];
    const modIds: string[] = [];
    const map: Map<string, string> = new Map();
    for (const file of this.files) {
      for (const info of file.infos) {
        const config = JSON.parse(info.data);
        const keys = Object.keys(config);
        if (keys.includes("id")) {
          modIds.push(config.id);
          map.set(config.id, file.filename);
        }else if(keys.includes("mods")){
          modIds.push(config.mods[0].modId);
          map.set(config.mods[0].modId, file.filename);
        }
      }
    }
    const modids = modIds;
    const modIdToIsTypeMod = await this.got.post(`api/mod/check`,{
      json: {
        modids,
      }
    }).json<{[modId: string]: boolean}>()
    const modIdToIsTypeModKeys = Object.keys(modIdToIsTypeMod);
    for(const modId of modIdToIsTypeModKeys){
      if(modIdToIsTypeMod[modId]){
        const MapData = map.get(modId);
        if(MapData){
          clientMods.push(MapData);
        }
      }else{
        const MapData = map.get(modId);
        if(MapData){
          serverMods.push(MapData);
        }
      }
    }
    return { serverMods, clientMods };
  }

  private async checkHashesForClientMods(): Promise<string[]> {
    const hashToFilename = new Map<string, string>();
    const hashes = this.files.map(file => {
      hashToFilename.set(file.hash, file.filename);
      return file.hash;
    });

    logger.debug("Checking mod hashes with Modrinth API", { fileCount: this.files.length });

    try {
      const fileInfoResponse = await got.post(`${this.utils.modrinth_url}/v2/version_files`, {
        headers: { "User-Agent": "DeEarth", "Content-Type": "application/json" },
        json: { hashes, algorithm: "sha1" }
      }).json<IHashResponse>();

      const projectIdToFilename = new Map<string, string>();
      const projectIds = Object.entries(fileInfoResponse)
        .map(([hash, info]) => {
          const filename = hashToFilename.get(hash);
          if (filename) projectIdToFilename.set(info.project_id, filename);
          return info.project_id;
        });

      const projectsResponse = await got.get(`${this.utils.modrinth_url}/v2/projects?ids=${JSON.stringify(projectIds)}`, {
        headers: { "User-Agent": "DeEarth" }
      }).json<IProjectInfo[]>();

      const clientMods = projectsResponse
        .filter(p => p.client_side === "required" && p.server_side === "unsupported")
        .map(p => projectIdToFilename.get(p.id))
        .filter(Boolean) as string[];

      logger.debug("Hash check completed", { count: clientMods.length });
      return clientMods;
    } catch (error: any) {
      logger.error("Hash check failed", error);
      return [];
    }
  }

  private async checkMixinsForClientMods(): Promise<string[]> {
    const clientMods: string[] = [];

    for (const file of this.files) {
      for (const mixin of file.mixins) {
        try {
          const config = JSON.parse(mixin.data);
          if (!config.mixins?.length && config.client?.length > 0 && !file.filename.includes("lib")) {
            clientMods.push(file.filename);
            break;
          }
        } catch (error: any) {
          logger.warn("Failed to parse mixin config", { filename: file.filename, mixin: mixin.name, error: error.message });
        }
      }
    }

    logger.debug("Mixins check completed", { count: clientMods.length });
    return [...new Set(clientMods)];
  }

  private async moveClientSideMods(clientMods: string[]): Promise<void> {
    if (!clientMods.length) {
      logger.info("No client-side mods to move");
      return;
    }

    let successCount = 0, errorCount = 0;

    for (const sourcePath of clientMods) {
      try {
        const targetPath = `${this.movePath}/${sourcePath.replace(this.modsPath, "").replace(/^\/+/, "")}`;
        logger.info("Moving file", { source: sourcePath, target: targetPath });
        await fs.promises.rename(sourcePath, targetPath);
        successCount++;
      } catch (error: any) {
        logger.error("Failed to move file", { source: sourcePath, error: error.message });
        errorCount++;
      }
    }

    logger.info("File movement completed", { total: clientMods.length, success: successCount, error: errorCount });
  }

  private async getFilesInfo(): Promise<void> {
    const jarFiles = this.getJarFiles();
    logger.info("Getting file information", { fileCount: jarFiles.length });

    for (const jarFilename of jarFiles) {
      const fullPath = `${this.modsPath}/${jarFilename}`;

      try {
        const fileData = fs.readFileSync(fullPath);
        const mixins = await this.extractMixins(fileData);
        const infos = await this.extractModInfo(fileData);

        this.files.push({
          filename: fullPath,
          hash: crypto.createHash('sha1').update(fileData).digest('hex'),
          mixins,
          infos,
        });

        logger.debug("File processed", { filename: fullPath, mixinCount: mixins.length });
      } catch (error: any) {
        logger.error("Error processing file", { filename: fullPath, error: error.message });
      }
    }

    logger.debug("File information collection completed", { processedFiles: this.files.length });
  }

  private getJarFiles(): string[] {
    if (!fs.existsSync(this.modsPath)) fs.mkdirSync(this.modsPath, { recursive: true });
    return fs.readdirSync(this.modsPath).filter(f => f.endsWith(".jar"));
  }

  private async extractModInfo(jarData: Buffer): Promise<IInfoFile[]> {
    const infos: IInfoFile[] = [];
    const zipEntries = Azip(jarData);
    await Promise.all(zipEntries.map(async (entry) => {
      try {
        if (entry.entryName.endsWith("neoforge.mods.toml") || entry.entryName.endsWith("mods.toml")) {
          const data = await entry.getData();
          infos.push({ name: entry.entryName, data: JSON.stringify(toml.parse(data.toString())) });
        } else if (entry.entryName.endsWith("fabric.mod.json")) {
          const data = await entry.getData();
          infos.push({ name: entry.entryName, data: data.toString() });
        }
      } catch (error: any) {
        logger.error(`Error extracting ${entry.entryName}`, error);
      }
    }
    )
    )
    return infos;
  }

  private async extractMixins(jarData: Buffer): Promise<IMixinFile[]> {
    const mixins: IMixinFile[] = [];
    const zipEntries = Azip(jarData);

    await Promise.all(zipEntries.map(async (entry) => {
      if (entry.entryName.endsWith(".mixins.json") && !entry.entryName.includes("/")) {
        try {
          const data = await entry.getData();
          mixins.push({ name: entry.entryName, data: data.toString() });
        } catch (error: any) {
          logger.error(`Error extracting ${entry.entryName}`, error);
        }
      }
    }));

    return mixins;
  }
}