const WebSocketServer = require('ws').Server;

// 網頁連線
class Websocket {
    // 建構式
    constructor(port) {
    // 驗證
        const self = this;
        const socketverify = function socketverify(info) {
            const origin = info.origin.match(/^(:?.+:\/\/)([^/]+)/);
            return (origin.length < 3);
        };
        // 連線資訊
        self.ws = new WebSocketServer({
            port,
            verifyClinet: socketverify,
        });
        // 事件柱列
        self.eventList = {};
        // 開啟連線事件
        self.open = function a(ws) {};
        // 關閉連線事件
        self.close = function b(ws) {};
        // 錯誤連線事件
        self.error = function c(ws, iData) {};
    }

    // 新增事件
    addEvent(iStrPacket = '', iFunc) {
        const self = this;
        self.eventList[iStrPacket] = iFunc;
    }

    // 開啟連線並註冊事件列表
    connectionRun() {
        const self = this;
        self.ws.on(
            'connection',
            (iSocket) => {
                // 開啟連結
                iSocket.on('open', () => {
                    self.open(iSocket);
                });
                // 關閉連結
                iSocket.on('close', () => {
                    self.close(iSocket);
                });
                // 接收資料
                iSocket.on('message', (iData) => { // 封包格式驗證
                    const packet = JSON.parse(iData);
                    if (Object.is(packet.n, undefined) || Object.is(packet.d, undefined)) {
                        self.error(iSocket, '封包解析錯誤');
                        return;
                    }
                    // console.log(packet);
                    // console.log(self.eventList[packet.n]);
                    self.eventList[packet.n](iSocket, packet.d);
                });
                // 錯誤處理
                iSocket.on('error', (iData) => {
                    self.error(iSocket, iData);
                });
            },
        );
    }

    // 發送訊息
    send(iStrPacket, iData, iws, iFunc) {
        const self = this;
        self.options = {
            mask: true,
            binary: true,
            compress: false,
        };
        // 封包資料
        const packet = {
            n: iStrPacket, // 封包名稱
            d: iData, // 封包資料
        };
        // iws.send(packet, self.options, iFunc);
        iws.send(JSON.stringify(packet));
    }

    // 開啟連線 o_func(i_ws)
    onOpen(oFunc) {
        const self = this;
        self.open = oFunc;
    }

    // 關閉連線 o_func(i_ws)
    onClose(oFunc) {
        const self = this;
        self.close = oFunc;
    }

    // 錯誤連線 o_func(i_ws, i_data)
    onError(oFunc) {
        const self = this;
        self.error = oFunc;
    }
}

module.exports = Websocket;
