class Debugger{
    static log(msg: any){
        if (process.env.DEBUG){
            console.log(msg)
        }
    }
}