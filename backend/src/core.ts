import express, { Application } from "express";
import multer from "multer";
import cors from "cors"
import websocket, { WebSocketServer } from "ws"
import { createServer, Server } from "node:http";
import { Config, IConfig } from "./utils/config.js";
import { Dex } from "./Dex.js";
import { logger } from "./utils/logger.js";
import { checkJava, JavaCheckResult } from "./utils/utils.js";
import { Galaxy } from "./galaxy.js";
export class Core {
    private config: IConfig;
    private readonly app: Application;
    private readonly server: Server;
    public ws!: WebSocketServer;
    private wsx!: websocket;
    private readonly upload: multer.Multer;
    private task: {} = {};
    dex: Dex;
    galaxy: Galaxy;
    constructor(config: IConfig) {
        this.config = config
        this.app = express();
        this.server = createServer(this.app);
        this.ws = new WebSocketServer({ server: this.server })
        this.ws.on("connection",(e)=>{
            this.wsx = e
        })
        this.dex = new Dex(this.ws)
        this.galaxy = new Galaxy()
        this.upload = multer();
    }

    private async javachecker() {
        try {
            const result: JavaCheckResult = await checkJava();
            
            if (result.exists && result.version) {
                logger.info(`Java detected: ${result.version.fullVersion} (${result.version.vendor})`);
                
                if (this.wsx) {
                    this.wsx.send(JSON.stringify({
                        type: "info",
                        message: `Java detected: ${result.version.fullVersion} (${result.version.vendor})`,
                        data: result.version
                    }));
                }
            } else {
                logger.error("Java check failed", result.error);
                
                if (this.wsx) {
                    this.wsx.send(JSON.stringify({
                        type: "error",
                        message: result.error || "Java not found or version check failed",
                        data: result
                    }));
                }
            }
        } catch (error) {
            logger.error("Java check exception", error as Error);
            
            if (this.wsx) {
                this.wsx.send(JSON.stringify({
                    type: "error",
                    message: "Java check encountered an exception"
                }));
            }
        }
    }

    private express() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // 健康检查路由
        this.app.get('/', (req, res) => {
            res.json({
                status: 200,
                by: "DeEarthX.Core",
                qqg: "559349662",
                bilibili: "https://space.bilibili.com/1728953419"
            });
        });
        
        // 启动任务路由
        this.app.post("/start", this.upload.single("file"), (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ status: 400, message: "No file uploaded" });
                }
                if (!req.query.mode) {
                    return res.status(400).json({ status: 400, message: "Mode parameter missing" });
                }
                
                const isServerMode = req.query.mode === "server";
                logger.info("Starting task", { isServerMode });
                
                // 非阻塞执行主要任务
                this.dex.Main(req.file.buffer, isServerMode, req.file.originalname).catch(err => {
                    logger.error("Task execution failed", err);
                });
                
                res.json({ status: 200, message: "Task is pending" });
            } catch (err) {
                const error = err as Error;
                logger.error("/start route error", error);
                res.status(500).json({ status: 500, message: "Internal server error" });
            }
        });
        
        // 获取配置路由
        this.app.get('/config/get', (req, res) => {
            try {
                res.json(this.config);
            } catch (err) {
                const error = err as Error;
                logger.error("/config/get route error", error);
                res.status(500).json({ status: 500, message: "Failed to get config" });
            }
        });

        // 更新配置路由
        this.app.post('/config/post', (req, res) => {
            try {
                Config.writeConfig(req.body);
                this.config = req.body; // 更新内存中的配置
                logger.info("Config updated");
                res.json({ status: 200 });
            } catch (err) {
                const error = err as Error;
                logger.error("/config/post route error", error);
                res.status(500).json({ status: 500, message: "Failed to update config" });
            }
        });

        this.app.use("/galaxy", this.galaxy.getRouter());
    }

    public async start() {
        this.express();
        this.server.listen(37019, async () => {
            logger.info("Server is running on http://localhost:37019");
            await this.javachecker(); // 启动时检查Java
        });
        
        // 处理服务器错误
        this.server.on('error', (err) => {
            logger.error("Server error", err);
        });
    }
}