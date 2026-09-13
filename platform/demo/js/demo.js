/* ==========================================================================
   HyicoPlatform · 演示站脚本
   --------------------------------------------------------------------------
   这是一个**纯前端演示**：没有后端、没有 WebSocket、没有任何网络请求。
   数据由下面的模拟器生成，并用定时器持续微调，用来体现「实时推送」的手感。

   刻意保留的行为，以便演示产物和真实产品一致：
     - 数值越限变色（电量低、主控温度高、链路弱）
     - null / 缺失字段一律显示 "--"，不显示 NaN
     - 状态一律「颜色 + 文字」成对出现，不靠颜色单独表达
     - 指令按钮恒为禁用（只读模式）
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------ 模拟机队 */

  /* 四台覆盖不同情况的机器，和 platform/mock-server.js 用的是同一组设定，
     这样演示站看到的东西和接真后端时一致。 */
  const SEED = [
    {
      sysid: 1, name: 'HyicoFly-H770 · 甲', online: true, armed: false,
      battery: 87, mode: 'AUTO', modeLabel: '自动', satellites: 17,
      roll: 3.2, pitch: -1.8, yaw: 128.4, rel_alt: 42.6, alt: 58.3,
      voltage: 24.7, current: 12.3, groundspeed: 8.4, airspeed: 9.1,
      climb: 0.6, throttle: 61, mcu_temp: 48.2, mcu_voltage: 5.02,
      rssi: -62, load: 34, wind: 2.4, ekf: true, gpsOk: true, fix: '3D 定位',
      vibration: [4.2, 5.1, 8.9], local: [12.4, -3.1, -42.6], range: 310.5,
      groundDist: 42.6, systemStatus: 3
    },
    {
      sysid: 2, name: 'HyicoFly-H770 · 乙', online: true, armed: true,
      battery: 8, mode: 'LOITER', modeLabel: '悬停', satellites: 6,
      roll: -11.4, pitch: 7.9, yaw: 274.1, rel_alt: 118.9, alt: 134.2,
      voltage: 20.9, current: 28.6, groundspeed: 0.3, airspeed: 1.2,
      climb: -0.2, throttle: 72, mcu_temp: 82.6, mcu_voltage: 4.71,
      rssi: -96, load: 78, wind: 7.8, ekf: false, gpsOk: false, fix: '3D 定位',
      vibration: [22.4, 19.8, 31.2], local: [-44.2, 18.7, -118.9], range: 0,
      groundDist: 0, systemStatus: 4
    },
    {
      sysid: 3, name: 'HyicoFly-H770 · 丙', online: false, armed: false,
      battery: 46, mode: 'STABILIZE', modeLabel: '自稳', satellites: 12,
      roll: 0, pitch: 0, yaw: 0, rel_alt: 0, alt: 16.1,
      voltage: 23.1, current: 0, groundspeed: 0, airspeed: 0,
      climb: 0, throttle: 0, mcu_temp: 31.4, mcu_voltage: 5.01,
      rssi: -78, load: 5, wind: 0, ekf: true, gpsOk: true, fix: '3D 定位',
      vibration: [0, 0, 0], local: [0, 0, 0], range: 0,
      groundDist: 0, systemStatus: 1
    },
    {
      /* 大量字段缺失：用来展示 -- 兜底，以及地图/姿态没有数据时的表现 */
      sysid: 4, name: 'HyicoFly-H770 · 丁（未标定）', online: true, armed: false,
      battery: 19, mode: null, modeLabel: '未知', satellites: 0,
      roll: null, pitch: null, yaw: null, rel_alt: null, alt: null,
      voltage: null, current: null, groundspeed: null, airspeed: null,
      climb: null, throttle: null, mcu_temp: null, mcu_voltage: null,
      rssi: null, load: null, wind: null, ekf: false, gpsOk: false, fix: '无定位',
      vibration: [null, null, null], local: [null, null, null], range: null,
      groundDist: null, systemStatus: null
    }
  ];

  const ALERTS = {
    2: [
      { level: 'critical', rule: 'low_battery',    msg: '电量 8%，低于返航阈值',        ago: 95 },
      { level: 'critical', rule: 'link_lost',      msg: '链路强度 -96 dBm，接近失联',   ago: 40 },
      { level: 'warning',  rule: 'gps_weak',       msg: '可见卫星 6 颗，定位精度下降',  ago: 220 },
      { level: 'warning',  rule: 'attitude_limit', msg: '横滚角 -11.4°，超出平稳范围', ago: 310 },
      { level: 'info',     rule: 'arm',            msg: '飞行器已解锁',                ago: 640 }
    ],
    4: [{ level: 'warning', rule: 'gps_lost', msg: '无定位信息，光流已接管', ago: 55 }],
    3: [{ level: 'info',    rule: 'disarm',   msg: '飞行器已上锁',           ago: 2100 }]
  };

  /* 告警规则名 -> 中文。未映射时保留原始标识符（不丢信息）并打一条 warn，
     这样前后端规则表一旦漂移会立刻被发现。 */
  const RULE_LABEL = {
    link_lost: '链路丢失', low_battery: '低电量', battery_critical: '电量危急',
    gps_lost: 'GPS 丢星', gps_weak: '卫星数偏少', mode_failsafe: '失控保护',
    attitude_limit: '姿态越限', vibration: '振动异常', ekf: 'EKF 异常',
    geofence: '越出地理围栏', rc_lost: '遥控信号丢失', arm: '已解锁', disarm: '已上锁'
  };
  const LEVEL_LABEL = { info: '提示', warning: '警告', critical: '严重' };

  function ruleLabel(rule) {
    const hit = RULE_LABEL[rule];
    if (hit) return hit;
    console.warn('[HyicoPlatform demo] 未映射的告警规则名：', rule);
    return rule;
  }

  /* ------------------------------------------------------------ 工具 */

  const $ = s => document.querySelector(s);
  const now = () => Math.floor(Date.now() / 1000);

  /** 数值格式化：null / NaN 一律 "--"，绝不让 NaN 漏到界面上 */
  function fmt(v, digits) {
    if (v === null || v === undefined) return '--';
    const n = Number(v);
    if (!isFinite(n)) return '--';
    return n.toFixed(digits === undefined ? 1 : digits);
  }
  function withUnit(v, unit, digits) {
    const s = fmt(v, digits);
    return s === '--' ? '--' : s + ' ' + unit;
  }
  function timeStr(ts) {
    const d = new Date(ts * 1000);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function relTime(ts) {
    const s = now() - ts;
    if (s < 10) return '刚刚';
    if (s < 60) return s + ' 秒前';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    return Math.floor(s / 3600) + ' 小时前';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------------------------------------------------------------ 状态 */

  let drones = SEED.map(d => Object.assign({}, d, { lastSeen: now() - (d.online ? 3 : 1860) }));
  let tick = 0;
  let paused = false;
  let selected = null;

  /* ------------------------------------------------------------ 渲染：统计条 */

  function renderStats() {
    const online = drones.filter(d => d.online).length;
    const alerting = drones.filter(d => (ALERTS[d.sysid] || []).some(a => a.level !== 'info')).length;
    $('#stats').innerHTML = [
      `<div class="stat stat--ok"><span class="stat__v">${online}</span><span class="stat__l">在线</span></div>`,
      `<div class="stat"><span class="stat__v">${drones.length}</span><span class="stat__l">已登记</span></div>`,
      `<div class="stat ${alerting ? 'stat--danger' : 'stat--ok'}"><span class="stat__v">${alerting}</span><span class="stat__l">告警中</span></div>`
    ].join('');
  }

  /** 电量三档：<=10 危险、<=20 警告 */
  function batteryClass(b) {
    if (b === null || b === undefined) return '';
    if (b <= 10) return 'metric__v--danger';
    if (b <= 20) return 'metric__v--warn';
    return '';
  }

  function badge(kind, text) {
    return `<span class="badge badge--${kind}"><span class="badge__d"></span>${esc(text)}</span>`;
  }

  function cardHtml(d) {
    const list = ALERTS[d.sysid] || [];
    const worst = list.some(a => a.level === 'critical') ? 'critical'
                : list.some(a => a.level === 'warning') ? 'warning' : '';
    const cls = ['card'];
    if (!d.online) cls.push('is-offline');
    if (worst === 'critical') cls.push('has-critical');
    if (worst === 'warning') cls.push('has-warning');

    const badges = [];
    badges.push(d.online ? badge('ok', '在线') : badge('muted', '离线'));
    if (d.online) badges.push(d.armed ? badge('warn', '已解锁') : badge('muted', '已上锁'));
    if (worst === 'critical') badges.push(badge('danger', '严重'));
    else if (worst === 'warning') badges.push(badge('warn', '警告'));

    const alt = d.rel_alt !== null && d.rel_alt !== undefined ? d.rel_alt : d.alt;

    return `
      <button type="button" class="${cls.join(' ')}" data-sysid="${d.sysid}"
              aria-label="查看 ${esc(d.name)} 详情">
        <span class="card__top">
          <span class="card__av" aria-hidden="true">H</span>
          <span class="card__nm">
            <b>${esc(d.name)}</b>
            <span class="card__id">SYSID ${d.sysid}</span>
          </span>
        </span>
        <span class="card__badges">${badges.join('')}</span>
        <span class="metrics">
          <span class="metric">
            <span class="metric__l">电量</span>
            <span class="metric__v ${batteryClass(d.battery)}">${fmt(d.battery, 0)}<small>%</small></span>
          </span>
          <span class="metric">
            <span class="metric__l">高度</span>
            <span class="metric__v">${alt === null || alt === undefined ? '--' : fmt(alt, 1) + '<small>m</small>'}</span>
          </span>
          <span class="metric">
            <span class="metric__l">模式</span>
            <span class="metric__v">${esc(d.modeLabel)}</span>
          </span>
          <span class="metric">
            <span class="metric__l">卫星</span>
            <span class="metric__v">${fmt(d.satellites, 0)}</span>
          </span>
        </span>
        <span class="card__foot">
          <span>最后心跳：${esc(relTime(d.lastSeen))}</span>
          <span>查看详情 ›</span>
        </span>
      </button>`;
  }

  function renderFleet() {
    // 在线优先 -> 告警严重度高的优先 -> sysid 升序
    const rank = d => {
      const list = ALERTS[d.sysid] || [];
      if (list.some(a => a.level === 'critical')) return 3;
      if (list.some(a => a.level === 'warning')) return 2;
      return 1;
    };
    const sorted = drones.slice().sort((a, b) =>
      (a.online === b.online ? 0 : a.online ? -1 : 1) ||
      (rank(b) - rank(a)) ||
      (a.sysid - b.sysid));
    $('#fleet').innerHTML = sorted.map(cardHtml).join('');
  }

  /* ------------------------------------------------------------ 渲染：详情 */

  const FIELDS = [
    ['飞行模式',    d => d.modeLabel],
    ['系统状态',    d => fmt(d.systemStatus, 0)],
    ['电量',        d => fmt(d.battery, 0) + ' %'],
    ['电压',        d => withUnit(d.voltage, 'V', 1)],
    ['电流',        d => withUnit(d.current, 'A', 1)],
    ['海拔高度',    d => withUnit(d.alt, 'm', 1)],
    ['相对高度',    d => withUnit(d.rel_alt, 'm', 1)],
    ['地速',        d => withUnit(d.groundspeed, 'm/s', 1)],
    ['空速',        d => withUnit(d.airspeed, 'm/s', 1)],
    ['爬升率',      d => withUnit(d.climb, 'm/s', 1)],
    ['油门',        d => fmt(d.throttle, 0) + ' %'],
    ['卫星数',      d => fmt(d.satellites, 0)],
    ['定位类型',    d => d.fix],
    ['GPS 状态',    d => d.gpsOk ? '正常' : '异常', d => d.gpsOk ? 'is-ok' : 'is-bad'],
    ['机体坐标',    d => d.local[0] === null ? '--'
        : `X ${fmt(d.local[0], 2)} / Y ${fmt(d.local[1], 2)} / Z ${fmt(d.local[2], 2)} m`],
    ['振动',        d => d.vibration[0] === null ? '--'
        : `X ${fmt(d.vibration[0], 1)} / Y ${fmt(d.vibration[1], 1)} / Z ${fmt(d.vibration[2], 1)}`],
    ['测距',        d => withUnit(d.range, 'm', 2)],
    ['主控温度',    d => withUnit(d.mcu_temp, '°C', 1), d => (d.mcu_temp > 75 ? 'is-warn' : '')],
    ['主控电压',    d => withUnit(d.mcu_voltage, 'V', 2)],
    ['链路强度',    d => withUnit(d.rssi, 'dBm', 0), d => (d.rssi !== null && d.rssi < -90 ? 'is-bad' : '')],
    ['CPU 负载',    d => withUnit(d.load, '%', 1)],
    ['风速',        d => withUnit(d.wind, 'm/s', 1)],
    ['EKF 状态',    d => d.ekf ? '正常' : '异常', d => d.ekf ? 'is-ok' : 'is-bad'],
    ['离地高度',    d => withUnit(d.groundDist, 'm', 2)],
    ['最后心跳',    d => relTime(d.lastSeen)]
  ];

  function renderDetail() {
    const d = drones.find(x => x.sysid === selected);
    if (!d) return;

    $('#dtMeta').textContent =
      `SYSID ${d.sysid} · ${d.online ? '在线' : '离线'} · ${d.modeLabel}` +
      (d.armed ? ' · 已解锁' : '');

    // 姿态：没有数据时不要假装有
    const hasAtti = d.roll !== null && d.pitch !== null;
    $('#atti').style.opacity = hasAtti ? '1' : '.35';
    if (hasAtti) {
      $('#attiDisc').style.transform = `rotate(${-d.roll}deg)`;
      const p = Math.max(-45, Math.min(45, d.pitch)) * 3;
      $('#attiHorizon').style.top = `calc(50% + ${p}px)`;
      $('#attiPitch').textContent = fmt(d.pitch, 1) + '°';
    } else {
      $('#attiDisc').style.transform = '';
      $('#attiHorizon').style.top = '50%';
      $('#attiPitch').textContent = '--';
    }
    $('#attiReadouts').innerHTML = [
      ['横滚', hasAtti ? fmt(d.roll, 1) + '°' : '--'],
      ['俯仰', hasAtti ? fmt(d.pitch, 1) + '°' : '--'],
      ['航向', d.yaw === null ? '--' : fmt(d.yaw, 1) + '°']
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    // 遥测
    $('#telemetry').innerHTML = FIELDS.map(([label, get, cls]) => {
      const c = cls ? cls(d) : '';
      return `<div><dt>${label}</dt><dd class="${c}">${esc(get(d))}</dd></div>`;
    }).join('');

    // 告警：按严重度 -> 时间倒序
    const list = (ALERTS[d.sysid] || []).slice().sort((a, b) =>
      (sev(b.level) - sev(a.level)) || (a.ago - b.ago));
    $('#alerts').innerHTML = list.length ? list.map(a => `
      <li class="alert alert--${a.level}">
        <span class="alert__t">
          <b>${esc(ruleLabel(a.rule))}</b>
          <span class="alert__lv is-set">${esc(LEVEL_LABEL[a.level] || a.level)}</span>
        </span>
        <span class="alert__m">${esc(a.msg)}</span>
        <span class="alert__time">${esc(timeStr(now() - a.ago))}</span>
      </li>`).join('')
      : '<li class="alerts__empty">暂无告警</li>';

    renderHistory(d);
  }

  function sev(l) { return l === 'critical' ? 3 : l === 'warning' ? 2 : 1; }

  function renderHistory(d) {
    const rows = [];
    for (let i = 49; i >= 0; i--) {
      const ts = now() - i * 20;
      const bat = d.sysid === 2 ? Math.max(8, 72 - Math.round((49 - i) * 1.3)) : 80 - ((49 - i) % 7);
      const alt = d.sysid === 4 ? null : 20 + Math.sin(i / 5) * 40;
      rows.push(`<tr>
        <td>${esc(timeStr(ts))}</td>
        <td>${fmt(bat, 0)}%</td>
        <td>${alt === null ? '--' : fmt(alt, 1) + ' m'}</td>
        <td>${esc(d.sysid === 4 ? '--' : (i < 15 ? 'LOITER' : 'AUTO'))}</td>
        <td>${d.sysid === 2 && i < 45 ? '✔ 已解锁' : '—'}</td>
      </tr>`);
    }
    $('#history').innerHTML = rows.join('');
  }

  function renderCommands() {
    // 只读模式：按钮恒为禁用，演示站也不发任何请求
    const cmds = [['arm', '解锁'], ['takeoff', '起飞'], ['set_mode', '切换模式'],
                  ['goto', '飞往航点'], ['rtl', '返航'], ['land', '降落'], ['disarm', '上锁']];
    $('#commands').innerHTML = cmds.map(([k, label]) =>
      `<button type="button" class="cmd" disabled aria-disabled="true">
         <span aria-hidden="true">🔒</span>${esc(label)}
       </button>`).join('');
  }

  /* ------------------------------------------------------------ 模拟数据流 */

  /** 让数值轻微浮动，制造「实时推送」的观感。同时推进心跳时间。 */
  function step() {
    if (paused) return;
    tick++;
    drones.forEach(d => {
      if (!d.online) return;
      d.lastSeen = now();
      const wob = (base, amp) => base === null ? null : +(base + Math.sin(tick / 3 + d.sysid) * amp).toFixed(2);
      d.rel_alt = wob(d.rel_alt, 1.5);
      d.groundspeed = wob(d.groundspeed, 0.6);
      d.roll = wob(d.roll, 1.2);
      d.pitch = wob(d.pitch, 0.8);
      d.yaw = d.yaw === null ? null : +( (d.yaw + 2) % 360 ).toFixed(1);
      if (tick % 7 === 0 && d.battery > 1) d.battery -= 1;
    });
    renderStats();
    renderFleet();
    if (selected) renderDetail();
  }

  /* ------------------------------------------------------------ 交互 */

  function openDetail(sysid) {
    selected = sysid;
    $('#detailSec').hidden = false;
    renderDetail();
    $('#detailSec').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function closeDetail() {
    selected = null;
    $('#detailSec').hidden = true;
    $('#ov-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* 主题：与主站共用 hyico-theme 键 */
  function initTheme() {
    const btn = $('#themeBtn');
    const sync = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    };
    btn.addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
      try { localStorage.setItem('hyico-theme', next); } catch (e) {}
      sync();
    });
    sync();
  }

  function init() {
    renderCommands();
    renderStats();
    renderFleet();
    initTheme();

    $('#fleet').addEventListener('click', e => {
      const card = e.target.closest('[data-sysid]');
      if (card) openDetail(Number(card.getAttribute('data-sysid')));
    });
    $('#closeDetail').addEventListener('click', closeDetail);

    const pauseBtn = $('#pauseBtn');
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      pauseBtn.textContent = paused ? '恢复数据' : '暂停数据';
      $('#liveHint').classList.toggle('is-paused', paused);
      $('#liveText').textContent = paused ? '数据流已暂停' : '模拟数据流已启动';
    });

    setInterval(step, 1500);

    // 内容就绪后再放进场动画，避免刚渲染就闪
    requestAnimationFrame(() => {
      document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-in'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
