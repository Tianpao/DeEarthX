import yauzl from "yauzl";
import Stream from "node:stream"

export interface IentryP extends yauzl.Entry {
    openReadStream: Promise<Stream.Readable>;
    ReadEntry: Promise<Buffer>;
}

export async function yauzl_promise(buffer: Buffer): Promise<IentryP[]>{
   const zip = await (new Promise((resolve,reject)=>{
    yauzl.fromBuffer(buffer,/*{lazyEntries:true},*/ (err, zipfile) => {
      if (err){
        reject(err);
        return;
      }
      resolve(zipfile);
    });
    return;
  }) as Promise<yauzl.ZipFile>);

   return new Promise((resolve, reject) => {
    const entries: IentryP[]= []
        zip.on("entry", async (entry: yauzl.Entry) => {
          const _entry = {
            ...entry,
            getLastModDate: entry.getLastModDate,
            isEncrypted: entry.isEncrypted,
            isCompressed: entry.isCompressed,
            openReadStream: _openReadStream(zip,entry),
            ReadEntry: _ReadEntry(zip,entry),
          }
          entries.push(_entry)
          if (zip.entryCount === entries.length){
              zip.close();
              resolve(entries);
          }
        });
        zip.on("error",err=>{
            reject(err);
        })
    });
}

async function _ReadEntry(zip:yauzl.ZipFile,entry:yauzl.Entry): Promise<Buffer>{
  return new Promise((resolve,reject)=>{
    zip.openReadStream(entry,(err,stream)=>{
      if (err){
        reject(err);
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data",(chunk)=>{
        chunks.push(chunk);
      })
      stream.on("end",()=>{
        resolve(Buffer.concat(chunks));
      })
    })
  })
}

async function _openReadStream(zip:yauzl.ZipFile,entry:yauzl.Entry): Promise<Stream.Readable>{
    return new Promise((resolve,reject)=>{
     zip.openReadStream(entry,(err,stream)=>{
         if (err){
            reject(err);
            return;
         }
         resolve(stream);
     })
    })
}