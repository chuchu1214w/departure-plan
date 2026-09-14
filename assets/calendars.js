// 重大事件 / 学习 两个日历的加改删界面。全部包在一个 IIFE 里，
// 避免和页面里另一段大脚本的变量名互相冲突。
(function () {
  const WD = ["一","二","三","四","五","六","日"];
  const lists = { event: document.getElementById("eventList"), study: document.getElementById("studyList") };
  const cache = { event: [], study: [] };
  const unsub = {};

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return `${d.getMonth()+1}/${d.getDate()} 周${WD[(d.getDay()+6)%7]}`;
  }

  function row(item) {
    const done = !!item.done;
    return `<div class="td ${done?'done':''}" data-id="${item.id}">
      <button class="cb" aria-label="${done?'取消完成':'标记完成'}">
        <svg viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.6 8.8 10 3.4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <span class="tdt">${fmtDate(item.date)}${item.source==='ai'?'<small>AI 生成</small>':''}</span>
      <span><span class="ti">${escapeHtml(item.title)}</span>${item.note?`<span class="tn">${escapeHtml(item.note)}</span>`:''}</span>
    </div>`;
  }
  function escapeHtml(s){ const d=document.createElement("div"); d.textContent=s||""; return d.innerHTML; }

  async function render(kind) {
    const el = lists[kind];
    if (!el) return;
    try {
      const items = await window.Store.list(kind);
      cache[kind] = items;
      el.innerHTML = items.length ? items.map(row).join("") : '<div class="empty">还没有事项，点上面加一件</div>';
    } catch (e) {
      el.innerHTML = `<div class="empty">加载失败：${e.message||e}</div>`;
    }
  }

  // ---- 点击列表：勾选框切换完成，其余区域打开编辑弹窗 ----
  Object.entries(lists).forEach(([kind, el]) => {
    if (!el) return;
    el.addEventListener("click", async (e) => {
      const row = e.target.closest(".td"); if (!row) return;
      const id = row.dataset.id;
      const item = cache[kind].find(x => x.id === id);
      if (!item) return;
      if (e.target.closest(".cb")) {
        row.classList.toggle("done");
        try { await window.Store.toggleDone(id, !item.done); item.done = !item.done; }
        catch (err) { row.classList.toggle("done"); alert("保存失败：" + (err.message||err)); }
      } else {
        openPop(kind, item);
      }
    });
  });

  // ---- 加一件事按钮 ----
  document.querySelectorAll(".addbtn[data-kind]").forEach(btn => {
    btn.addEventListener("click", () => openPop(btn.dataset.kind, null));
  });

  // ---- 弹窗：新建 / 编辑 ----
  const pop = document.getElementById("itemPop");
  const elT = document.getElementById("itemPopT");
  const elTitle = document.getElementById("itemTitle");
  const elDate = document.getElementById("itemDate");
  const elNote = document.getElementById("itemNote");
  const elSave = document.getElementById("itemSave");
  const elDel = document.getElementById("itemDelete");
  const elCancel = document.getElementById("itemCancel");
  let editing = null; // {kind, id} 或 null（新建）

  function openPop(kind, item) {
    editing = item ? { kind, id: item.id } : { kind, id: null };
    elT.textContent = item ? "编辑" : "加一件事";
    elTitle.value = item ? item.title : "";
    elDate.value = item ? (item.date || "") : "";
    elNote.value = item ? (item.note || "") : "";
    elDel.hidden = !item;
    pop.classList.add("on");
    setTimeout(() => elTitle.focus(), 40);
  }
  function closePop() { pop.classList.remove("on"); editing = null; }

  elCancel.onclick = closePop;
  pop.addEventListener("click", (e) => { if (e.target === pop) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop.classList.contains("on")) closePop(); });

  elSave.onclick = async () => {
    const title = elTitle.value.trim();
    if (!title) { elTitle.focus(); return; }
    const fields = { title, date: elDate.value || null, note: elNote.value.trim() };
    elSave.disabled = true;
    try {
      if (editing.id) await window.Store.update(editing.id, fields);
      else await window.Store.add(editing.kind, fields);
      closePop();
      render(editing ? editing.kind : "event");
    } catch (e) {
      alert("保存失败：" + (e.message || e));
    }
    elSave.disabled = false;
  };
  elDel.onclick = async () => {
    if (!editing || !editing.id) return;
    if (!confirm("删掉这一条？")) return;
    try { await window.Store.remove(editing.id); const k = editing.kind; closePop(); render(k); }
    catch (e) { alert("删除失败：" + (e.message || e)); }
  };

  // ---- AI 生成本周学习计划：先占位，账号设好之后再接 ----
  const aiBtn = document.getElementById("aiGen");
  if (aiBtn) aiBtn.addEventListener("click", () => {
    alert("这个功能还没设置好。需要先开一个带账单的 AI 接口账号，等设置好我再通知你。");
  });

  // ---- 登录后：首次加载 + 打开实时订阅（其他设备改了也会自动刷新） ----
  function boot() {
    ["event", "study"].forEach(kind => {
      render(kind);
      if (unsub[kind]) unsub[kind]();
      unsub[kind] = window.Store.subscribe(kind, () => render(kind));
    });
  }
  if (document.getElementById("appRoot") && !document.getElementById("appRoot").hidden) boot();
  window.addEventListener("app:authed", boot);
})();
