import fs from "node:fs";
import websocket from "ws";
import { yauzl_promise } from "./utils/yauzl.promise.js";
import { pipeline } from "node:stream/promises";
import { platform, what_platform } from "./platform/index.js";

interface Iinfo{
  name:string
  buffer:Buffer
}

export class Dex {
  ws: websocket;
  in: any;
  constructor(ws: websocket) {
    this.ws = ws;
    this.in = {}
  }

  public async Main(buffer: Buffer) {
    const info = await this._getinfo(buffer)
    const plat = what_platform(info)
    const mpname = this.in.name
    await Promise.all([
      this._unzip(buffer,mpname),
      platform(plat).downloadfile(this.in,`./instance/${mpname}`)
    ])
    //await this._unzip(buffer);
  }

  private async _getinfo(buffer: Buffer){
    const important_name = ["manifest.json","modrinth.index.json"]
    let contain:string = ""
    const zip = await yauzl_promise(buffer);
    zip.filter(e=>important_name.includes(e.fileName)).forEach(async e=>{
      this.in =  JSON.parse((await e.ReadEntry).toString())
      contain = e.fileName
    })
    return contain;
  }

  private async _unzip(buffer: Buffer,instancename:string) {
    /* 解压Zip */
    const zip = await yauzl_promise(buffer);
    let index = 0;
    for await (const entry of zip) {
      const ew = entry.fileName.endsWith("/");
      if (ew) {
        await fs.promises.mkdir(`./instance/${instancename}/${entry.fileName}`, {
          recursive: true,
        });
      }
      if (!ew&&entry.fileName.startsWith("overrides/")) {
        const dirPath = `./instance/${instancename}/${entry.fileName.substring(
          0,
          entry.fileName.lastIndexOf("/")
        )}`;
        await fs.promises.mkdir(dirPath, { recursive: true });
        const stream = await entry.openReadStream;
        const write = fs.createWriteStream(`./instance/${instancename}/${entry.fileName}`);
        await pipeline(stream, write);
      }
      this.ws.send(JSON.stringify({ status: "unzip", result: { name: entry.fileName,total: zip.length, current:index } }));
      index++
    }
    /* 解压完成 */
    this.ws.send(JSON.stringify({ status: "changed", result: undefined }));
  }
}
