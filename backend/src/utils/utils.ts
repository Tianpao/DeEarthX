import config from "./config.js";

export class Utils{
    public modrinth_url: string;
    public curseforge_url: string;
    constructor(){
    this.modrinth_url = "https://api.modrinth.com"
    this.curseforge_url = "https://api.curseforge.com"
    if(config.mirror.mcimirror){
        this.modrinth_url = "https://mod.mcimirror.top/modrinth"
        this.curseforge_url = "https://mod.mcimirror.top/curseforge"
    }
    }
}