# Hyico 官网

H 型构架轻型运输无人机、科研探测与远程运营平台的官方网站前端。

**纯静态、零依赖、零构建**：只有 HTML / CSS / 原生 JS，没有任何 npm 包、打包器或框架。改完文件刷新浏览器即可看到结果。

---

## 快速开始

```bash
# 在仓库根目录
node dev-server.js          # 默认 http://localhost:4173
node dev-server.js 8080     # 指定端口
```

`dev-server.js` 是一个零依赖的本地预览服务器，行为刻意与 Cloudflare Pages 对齐（目录自动找 `index.html`，未知路径回退 `404.html`）。

> 直接双击 `web/index.html` 用 `file://` 打开也能看到完整内容，但浏览器不允许读取本地 JSON，所以那时页面显示的是 HTML 内联的默认文案，主题切换与移动端导航也不可用。要看到完整效果请用上面的方式起服务。

调试内容覆盖过程：

```
http://localhost:4173/h770.html?content-debug=1
```

控制台会打印每一条文案键的命中与缺失情况。

---

## 目录结构

```
web/                          ← 部署目录（Cloudflare Pages 的构建输出目录设为此）
├── index.html                首页
├── products.html             产品总览
├── h770.html                 HyicoFly-H770 详情
├── technology.html           H 型构架技术
├── platform.html             HyicoPlatform
├── hgc.html                  HyicoGroundControl
├── about.html                关于我们
├── news.html                 新闻列表
├── news-post.html            新闻详情（通用模板，?slug=）
├── careers.html              招聘列表
├── careers-post.html         职位详情（通用模板，?slug=）
├── faq.html                  常见问题
├── contact.html              联系我们
├── 404.html                  未找到
│
├── site.json                 ← 全站共用信息（改公司信息只动这里）
├── index.json                各页面同名文案，与 HTML 一一对应
├── products.json  h770.json  technology.json  platform.json  hgc.json
├── about.json  news.json  news-post.json  careers.json  careers-post.json
├── faq.json  contact.json
├── news/<slug>.json          单篇新闻正文
├── careers/<slug>.json       单个职位正文
│
├── assets/
│   ├── css/
│   │   ├── tokens.css        ← 设计令牌：颜色、字号、间距、圆角、动效。改主题只动这里
│   │   ├── base.css          reset + 语义排版 + 可访问性基线
│   │   ├── layout.css        容器、栅格、分区、页头页脚骨架
│   │   ├── components.css    按钮、卡片、导航、规格表、选项卡、折叠面板、图纸图元
│   │   └── pages.css         页面级微调
│   ├── js/
│   │   ├── core/
│   │   │   ├── dom.js        工具函数（选择、事件、复制、安全 HTML）
│   │   │   ├── content.js    ← 同名 JSON 内容覆盖引擎
│   │   │   ├── theme.js      深浅色主题
│   │   │   └── nav.js        页头、下拉菜单、移动端抽屉
│   │   ├── components/
│   │   │   ├── reveal.js     滚动进场
│   │   │   ├── countup.js    数字滚动
│   │   │   ├── tabs.js       选项卡
│   │   │   └── hero.js       Hero 图纸视差
│   │   ├── pages/
│   │   │   ├── list.js       列表渲染与筛选（新闻 / 招聘 / 首页摘要）
│   │   │   ├── post.js       详情页（读 ?slug=）
│   │   │   └── contact.js    表单校验 + mailto、邮箱复制
│   │   └── main.js           统一引导
│   └── img/
│       ├── favicon.svg
│       └── og-default.svg    社交分享图（建议另导出一份 PNG，见下方"待办"）
│
├── sitemap.xml
├── robots.txt
└── _headers                  Cloudflare Pages 响应头（缓存与安全策略）
```

---

## 内容系统：同名 JSON 覆盖

这是整站维护的核心机制。

**HTML 里始终写完整、可读的中文默认文案，同时带上 `data-*` 键。** 页面加载后，JS 读取**同目录同名**的 JSON 覆盖这些文案：

```
index.html   ↔  index.json
h770.html    ↔  h770.json
```

每个页面还会先加载全局的 `site.json`，页面同名 JSON 覆盖同名键。

**这套设计带来三个好处：**

1. **改文案只改 JSON**，不需要碰 HTML，也不会破坏结构。
2. **JSON 丢失、语法错误、断网、关掉 JS** —— 页面依旧完整可读，只是显示 HTML 里的默认文案，不会白屏。
3. **SEO 友好**：爬虫读到的是真实 HTML 文本，不依赖 JS 渲染。

### 可用的属性

| 属性 | 作用 |
| --- | --- |
| `data-content="a.b.c"` | 写入 `textContent`（纯文本） |
| `data-content-html="a.b.c"` | 写入 HTML，自动过滤 `<script>` 与 `on*` 事件属性 |
| `data-content-attr="href:u;aria-label:t"` | 批量设置属性，`属性名:数据路径`，多组用 `;` 分隔 |
| `data-each="a.b"` | 按数组重复子节点；子节点用 `data-template` 标记模板 |
| `data-each-keep-empty` | 数组为空时**保留**内联默认内容（默认行为是隐藏整个宿主） |
| `data-optional="a.b"` | 该键为假值或空数组时隐藏此元素 |
| `data-placeholder="a.b"` | 该键为 `true` 时自动追加一个「待确认」标记 |
| `data-countup-from="a.b"` | 把数值交给数字滚动组件 |

**作用域规则**：`data-each` 内部，路径先按当前项解析，找不到再回退到全局。要在数组内部强制取全局值，用 `^` 前缀，例如 `data-content="^site.name"`。

数组元素可以是字符串，此时模板里用 `data-content="value"` 取到它。

### 常见任务

**改公司信息、联系方式、页脚**
→ 只改 `site.json`。

**改某个页面的文案**
→ 改该页面的同名 JSON。删掉某个键，页面会退回 HTML 内联的默认文案。

**新增一篇新闻**

1. 在 `news.json` 的 `items` 数组里加一条，`slug` 与 `href` 要对应：
   ```json
   {
     "slug": "my-new-post",
     "date": "2026-04-01",
     "category": "技术",
     "tags": ["技术"],
     "title": "标题",
     "excerpt": "摘要",
     "href": "news-post.html?slug=my-new-post"
   }
   ```
2. 新建 `news/my-new-post.json`，`body` 字段写 HTML 正文（支持 `h2` `p` `ul` `li` `blockquote` `strong` `code`）。

首页的「最新动态」会自动取 `news.json` 的前 3 条，不需要额外改动。

**新增一个职位**
→ 同理：`careers.json` 加条目 + 新建 `careers/<slug>.json`（`duties` / `requirements` / `bonus` / `offer` 是字符串数组）。

**新增一个页面**
→ 复制一个现有页面改内容，建一个同名 JSON，在页头与页脚的导航里补上链接（导航是静态 HTML，见下方说明）。

---

## 主题与设计

### 颜色

品牌色阶集中在 `assets/css/tokens.css`：

```
#EBF1EF  #C9DBD5  #9EBDB4  #578E7D  #446F62  #325249  #213630
```

改主题色只需要改 `tokens.css` 顶部的 `--mint-*`，浅色与深色主题都会跟着变。

`.surface-dark` 是一个特殊的容器类：它重新声明了一整套局部变量，因此在浅色主题里插入深色区块时，内部的按钮、卡片、规格表都会自动正确反色，不需要写任何覆盖样式。

### 深浅色模式

- 默认跟随系统（`prefers-color-scheme`）。
- 用户手动切换后写入 `localStorage`，之后不再跟随系统。
- 首屏防闪白由每个页面 `<head>` 里的内联脚本负责，**这段脚本必须在 CSS 之前**。
- 主题状态放在 `<html data-theme="light|dark">` 上，CSS 变量随之切换。

### 字体

无外链 CDN。中文使用系统字体栈（PingFang SC / HarmonyOS Sans / Microsoft YaHei / Noto Sans SC），西文与数字优先使用系统 UI 字体，参数与编号使用等宽栈。

想换成品牌字体：把 woff2 放进 `assets/fonts/`，并取消 `tokens.css` 中 `@font-face` 那段注释即可，全站无需改其它文件。

### 品牌视觉装置

H 型构架是贯穿全站的图形语言：logo、章节标记、图纸插图、分隔符、404 页面都基于同一个形状。

### 技术图纸

全站插图**没有一张位图**，都是内联 SVG，因此能跟随深浅色主题自动换色。图纸按用途分开，避免重复：

| 位置 | 图纸 | 说明 |
| --- | --- | --- |
| 首页 Hero | `index.html` | **俯视图**。25mm 中梁 + 20mm 机臂碳管 + 铝合金三通 + 80mm 中心板（内含 6S2P 电池虚线）+ 四个桨盘 + LU/LD/RU/RD 电机编号 + 770mm 轴距 |
| `h770.html` 页面头 | `h770.html` | **侧视图**。展示垂直堆叠关系：机臂碳管、电机与桨盘、中心板内的电池组、板上方的飞控与分电板、板下方的光流模块、机头下方的云台、起落架 |
| `h770.html` 结构细节 | `h770.html` | **中心舱细节图**。管夹、LU/LD/RU/RD 丝印、定制分电板（含 `BY LuminNya` / `FR4_V1.0` 丝印）、飞控接线端口、线束与扎带、光流与云台。图中用编号 1–7 标记，图注写在 HTML 里（可被 JSON 覆盖），因此文字可比图面小字大得多，也更利于无障碍阅读 |
| `technology.html` | `technology.html` | **H 型 vs X 型对比图**，用同一套管件图元，保证与产品页视觉一致 |
| `products.html` | `products.html` | 载荷安装示意（运输 / 探测），同样使用管件图元 |

图纸的图元类都定义在 `components.css` 的「结构图元」一节：

```
.bp-tube-mid / .bp-tube-arm   碳管（中梁 25mm、机臂 20mm，线宽即管径）
.bp-fitting / .bp-pin         铝合金三通、管夹与螺栓
.bp-plate-fill / .bp-cut      中心板与减重孔
.bp-batt / .bp-batt-cell      电池组与电芯分格（虚线表示"被结构包住"）
.bp-pcb / .bp-pcb-hi          分电板与叠装其上的飞控
.bp-conn / .bp-ty             接插件外壳与尼龙扎带
.bp-wire--red/amber/blue/...  线束配色
.bp-disc / .bp-prop           桨盘与旋翼扫掠面
.bp-num / .bp-num-text        编号标记
```

图纸坐标与实物成比例（首页俯视图 1 单位 = 2.5mm，中心舱细节图 1 单位 = 1mm），因此标注的 770mm 轴距、25mm 中梁、80mm 中心板都是按比例画出来的，不是随手写的文字。

---

## 部署（Cloudflare Pages）

1. 仓库连接到 Cloudflare Pages。
2. **构建输出目录填 `web`**，构建命令留空（没有构建步骤）。
3. 完成。`web/_headers` 会被自动读取，用于设置缓存与安全响应头。

其他静态托管（GitHub Pages / Netlify / Vercel）同样可以直接用 `web` 目录，所有路径都是相对的。

> `404.html` 内部使用的是绝对路径（`/assets/...`），因为未知路径的深度不确定。若部署在子路径下而非域名根目录，需要把 `404.html` 里的路径改成相对路径。

### 响应头里的 CSP

`_headers` 中配置了较严格的 CSP，只放行本站资源。因为没有引入任何第三方脚本、字体或图片，这条策略不需要额外豁免。**如果你后续加入了外部服务（统计、字体、表单服务），记得同步修改 CSP。**

---

## 待办：上线前必须替换的占位内容

以下内容目前是**占位值**，不是真实数据，上线前请逐一处理：

### 1. 产品参数

`h770.json` 的规格表现在分两类：

- **机身与构型、动力与电池**：来自实际装机配置（25mm 中梁、20mm 机臂、80mm 中心板、6010 电机、1855 桨、6S2P 21700），可以直接使用。
- **飞行性能**：`value` 写的是「待确认」——这是真实状态，不是占位符。测出数据后把 `value` 改成数字即可。

如果需要显示「待确认」小标，给该行加 `"draft": true`。如果某行还不该公开，直接删掉该行。

### 2. 联系方式与地址

`site.json` 里的 `contactEmail` / `businessEmail` / `careerEmail` / `phone` / `address` 全部是占位值。`about.json` 的 `office.items` 里也有地址占位。

### 3. 域名

若正式域名不是 `hyico.pages.dev`，需要替换：

- `sitemap.xml` 与 `robots.txt`
- 每个 HTML 里的 `<link rel="canonical">` 与 `og:url`

### 4. 社交分享图

`assets/img/og-default.svg` 是 SVG。大多数社交平台偏好 PNG/JPG，建议按 1200×630 导出一份 PNG，并把各页面 `<meta property="og:image">` 指向它。

### 5. 其他

- 招聘职位的工作地点（`careers.json` 的 `location`）
- 内容中的示例数字（`platform.json` / `hgc.json` 的 `ui.mock`）均为排版示意，页面上已标注说明
- `faq.json` 的答案目前是纯文本；如需插入链接，把对应元素的 `data-content` 改成 `data-content-html`

---

## 维护说明

### 页头与页脚是静态 HTML

每个页面里都有一份完整的页头与页脚标记。**这是有意为之**：如果改成 JS 注入，关闭 JS 或爬虫访问时导航就会消失。

代价是修改导航需要同步改所有页面。改动时建议用编辑器在 `web/` 目录内全局搜索替换，例如把「新闻动态」替换成「动态」，或统一在 `<li class="nav__item">` 附近做正则替换。

`site.json` 仍然可以覆盖页头页脚里的**文字**（如公司名、简介、状态标签），但改不了链接结构。

### 脚本按需引入

每个页面只引入自己需要的脚本，例如 `404.html` 不引入 `nav.js`，`contact.html` 额外引入 `contact.js`。`main.js` 里所有模块调用都做了存在性判断，因此增删脚本不会报错。

### 无尾依赖，别引入 CDN

本站刻意不请求任何外部资源（这在 `_headers` 的 CSP 与离线可用性上都有意义）。如果要加第三方库，请下载到 `assets/` 本地引入，并同步更新 CSP。

---

## 已验证的行为

- 全部 21 个页面 / 状态：控制台零错误、零警告、零 404
- 内容键覆盖：除详情页模板的条目字段外，全站 `data-content` 键 100% 有 JSON 对应（用 `?content-debug=1` 逐页核对）
- 深浅色主题在全部页面正常，切换后持久化并跨页面保持
- 响应式断点：320 / 375 / 768 / 1024 / 1440；375px 下无横向溢出，抽屉可开合、焦点落入抽屉
- 关闭 JS：`<html>` 上不会有 `has-js`，滚动进场元素保持可见，正文完整可读
- 内容 JSON 全部 404：页面静默降级为 HTML 内联文案，无报错
- 未知路径返回 404.html（已在本地服务器验证）
- 联系表单：必填校验、邮箱格式校验、错误聚焦、mailto 生成、邮箱一键复制全部可用
- 无障碍：每个页面恰好一个 `h1`、标题层级无跳级、所有 `svg[role=img]` 有 `aria-label`、所有按钮与链接有可读名称、所有表单控件有 `<label>`、地标与 skip-link 齐全
- `prefers-reduced-motion: reduce` 下进场元素立即可见、装饰动画关闭

### 性能预算（实测）

| | 原始 | gzip | brotli |
| --- | --- | --- | --- |
| CSS（5 个文件） | 65.7 KB | 16.3 KB | **13.4 KB** |
| JS（首页 9 个文件） | 41.3 KB | 15.4 KB | **12.5 KB** |
| 首页首屏合计（HTML + 内容 JSON + CSS + JS） | 146.4 KB | **43.8 KB** | — |

Cloudflare Pages 会自动启用 brotli。全站零外部请求、零第三方字体、零图片文件（所有插图都是内联 SVG 或 CSS）。
