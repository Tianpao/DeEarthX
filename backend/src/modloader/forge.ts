import got, { Got } from "got";
import fs from "node:fs"
import fse from "fs-extra"
import { execPromise, fastdownload, version_compare } from "../utils/utils.js";
import { Azip } from "../utils/ziplib.js";
import { execSync } from "node:child_process";

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
    path: string;
 constructor(minecraft:string,loaderVersion:string,path:string){
    this.minecraft = minecraft;
    this.loaderVersion = loaderVersion;
    this.path = path
    this.got = got.extend({
        prefixUrl: "https://bmclapi2.bangbang93.com",
        headers: { "User-Agent": "DeEarthX" },
    })
 }

 async setup(){
    await this.installer()
    await this.library()
    await this.install()
    if (version_compare(this.minecraft,"1.18") === -1){
        await this.wshell()
    }
 }

 async library(){
    const _downlist: [string,string][]= []
    const data = await fs.promises.readFile(`${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`)
    const zip = Azip(data)
    for await(const entry of zip){
        if(entry.entryName === "version.json" || entry.entryName === "install_profile.json"){ //Libraries
        JSON.parse((entry.getData()).toString()).libraries.forEach(async (e:any)=>{
            const t = e.downloads.artifact.path
            _downlist.push([`https://bmclapi2.bangbang93.com/maven/${t}`,`${this.path}/libraries/${t}`])
        })
        }
        if(entry.entryName === "install_profile.json"){ //MOJMAPS
            /* 获取MOJMAPS */
            const json = JSON.parse((entry.getData()).toString()) as Iforge
            const vjson = await this.got.get(`version/${this.minecraft}/json`).json<Iversion>()
            console.log(`${new URL(vjson.downloads.server_mappings.url).pathname}`)
            const mojpath = this.MTP(json.data.MOJMAPS.server)
            _downlist.push([`https://bmclapi2.bangbang93.com/${new URL(vjson.downloads.server_mappings.url).pathname.slice(1)}`,`${this.path}/libraries/${mojpath}`])
            /* 获取MOJMAPS */

            /*获取MAPPING*/
            const mappingobj = json.data.MAPPINGS.server
            const path = this.MTP(mappingobj.replace(":mappings@txt","@zip"))
            _downlist.push([`https://bmclapi2.bangbang93.com/maven/${path}`,`${this.path}/libraries/${path}`])
            /* 获取MAPPING */
        }
    }
    const downlist = [...new Set(_downlist)]
    await fastdownload(downlist)
 }

 async install(){
   await execPromise(`java -jar forge-${this.minecraft}-${this.loaderVersion}-installer.jar --installServer`,{cwd:this.path})
 }

 async installer(){
   const res = (await this.got.get(`forge/download?mcversion=${this.minecraft}&version=${this.loaderVersion}&category=installer&format=jar`)).rawBody;
   await fse.outputFile(`${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`,res);
 }

 private async wshell(){
    const cmd = `java -jar forge-${this.minecraft}-${this.loaderVersion}.jar`
    await fs.promises.writeFile(`${this.path}/run.bat`,`@echo off\n${cmd}`) //Windows
    await fs.promises.writeFile(`${this.path}/run.sh`,`#!/bin/bash\n${cmd}`) //Linux
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