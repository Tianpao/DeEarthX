import got, { Got } from "got";
import fs from "node:fs"
import fse from "fs-extra"
import { xfastdownload } from "../utils/utils.js";
import { yauzl_promise } from "../utils/yauzl.promise.js";

interface Iforge{
    data:{
        MOJMAPS:{
            server:string
        },
        MAPPINGS:{
            server:string
        }
    }
}

interface Iversion{
    downloads:{
        server_mappings:{
            url:string
        }
    }
}

export class Forge {
    minecraft: string;
    loaderVersion: string;
    got: Got;
 constructor(minecraft:string,loaderVersion:string){
    this.minecraft = minecraft;
    this.loaderVersion = loaderVersion;
    this.got = got.extend({
        prefixUrl: "https://bmclapi2.bangbang93.com",
        headers: { "User-Agent": "DeEarthX" },
    })
 }

 async setup(){
    await this.installer()
    await this.library()
    // if (this.minecraft.startsWith("1.18")){
    // }
 }

 async library(){
    const _downlist: [string,string][]= []
    const data = await fs.promises.readFile(`./forge/Forge-${this.minecraft}-${this.loaderVersion}.jar`)
    const zip = await yauzl_promise(data)
    for await(const entry of zip){
        if(entry.fileName === "version.json" || entry.fileName === "install_profile.json"){ //Libraries
        JSON.parse((await entry.ReadEntry).toString()).libraries.forEach(async (e:any)=>{
            const t = e.downloads.artifact.path
            _downlist.push([`https://bmclapi2.bangbang93.com/maven/${t}`,`./forge/libraries/${t}`])
        })
        }
        if(entry.fileName === "install_profile.json"){ //MOJMAPS
            /* 获取MOJMAPS */
            const json = JSON.parse((await entry.ReadEntry).toString()) as Iforge
            const vjson = await this.got.get(`version/${this.minecraft}/json`).json<Iversion>()
            console.log(`${new URL(vjson.downloads.server_mappings.url).pathname}`)
            const mojpath = this.MTP(json.data.MOJMAPS.server)
            _downlist.push([`https://bmclapi2.bangbang93.com/${new URL(vjson.downloads.server_mappings.url).pathname.slice(1)}`,`./forge/libraries/${mojpath}`])
            /* 获取MOJMAPS */

            /*获取MAPPING*/
            const mappingobj = json.data.MAPPINGS.server
            const path = this.MTP(mappingobj.replace(":mappings@txt","@zip"))
            _downlist.push([`https://bmclapi2.bangbang93.com/maven/${path}`,`./forge/libraries/${path}`])
            /* 获取MAPPING */
        }
    }
    const downlist = [...new Set(_downlist)]
    await xfastdownload(downlist)
 }

 async installer(){
   const res = (await this.got.get(`forge/download?mcversion=${this.minecraft}&version=${this.loaderVersion}&category=installer&format=jar`)).rawBody;
   await fse.outputFile(`./forge/Forge-${this.minecraft}-${this.loaderVersion}.jar`,res);
 }


 private MTP(string:string){
    const mjp =  string.replace(/^\[|\]$/g, '')
    const OriginalName = mjp.split("@")[0]
    const x = OriginalName.split(":")
    const mappingType = mjp.split('@')[1];
    if(x[3]){
    return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}-${x[3]}.${mappingType}`
    }else{
    return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}.${mappingType}`
    }
  }    
}