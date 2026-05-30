import express, { Application } from "express";
import multer from "multer";
import cors from "cors"
import { createServer, Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Config, IConfig } from "./utils/config.js";
import { Dex } from "./Dex.js";
import { logger } from "./utils/logger.js";
import { checkJava, JavaCheckResult, detectJavaPaths } from "./utils/java.js";
import { Galaxy } from "./galaxy.js";
import { Server as SocketServer } from "socket.io";
import { setupTemplateRoutes } from "./routes/templates.js";
import { setupModCheckRoutes } from "./routes/modcheck.js";
import { setupDownloadRoutes } from "./routes/download.js";

export class Core {
    private config: IConfig;
    private readonly app: Application;
    private readonly server: Server;
    private readonly upload: multer.Multer;
    dex: Dex;
    galaxy: Galaxy;
    io: SocketServer;

    constructor(config: IConfig) {
        this.config = config
        this.app = express();
        this.server = createServer(this.app);
        this.io = new SocketServer(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
                credentials: true
            }
        })
        this.dex = new Dex(this.io)
        this.galaxy = new Galaxy()
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
                this.io.emit("message", {
                    type: "info",
                    message: `检测到 Java: ${result.version.fullVersion} (${result.version.vendor})`,
                    data: result.version
                });
            } else {
                logger.error("Java 检查失败", result.error);
                this.io.emit("message", {
                    type: "error",
                    message: result.error || "未找到 Java 或版本检查失败",
                    data: result
                });
            }
        } catch (error) {
            logger.error("Java 检查异常", error as Error);
            this.io.emit("message", {
                type: "error",
                message: "Java 检查遇到异常"
            });
        }
    }

    private setupExpressRoutes() {
        this.setupMiddleware();
        this.setupHealthRoutes();
        this.setupTaskRoutes();
        this.setupConfigRoutes();
        this.setupModCheckRoutes();
        this.setupGalaxyRoutes();
        this.setupJavaRoutes();
        this.setupTemplateRoutes();
        this.setupDownloadRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors({
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            credentials: true,
        }));
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
                const template = req.query.template as string || "";
                logger.info("正在启动任务", { 是否服务端模式: isServerMode, 文件名: req.file.originalname, 文件大小: req.file.size, 模板: template || "官方模组加载器" });

                // 非阻塞执行主要任务
                this.dex.Main(req.file.buffer, isServerMode, req.file.originalname, template).catch(err => {
                    logger.error("任务执行失败", err);
                });

                res.json({ status: 200, message: "任务已提交，正在处理中" });
            } catch (err) {
                const error = err as Error;
                logger.error("/start 路由错误", error);
                res.status(500).json({ status: 500, message: "服务器内部错误" });
            }
        });

        this.app.post("/start-path", (req, res) => {
            try {
                const filePath = req.body.path as string;
                if (!filePath) {
                    return res.status(400).json({ status: 400, message: "缺少 path 参数" });
                }
                if (!req.query.mode) {
                    return res.status(400).json({ status: 400, message: "缺少 mode 参数" });
                }

                const allowedExtensions = ['.zip', '.mrpack'];
                const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
                if (!allowedExtensions.includes(fileExtension)) {
                    return res.status(400).json({ status: 400, message: "只支持 .zip 和 .mrpack 文件" });
                }

                if (!fs.existsSync(filePath)) {
                    return res.status(400).json({ status: 400, message: "文件不存在" });
                }

                const isServerMode = req.query.mode === "server";
                const template = req.query.template as string || "";
                const filename = path.basename(filePath);
                logger.info("正在启动任务(路径模式)", { 是否服务端模式: isServerMode, 文件路径: filePath, 文件名: filename, 模板: template || "官方模组加载器" });

                this.dex.MainFromPath(filePath, isServerMode, template).catch(err => {
                    logger.error("任务执行失败", err);
                });

                res.json({ status: 200, message: "任务已提交，正在处理中" });
            } catch (err) {
                const error = err as Error;
                logger.error("/start-path 路由错误", error);
                res.status(500).json({ status: 500, message: "服务器内部错误" });
            }
        });
    }

    private setupConfigRoutes() {
        // 获取配置路由
        this.app.get('/config/get', (req, res) => {
            try {
                this.config = Config.getConfig();
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
                this.config = req.body;
                Config.clearCache();
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
        setupModCheckRoutes(this.app, this.io);
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

    private setupTemplateRoutes() {
        setupTemplateRoutes(this.app);
    }

    private setupDownloadRoutes() {
        setupDownloadRoutes(this.app, this.io);
    }

    public async start() {

        this.setupExpressRoutes();
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