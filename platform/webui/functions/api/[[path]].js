/**
 * HyicoPlatform — Cloudflare Pages Function：把前端的 /api/* REST 请求代理到后端。
 *
 * 目的：
 *   前端部署在 Cloudflare Pages（HTTPS），后端跑在阿里云 ECS（HTTP）。
 *   浏览器出于安全策略会拦截「HTTPS 页面请求 HTTP 资源」的混合内容（Mixed Content）。
 *   此函数让前端只与本站同源通信（https://platform.hyico.cn/api/...），
 *   由 Cloudflare 边缘节点把请求转发到后端，从而绕开混合内容限制；
 *   后端无需对外暴露 80/443，也无需备案。
 *
 * 配置（必填）：
 *   Cloudflare Pages 项目 → Settings → Environment variables：
 *     BACKEND_URL = http://<后端地址>:8000
 *
 * 刻意不设默认值：写死回落地址等于把后端真实地址留在公开仓库里，
 * 而且一旦环境变量漏配，请求会静默打到一台错误的机器上。
 * 宁可明确报 500，也不猜。
 */
export async function onRequest(context) {
    const { request, env } = context;

    // 跨域预检：直接返回 CORS 头，不转发到后端。
    // 放在配置校验之前，这样即使漏配 BACKEND_URL，预检也能通过，
    // 前端拿到的是下面那个明确的 500，而不是一个看不懂的 CORS 报错。
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const backend = env && env.BACKEND_URL;
    if (!backend) {
        return new Response(
            JSON.stringify({ detail: 'server_misconfigured' }),
            { status: 500, headers: jsonHeaders(request) }
        );
    }

    const url = new URL(request.url);
    // /api/... -> backend/api/...（保留路径与查询串）
    const target = backend.replace(/\/+$/, '') + url.pathname + url.search;

    const headers = new Headers(request.headers);
    // 去掉 hop-by-hop / 会与转发体冲突的头
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');

    const init = {
        method: request.method,
        headers: headers
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
    }

    const upstream = await fetch(target, init);

    const respHeaders = new Headers(upstream.headers);
    const cors = corsHeaders(request);
    cors.forEach(function (value, key) { respHeaders.set(key, value); });

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders
    });
}

function corsHeaders(request) {
    const origin = request.headers.get('Origin');
    // 反射 Origin 以配合 Allow-Credentials；无 Origin（同源/非浏览器）时用 *。
    return new Headers({
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    });
}

/** JSON 错误响应，同样带上 CORS 头，否则前端只能看到一个含糊的跨域失败。 */
function jsonHeaders(request) {
    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return headers;
}
