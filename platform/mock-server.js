/* ==========================================================================
   HyicoPlatform · 本地 mock 后端
   --------------------------------------------------------------------------
   用途：在没有真实后端的情况下，把前端的全部功能跑起来做验证。
   零依赖：只用 Node 内置模块。WebSocket 的握手与帧编码手写（不引 ws 包），
   与仓库「无外部依赖」的约定一致。

   模拟的东西：
     GET  /api/health                     -> commands_enabled: false（只读模式）
     POST /api/auth/login                 -> { access_token, username, role }
     GET  /api/drones                     -> { drones: [...] }
     GET  /api/drones/:sysid              -> 单个 drone
     GET  /api/drones/:sysid/history      -> { history: [...] }
     GET  /api/drones/:sysid/alerts       -> { alerts: [...] }
     WS   /ws?token=...                   -> 定期推送 { type:'snapshot', drones, alerts }

   数据刻意覆盖边界情况，方便用截图验证渲染是否正确：
     - 在线/离线、已解锁/未解锁
     - 电量三档：<=10 危险、<=20 警告、正常
     - 告警三级：critical / warning / info
     - 一台「字段大量缺失」的机器，验证 -- 兜底与空态
     - 一台「无定位」的机器，验证地图占位符
     - 主控温度 >75、链路 < -90dBm，验证数值越限变红

   运行：node platform/mock-server.js   然后打开 http://localhost:4180
   账号：任意非空用户名 + 密码 admin（见下方 login 处理）
   ========================================================================== */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, 'webui');
const PORT = 4180;

/* ---------------------------------------------------------------- 模拟数据 */

// 一台「健康在线」的机器，字段齐全
const DRONE_A = {
  sysid: 1, name: 'HyicoFly-H770 · 甲',
  online: true, armed: false,
  battery: 87, rel_alt: 42.6, alt: 58.3,
  mode: 'AUTO', satellites: 17, last_seen: Math.floor(Date.now() / 1000) - 3,
  lat: 31.2304, lon: 121.4737, roll: 3.2, pitch: -1.8, yaw: 128.4,
  system_status: 3, voltage: 24.7, current: 12.3, heading: 128,
  groundspeed: 8.4, airspeed: 9.1, climb: 0.6, throttle: 61,
  fix_type: 6, gps_ok: true,
  local_x: 12.4, local_y: -3.1, local_z: -42.6,
  vibration_x: 4.2, vibration_y: 5.1, vibration_z: 8.9,
  range_m: 310.5, mcu_temp: 48.2, mcu_voltage: 5.02,
  rssi: -62, load: 34, wind_speed: 2.4, ekf_ok: true, ground_distance: 42.6
};

// 一台「告警中」的机器：低电量 + 已解锁 + 高温 + 弱链路
const DRONE_B = {
  sysid: 2, name: 'HyicoFly-H770 · 乙',
  online: true, armed: true,
  battery: 8, rel_alt: 118.9, alt: 134.2,
  mode: 'LOITER', satellites: 6, last_seen: Math.floor(Date.now() / 1000) - 1,
  lat: 31.2418, lon: 121.4901, roll: -11.4, pitch: 7.9, yaw: 274.1,
  system_status: 4, voltage: 20.9, current: 28.6, heading: 274,
  groundspeed: 0.3, airspeed: 1.2, climb: -0.2, throttle: 72,
  fix_type: 3, gps_ok: false,
  local_x: -44.2, local_y: 18.7, local_z: -118.9,
  vibration_x: 22.4, vibration_y: 19.8, vibration_z: 31.2,
  range_m: 0, mcu_temp: 82.6, mcu_voltage: 4.71,
  rssi: -96, load: 78, wind_speed: 7.8, ekf_ok: false, ground_distance: 0
};

// 一台「离线」的机器
const DRONE_C = {
  sysid: 3, name: 'HyicoFly-H770 · 丙',
  online: false, armed: false,
  battery: 46, rel_alt: 0, alt: 16.1,
  mode: 'STABILIZE', satellites: 12, last_seen: Math.floor(Date.now() / 1000) - 1860,
  lat: 31.1988, lon: 121.4312, roll: 0, pitch: 0, yaw: 0,
  system_status: 1, voltage: 23.1, current: 0, heading: 0,
  groundspeed: 0, airspeed: 0, climb: 0, throttle: 0,
  fix_type: 3, gps_ok: true,
  local_x: 0, local_y: 0, local_z: 0,
  vibration_x: 0, vibration_y: 0, vibration_z: 0,
  range_m: 0, mcu_temp: 31.4, mcu_voltage: 5.01,
  rssi: -78, load: 5, wind_speed: 0, ekf_ok: true, ground_distance: 0
};

// 一台「几乎什么都没上报」的机器：验证 -- 兜底、空值不崩、地图占位
const DRONE_D = {
  sysid: 4, name: 'HyicoFly-H770 · 丁（未标定）',
  online: true, armed: false,
  battery: 19, rel_alt: null, alt: null,
  mode: null, satellites: 0, last_seen: Math.floor(Date.now() / 1000) - 42,
  lat: null, lon: null, roll: null, pitch: null, yaw: null,
  system_status: null, voltage: null, current: null, heading: null,
  groundspeed: null, airspeed: null, climb: null, throttle: null,
  fix_type: 0, gps_ok: false,
  local_x: null, local_y: null, local_z: null,
  vibration_x: null, vibration_y: null, vibration_z: null,
  range_m: null, mcu_temp: null, mcu_voltage: null,
  rssi: null, load: null, wind_speed: null, ekf_ok: false, ground_distance: null
};

const DRONES = [DRONE_A, DRONE_B, DRONE_C, DRONE_D];

const ALERTS = [
  { sysid: 2, level: 'critical', rule: 'low_battery',  message: '电量 8%，低于返航阈值', triggered_at: Math.floor(Date.now() / 1000) - 95 },
  { sysid: 2, level: 'critical', rule: 'link_lost',    message: '链路强度 -96 dBm，接近失联', triggered_at: Math.floor(Date.now() / 1000) - 40 },
  { sysid: 2, level: 'warning',  rule: 'gps_weak',     message: '可见卫星 6 颗，定位精度下降', triggered_at: Math.floor(Date.now() / 1000) - 220 },
  { sysid: 2, level: 'warning',  rule: 'attitude_limit', message: '横滚角 -11.4°，超出平稳范围', triggered_at: Math.floor(Date.now() / 1000) - 310 },
  { sysid: 2, level: 'info',     rule: 'arm',          message: '飞行器已解锁', triggered_at: Math.floor(Date.now() / 1000) - 640 },
  { sysid: 4, level: 'warning',  rule: 'gps_lost',     message: '无定位信息，光流已接管', triggered_at: Math.floor(Date.now() / 1000) - 55 },
  { sysid: 3, level: 'info',     rule: 'disarm',       message: '飞行器已上锁', triggered_at: Math.floor(Date.now() / 1000) - 2100 }
];

function historyFor(sysid) {
  const base = Math.floor(Date.now() / 1000) - 50 * 20;
  const rows = [];
  for (let i = 0; i < 50; i++) {
    const t = base + i * 20;
    // 让乙机的电量有明显下降趋势，便于肉眼验证历史表
    const bat = sysid === 2 ? Math.max(8, 72 - Math.round(i * 1.3)) : 80 - (i % 7);
    rows.push({
      ts: t,
      battery: bat,
      alt: sysid === 4 ? null : Math.round((20 + Math.sin(i / 5) * 40) * 10) / 10,
      mode: sysid === 4 ? null : (i > 34 ? 'AUTO' : 'LOITER'),
      armed: sysid === 2 ? (i > 4) : false
    });
  }
  return rows;
}

/* ------------------------------------------------------------ 工具与响应 */

function json(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  // 防目录穿越
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      // 模拟 Cloudflare Pages 的 404 回退
      fs.readFile(path.join(ROOT, 'index.html'), (e2, fallback) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(404, { 'Content-Type': MIME['.html'] });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

/* ------------------------------------------------------------ WebSocket */

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const sockets = new Set();

/** 服务端 -> 客户端文本帧（不掩码，服务端本来就不该掩码） */
function wsSend(socket, text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch (e) { /* 已断开 */ }
}

function snapshot(served) {
  // 让每次推送的数字都变一变，验证前端是「实时更新」而不是只画一次
  const tick = served / 3;
  const drones = DRONES.map(d => {
    if (!d.online) return Object.assign({}, d);
    const jitter = (n) => n === null ? null : Math.round((n + Math.sin(tick + d.sysid) * 1.5) * 10) / 10;
    return Object.assign({}, d, {
      battery: Math.max(1, Math.round(d.battery - (served % 7 === 0 ? 1 : 0))),
      rel_alt: jitter(d.rel_alt),
      groundspeed: jitter(d.groundspeed),
      roll: jitter(d.roll),
      pitch: jitter(d.pitch),
      yaw: d.yaw === null ? null : Math.round((d.yaw + 2) % 360 * 10) / 10,
      last_seen: Math.floor(Date.now() / 1000)
    });
  });
  return JSON.stringify({ type: 'snapshot', drones: drones, alerts: ALERTS });
}

let served = 0;
setInterval(() => {
  if (!sockets.size) return;
  served += 3;
  const msg = snapshot(served);
  sockets.forEach(s => wsSend(s, msg));
}, 3000);

/* ---------------------------------------------------------------- 路由 */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // 前端在「直连模式」下会带 Authorization，这里不校验，只记录
  const hasAuth = !!req.headers.authorization;

  if (p === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.username === 'bad' || body.password === 'wrong') {
      return json(res, 401, { detail: 'invalid_credentials' });
    }
    if (!body.username || !body.password) {
      return json(res, 400, { detail: 'missing_fields' });
    }
    return json(res, 200, {
      access_token: 'mock-jwt-' + crypto.randomBytes(8).toString('hex'),
      username: body.username,
      role: 'admin'
    });
  }

  if (p === '/api/me') {
    if (!hasAuth) return json(res, 401, { detail: 'unauthorized' });
    return json(res, 200, { username: 'demo', role: 'admin' });
  }

  if (p === '/api/health') {
    // 只读模式：前端据此保持指令按钮禁用
    return json(res, 200, { commands_enabled: false });
  }

  if (p === '/api/drones' && req.method === 'GET') {
    if (!hasAuth) return json(res, 401, { detail: 'unauthorized' });
    return json(res, 200, { drones: DRONES });
  }

  const mDrone = p.match(/^\/api\/drones\/(\d+)$/);
  if (mDrone && req.method === 'GET') {
    if (!hasAuth) return json(res, 401, { detail: 'unauthorized' });
    const d = DRONES.find(x => x.sysid === Number(mDrone[1]));
    if (!d) return json(res, 404, { detail: 'drone_not_found' });
    return json(res, 200, d);
  }

  const mHist = p.match(/^\/api\/drones\/(\d+)\/history$/);
  if (mHist && req.method === 'GET') {
    if (!hasAuth) return json(res, 401, { detail: 'unauthorized' });
    const sysid = Number(mHist[1]);
    if (!DRONES.some(x => x.sysid === sysid)) return json(res, 404, { detail: 'drone_not_found' });
    const limit = Number(url.searchParams.get('limit')) || 300;
    return json(res, 200, { history: historyFor(sysid).slice(0, limit) });
  }

  const mAlerts = p.match(/^\/api\/drones\/(\d+)\/alerts$/);
  if (mAlerts && req.method === 'GET') {
    if (!hasAuth) return json(res, 401, { detail: 'unauthorized' });
    const sysid = Number(mAlerts[1]);
    const active = url.searchParams.get('active');
    let list = ALERTS.filter(a => a.sysid === sysid);
    if (active) list = list.filter(a => a.level !== 'info');
    return json(res, 200, { alerts: list });
  }

  const mCmd = p.match(/^\/api\/drones\/(\d+)\/command$/);
  if (mCmd && req.method === 'POST') {
    // 只读模式：一律拒绝，验证前端的错误处理
    return json(res, 403, { detail: 'commands_disabled' });
  }

  if (p.startsWith('/api/')) {
    return json(res, 404, { detail: 'not_found' });
  }

  return serveStatic(req, res, p);
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') { socket.destroy(); return; }

  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );

  sockets.add(socket);
  // 连上立刻推一帧，前端不必等 3 秒
  wsSend(socket, snapshot(served));

  const drop = () => sockets.delete(socket);
  socket.on('close', drop);
  socket.on('error', drop);
  socket.on('end', drop);
});

server.listen(PORT, () => {
  console.log('HyicoPlatform mock backend');
  console.log('  webui : http://localhost:' + PORT + '/login.html');
  console.log('  api   : http://localhost:' + PORT + '/api/drones');
  console.log('  ws    : ws://localhost:' + PORT + '/ws?token=demo');
  console.log('  登录  : 任意用户名 + 密码 admin（用户名 bad / 密码 wrong 走失败分支）');
  console.log('  机器  : sysid 1 正常 / 2 告警 / 3 离线 / 4 无数据');
});
