import express, { Application } from "express";
import multer from "multer";
import cors from "cors"
import websocket, { WebSocketServer } from "ws"
import { createServer, Server } from "node:http";
import { Config, IConfig } from "./utils/config.js";
import { Dex } from "./Dex.js";
import { logger } from "./utils/logger.js";
import { checkJava, JavaCheckResult, detectJavaPaths } from "./utils/utils.js";
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
        // 使用内存存储，配置文件字段名
        const storage = multer.memoryStorage();
        this.upload = multer({ 
            storage: storage,
            limits: {
                fileSize: 2 * 1024 * 1024 * 1024,
                files: 10
            }
        });
    }

    private async javachecker() {
        try {
            const result: JavaCheckResult = await checkJava();
            
            if (result.exists && result.version) {
                logger.info(`检测到 Java: ${result.version.fullVersion} (${result.version.vendor})`);
                
                if (this.wsx) {
                    this.wsx.send(JSON.stringify({
                        type: "info",
                        message: `检测到 Java: ${result.version.fullVersion} (${result.version.vendor})`,
                        data: result.version
                    }));
                }
            } else {
                logger.error("Java 检查失败", result.error);
                
                if (this.wsx) {
                    this.wsx.send(JSON.stringify({
                        type: "error",
                        message: result.error || "未找到 Java 或版本检查失败",
                        data: result
                    }));
                }
            }
        } catch (error) {
            logger.error("Java 检查异常", error as Error);
            
            if (this.wsx) {
                this.wsx.send(JSON.stringify({
                    type: "error",
                    message: "Java 检查遇到异常"
                }));
            }
        }
    }

    private express() {
        this.setupMiddleware();
        this.setupHealthRoutes();
        this.setupTaskRoutes();
        this.setupConfigRoutes();
        this.setupModCheckRoutes();
        this.setupGalaxyRoutes();
        this.setupJavaRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '2gb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '2gb' }));
        
        // 全局错误处理中间件
        this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            logger.error("全局错误捕获", err);
            res.status(err.status || 500).json({
                status: err.status || 500,
                message: err.message || "服务器内部错误",
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        });
    }

    private setupHealthRoutes() {
        // 健康检查路由（ping 接口）
        this.app.get('/', (req, res) => {
            const pingTime = new Date().toISOString();
            logger.debug("收到 Ping 请求", { time: pingTime, ip: req.ip });
            res.json({
                status: 200,
                by: "DeEarthX.Core",
                qqg: "559349662",
                bilibili: "https://space.bilibili.com/1728953419  ",
                ping: pingTime
            });
        });
        
        // 版本信息路由
        this.app.get('/version', (req, res) => {
            logger.debug("请求版本信息", { ip: req.ip });
            res.json({
                status: 200,
                version: "1.0.0",
                name: "DeEarthX.Core",
                buildTime: new Date().toISOString()
            });
        });
    }

    private setupTaskRoutes() {
        // 启动任务路由
        this.app.post("/start", this.upload.single("file"), (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ status: 400, message: "未上传文件" });
                }
                if (!req.query.mode) {
                    return res.status(400).json({ status: 400, message: "缺少 mode 参数" });
                }
                
                // 文件类型检查
                const allowedExtensions = ['.zip', '.mrpack'];
                const fileExtension = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
                if (!allowedExtensions.includes(fileExtension)) {
                    return res.status(400).json({ status: 400, message: "只支持 .zip 和 .mrpack 文件" });
                }
                
                const isServerMode = req.query.mode === "server";
                logger.info("正在启动任务", { 是否服务端模式: isServerMode, 文件名: req.file.originalname, 文件大小: req.file.size });
                
                // 非阻塞执行主要任务
                this.dex.Main(req.file.buffer, isServerMode, req.file.originalname).catch(err => {
                    logger.error("任务执行失败", err);
                });
                
                res.json({ status: 200, message: "任务已提交，正在处理中" });
            } catch (err) {
                const error = err as Error;
                logger.error("/start 路由错误", error);
                res.status(500).json({ status: 500, message: "服务器内部错误" });
            }
        });
    }

    private setupConfigRoutes() {
        // 获取配置路由
        this.app.get('/config/get', (req, res) => {
            try {
                res.json(this.config);
            } catch (err) {
                const error = err as Error;
                logger.error("/config/get 路由错误", error);
                res.status(500).json({ status: 500, message: "获取配置失败" });
            }
        });

        // 更新配置路由
        this.app.post('/config/post', (req, res) => {
            try {
                Config.writeConfig(req.body);
                this.config = req.body; // 更新内存中的配置
                logger.info("配置已更新");
                res.json({ status: 200 });
            } catch (err) {
                const error = err as Error;
                logger.error("/config/post 路由错误", error);
                res.status(500).json({ status: 500, message: "更新配置失败" });
            }
        });
    }

    private setupModCheckRoutes() {
        // 模组检查路由 - 通过路径检查
        this.app.get('/modcheck', async (req, res) => {
            try {
                const modsPath = req.query.path as string;
                if (!modsPath) {
                    return res.status(400).json({ status: 400, message: "缺少 path 参数" });
                }

                const { ModCheckService } = await import('./mod-filter/index.js');
                const checkService = new ModCheckService(modsPath);
                const results = await checkService.checkMods();

                res.json(results);
            } catch (err) {
                const error = err as Error;
                logger.error("/modcheck 路由错误", error);
                res.status(500).json({ status: 500, message: "模组检查失败" });
            }
        });

        // 模组检查路由 - 通过上传文件检查
        this.app.post('/modcheck/upload', this.upload.array('files'), async (req, res) => {
            try {
                logger.info("收到模组检查上传请求", { 
                    filesCount: req.files ? (req.files as Express.Multer.File[]).length : 0 
                });
                
                if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
                    logger.warn("请求中未包含文件");
                    return res.status(400).json({ status: 400, message: "未上传文件" });
                }

                // 文件类型检查
                const allowedExtensions = ['.jar'];
                for (const file of req.files as Express.Multer.File[]) {
                    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
                    if (!allowedExtensions.includes(fileExtension)) {
                        return res.status(400).json({ status: 400, message: `只支持 .jar 文件，${file.originalname} 不是有效的模组文件` });
                    }
                }

                const { ModCheckService } = await import('./mod-filter/index.js');
                const checkService = new ModCheckService('');
                const results = await checkService.checkUploadedFiles(req.files as Express.Multer.File[]);

                logger.info("模组检查完成", { resultsCount: results.length });
                res.json(results);
            } catch (err) {
                const error = err as Error;
                logger.error("/modcheck/upload 路由错误", error);
                res.status(500).json({ status: 500, message: "模组检查失败: " + error.message });
            }
        });
    }

    private setupGalaxyRoutes() {
        this.app.use("/galaxy", this.galaxy.getRouter());
    }

    private setupJavaRoutes() {
        // 检查Java版本
        this.app.get('/java/check', async (req, res) => {
            try {
                const javaPath = req.query.path as string;
                const result: JavaCheckResult = await checkJava(javaPath);
                
                res.json({
                    status: 200,
                    data: result
                });
            } catch (err) {
                const error = err as Error;
                logger.error("/java/check 路由错误", error);
                res.status(500).json({ status: 500, message: "Java检查失败" });
            }
        });

        // 自动检测Java路径
        this.app.get('/java/detect', async (req, res) => {
            try {
                const paths = await detectJavaPaths();
                
                res.json({
                    status: 200,
                    data: paths
                });
            } catch (err) {
                const error = err as Error;
                logger.error("/java/detect 路由错误", error);
                res.status(500).json({ status: 500, message: "Java路径检测失败" });
            }
        });
    }
    public async start() {
        
        this.express();
        const port = this.config.port || 37019;
        const host = this.config.host || 'localhost';
        this.server.listen(port, host, async () => {
            logger.info(`服务器正在运行于 http://${host}:${port}`);
            await this.javachecker();
        });
        
        this.server.on('error', (err) => {
            logger.error("服务器错误", err);
        });
    }
}