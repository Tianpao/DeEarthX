import fse from "fs-extra";
import { Forge } from "./forge.js";
import { Config } from "../utils/config.js";
import { Got, got } from "got";

export class NeoForge extends Forge {
  got: Got;

  constructor(minecraft: string, loaderVersion: string, path: string) {
    super(minecraft, loaderVersion, path);
    const config = Config.getConfig();
    this.got = got.extend({
      headers: { "User-Agent": "DeEarthX" },
      hooks: {
        init: [
          (options) => {
            if (config.mirror?.bmclapi) {
              options.prefixUrl = "https://bmclapi2.bangbang93.com/";
            } else {
              options.prefixUrl = "https://maven.neoforged.net/releases/";
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
  }

  async installer() {
    const config = Config.getConfig();
    let url = `neoforge/version/${this.loaderVersion}/download/installer.jar`;
    if (!config.mirror?.bmclapi) {
      url = `net/neoforged/neoforge/${this.loaderVersion}/neoforge-${this.loaderVersion}-installer.jar`;
    }
    const res = (await this.got.get(url)).rawBody;
    await fse.outputFile(`${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`, res);
  }
}
