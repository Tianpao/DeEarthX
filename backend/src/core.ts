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

    private setupExpressRoutes() {
        this.setupMiddleware();
        this.setupHealthRoutes();
        this.setupTaskRoutes();
        this.setupConfigRoutes();
        this.setupModCheckRoutes();
        this.setupGalaxyRoutes();
        this.setupJavaRoutes();
        this.setupTemplateRoutes();
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
        // 模组检查路由 - 通过路径检查
        this.app.get('/modcheck', async (req, res) => {
            try {
                const modsPath = req.query.path as string;
                if (!modsPath) {
                    return res.status(400).json({ status: 400, message: "缺少 path 参数" });
                }

                const { ModCheckService } = await import('./dearth/index.js');
                const checkService = new ModCheckService(modsPath);
                const results = await checkService.checkMods();

                res.json(results);
            } catch (err) {
                const error = err as Error;
                logger.error("/modcheck 路由错误", error);
                res.status(500).json({ status: 500, message: "模组检查失败" });
            }
        });



        // 模组检查路由 - 通过文件夹路径和整合包名字检查
        this.app.post('/modcheck/folder', async (req, res) => {
            try {
                const { folderPath, bundleName } = req.body;

                if (!folderPath) {
                    logger.warn("请求中缺少文件夹路径");
                    return res.status(400).json({ status: 400, message: "缺少文件夹路径" });
                }

                if (!bundleName || !bundleName.trim()) {
                    logger.warn("请求中缺少整合包名字");
                    return res.status(400).json({ status: 400, message: "缺少整合包名字" });
                }

                logger.info("收到模组检查文件夹请求", { 
                    folderPath, 
                    bundleName: bundleName.trim() 
                });

                const { ModCheckService } = await import('./dearth/index.js');
                const checkService = new ModCheckService(folderPath);
                const results = await checkService.checkModsWithBundle(bundleName.trim());

                logger.info("模组检查完成", { resultsCount: results.length });
                res.json(results);
            } catch (err) {
                const error = err as Error;
                logger.error("/modcheck/folder 路由错误", error);
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

    private setupTemplateRoutes() {
        // 获取模板列表
        this.app.get('/templates', async (req, res) => {
            try {
                const templateModule = await import('./template/index.js');
                const TemplateManager = (templateModule as any).TemplateManager;
                const templateManager = new TemplateManager();
                const templates = await templateManager.getTemplates();
                
                res.json({
                    status: 200,
                    data: templates
                });
            } catch (err) {
                const error = err as Error;
                logger.error("/templates 路由错误", error);
                res.status(500).json({ status: 500, message: "获取模板列表失败" });
            }
        });

        // 创建模板
        this.app.post('/templates', async (req, res) => {
            try {
                const { name, version, description, author } = req.body;
                
                if (!name) {
                    res.status(400).json({ status: 400, message: "模板名称不能为空" });
                    return;
                }

                const templateModule = await import('./template/index.js');
                const TemplateManager = (templateModule as any).TemplateManager;
                const templateManager = new TemplateManager();
                
                const templateId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
                
                await templateManager.createTemplate(templateId, {
                    name,
                    version: version || '1.0.0',
                    description: description || '',
                    author: author || '',
                    created: new Date().toISOString().split("T")[0],
                    type: 'template'
                });
                
                res.json({
                    status: 200,
                    message: "模板创建成功",
                    data: { id: templateId }
                });
            } catch (err) {
                const error = err as Error;
                logger.error("/templates POST 路由错误", error);
                res.status(500).json({ status: 500, message: "创建模板失败" });
            }
        });

        // 删除模板
        this.app.delete('/templates/:id', async (req, res) => {
            try {
                const { id } = req.params;
                
                const templateModule = await import('./template/index.js');
                const TemplateService = (templateModule as any).TemplateService;
                const templateService = new TemplateService();
                
                const success = await templateService.deleteTemplate(id);
                
                if (success) {
                    res.json({
                        status: 200,
                        message: "模板删除成功"
                    });
                } else {
                    res.status(404).json({ status: 404, message: "模板不存在" });
                }
            } catch (err) {
                const error = err as Error;
                logger.error(`/templates/${req.params.id} DELETE 路由错误`, error);
                res.status(500).json({ status: 500, message: "删除模板失败" });
            }
        });

        // 修改模板信息
        this.app.put('/templates/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { name, version, description, author } = req.body;
                
                if (!name) {
                    res.status(400).json({ status: 400, message: "模板名称不能为空" });
                    return;
                }

                const templateModule = await import('./template/index.js');
                const TemplateManager = (templateModule as any).TemplateManager;
                const templateManager = new TemplateManager();
                
                await templateManager.updateTemplate(id, {
                    name,
                    version: version || '1.0.0',
                    description: description || '',
                    author: author || '',
                    type: 'template'
                });
                
                res.json({
                    status: 200,
                    message: "模板更新成功"
                });
            } catch (err) {
                const error = err as Error;
                logger.error(`/templates/${req.params.id} PUT 路由错误`, error);
                res.status(500).json({ status: 500, message: "更新模板失败" });
            }
        });

        // 打开模板文件夹
        this.app.get('/templates/:id/path', async (req, res) => {
            try {
                const { id } = req.params;
                const path = await import('path');
                const { exec } = await import('child_process');
                const templateModule = await import('./template/index.js');
                const TemplateManager = (templateModule as any).TemplateManager;
                
                const templateManager = new TemplateManager();
                const templatesPath = (templateManager as any).templatesPath;
                const templatePath = path.resolve(templatesPath, id);
                
                const platform = process.platform;
                let command: string;
                
                if (platform === 'win32') {
                    command = `explorer "${templatePath}"`;
                } else if (platform === 'darwin') {
                    command = `open "${templatePath}"`;
                } else {
                    command = `xdg-open "${templatePath}"`;
                }
                
                exec(command, (error) => {
                    res.json({
                        status: 200,
                        message: "文件夹已打开"
                    });
                });
            } catch (err) {
                const error = err as Error;
                logger.error(`/templates/${req.params.id}/path 路由错误`, error);
                res.status(500).json({ status: 500, message: "打开文件夹失败" });
            }
        });
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