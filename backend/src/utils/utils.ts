import pMap from "p-map";
import config from "./config.js";
import got from "got";
import pRetry from "p-retry";
import fs from "fs";
import fse from "fs-extra";

export class Utils {
  public modrinth_url: string;
  public curseforge_url: string;
  public curseforge_Durl: string;
  public modrinth_Durl: string;
  constructor() {
    this.modrinth_url = "https://api.modrinth.com";
    this.curseforge_url = "https://api.curseforge.com";
    this.modrinth_Durl = "https://cdn.modrinth.com";
    this.curseforge_Durl = "https://media.forgecdn.net";
    if (config.mirror.mcimirror) {
      this.modrinth_url = "https://mod.mcimirror.top/modrinth";
      this.curseforge_url = "https://mod.mcimirror.top/curseforge";
      this.modrinth_Durl = "https://mod.mcimirror.top";
      this.curseforge_Durl = "https://mod.mcimirror.top";
    }
  }
}

export async function fastdownload(data: [string, string]) {
  return await pMap(
    data,
    async (e) => {
      try {
        await pRetry(
          async () => {
            if (!fs.existsSync(e[1])) {
              const size: number = await (async () => {
                const head = (
                  await got.head(
                    e[0] /*.replace("https://mod.mcimirror.top","https://edge.forgecdn.net")*/,
                    { headers: { "user-agent": "DeEarthX" } }
                  )
                ).headers["content-length"];
                if (head) {
                  return Number(head);
                } else {
                  return 0;
                }
              })();
              await got
                .get(e[0], {
                  responseType: "buffer",
                  headers: {
                    "user-agent": "DeEarthX",
                  },
                })
                .on("downloadProgress", (progress) => {
                  //bar.update(progress.transferred);
                })
                .then((res) => {
                  fse.outputFileSync(e[1], res.rawBody);
                });
            }
          },
          { retries: 3 }
        );
      } catch (e) {
        //LOGGER.error({ err: e });
      }
    },
    { concurrency: 16 }
  );
}

export async function mr_fastdownload(data: [string, string, string]) {
  return await pMap(
    data,
    async (e) => {
      //const bar = multibar.create(Number(e[2]), 0, { filename: e[1] });
      try {
        await pRetry(
          async () => {
            if (!fse.existsSync(e[1])) {
              await got
                .get(e[0], {
                  responseType: "buffer",
                  headers: {
                    "user-agent": "DeEarthX",
                  },
                })
                .on("downloadProgress", (progress) => {
                  //bar.update(progress.transferred);
                })
                .then((res) => {
                  fse.outputFileSync(e[1], res.rawBody);
                });
            }
          },
          { retries: 3 }
        );
      } catch (e) {
        //LOGGER.error({ err: e });
      }
    },
    { concurrency: 16 }
  );
}

