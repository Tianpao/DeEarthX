import fs from "node:fs";
import fse from "fs-extra";
import { Server } from "socket.io";
import { MessageWS } from "../utils/socketio.js";
import { logger } from "../utils/logger.js";
import { Minecraft } from "../modloader/minecraft.js";
import { Forge } from "../modloader/forge.js";
import { NeoForge } from "../modloader/neoforge.js";
import { Fabric } from "../modloader/fabric.js";
import { Config } from "../utils/config.js";
import { version_compare } from "../utils/java.js";

interface XLoader {
  setup(): Promise<void>;
  installer(): Promise<void>;
}

function getLoaderInstance(loader: string, mcVersion: string, loaderVersion: string, installPath: string): XLoader {
  switch (loader) {
    case "forge":
      return new Forge(mcVersion, loaderVersion, installPath);
    case "neoforge":
      return new NeoForge(mcVersion, loaderVersion, installPath);
    case "fabric":
    case "fabric-loader":
      return new Fabric(mcVersion, loaderVersion, installPath);
    default:
      return new Minecraft(loader, mcVersion, loaderVersion, installPath);
  }
}

async function generateInstallScripts(
  loader: string,
  mcVersion: string,
  loaderVersion: string,
  installPath: string
): Promise<void> {
  const config = Config.getConfig();
  const javaCmd = config.javaPath || "java";

  if (loader === "forge" || loader === "neoforge") {
    const installerJar = `forge-${mcVersion}-${loaderVersion}-installer.jar`;
    const basicCmd = `${javaCmd} -jar ${installerJar} --installServer`;
    const chinaCmd = `${javaCmd} -jar ${installerJar} --installServer --mirror https://bmclapi2.bangbang93.com/maven/`;

    await fs.promises.writeFile(
      `${installPath}/install_forge.bat`,
      `@echo off\n${basicCmd}\necho Install Successfully, Press any key to exit!\npause\n`
    );
    await fs.promises.writeFile(
      `${installPath}/install_forge.sh`,
      `#!/bin/bash\n${basicCmd}\n`
    );
    await fs.promises.writeFile(
      `${installPath}/install_forge_china.bat`,
      `@echo off\n${chinaCmd}\necho Install Successfully, Press any key to exit!\npause\n`
    );
    await fs.promises.writeFile(
      `${installPath}/install_forge_china.sh`,
      `#!/bin/bash\n${chinaCmd}\n`
    );

    if (version_compare(mcVersion, "1.16.5") < 0) {
      await fs.promises.writeFile(
        `${installPath}/run.sh`,
        `#!/bin/bash\n${javaCmd} -jar forge-${mcVersion}-${loaderVersion}.jar\n`
      );
    }
  } else if (loader === "fabric" || loader === "fabric-loader") {
    const cmd = `${javaCmd} -jar fabric-installer.jar server -dir . -mcversion ${mcVersion} -loader ${loaderVersion} -downloadMinecraft`;
    await fs.promises.writeFile(
      `${installPath}/install.bat`,
      `@echo off\n${cmd}\necho Install Successfully, Press any key to exit!\npause\n`
    );
    await fs.promises.writeFile(
      `${installPath}/install.sh`,
      `#!/bin/bash\n${cmd}\n`
    );

    await fs.promises.writeFile(
      `${installPath}/run.bat`,
      `@echo off\n${javaCmd} -jar fabric-server-launch.jar\npause\n`
    );
    await fs.promises.writeFile(
      `${installPath}/run.sh`,
      `#!/bin/bash\n${javaCmd} -jar fabric-server-launch.jar\n`
    );
  }
}

export async function performInstall(
  loader: string,
  mcVersion: string,
  loaderVersion: string,
  installPath: string,
  autoInstall: boolean,
  io: Server,
  socketId?: string
): Promise<void> {
  await fse.ensureDir(installPath);

  let ws: MessageWS | undefined;
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      ws = new MessageWS(socket);
    }
  }

  const startTime = Date.now();

  try {
    ws?.serverInstallStart("Server Install", mcVersion, loader, loaderVersion);

    if (autoInstall) {
      ws?.serverInstallStep("安装 Minecraft 服务端", 1, 2);
      const minecraft = new Minecraft(loader, mcVersion, loaderVersion, installPath);
      await minecraft.setup();

      ws?.serverInstallStep(`安装 ${loader} 加载器`, 2, 2);
      await getLoaderInstance(loader, mcVersion, loaderVersion, installPath).setup();
    } else {
      ws?.serverInstallStep("下载安装器", 1, 2);
      await getLoaderInstance(loader, mcVersion, loaderVersion, installPath).installer();

      ws?.serverInstallStep("生成安装脚本", 2, 2);
      await generateInstallScripts(loader, mcVersion, loaderVersion, installPath);
    }

    const duration = Date.now() - startTime;
    ws?.serverInstallComplete(installPath, duration);
    logger.info(`安装完成: ${installPath}, 耗时 ${duration}ms`);
  } catch (err) {
    logger.error("安装失败", err as Error);
    ws?.serverInstallError((err as Error).message);
    throw err;
  }
}
