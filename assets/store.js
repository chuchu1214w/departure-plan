// events 表的读写封装。所有函数都基于当前登录用户，未登录时调用会被 RLS 拒绝。
window.Store = (function () {
  const sb = () => window.sb;

  async function list(kind) {
    const { data, error } = await sb()
      .from("events")
      .select("*")
      .eq("kind", kind)
      .order("date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function add(kind, fields) {
    const { data: userRes } = await sb().auth.getUser();
    const user_id = userRes && userRes.user && userRes.user.id;
    if (!user_id) throw new Error("未登录");
    const row = Object.assign({ kind, user_id, source: "user" }, fields);
    const { data, error } = await sb().from("events").insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function update(id, fields) {
    const { data, error } = await sb().from("events").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(id) {
    const { error } = await sb().from("events").delete().eq("id", id);
    if (error) throw error;
  }

  async function toggleDone(id, done) {
    return update(id, { done });
  }

  // 实时订阅：kind 分类下任何一条记录变化（增/改/删）都会触发 onChange。
  // 用于让手机和电脑打开同一份数据时互相看到对方的改动，不用手动刷新。
  function subscribe(kind, onChange) {
    const channel = sb()
      .channel("events-" + kind)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `kind=eq.${kind}` },
        onChange
      )
      .subscribe();
    return () => sb().removeChannel(channel);
  }

  // 找出同一个 kind 里标题+日期完全一样的重复行，只留最早那条，其余删掉。
  // 返回删了几条。
  async function dedupe(kind) {
    const items = await list(kind);
    const groups = {};
    items.forEach(it => {
      const key = (it.title || "") + "|" + (it.date || "");
      (groups[key] = groups[key] || []).push(it);
    });
    let removed = 0;
    for (const key in groups) {
      const g = groups[key];
      if (g.length < 2) continue;
      g.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      for (let i = 1; i < g.length; i++) { await remove(g[i].id); removed++; }
    }
    return removed;
  }

  // 标题一样就改日期/备注，没有这个标题就新建。用来更新「之前导入过的某个里程碑，
  // 日期变了」这种情况，不会跟已有的那条变成两行。
  async function upsertByTitle(kind, title, fields) {
    const items = await list(kind);
    const hit = items.find(x => x.title === title);
    if (hit) return update(hit.id, fields);
    return add(kind, Object.assign({ title }, fields));
  }

  return { list, add, update, remove, toggleDone, subscribe, dedupe, upsertByTitle };
})();
