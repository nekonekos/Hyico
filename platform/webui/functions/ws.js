/**
 * HyicoPlatform — Cloudflare Pages Function：把前端的 WebSocket /ws 代理到后端。
 *
 * 前端以 wss://platform.hyico.cn/ws?token=<jwt> 连接；本函数把该升级请求转发到
 * 后端的 ws://<backend>/ws?token=<jwt>，并把双向消息在浏览器与后端之间隧道转发。
 *
 * 配置（必填）：BACKEND_URL —— 与 functions/api/[[path]].js 同一个变量。
 * 同样不设默认值，理由见那个文件。
 */
export async function onRequest(context) {
    const { request, env } = context;

    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const backend = env && env.BACKEND_URL;
    if (!backend) {
        return new Response('BACKEND_URL is not configured', { status: 500 });
    }

    const url = new URL(request.url);
    const wsBackend = backend.replace(/^http/i, 'ws');
    const target = wsBackend + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('Upgrade', 'websocket');
    headers.set('Connection', 'Upgrade');

    return fetch(target, { method: 'GET', headers: headers });
}
