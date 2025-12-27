import fs from "node:fs"
import crypto from "node:crypto"
import { yauzl_promise } from "./yauzl.promise.js"
import got from "got"
import { Utils } from "./utils.js"
import config from "./config.js"
interface IMixins{
    name: string
    data: string
}

interface IFile{
    filename: string
    hash: string
    mixins: IMixins[]
}

interface IHashRes{
    [key:string]:{
    project_id: string
    }
}
interface IPjs{
    id:string,
    client_side:string,
    server_side:string
}
export class DeEarth{
    movepath: string
    modspath: string
    file: IFile[]
    utils: Utils
    constructor(modspath:string,movepath:string) {
        this.utils = new Utils();
        this.movepath = movepath
        this.modspath = modspath
        this.file = []
    }

    async Main(){
        if(!fs.existsSync(this.movepath)){
            fs.mkdirSync(this.movepath,{recursive:true})
        }
        await this.getFile()
        let hash;
        let mixins;
        if (config.filter.hashes){ //Hash
        hash =  await this.Check_Hashes()
        }
        if (config.filter.mixins){ //Mixins
            mixins = await this.Check_Mixins()
        }
        if(!hash||mixins){
            return;
        }
        const result = [...new Set(hash.concat(mixins))]
                //console.log(result)
        result.forEach(async e=>{
            await fs.promises.rename(`${e}`,`${this.movepath}/${e}`.replace(this.modspath,""))
            //await fs.promises.rename(`${this.modspath}/${e}`,`${this.movepath}/${e}`)
        })
    }

    async Check_Hashes(){
        const cmap = new Map<string,string>()
        const fmap = new Map<string,string>()
        const hashes:string[] = []
        this.file.forEach(e=>{
            hashes.push(e.hash);
            cmap.set(e.hash,e.filename)
        })
        const res = await got.post(this.utils.modrinth_url+"/v2/version_files",{
            headers:{
                "User-Agent": "DeEarth",
                "Content-Type": "application/json"
            },
            json:{
                hashes,
                algorithm: "sha1"
            }
        }).json<IHashRes>()
        const x = Object.keys(res)
        const arr = []
        const fhashes = []
        for(let i=0;i<x.length;i++){
            const e = x[i] //hash
            const d = res[e] //hash object
            const result = cmap.get(e)
            if(result){
            fmap.set(d.project_id,result)
            }
            fhashes.push(e)
            arr.push(d.project_id)
             
        }
        const mpres = await got.get(`${this.utils.modrinth_url}/v2/projects?ids=${JSON.stringify(arr)}`,{
            headers:{
                "User-Agent": "DeEarth"
            }
        }).json<IPjs[]>()
         const result = [] //要删除的文件
          for(let i=0;i<mpres.length;i++){
             const e = mpres[i]
             if(e.client_side==="required" && e.server_side==="unsupported"){
             const f = fmap.get(e.id)
             result.push(f)
             }
          }
          return result
    }
    
    async Check_Mixins(){
        //const files = await this.getFile()
        const files = this.file
        const result:string[] = []
        for(let i=0;i<files.length;i++){
            const file = files[i]
            file.mixins.forEach(e=>{
                try{
                const json = JSON.parse(e.data);
                if(this._isClientMx(file,json)){
                    result.push(file.filename)
                }
                }catch(e){}
            })
        }
        const _result = [...new Set(result)]
        return _result;
    }
    async getFile():Promise<IFile[]>{
        const files = this.getDir()
        const arr = []
        for(let i=0;i<files.length;i++){
            const _file = files[i]
            const file = `${this.modspath}/${_file}`
            const data = fs.readFileSync(file)
            const sha1 = crypto.createHash('sha1').update(data).digest('hex') //Get Hash
            const mxarr:{name:string,data:string}[] = []
            const mixins = (await yauzl_promise(data)).forEach(async e=>{ //Get Mixins Info to check
                if(e.fileName.endsWith(".mixins.json")&&!e.fileName.includes("/")){
                    mxarr.push({name:e.fileName,data:(await e.ReadEntry).toString()})
                }
            })
            arr.push({filename:file,hash:sha1,mixins:mxarr})
        }
        this.file = arr
        return arr;
    }
    private getDir():string[]{
        if(!fs.existsSync(this.movepath)){
            fs.mkdirSync(this.movepath)
        }
        const dirarr = fs.readdirSync(this.modspath).filter(e=>e.endsWith(".jar")).filter(e=>e.concat(this.modspath));
        return dirarr
    }

    private _isClientMx(file:IFile,mixins:any){
        return (!("mixins" in mixins) || mixins.mixins.length === 0)&&(("client" in mixins) && (mixins.client.length !== 0))&&!file.filename.includes("lib")
    }
}