import fs from "node:fs"
import { fastdownload, version_compare } from "../utils/utils.js";
import { yauzl_promise } from "../utils/yauzl.promise.js";
import { pipeline } from "node:stream/promises";
import got from "got";

interface ILInfo{
    libraries:{
        downloads:{
            artifact:{
                path:string
            }
        }
    }[]
}

export class Minecraft{
    loader: string;
    minecraft: string;
    loaderVersion: string;
    constructor(loader:string,minecraft:string,lv:string){
        this.loader = loader;
        this.minecraft = minecraft;
        this.loaderVersion = lv;
    }

    async setup(){
    switch (this.loader){
        case "forge":
            await this.forge_setup();
            break;
    }
    }

    async forge_setup(){
       if(version_compare(this.minecraft,"1.18") === 1){
       // 1.18.x + MC依赖解压
       const mcpath = `./forge/libraries/net/minecraft/server/${this.minecraft}/server-${this.minecraft}.jar`
       await fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`,mcpath])
       const zip = await yauzl_promise(await fs.promises.readFile(mcpath))
       for await(const entry of zip){
        if(entry.fileName.startsWith("META-INF/libraries/")&&!entry.fileName.endsWith("/")){
        console.log(entry.fileName)
        const stream = await entry.openReadStream;
        const write = fs.createWriteStream(`./forge/libraries/${entry.fileName.replace("META-INF/libraries/","")}`);
        await pipeline(stream, write);
        }
       }
       // 1.18.x + 依赖解压
    }else{
       //1.18.x - MC依赖下载
        const lowv = `./forge/minecraft_server.${this.minecraft}.jar`
        const dmc = fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`,lowv])
        const download:Promise<void> = new Promise(async (resolve)=>{
            console.log("并行")
            const json = await got.get(`https://bmclapi2.bangbang93.com/version/${this.minecraft}/json`,{
                headers:{
                    "User-Agent": "DeEarthX"
                }
            })
            .json<ILInfo>()
        json.libraries.forEach(async e=>{
            const path = e.downloads.artifact.path
            await fastdownload([`https://bmclapi2.bangbang93.com/maven/${path}`,`./forge/libraries/${path}`])
        })
        resolve()
    })
      await Promise.all([dmc,download])
       //1.18.x - 依赖下载
    }
    }
}