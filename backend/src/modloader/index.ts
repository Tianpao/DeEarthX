import { Fabric } from "./fabric.js";
import { Forge } from "./forge.js";
import { Minecraft } from "./minecraft.js";
import { NeoForge } from "./neoforge.js";
import fs from "node:fs";
import { MessageWS } from "../utils/ws.js";

interface XModloader {
  setup(): Promise<void>;
  installer(): Promise<void>;
}

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

export async function mlsetup(ml: string, mcv: string, mlv: string, path: string, messageWS?: MessageWS): Promise<void> {
  const totalSteps = 2;
  
  try {
    if (messageWS) {
      messageWS.serverInstallStart("Server Installation", mcv, ml, mlv);
      messageWS.serverInstallStep("Installing Minecraft Server", 1, totalSteps);
    }
    
    const minecraft = new Minecraft(ml, mcv, mlv, path);
    await minecraft.setup();
    
    if (messageWS) {
      messageWS.serverInstallProgress("Installing Minecraft Server", 100);
      messageWS.serverInstallStep(`Installing ${ml} Loader`, 2, totalSteps);
    }
    
    await modloader(ml, mcv, mlv, path).setup();
    
    if (messageWS) {
      messageWS.serverInstallProgress(`Installing ${ml} Loader`, 100);
    }
  } catch (error) {
    if (messageWS) {
      messageWS.serverInstallError(error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

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
