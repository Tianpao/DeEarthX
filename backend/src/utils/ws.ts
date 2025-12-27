import websocket, { WebSocketServer } from "ws";
export class MessageWS {
  ws!: websocket;
  constructor(ws: websocket) {
    this.ws = ws;
  }

  finish(first: number, latest: number) {
    this.ws.send(
      JSON.stringify({
        status: "finish",
        result: latest - first,
      })
    );
  }

  unzip(entryName: string, total: number, current: number) {
    this.ws.send(
      JSON.stringify({
        status: "unzip",
        result: { name: entryName, total, current },
      })
    );
  }

  download(total: number, index: number, name: string) {
    this.ws.send(
      JSON.stringify({
        status: "downloading",
        result: {
          total,
          index,
          name,
        },
      })
    );
  }

  statusChange() {
    this.ws.send(
      JSON.stringify({
        status: "changed",
        result: undefined,
      })
    );
  }

  handleError(error: Error) {
    this.ws.send(
      JSON.stringify({
        status: "error",
        result: error.message,
      })
    );
  }
}
