import config, { Config } from "./utils/config.js";
import fsp from "node:fs/promises";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { yauzl_promise } from "./utils/yauzl.promise.js";
import express from "express";
import multer from "multer";
import cors from "cors"
import websocket, {WebSocketServer} from "ws"
import { createServer } from "node:http";
const app = express();
const upload = multer()
app.use(cors())
app.use(express.json())
const server = createServer(app);
const wss = new WebSocketServer({server})
const tasks = new Map<number, {status: "peding"|"success",result: any}>()
let timespm = 0;
let ws:websocket|undefined = undefined;
/* 对外API */
 // Express
app.post("/start",upload.single("file"),(req,res)=>{
  if (!req.file){
   return;
  }
  DeX(req.file.buffer)
  timespm = Date.now();
  tasks.set(timespm,{status:"peding",result:undefined});
  res.json({taskId:timespm})
    //const buffer = Buffer.from(req.body);
    //console.log(buffer);
})

app.get('/getconfig',(req,res)=>{
    res.json(config)
})

app.post('/writeconfig',(req,res)=>{
    Config.write_config(req.body)
    res.json({status:200})
})
 // WebSocket
 wss.on("connection",(wsx)=>{
     ws = wsx;
 })

server.listen(37019,()=>{
    console.log("Server is running on http://localhost:37019")
})

async function DeX(buffer: Buffer) {
  /* 解压Zip */
  const zip = await yauzl_promise(buffer);
  for await (const entry of zip) {
    const ew = entry.fileName.endsWith('/')
    if (ew){
        await fsp.mkdir(`./test/${entry.fileName}`,{recursive:true})
    }
    if (!ew) {
        const dirPath = `./test/${entry.fileName.substring(0, entry.fileName.lastIndexOf('/'))}`;
        await fsp.mkdir(dirPath, { recursive: true });
        const stream = await entry.openReadStream;
        const write = fs.createWriteStream(`./test/${entry.fileName}`);
        await pipeline(stream, write);
    }
    if(ws){
      ws.send(JSON.stringify({status:"unzip",result:entry.fileName}))
    }
  }
  /* 解压完成 */
  ws?.send(JSON.stringify({status:"changed",result:undefined}))
}