import fs from "node:fs"
import { fastdownload, version_compare } from "../utils/utils.js";
import { pipeline } from "node:stream/promises";
import got from "got";
import { Azip } from "../utils/ziplib.js";
import config from "../utils/config.js";

interface ILInfo {
    libraries: {
        downloads: {
            artifact: {
                path: string
            }
        }
    }[]
}

export class Minecraft {
    loader: string;
    minecraft: string;
    loaderVersion: string;
    path: string;
    constructor(loader: string, minecraft: string, lv: string,path:string) {
        this.path = path
        this.loader = loader;
        this.minecraft = minecraft;
        this.loaderVersion = lv;
    }

    async setup() {
        await this.eula() //生成Eula.txt
        if(!config.mirror.bmclapi){
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
            // 1.18.x + MC依赖解压
            const mcpath = `${this.path}/libraries/net/minecraft/server/${this.minecraft}/server-${this.minecraft}.jar`
            await fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`, mcpath])
            const zip = await Azip(await fs.promises.readFile(mcpath))
            for await (const entry of zip) {
                if (entry.entryName.startsWith("META-INF/libraries/") && !entry.entryName.endsWith("/")) {
                    console.log(entry.entryName)
                    const stream = entry.getData();
                    const write = fs.createWriteStream(`${this.path}/libraries/${entry.entryName.replace("META-INF/libraries/", "")}`);
                    await pipeline(stream, write);
                }
            }
            // 1.18.x + 依赖解压
        } else {
            //1.18.x - MC依赖下载
            const lowv = `${this.path}/minecraft_server.${this.minecraft}.jar`
            const dmc = fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`, lowv])
            const download: Promise<void> = new Promise(async (resolve) => {
                console.log("并行")
                const json = await got.get(`https://bmclapi2.bangbang93.com/version/${this.minecraft}/json`, {
                    headers: {
                        "User-Agent": "DeEarthX"
                    }
                })
                    .json<ILInfo>()
                json.libraries.forEach(async e => {
                    const path = e.downloads.artifact.path
                    await fastdownload([`https://bmclapi2.bangbang93.com/maven/${path}`, `${this.path}/libraries/${path}`])
                })
                resolve()
            })
            await Promise.all([dmc, download])
            //1.18.x - 依赖下载
        }
    }

    async fabric_setup() {
        const mcpath = `${this.path}/server.jar`
        await fastdownload([`https://bmclapi2.bangbang93.com/version/${this.minecraft}/server`, mcpath])
        // 依赖解压
        /*const zip = await yauzl_promise(await fs.promises.readFile(mcpath))
        for await (const entry of zip) {
            // if (entry.fileName.startsWith("META-INF/libraries/") && entry.fileName.endsWith("/") &&entry.fileName !== "META-INF/libraries/") {
            //     fs.promises.mkdir(`${this.path}/libraries/${entry.fileName.replace("META-INF/libraries/", "")}`,{
            //      recursive:true
            //     })
            // }
            if (entry.fileName.startsWith("META-INF/libraries/") && !entry.fileName.endsWith("/")) {
                // const stream = await entry.openReadStream;
                //  fs.promises.mkdir(pa.dirname(`${this.path}/libraries/${entry.fileName.replace("META-INF/libraries/", "")}`),{
                //  recursive:true
                // })
                // const write = fs.createWriteStream(`${this.path}/libraries/${entry.fileName.replace("META-INF/libraries/", "")}`);
                // await pipeline(stream, write);
                const out = entry.ReadEntrySync
                await fsExtra.outputFile(`${this.path}/libraries/${entry.fileName.replace("META-INF/libraries/", "")}`,out)
            }
        }*/
        // 依赖解压
    }

    async installer(){ //占位

    }

    async eula(){
        const context = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n#Spawn by DeEarthX(QQgroup:559349662) Tianpao:(https://space.bilibili.com/1728953419)\neula=true`
        await fs.promises.writeFile(`${this.path}/eula.txt`,context)
    }
}