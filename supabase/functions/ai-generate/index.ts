// AI 生成入口：学习计划、复盘点评都走这一个函数。
// 密钥存在 Supabase 的 Edge Function Secrets 里（ANTHROPIC_API_KEY），
// 浏览器永远看不到真正的 key，只能带着登录态调这个函数。

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: cors });
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 6000) {
      return new Response(JSON.stringify({ error: "输入不对（空、太长，或者不是字符串）" }), { status: 400, headers: cors });
    }

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "服务端没配置 AI key" }), { status: 500, headers: cors });
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return new Response(JSON.stringify({ error: "AI 接口报错", detail }), { status: 502, headers: cors });
    }

    const data = await r.json();
    const text = (data.content || []).map((b: any) => b.text || "").join("");
    return new Response(JSON.stringify({ text }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
