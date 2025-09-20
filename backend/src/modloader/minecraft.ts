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
    constructor(loader:string,minecraft:string,){
        this.loader = loader;
        this.minecraft = minecraft;
    }

    async setup(){
    switch (this.loader){
        case "forge":
            await this.forge_setup();
            break;
    }
    }

    async forge_setup(){
       const mcpath = `./forge/libraries/net/minecraft/server/${this.minecraft}/server-${this.minecraft}.jar`
       await fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`,mcpath])
       if(version_compare(this.minecraft,"1.18") === 1){
       // 1.18.x + 依赖解压
       const zip = await yauzl_promise(await fs.promises.readFile(mcpath))
       for await(const entry of zip){
        //console.log(entry.fileName.replace("META-INF/libraries/",""))
        if(entry.fileName.endsWith("/")){
           const dirPath = entry.fileName.replace("META-INF/libraries/","./forge/libraries/")
        if (!fs.existsSync(dirPath)){
        await fs.promises.mkdir(dirPath, { recursive: true });
        }
        }
        if(entry.fileName.startsWith("META-INF/libraries/")&&!entry.fileName.endsWith("/")){
        console.log(entry.fileName)
        const stream = await entry.openReadStream;
        const write = fs.createWriteStream(`./forge/libraries/${entry.fileName.replace("META-INF/libraries/","")}`);
        await pipeline(stream, write);
        }
       }
       // 1.18.x + 依赖解压
    }else{
       //1.18.x - 依赖下载
        const json = await got.get(`https://bmclapi2.bangbang93.com/version/${this.minecraft}/json`)
        .json<ILInfo>()
        json.libraries.forEach(async e=>{
            const path = e.downloads.artifact.path
            await fastdownload([`https://bmclapi2.bangbang93.com/maven/${path}`,`./forge/libraries/${path}`])
        })
       //1.18.x - 依赖下载
    }
    }
}