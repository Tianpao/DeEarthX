import got, { Got } from "got";
import { fastdownload, xfastdownload } from "../utils/utils.js";

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
    constructor(minecraft:string,loaderVersion:string) {
        this.minecraft = minecraft;
        this.loaderVersion = loaderVersion;
        this.got = got.extend({
            prefixUrl:"https://bmclapi2.bangbang93.com/",
            headers:{
                "User-Agent": "DeEarthX"
            }
        })
    }

    async setup(){
        await this.libraries()
    }

    async libraries(){
        const res = await this.got.get(`fabric-meta/v2/versions/loader/${this.minecraft}/${this.loaderVersion}/server/json`).json<IServer>()
        const _downlist: [string,string][]= []
        res.libraries.forEach(e=>{
            const path = this.MTP(e.name)
            _downlist.push([`https://bmclapi2.bangbang93.com/maven/${path}`,`./fabric/libraries/${path}`])
        })
        await xfastdownload(_downlist)
    }

    async getLaestLoader(){
        let downurl = ""
        const res = await this.got.get("fabric-meta/v2/versions/installer").json<ILatestLoader[]>()
        res.forEach(e=>{
            if(e.stable){
                downurl = `https://bmclapi2.bangbang93.com/maven/${new URL(e.url).pathname.slice(1)}`
                return;
            }
        })
        await fastdownload([downurl,`./fabric/fabric-installer.jar`])
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