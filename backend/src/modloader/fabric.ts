import got, { Got } from "got";
import fs from "node:fs";
import { execPromise, fastdownload, verifySHA1, calculateSHA1 } from "../utils/utils.js";
import { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

interface ILatestLoader {
  url: string;
  stable: boolean;
}

interface IServer {
  libraries: {
    name: string;
  }[];
}

export class Fabric {
  minecraft: string;
  loaderVersion: string;
  got: Got;
  path: string;

  constructor(minecraft: string, loaderVersion: string, path: string) {
    this.minecraft = minecraft;
    this.loaderVersion = loaderVersion;
    this.path = path;
    this.got = got.extend({
      prefixUrl: "https://bmclapi2.bangbang93.com/",
      headers: {
        "User-Agent": "DeEarthX"
      }
    });
  }

  async setup(): Promise<void> {
    await this.installer();
    const config = Config.getConfig();
    if (config.mirror.bmclapi) {
      await this.libraries();
    }
    await this.install();
    await this.wshell();
  }

  async install() {
    const config = Config.getConfig();
    const javaCmd = config.javaPath || 'java';
    await execPromise(`${javaCmd} -jar fabric-installer.jar server -dir . -mcversion ${this.minecraft} -loader ${this.loaderVersion}`, {
      cwd: this.path
    }).catch(e => console.log(e));
  }

  private async wshell() {
    const config = Config.getConfig();
    const javaCmd = config.javaPath || 'java';
    const cmd = `${javaCmd} -jar fabric-server-launch.jar`;
    await fs.promises.writeFile(`${this.path}/run.bat`, `@echo off\n${cmd}`);
    await fs.promises.writeFile(`${this.path}/run.sh`, `#!/bin/bash\n${cmd}`);
  }

  async libraries() {
    const config = Config.getConfig();
    const res = await this.got.get(`fabric-meta/v2/versions/loader/${this.minecraft}/${this.loaderVersion}/server/json`).json<IServer>();
    const _downlist: [string, string, string?][] = [];
    res.libraries.forEach(e => {
      const path = this.MTP(e.name);
      _downlist.push([`https://bmclapi2.bangbang93.com/maven/${path}`, `${this.path}/libraries/${path}`]);
    });

    await fastdownload(_downlist as any);

    if (config.mirror.bmclapi) {
      logger.info(`验证 ${_downlist.length} 个 Fabric 库文件的完整性...`);
      let verifiedCount = 0;
      for (const [, filePath] of _downlist) {
        if (fs.existsSync(filePath)) {
          const hash = calculateSHA1(filePath);
          logger.debug(`${filePath}: SHA1 = ${hash}`);
          verifiedCount++;
        }
      }
      logger.info(`Fabric 库文件验证完成，共验证 ${verifiedCount}/${_downlist.length} 个文件`);
    }
  }

  async installer() {
    let downurl = "";
    const res = await this.got.get("fabric-meta/v2/versions/installer").json<ILatestLoader[]>();
    res.forEach(e => {
      if (e.stable) {
        downurl = e.url;
        return;
      }
    });

    const filePath = `${this.path}/fabric-installer.jar`;
    await fastdownload([downurl, filePath]);

    if (fs.existsSync(filePath)) {
      const hash = calculateSHA1(filePath);
      logger.debug(`Fabric installer 下载完成，SHA1: ${hash}`);
    }
  }

  private MTP(string: string) {
    const mjp = string.replace(/^\[|\]$/g, '');
    const OriginalName = mjp.split("@")[0];
    const x = OriginalName.split(":");
    const _mappingType = mjp.split('@')[1];
    let mappingType = "";
    if (_mappingType) {
      mappingType = _mappingType;
    } else {
      mappingType = "jar";
    }
    if (x[3]) {
      return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}-${x[3]}.${mappingType}`;
    } else {
      return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}.${mappingType}`;
    }
  }
}
