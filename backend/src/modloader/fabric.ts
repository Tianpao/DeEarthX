import got, { Got } from "got";
import fs from "node:fs"
import { execPromise, fastdownload } from "../utils/utils.js";

interface ILatestLoader{
    url:string,
    stable:boolean
}

interface IServer{
    libraries:{
        name:string
    }[]
}

export class Fabric{
    minecraft: string;
    loaderVersion: string;
    got:Got
    path: string;
    constructor(minecraft:string,loaderVersion:string,path:string) {
        this.minecraft = minecraft;
        this.loaderVersion = loaderVersion;
        this.path = path
        this.got = got.extend({
            prefixUrl:"https://bmclapi2.bangbang93.com/",
            headers:{
                "User-Agent": "DeEarthX"
            }
        })
    }

    async setup():Promise<void>{
        await this.installer()
        await this.libraries()
        await this.install()
        await this.wshell()
    }

    async install(){
        await execPromise(`java -jar fabric-installer.jar server -dir . -mcversion ${this.minecraft} -loader ${this.loaderVersion}`,{
            cwd:this.path
        }).catch(e=>console.log(e))
    }

    private async wshell(){
        const cmd = `java -jar fabric-server-launch.jar`
        await fs.promises.writeFile(`${this.path}/run.bat`,`@echo off\n${cmd}`) //Windows
        await fs.promises.writeFile(`${this.path}/run.sh`,`#!/bin/bash\n${cmd}`) //Linux
     }

    async libraries(){
        const res = await this.got.get(`fabric-meta/v2/versions/loader/${this.minecraft}/${this.loaderVersion}/server/json`).json<IServer>()
        const _downlist: [string,string][]= []
        res.libraries.forEach(e=>{
            const path = this.MTP(e.name)
            _downlist.push([`https://bmclapi2.bangbang93.com/maven/${path}`,`${this.path}/libraries/${path}`])
        })
        await fastdownload(_downlist)
    }

    async installer(){
        let downurl = ""
        const res = await this.got.get("fabric-meta/v2/versions/installer").json<ILatestLoader[]>()
        res.forEach(e=>{
            if(e.stable){
                //downurl = `https://bmclapi2.bangbang93.com/maven/${new URL(e.url).pathname.slice(1)}`
                downurl = e.url
                return;
            }
        })
        await fastdownload([downurl,`${this.path}/fabric-installer.jar`])
    }

    private MTP(string:string){
        const mjp =  string.replace(/^\[|\]$/g, '')
        const OriginalName = mjp.split("@")[0]
        const x = OriginalName.split(":")
        const _mappingType = mjp.split('@')[1];
        let mappingType = ""
        if (_mappingType){
            mappingType = _mappingType
        }else{
            mappingType = "jar"
        }
            if(x[3]){
                return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}-${x[3]}.${mappingType}`
            }else{
                return `${x[0].replace(/\./g, '/')}/${x[1]}/${x[2]}/${x[1]}-${x[2]}.${mappingType}`
        }
    }    
}