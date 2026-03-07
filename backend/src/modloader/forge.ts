import got, { Got } from "got";
import fs from "node:fs"
import fse from "fs-extra"
import { execPromise, fastdownload, version_compare, verifySHA1 } from "../utils/utils.js";
import { Azip } from "../utils/ziplib.js";
import { execSync } from "node:child_process";
import config from "../utils/config.js";
import { logger } from "../utils/logger.js";

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

interface IForgeFile {
    format: string;
    category: string;
    hash: string;
    _id: string;
}

interface IForgeBuild {
    branch: string;
    build: number;
    mcversion: string;
    modified: string;
    version: string;
    _id: string;
    files: IForgeFile[];
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
        headers: { "User-Agent": "DeEarthX" },
        hooks: {
            init: [
                (options) => {
                    if(config.mirror.bmclapi){
                        options.prefixUrl = "https://bmclapi2.bangbang93.com";
                    }else{
                        options.prefixUrl = "http://maven.minecraftforge.net/";
                    }
                }
            ]
        }
    })
 }

 async setup(){
    await this.installer()
    if(config.mirror.bmclapi){
        await this.library()
    }
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
   const javaCmd = config.javaPath || 'java';
   await execPromise(`${javaCmd} -jar forge-${this.minecraft}-${this.loaderVersion}-installer.jar --installServer`,{cwd:this.path})
 }

async installer(){
    let url = `forge/download?mcversion=${this.minecraft}&version=${this.loaderVersion}&category=installer&format=jar`
    let expectedHash: string | undefined;
    
    // 如果使用 BMCLAPI，先获取版本信息以获取 hash
    if (config.mirror?.bmclapi) {
        try {
            const forgeInfo = await this.got.get(`forge/minecraft/${this.minecraft}`).json<IForgeBuild[]>();
            // 查找匹配的 forge 版本
            const forgeVersion = forgeInfo.find(f => f.version === this.loaderVersion);
            if (forgeVersion) {
                // 查找 installer 文件的 hash
                const installerFile = forgeVersion.files.find(f => f.category === 'installer' && f.format === 'jar');
                if (installerFile) {
                    expectedHash = installerFile.hash;
                    logger.debug(`获取到 Forge installer hash: ${expectedHash}`);
                }
            }
        } catch (error) {
            logger.warn(`获取 Forge hash 信息失败，将跳过 hash 验证`, error);
        }
    } else {
        url = `net/minecraftforge/forge/${this.minecraft}-${this.loaderVersion}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`
    }
    
    const res = (await this.got.get(url)).rawBody;
    const filePath = `${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`;
    await fse.outputFile(filePath, res);
    
    // 如果获取到了 hash，验证下载的文件
    if (expectedHash) {
        if (!verifySHA1(filePath, expectedHash)) {
            // hash 验证失败，删除文件并重新下载
            logger.warn(`Forge installer hash 验证失败，删除文件并重试`);
            fs.unlinkSync(filePath);
            // 重新下载一次
            const res2 = (await this.got.get(url)).rawBody;
            await fse.outputFile(filePath, res2);
            
            // 再次验证
            if (!verifySHA1(filePath, expectedHash)) {
                throw new Error(`Forge installer hash 验证失败，文件可能已损坏`);
            }
        }
    }
}

 private async wshell(){
    const javaCmd = config.javaPath || 'java';
    const cmd = `${javaCmd} -jar forge-${this.minecraft}-${this.loaderVersion}.jar`
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