import fs from "node:fs";
import { fastdownload, version_compare } from "../utils/utils.js";
import got from "got";
import { Azip } from "../utils/ziplib.js";
import { Config } from "../utils/config.js";

interface ILInfo {
  libraries: {
    downloads: {
      artifact: {
        path: string;
      };
    };
  }[];
}

export class Minecraft {
  loader: string;
  minecraft: string;
  loaderVersion: string;
  path: string;

  constructor(loader: string, minecraft: string, lv: string, path: string) {
    this.path = path;
    this.loader = loader;
    this.minecraft = minecraft;
    this.loaderVersion = lv;
  }

  async setup() {
    await this.eula();
    const config = Config.getConfig();
    if (!config.mirror.bmclapi) {
      return;
    }
    switch (this.loader) {
      case "forge":
        await this.forge_setup();
        break;
      case "neoforge":
        await this.forge_setup();
        break;
      case "fabric":
        await this.fabric_setup();
        break;
      case "fabric-loader":
        await this.fabric_setup();
        break;
    }
  }

  async forge_setup() {
    if (version_compare(this.minecraft, "1.18") === 1) {
      const mcpath = `${this.path}/libraries/net/minecraft/server/${this.minecraft}/server-${this.minecraft}.jar`;
      await fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`, mcpath]);
      const zip = await Azip(await fs.promises.readFile(mcpath));
      for await (const entry of zip) {
        if (entry.entryName.startsWith("META-INF/libraries/") && !entry.entryName.endsWith("/")) {
          console.log(entry.entryName);
          const data = entry.getData();
          const filepath = `${this.path}/libraries/${entry.entryName.replace("META-INF/libraries/", "")}`;
          const dir = require('path').dirname(filepath);
          await fs.promises.mkdir(dir, { recursive: true });
          await fs.promises.writeFile(filepath, data);
        }
      }
    } else {
      const lowv = `${this.path}/minecraft_server.${this.minecraft}.jar`;
      const dmc = fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`, lowv]);
      
      const download = (async () => {
        console.log("并行");
        const json = await got.get(`https://bmclapi2.bangbang93.com/version/${this.minecraft}/json`, {
          headers: {
            "User-Agent": "DeEarthX"
          }
        }).json<ILInfo>();
        
        await Promise.all(json.libraries.map(async e => {
          const path = e.downloads.artifact.path;
          await fastdownload([`https://bmclapi2.bangbang93.com/maven/${path}`, `${this.path}/libraries/${path}`]);
        }));
      })();
      
      await Promise.all([dmc, download]);
    }
  }

  async fabric_setup() {
    const mcpath = `${this.path}/server.jar`;
    await fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`, mcpath]);
  }

  async installer() {
  }

  async eula() {
    const context = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n#Spawn by DeEarthX(QQgroup:559349662) Tianpao:(https://space.bilibili.com/1728953419)\neula=true`;
    await fs.promises.writeFile(`${this.path}/eula.txt`, context);
  }
}
