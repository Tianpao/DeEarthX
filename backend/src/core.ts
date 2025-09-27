import express, { Application } from "express";
import multer from "multer";
import cors from "cors"
import websocket, { WebSocketServer } from "ws"
import { createServer, Server } from "node:http";
import fs from "node:fs"
import { pipeline } from "node:stream/promises";
import { Config, IConfig } from "./utils/config.js";
import { yauzl_promise } from "./utils/yauzl.promise.js";
import { Dex } from "./Dex.js";
import { mlsetup } from "./modloader/index.js";
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

    express() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.post("/start", this.upload.single("file"), (req, res) => {
            if (!req.file) {
                return;
            }
        this.dex.Main(req.file.buffer) //Dex
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