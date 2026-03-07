import admZip from "adm-zip";
import yauzl from "yauzl";
import Stream from "node:stream";

export interface IentryP extends yauzl.Entry {
  openReadStream: Promise<Stream.Readable>;
  ReadEntry: Promise<Buffer>;
}

export async function yauzl_promise(buffer: Buffer): Promise<IentryP[]> {
  const zip = await (new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      /*{lazyEntries:true},*/ (err, zipfile) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(zipfile);
      }
    );
    return;
  }) as Promise<yauzl.ZipFile>);

  const _ReadEntry = async (
    zip: yauzl.ZipFile,
    entry: yauzl.Entry
  ): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      zip.openReadStream(entry, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => {
          if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
          } else if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk));
          }
        });
        stream.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      });
    });
  };

  const _openReadStream = async (
    zip: yauzl.ZipFile,
    entry: yauzl.Entry
  ): Promise<Stream.Readable> => {
    return new Promise((resolve, reject) => {
      zip.openReadStream(entry, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(stream);
      });
    });
  };

  return new Promise((resolve, reject) => {
    const entries: IentryP[] = [];
    zip.on("entry", async (entry: yauzl.Entry) => {
    const entryP = entry as IentryP;
    //console.log(entry.fileName);
    entryP.openReadStream = _openReadStream(zip, entry);
    entryP.ReadEntry = _ReadEntry(zip, entry);
    entries.push(entryP);
      if (zip.entryCount === entries.length) {
        zip.close();
        resolve(entries);
      }
    });
    zip.on("error", (err) => {
      reject(err);
    });
  });
}

export function Azip(buffer: Buffer) {
  const zip = new admZip(buffer);
  const entries = zip.getEntries();
  return entries;
}
