import { Application, Request, Response } from "express";
import got from "got";
import path from "node:path";
import { Server } from "socket.io";
import { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { getAppDir } from "../utils/appdir.js";
import { performInstall } from "./download-install.js";

const cache = new Map<string, { data: any; time: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry) return entry.data as T;
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, time: Date.now() });
}

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

interface ForgePromoEntry {
  name: string;
  build: {
    mcversion: string;
    version: string;
    files: ForgeBuildFile[];
  };
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

function loaderDisplayName(loader: string): string {
  switch (loader) {
    case "forge": return "Forge";
    case "neoforge": return "NeoForge";
    case "fabric":
    case "fabric-loader": return "Fabric";
    default: return loader;
  }
}

export function setupDownloadRoutes(app: Application, io: Server): void {

  app.get("/download/minecraft-versions", async (_req: Request, res: Response) => {
    try {
      const cacheKey = "minecraft-versions";
      const cached = getCached<{ versions: { id: string; type: string }[] }>(cacheKey);
      if (cached) return res.json(cached);

      const config = Config.getConfig();
      const url = config.mirror.bmclapi
        ? "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json"
        : "http://launchermeta.mojang.com/mc/game/version_manifest.json";

      const data = await got.get(url, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<{ versions: MinecraftVersionEntry[] }>();

      const result = { versions: data.versions.map(v => ({ id: v.id, type: v.type })) };
      setCache(cacheKey, result);
      res.json(result);
    } catch (err) {
      logger.error("获取 Minecraft 版本列表失败", err as Error);
      res.status(500).json({ error: "获取版本列表失败" });
    }
  });

  app.get("/download/forge-promos", async (_req: Request, res: Response) => {
    try {
      const cacheKey = "forge-promos";
      const cached = getCached<Record<string, { latest?: string; recommended?: string }>>(cacheKey);
      if (cached) return res.json(cached);

      const data = await got.get("https://bmclapi2.bangbang93.com/forge/promos", {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<ForgePromoEntry[]>();

      const promos: Record<string, { latest?: string; recommended?: string }> = {};
      for (const entry of data) {
        if (!entry.build?.mcversion) continue;
        if (!promos[entry.build.mcversion]) promos[entry.build.mcversion] = {};
        if (entry.name.endsWith("-latest")) promos[entry.build.mcversion].latest = entry.build.version;
        else if (entry.name.endsWith("-recommended")) promos[entry.build.mcversion].recommended = entry.build.version;
      }
      setCache(cacheKey, promos);
      res.json(promos);
    } catch (err) {
      logger.error("获取 Forge Promos 失败", err as Error);
      res.status(500).json({ error: "获取 Forge Promos 失败" });
    }
  });

  app.get("/download/forge-versions", async (req: Request, res: Response) => {
    try {
      const mcver = req.query.mcver as string;
      if (!mcver) return res.status(400).json({ error: "缺少 mcver 参数" });

      const cacheKey = `forge-versions:${mcver}`;
      const cached = getCached<{ version: string; mcversion: string; hash?: string }[]>(cacheKey);
      if (cached) return res.json(cached);

      const data = await got.get(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcver}`, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<ForgeBuild[]>();

      const versions = data.map(v => {
        const installer = v.files?.find(f => f.category === "installer" && f.format === "jar");
        return { version: v.version, mcversion: v.mcversion, hash: installer?.hash };
      });
      setCache(cacheKey, versions);
      res.json(versions);
    } catch (err) {
      logger.error("获取 Forge 版本列表失败", err as Error);
      res.status(500).json({ error: "获取 Forge 版本列表失败" });
    }
  });

  app.get("/download/neoforge-versions", async (req: Request, res: Response) => {
    try {
      const mcver = req.query.mcver as string;
      if (!mcver) return res.status(400).json({ error: "缺少 mcver 参数" });

      const cacheKey = `neoforge-versions:${mcver}`;
      const cached = getCached<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const data = await got.get(`https://bmclapi2.bangbang93.com/neoforge/list/${mcver}`, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<NeoForgeBuild[]>();

      const versions = data.map((v, i) => ({
        version: v.version, mcversion: v.mcversion,
        installerPath: v.installerPath, latest: i === data.length - 1
      }));
      setCache(cacheKey, versions);
      res.json(versions);
    } catch (err) {
      logger.error("获取 NeoForge 版本列表失败", err as Error);
      res.status(500).json({ error: "获取 NeoForge 版本列表失败" });
    }
  });

  app.get("/download/fabric-versions", async (req: Request, res: Response) => {
    try {
      const mcver = req.query.mcver as string;
      if (!mcver) return res.status(400).json({ error: "缺少 mcver 参数" });

      const cacheKey = `fabric-versions:${mcver}`;
      const cached = getCached<{ version: string; stable: boolean }[]>(cacheKey);
      if (cached) return res.json(cached);

      const data = await got.get(`https://meta.fabricmc.net/v1/versions/loader/${mcver}`, {
        headers: { "User-Agent": "DeEarthX" },
        timeout: { request: 30000 }
      }).json<FabricLoaderEntry[]>();

      const versions = data.map(v => ({ version: v.loader.version, stable: v.loader.stable }));
      versions.sort((a, b) => (b.stable ? 1 : 0) - (a.stable ? 1 : 0));
      setCache(cacheKey, versions);
      res.json(versions);
    } catch (err) {
      logger.error("获取 Fabric 版本列表失败", err as Error);
      res.status(500).json({ error: "获取 Fabric 版本列表失败" });
    }
  });

  app.post("/download/install", async (req: Request, res: Response) => {
    try {
      const { loader, mcVersion, loaderVersion, autoInstall } = req.body;
      if (!loader || !mcVersion || !loaderVersion) {
        return res.status(400).json({ error: "缺少必要参数: loader, mcVersion, loaderVersion" });
      }

      const name = loaderDisplayName(loader);
      const timestamp = Date.now().toString().substring(6, 10);
      const dirName = `${mcVersion}-${name}-${loaderVersion}-${timestamp}`;
      const installPath = path.join(getAppDir(), "instance", dirName);

      const socketId = req.query.socketId as string;

      performInstall(loader, mcVersion, loaderVersion, installPath, autoInstall === true, io, socketId)
        .catch(err => logger.error("安装失败", err as Error));

      res.json({ status: 200, message: "安装已开始", installPath });
    } catch (err) {
      logger.error("安装请求处理失败", err as Error);
      res.status(500).json({ error: "安装请求处理失败" });
    }
  });
}
