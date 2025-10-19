import pMap from "p-map";
import config from "./config.js";
import got from "got";
import pRetry from "p-retry";
import fs from "node:fs";
import fse from "fs-extra";
import { WebSocket } from "ws";
import { ExecOptions, exec} from "node:child_process";

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

export function mavenToUrl(
  coordinate: { split: (arg0: string) => [any, any, any, any] },
  base = "maven"
) {
  const [g, a, v, ce] = coordinate.split(":");
  const [c, e = "jar"] = (ce || "").split("@");
  return `${base.replace(/\/$/, "")}/${g.replace(
    /\./g,
    "/"
  )}/${a}/${v}/${a}-${v}${c ? "-" + c : ""}.${e}`;
}

export function version_compare(v1: string, v2: string) {
  const v1_arr = v1.split(".");
  const v2_arr = v2.split(".");
  for (let i = 0; i < v1_arr.length; i++) {
    if (v1_arr[i] !== v2_arr[i]) {
      return v1_arr[i] > v2_arr[i] ? 1 : -1;
    }
  }
  return 0;
}

export function execPromise(cmd:string,options?:ExecOptions){
  return new Promise((resolve,reject)=>{
    exec(cmd,options,(err,stdout,stderr)=>{
      if(err){
        reject(err)
        return;
      }
    }).on('exit',(code)=>{
      resolve(code)
    })
  })
}

export async function fastdownload(data: [string, string]) {
  return await pMap(
    [data],
    async (e:any) => {
      try {
        await pRetry(
          async () => {
            if (!fs.existsSync(e[1])) {
              /*
              const size: number = await (async () => {
                const head = (
                  await got.head(
                    e[0],
                    { headers: { "user-agent": "DeEarthX" } }
                  )
                ).headers["content-length"];
                if (head) {
                  return Number(head);
                } else {
                  return 0;
                }
              })();*/
              
               //console.log(e)
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

export async function Wfastdownload(data: [string, string],ws:WebSocket) {
  let index = 1;
  return await pMap(
    data,
    async (e:any) => {
      try {
        await pRetry(
          async () => {
            if (!fs.existsSync(e[1])) {
              await got
                .get(e[0], {
                  responseType: "buffer",
                  headers: {
                    "user-agent": "DeEarthX",
                  },
                })
                .then((res) => {
                  fse.outputFileSync(e[1], res.rawBody);
                });
            }
           ws.send(JSON.stringify({
             status:"downloading",
               result:{
                total:data.length,
                index:index,
                name:e[1]
              }
            }))
            index++
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

export async function xfastdownload(data: [string, string][]) {
  return await pMap(
    data,
    async (e:any) => {
      try {
        await pRetry(
          async () => {
            if (!fs.existsSync(e[1])) {
              /*
              const size: number = await (async () => {
                const head = (
                  await got.head(
                    e[0],
                    { headers: { "user-agent": "DeEarthX" } }
                  )
                ).headers["content-length"];
                if (head) {
                  return Number(head);
                } else {
                  return 0;
                }
              })();*/
               //console.log(e)
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

