import express from "express";
import toml from "smol-toml";
import multer, { Multer } from "multer";
import AdmZip from "adm-zip";
import { logger } from "./utils/logger.js";
import got, { Got } from "got";

export class Galaxy {
    private readonly upload: multer.Multer;
    got: Got;
    constructor() {
        this.upload = multer()
        this.got = got.extend({
            prefixUrl: "https://galaxy.tianpao.top/",
            //prefixUrl: "http://localhost:3000/",
            headers: {
                "User-Agent": "DeEarthX",
            },
            responseType: "json",
        });
    }
  getRouter() {
    const router = express.Router();
    router.use(express.json()); // 解析 JSON 请求体
    router.post("/upload",this.upload.array("files"), (req, res) => {
        const files = req.files as Express.Multer.File[];
        if(!files || files.length === 0){
            res.status(400).json({ status: 400, message: "No file uploaded" });
            return;
        }
        const modids = this.getModids(files);
        logger.info("Uploaded modids", modids);
        res.json({modids}).end();
    });
    router.post("/submit/:type",(req,res)=>{
        const type = req.params.type;
        if(type !== "server" && type !== "client"){
            res.status(400).json({ status: 400, message: "Invalid type" });
            return;
        }
        const modid = req.body.modids as string;
        if(!modid){
            res.status(400).json({ status: 400, message: "No modid provided" });
            return;
        }
        this.got.post(`api/mod/submit/${type}`,{
            json: {
                modid,
            }
        }).then((response)=>{
            logger.info(`Submitted modids for ${type}：`, response.body);
            res.json(response.body).end();
        }).catch((error)=>{
            logger.error(`Failed to submit modids for ${type}：`, error);
            res.status(500).json({ status: 500, message: "Failed to submit modids" });
        })
    })
    return router;
  }

  getModids(files:Express.Multer.File[]):string[] {
        let modid:string[] = [];
        for(const file of files){
            const zip = new AdmZip(file.buffer);
            const entries = zip.getEntries();
            for(const entry of entries){
                if(entry.entryName.endsWith("mods.toml")){
                    const content = entry.getData().toString("utf8");
                    const config = toml.parse(content) as any;
                    modid.push(config.mods[0].modId as string)
                }else if(entry.entryName.endsWith("neoforge.mods.toml")){
                    const content = entry.getData().toString("utf8");
                    const config = toml.parse(content) as any;
                    modid.push(config.mods[0].modId as string)
                }else if(entry.entryName.endsWith("fabric.mod.json")){
                    const content = entry.getData().toString("utf8");
                    const config = JSON.parse(content);
                    modid.push(config.id as string)
                }
        }
    }
        return modid
  }
}
