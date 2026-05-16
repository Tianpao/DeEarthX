import { Application, Request, Response } from "express";
import got from "got";
import { Server } from "socket.io";
import { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { performInstall } from "./download-install.js";

interface MinecraftVersionEntry {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

interface ForgeBuildFile {
  format: string;
  category: string;
  hash: string;
}

interface ForgeBuild {
  version: string;
  mcversion: string;
  files: ForgeBuildFile[];
}

interface NeoForgeBuild {
  version: string;
  mcversion: string;
  installerPath: string;
}

interface FabricLoaderEntry {
  loader: {
    version: string;
    stable: boolean;
  };
}

export function setupDownloadRoutes(app: Application, io: Server): void {

  app.get("/download/minecraft-versions", async (_req: Request, res: Response) => {
    try {
      const config = Config.getConfig();
      const url = config.mirror.bmclapi
        ? "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json"
        : "http://launchermeta.mojang.com/mc/game/version_manifest.json";

      const data = await got.get(url, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<{ versions: MinecraftVersionEntry[] }>();

      const versions = data.versions.map(v => ({ id: v.id, type: v.type }));
      res.json({ versions });
    } catch (err) {
      logger.error("获取 Minecraft 版本列表失败", err as Error);
      res.status(500).json({ error: "获取版本列表失败" });
    }
  });

  app.get("/download/forge-versions", async (req: Request, res: Response) => {
    try {
      const mcver = req.query.mcver as string;
      if (!mcver) {
        return res.status(400).json({ error: "缺少 mcver 参数" });
      }

      const data = await got.get(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcver}`, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<ForgeBuild[]>();

      const versions = data.map(v => {
        const installer = v.files?.find(f => f.category === "installer" && f.format === "jar");
        return {
          version: v.version,
          mcversion: v.mcversion,
          hash: installer?.hash
        };
      });

      res.json(versions);
    } catch (err) {
      logger.error("获取 Forge 版本列表失败", err as Error);
      res.status(500).json({ error: "获取 Forge 版本列表失败" });
    }
  });

  app.get("/download/neoforge-versions", async (req: Request, res: Response) => {
    try {
      const mcver = req.query.mcver as string;
      if (!mcver) {
        return res.status(400).json({ error: "缺少 mcver 参数" });
      }

      const data = await got.get(`https://bmclapi2.bangbang93.com/neoforge/list/${mcver}`, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<NeoForgeBuild[]>();

      const versions = data.map(v => ({
        version: v.version,
        mcversion: v.mcversion,
        installerPath: v.installerPath
      }));

      res.json(versions);
    } catch (err) {
      logger.error("获取 NeoForge 版本列表失败", err as Error);
      res.status(500).json({ error: "获取 NeoForge 版本列表失败" });
    }
  });

  app.get("/download/fabric-versions", async (req: Request, res: Response) => {
    try {
      const mcver = req.query.mcver as string;
      if (!mcver) {
        return res.status(400).json({ error: "缺少 mcver 参数" });
      }

      const data = await got.get(`https://meta.fabricmc.net/v1/versions/loader/${mcver}`, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<FabricLoaderEntry[]>();

      const versions = data.map(v => ({
        version: v.loader.version,
        stable: v.loader.stable
      }));

      versions.sort((a, b) => (b.stable ? 1 : 0) - (a.stable ? 1 : 0));

      res.json(versions);
    } catch (err) {
      logger.error("获取 Fabric 版本列表失败", err as Error);
      res.status(500).json({ error: "获取 Fabric 版本列表失败" });
    }
  });

  app.post("/download/install", async (req: Request, res: Response) => {
    try {
      const { loader, mcVersion, loaderVersion, installPath, autoInstall } = req.body;
      if (!loader || !mcVersion || !loaderVersion || !installPath) {
        return res.status(400).json({ error: "缺少必要参数: loader, mcVersion, loaderVersion, installPath" });
      }

      const socketId = req.query.socketId as string;

      performInstall(loader, mcVersion, loaderVersion, installPath, autoInstall === true, io, socketId)
        .catch(err => logger.error("安装失败", err as Error));

      res.json({ status: 200, message: "安装已开始" });
    } catch (err) {
      logger.error("安装请求处理失败", err as Error);
      res.status(500).json({ error: "安装请求处理失败" });
    }
  });
}
