const env = process.env.DEBUG;

export function debug(msg: any){
    if (env === "true"){
        if(msg instanceof Error){
            console.log(`[ERROR] [${new Date().toLocaleString()}] `);
            console.log(msg);
        }
        if (typeof msg === "string"){
            console.log(`[DEBUG] [${new Date().toLocaleString()}] ` + msg);
        }
        if (typeof msg === "object"){
            console.log(`[OBJ] [${new Date().toLocaleString()}] `);
            console.log(msg);
        }
    }
}
