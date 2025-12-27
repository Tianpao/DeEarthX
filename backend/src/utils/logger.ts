const env = process.env.DEBUG;

export function debug(msg: string){
    if (env === "true"){
        console.info(msg);
    }
}
