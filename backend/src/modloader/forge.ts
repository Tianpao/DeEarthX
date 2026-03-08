import got, { Got } from "got";
import fs from "node:fs";
import fse from "fs-extra";
import { execPromise, fastdownload, version_compare, verifySHA1 } from "../utils/utils.js";
import { Azip } from "../utils/ziplib.js";
import { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

interface IForge {
  data: {
    MOJMAPS: {
      server: string;
    };
    MAPPINGS: {
      server: string;
    };
  };
}

interface IVersion {
  downloads: {
    server_mappings: {
      url: string;
    };
  };
}

interface IForgeFile {
  format: string;
  category: string;
  hash: string;
  _id: string;
}

interface IForgeBuild {
  branch: string;
  build: number;
  mcversion: string;
  modified: string;
  version: string;
  _id: string;
  files: IForgeFile[];
}

export class Forge {
  minecraft: string;
  loaderVersion: string;
  got: Got;
  path: string;

  constructor(minecraft: string, loaderVersion: string, path: string) {
    this.minecraft = minecraft;
    this.loaderVersion = loaderVersion;
    this.path = path;
    const config = Config.getConfig();
    this.got = got.extend({
      headers: { "User-Agent": "DeEarthX" },
      hooks: {
        init: [
          (options) => {
            if (config.mirror.bmclapi) {
              options.prefixUrl = "https://bmclapi2.bangbang93.com";
            } else {
              options.prefixUrl = "http://maven.minecraftforge.net/";
            }
          }
        ]
      }
    });
  }

  async setup() {
    await this.installer();
    const config = Config.getConfig();
    if (config.mirror.bmclapi) {
      await this.library();
    }
    await this.install();
    if (version_compare(this.minecraft, "1.18") === -1) {
      await this.wshell();
    }
  }

  async library() {
    const _downlist: [string, string][] = [];
    const data = await fs.promises.readFile(`${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`);
    const zip = Azip(data);

    for await (const entry of zip) {
      if (entry.entryName === "version.json" || entry.entryName === "install_profile.json") {
        JSON.parse((entry.getData()).toString()).libraries.forEach(async (e: any) => {
          const t = e.downloads.artifact.path;
          _downlist.push([`https://bmclapi2.bangbang93.com/maven/${t}`, `${this.path}/libraries/${t}`]);
        });
      }

      if (entry.entryName === "install_profile.json") {
        const json = JSON.parse((entry.getData()).toString()) as IForge;
        const vjson = await this.got.get(`version/${this.minecraft}/json`).json<IVersion>();
        console.log(`${new URL(vjson.downloads.server_mappings.url).pathname}`);
        const mojpath = this.MTP(json.data.MOJMAPS.server);
        _downlist.push([`https://bmclapi2.bangbang93.com/${new URL(vjson.downloads.server_mappings.url).pathname.slice(1)}`, `${this.path}/libraries/${mojpath}`]);

        const mappingobj = json.data.MAPPINGS.server;
        const path = this.MTP(mappingobj.replace(":mappings@txt", "@zip"));
        _downlist.push([`https://bmclapi2.bangbang93.com/maven/${path}`, `${this.path}/libraries/${path}`]);
      }
    }

    const downlist = [...new Set(_downlist)];
    await fastdownload(downlist);
  }

  async install() {
    const config = Config.getConfig();
    const javaCmd = config.javaPath || 'java';
    let cmd = `${javaCmd} -jar forge-${this.minecraft}-${this.loaderVersion}-installer.jar --installServer`;
    if (config.mirror.bmclapi) {
      cmd += ` --mirror https://bmclapi2.bangbang93.com/maven/`;
    }
    await execPromise(cmd, { cwd: this.path }).catch((e) => {
      logger.error(`Forge 安装失败: ${e}`);
      throw e;
    });
  }

  async installer() {
    const config = Config.getConfig();
    let url = `forge/download?mcversion=${this.minecraft}&version=${this.loaderVersion}&category=installer&format=jar`;
    let expectedHash: string | undefined;

    if (config.mirror?.bmclapi) {
      try {
        const forgeInfo = await this.got.get(`forge/minecraft/${this.minecraft}`).json<IForgeBuild[]>();
        const forgeVersion = forgeInfo.find(f => f.version === this.loaderVersion);
        if (forgeVersion) {
          const installerFile = forgeVersion.files.find(f => f.category === 'installer' && f.format === 'jar');
          if (installerFile) {
            expectedHash = installerFile.hash;
            logger.debug(`获取到 Forge installer hash: ${expectedHash}`);
          }
        }
      } catch (error) {
        logger.warn(`获取 Forge hash 信息失败，将跳过 hash 验证`, error);
      }
    } else {
      url = `net/minecraftforge/forge/${this.minecraft}-${this.loaderVersion}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`;
    }

    const res = (await this.got.get(url)).rawBody;
    const filePath = `${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`;
    await fse.outputFile(filePath, res);

    if (expectedHash) {
      if (!verifySHA1(filePath, expectedHash)) {
        logger.warn(`Forge installer hash 验证失败，删除文件并重试`);
        fs.unlinkSync(filePath);
        const res2 = (await this.got.get(url)).rawBody;
        await fse.outputFile(filePath, res2);

        if (!verifySHA1(filePath, expectedHash)) {
          throw new Error(`Forge installer hash 验证失败，文件可能已损坏`);
        }
      }
    }
  }

  private async wshell() {
    const config = Config.getConfig();
    const javaCmd = config.javaPath || 'java';
    const cmd = `${javaCmd} -jar forge-${this.minecraft}-${this.loaderVersion}.jar`;
    await fs.promises.writeFile(`${this.path}/run.bat`, `@echo off\n${cmd}`);
    await fs.promises.writeFile(`${this.path}/run.sh`, `#!/bin/bash\n${cmd}`);
  }

  private MTP(string: string) {
    const mjp = string.replace(/^\[|\]$/g, '');
    const OriginalName = mjp.split("@")[0];
    const x = OriginalName.split(":");
    const mappingType = mjp.split('@')[1];
    if (x[3]) {
      return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}-${x[3]}.${mappingType}`;
    } else {
      return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}.${mappingType}`;
    }
  }
}
