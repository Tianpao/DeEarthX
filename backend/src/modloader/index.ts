import { Fabric } from "./fabric.js";
import { Forge } from "./forge.js";
import { Minecraft } from "./minecraft.js";
import { NeoForge } from "./neoforge.js";

interface XModloader {
  setup(): Promise<void>;
  installer(): Promise<void>;
}
export function modloader(ml:string,mcv:string,mlv:string,path:string){
    let modloader:XModloader
 switch (ml) {
    case "fabric":
        modloader = new Fabric(mcv,mlv,path)
        break;
    case "fabric-loader":
        modloader = new Fabric(mcv,mlv,path)
        break;
    case "forge":
        modloader = new Forge(mcv,mlv,path)
        break;
    case "neoforge":
        modloader = new NeoForge(mcv,mlv,path)
        break;
    default:
        modloader = new Minecraft(ml,mcv,mlv,path)
        break;
 }
     return modloader
}

export async function mlsetup(ml:string,mcv:string,mlv:string,path:string){
    const minecraft = new Minecraft(ml,mcv,mlv,path);
    //console.log(ml)
    await modloader(ml,mcv,mlv,path).setup()
    await minecraft.setup()
}

export async function dinstall(ml:string,mcv:string,mlv:string,path:string){
    await modloader(ml,mcv,mlv,path).installer();
}