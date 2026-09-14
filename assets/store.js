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

  return { list, add, update, remove, toggleDone, subscribe };
})();
