import fse from "fs-extra"
import { Forge } from "./forge.js";

export class NeoForge extends Forge{
constructor(minecraft:string,loaderVersion:string,path:string){
    super(minecraft,loaderVersion,path); //子承父业
}

async setup(){
    await this.installer();
    await this.library();
    await this.install();
}

async installer(){
    const res = (await this.got.get(`neoforge/version/${this.loaderVersion}/download/installer.jar`)).rawBody;
    await fse.outputFile(`${this.path}/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`,res);
}
}