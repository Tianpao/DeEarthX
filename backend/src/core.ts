import express, { Application } from "express";
import multer from "multer";
import cors from "cors"
import websocket, { WebSocketServer } from "ws"
import { createServer, Server } from "node:http";
import { Config, IConfig } from "./utils/config.js";
import { Dex } from "./Dex.js";
import { exec } from "node:child_process";
export class Core {
    private config: IConfig;
    private readonly app: Application;
    private readonly server: Server;
    public ws!: WebSocketServer;
    private wsx!: websocket;
    private readonly upload: multer.Multer;
    private task: {} = {};
    dex: Dex;
    constructor(config: IConfig) {
        this.config = config
        this.app = express();
        this.server = createServer(this.app);
        this.upload = multer()
        this.ws = new WebSocketServer({ server: this.server })
        this.ws.on("connection",(e)=>{
            this.wsx = e
        })
        this.dex = new Dex(this.ws)
    }

    javachecker(){
        exec("java -version",(err,stdout,stderr)=>{
            if(err){
                this.wsx.send(JSON.stringify({
                    type:"error",
                    message:"jini"
                }))
            }
        })
    }

    express() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.get('/',(req,res)=>{
            res.json({
                status:200,
                by:"DeEarthX.Core",
                qqg:"559349662",
                bilibili:"https://space.bilibili.com/1728953419"
            })
        })
        this.app.post("/start", this.upload.single("file"), (req, res) => {
            if (!req.file) {
                return;
            }
            if (!req.query.mode){
                return;
            }
        this.dex.Main(req.file.buffer,req.query.mode == "server") //Dex
            //this.dex.Main(req.file.buffer)
            res.json({
                status:200,
                message:"task is peding"
            })
        })
        this.app.get('/config/get', (req, res) => {
            res.json(this.config)
        })

        this.app.post('/config/post', (req, res) => {
            Config.write_config(req.body)
            res.json({ status: 200 })
        })
    }

    start() {
        this.express()
        this.server.listen(37019, () => {
            console.log("Server is running on http://localhost:37019")
        })
    }
}