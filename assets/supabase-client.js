// 初始化 Supabase 客户端。依赖 config.js 先加载好 window.SUPABASE_URL / SUPABASE_ANON_KEY。
window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
