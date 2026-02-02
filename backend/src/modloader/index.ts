import { Fabric } from "./fabric.js";
import { Forge } from "./forge.js";
import { Minecraft } from "./minecraft.js";
import { NeoForge } from "./neoforge.js";
import fs from "node:fs";

/**
 * 模组加载器接口
 */
interface XModloader {
  setup(): Promise<void>;
  installer(): Promise<void>;
}
/**
 * 创建模组加载器实例
 * @param ml 加载器类型
 * @param mcv Minecraft版本
 * @param mlv 加载器版本
 * @param path 安装路径
 * @returns 加载器实例
 */
export function modloader(ml: string, mcv: string, mlv: string, path: string): XModloader {
  switch (ml) {
    case "fabric":
    case "fabric-loader":
      return new Fabric(mcv, mlv, path);
    case "forge":
      return new Forge(mcv, mlv, path);
    case "neoforge":
      return new NeoForge(mcv, mlv, path);
    default:
      return new Minecraft(ml, mcv, mlv, path);
  }
}

/**
 * 设置模组加载器
 * @param ml 加载器类型
 * @param mcv Minecraft版本
 * @param mlv 加载器版本
 * @param path 安装路径
 */
export async function mlsetup(ml: string, mcv: string, mlv: string, path: string): Promise<void> {
  const minecraft = new Minecraft(ml, mcv, mlv, path);
  await modloader(ml, mcv, mlv, path).setup();
  await minecraft.setup();
}

/**
 * 安装模组加载器
 * @param ml 加载器类型
 * @param mcv Minecraft版本
 * @param mlv 加载器版本
 * @param path 安装路径
 */
export async function dinstall(ml: string, mcv: string, mlv: string, path: string): Promise<void> {
  await modloader(ml, mcv, mlv, path).installer();
  
  let cmd = '';
  if (ml === 'forge' || ml === 'neoforge') {
    cmd = `java -jar forge-${mcv}-${mlv}-installer.jar --installServer`;
  } else if (ml === 'fabric' || ml === 'fabric-loader') {
    await fs.promises.writeFile(`${path}/run.bat`,`@echo off\njava -jar fabric-server-launch.jar\n`)
    await fs.promises.writeFile(`${path}/run.sh`,`#!/bin/bash\njava -jar fabric-server-launch.jar\n`)
    cmd = `java -jar fabric-installer.jar server -dir . -mcversion ${mcv} -loader ${mlv} -downloadMinecraft`;
  }

  if (cmd) {
    await fs.promises.writeFile(`${path}/install.bat`, `@echo off\n${cmd}\necho Install Successfully,Enter Some Key to Exit!\npause\n`);
    await fs.promises.writeFile(`${path}/install.sh`, `#!/bin/bash\n${cmd}\n`);
  }
}