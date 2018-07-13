const request = require('request');
const jwt = require('jsonwebtoken');
const WebSocket = require('./src/Websocket');
const db = require('./src/Database');
const api = require('./config/api_setting');
const ex = require('./src/exchange');

const port = process.env.PORT || 3002;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // disable SSL security checks for all https requests
const ws = new WebSocket(port);

const Server = {};

Server.init = async function init() {
    const self = this;
    const channelList = await Server.getChannelList();
    self.channelList = channelList.list;
    ws.connectionRun();
};

Server.addUser = async function addUser(data) {
    const con = data;
    con.free_credit = data.freecredit;
    delete con.freecredit;
    delete con.rid; // 測試用
    con.rid = 0; // 測試用
    con.status_id = 1;
    con.profit_loss = 0;
    con.jpid = con.channel_info.cid;
    con.mpid = con.channel_info.cid;
    con.mrid = con.channel_info.cid;
    const res = await api.addGamer(con);
    return res.result;
};

// 取得玩家所有資料
Server.getPlayer = async function getPlayer(data) {
    const user = await api.userdata(data.token);
    if (Object.is(user.result, 0)) {
        const res = user.userdata;
        res.free_credit = user.userdata.freecredit;
        delete res.freecredit;
        const player = JSON.stringify(res);
        const userData = await db.callSP('gamedb', 'sp_member_create', player);
        // console.log(userData)
        userData.token = data.token;
        userData.channel_info = await Server.getChannelInfo(data.channelId);
        delete userData.result;
        const roomId = await Server.getRoomId(); // 取得房號
        userData.rid = roomId;
        // 這邊call db
        const ag = await Server.addUser(userData);
        if (ag !== 0) {
            return {
                result: 0,
                message: 'Add gamer Error',
            };
        }
        const result = await Server.transfer(userData, data); // 轉換幣值
        result.platform = data.platform;
        const getInRoom = await Server.roomIn(result);
        if (getInRoom !== 0) {
            return {
                result: 0,
                message: 'Get Room Error',
            };
        }
        // console.log(result);
        return result;
    }
    return {
        result: 0,
        message: data,
    };
};

// 取得空房間號碼
Server.getRoomId = async function getRoomId() {
    const res = await db.callSP('gamedb', 'sp_room_get');
    return res.room_id; // 回傳房間號碼
};

// 判斷頻道
Server.getChannelInfo = async function getChannelInfo(data) {
    const self = this;
    for (let i = 0; i < Object.keys(self.channelList).length; i += 1) {
        if (Object.is(self.channelList[i].cid, (data + 1).toString())) {
            return self.channelList[i]; // 回傳頻道資訊
        }
    }
    return {
        result: 0,
        message: 'Memory Server Error',
    };
};

// 取得頻道列表
Server.getChannelList = async function getChannelList() {
    const res = await api.channel();
    return res;
};

// promise物件封裝 request
// Server.promise = function promise(config) {
//     return new Promise((resolve, reject) => {
//         request(config, (error, response, body) => {
//             if (error) throw new Error(reject(error));
//             resolve(JSON.parse(body));
//         });
//     });
// };

// db玩家登入(籌碼換入)
Server.roomIn = async function roomIn(data) {
    // console.log(data);
    const con = {
        pid: data.pid,
        platform: data.platform,
        channels: data.channel_info.cid,
        chips: (data.transfer_credit + data.transfer_freecredit),
        credit: data.transfer_credit,
        free_credit: data.transfer_freecredit,
    };
    const res = await db.callSP('gamedb', 'sp_room_in()', con);
    return res.result;
};

// 轉移遊戲幣
Server.transfer = async function transfer(user, data) {
    const res = await ex.transfer(user, data);
    return res; // 回傳使用者資料
};

// 驗證token
Server.verify = async function verify(data) {
    const self = this;
    const serect = await db.callSP('gamedb', 'sp_getkey');
    self.key = serect.key;
    const ve = jwt.verify(data.token, self.key, (err, decoded) => (decoded));
    if (ve !== undefined) {
        return {
            result: 1,
            uid: ve.uid,
            message: self.channelList,
        }; // 回傳頻道列表
    }
    return {
        result: 0,
        message: 'Invalid Signature',
    };
};

ws.addEvent('login', (wss, packet) => {
    const wx = wss;
    const res = packet;
    async function getChannelList(data) { // only token
        const verifyData = await Server.verify(data);
        wx.uid = verifyData.uid;
        ws.send('login', verifyData.message, wx);
    }
    async function getUser(data) { // token + channelId + credit
        const userData = await Server.getPlayer(data);
        ws.send('login', userData, wx);
    }
    if (typeof (res) !== 'object') {
        ws.send('login', { result: 0, message: 'TypeError' }, wx);
    } else if ('channelId' in res) {
        getUser(res);
    } else {
        getChannelList(res);
    }
});


Server.init();
