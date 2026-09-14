// 重大事件（月历）+ 学习（月/周/日程）两套日历的渲染与加改删逻辑。
// 全部包在一个 IIFE 里，避免和页面里另一段大脚本的变量名互相冲突。
(function () {
  const WD = ["一","二","三","四","五","六","日"];
  const MN = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const cache = { event: [], study: [] };
  const unsub = {};

  function iso(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
  function fmtDateShort(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr + "T00:00:00");
    return `${d.getMonth()+1}/${d.getDate()} 周${WD[(d.getDay()+6)%7]}`;
  }
  function itemsOnDate(kind, isoStr) { return cache[kind].filter(x => x.date === isoStr); }

  function row(item) {
    const done = !!item.done;
    return `<div class="td ${done?'done':''}" data-id="${item.id}">
      <button class="cb" aria-label="${done?'取消完成':'标记完成'}">
        <svg viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.6 8.8 10 3.4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <span class="tdt">${fmtDateShort(item.date)}${item.source==='ai'?'<small>AI 生成</small>':''}</span>
      <span><span class="ti">${escapeHtml(item.title)}</span>${item.note?`<span class="tn">${escapeHtml(item.note)}</span>`:''}</span>
    </div>`;
  }

  async function loadAll(kind) { cache[kind] = await window.Store.list(kind); }

  // ---- 通用：点击一行（勾选完成 / 打开编辑） ----
  function wireRowClicks(container, kind) {
    container.addEventListener("click", async (e) => {
      const el = e.target.closest(".td"); if (!el) return;
      const id = el.dataset.id;
      const item = cache[kind].find(x => x.id === id);
      if (!item) return;
      if (e.target.closest(".cb")) {
        el.classList.toggle("done");
        try { await window.Store.toggleDone(id, !item.done); item.done = !item.done; }
        catch (err) { el.classList.toggle("done"); alert("保存失败：" + (err.message||err)); }
      } else {
        openPop(kind, item);
      }
    });
  }

  // =========================================================
  // 重大事件：月历 + 选中日详情
  // =========================================================
  let evCurM = new Date(); evCurM.setDate(1);
  let evSelDate = iso(new Date());

  function renderEventCal() {
    const y = evCurM.getFullYear(), m = evCurM.getMonth();
    document.getElementById("evMlabel").textContent = y + " 年 " + MN[m];
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const lead = (first.getDay() + 6) % 7;
    const today = iso(new Date());
    let h = '<div class="dh">一</div><div class="dh">二</div><div class="dh">三</div><div class="dh">四</div><div class="dh">五</div><div class="dh we">六</div><div class="dh we">日</div>';
    for (let i = 0; i < lead; i++) h += '<button class="cell" disabled></button>';
    let cnt = 0;
    for (let dd = 1; dd <= last.getDate(); dd++) {
      const d = new Date(y, m, dd), k = iso(d);
      const items = itemsOnDate("event", k);
      cnt += items.length;
      const cls = ["cell"];
      if (items.length) cls.push("has");
      if (k === today) cls.push("today");
      h += `<button class="${cls.join(" ")}" data-k="${k}">
        <span class="dn2">${dd}</span>
        ${items.length ? `<span class="pl">${items.length} 项</span><span class="dot"></span>` : ""}
      </button>`;
    }
    document.getElementById("evGrid").innerHTML = h;
    document.getElementById("evMinfo").innerHTML = `本月共 <b>${cnt}</b> 项`;
    renderEventDay();
  }
  function renderEventDay() {
    document.getElementById("evDayTitle").textContent = fmtDateShort(evSelDate) + " 的事项";
    const items = itemsOnDate("event", evSelDate).sort((a, b) => (a.start_at||"").localeCompare(b.start_at||""));
    document.getElementById("evDayList").innerHTML = items.length ? items.map(row).join("") : '<div class="empty">这天没有事项，可以点上面「加一件事」</div>';
  }
  document.getElementById("evGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".cell"); if (!c || c.disabled) return;
    evSelDate = c.dataset.k;
    renderEventDay();
  });
  document.getElementById("evPrev").onclick = () => { evCurM.setMonth(evCurM.getMonth()-1); renderEventCal(); };
  document.getElementById("evNext").onclick = () => { evCurM.setMonth(evCurM.getMonth()+1); renderEventCal(); };
  wireRowClicks(document.getElementById("evDayList"), "event");
  document.getElementById("evAdd").addEventListener("click", () => openPop("event", null, evSelDate));

  // =========================================================
  // 学习：月 / 周 / 日程 三个子视图
  // =========================================================
  let stCurM = new Date(); stCurM.setDate(1);
  let stCurW = new Date();
  let stCurD = new Date();

  function renderStudyMonth() {
    const y = stCurM.getFullYear(), m = stCurM.getMonth();
    document.getElementById("stMlabel").textContent = y + " 年 " + MN[m];
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const lead = (first.getDay() + 6) % 7;
    const today = iso(new Date());
    let h = '<div class="dh">一</div><div class="dh">二</div><div class="dh">三</div><div class="dh">四</div><div class="dh">五</div><div class="dh we">六</div><div class="dh we">日</div>';
    for (let i = 0; i < lead; i++) h += '<button class="cell" disabled></button>';
    let cnt = 0;
    for (let dd = 1; dd <= last.getDate(); dd++) {
      const d = new Date(y, m, dd), k = iso(d);
      const items = itemsOnDate("study", k);
      cnt += items.length;
      const cls = ["cell"];
      if (items.length) cls.push("has");
      if (k === today) cls.push("today");
      h += `<button class="${cls.join(" ")}" data-k="${k}">
        <span class="dn2">${dd}</span>
        ${items.length ? `<span class="pl">${items.length} 项</span><span class="dot"></span>` : ""}
      </button>`;
    }
    document.getElementById("stGrid").innerHTML = h;
    document.getElementById("stMinfo").innerHTML = `本月共 <b>${cnt}</b> 项`;
  }
  document.getElementById("stGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".cell"); if (!c || c.disabled) return;
    const p = c.dataset.k.split("-").map(Number);
    stCurD = new Date(p[0], p[1] - 1, p[2]);
    switchStudySub("d");
    renderStudyDay();
  });
  document.getElementById("stMPrev").onclick = () => { stCurM.setMonth(stCurM.getMonth()-1); renderStudyMonth(); };
  document.getElementById("stMNext").onclick = () => { stCurM.setMonth(stCurM.getMonth()+1); renderStudyMonth(); };

  function mondayOf(d) { const x = new Date(d); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); x.setHours(0,0,0,0); return x; }
  function renderStudyWeek() {
    const mon = mondayOf(stCurW);
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    document.getElementById("stWlabel").textContent = `${mon.getMonth()+1}/${mon.getDate()} – ${sun.getMonth()+1}/${sun.getDate()}`;
    let h = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate()+i);
      const k = iso(d);
      const items = itemsOnDate("study", k).sort((a,b) => (a.start_at||"").localeCompare(b.start_at||""));
      h += `<div style="margin-bottom:16px">
        <h4 style="margin:0 0 8px;font-size:13px;color:var(--ink3);font-family:'Archivo',sans-serif">周${WD[i]} · ${d.getMonth()+1}/${d.getDate()}</h4>
        <div class="todos">${items.length ? items.map(row).join("") : '<div class="empty" style="padding:13px">没有安排</div>'}</div>
      </div>`;
    }
    document.getElementById("stWeekBody").innerHTML = h;
  }
  document.getElementById("stWPrev").onclick = () => { stCurW.setDate(stCurW.getDate()-7); renderStudyWeek(); };
  document.getElementById("stWNext").onclick = () => { stCurW.setDate(stCurW.getDate()+7); renderStudyWeek(); };
  wireRowClicks(document.getElementById("stWeekBody"), "study");

  function renderStudyDay() {
    const k = iso(stCurD);
    document.getElementById("stDlabel").textContent = `${stCurD.getFullYear()}/${stCurD.getMonth()+1}/${stCurD.getDate()} 周${WD[(stCurD.getDay()+6)%7]}`;
    const items = itemsOnDate("study", k).sort((a,b) => (a.start_at||"").localeCompare(b.start_at||""));
    const body = document.getElementById("stDayBody");
    if (!items.length) { body.innerHTML = '<div class="empty">这天没有安排，点上面「加一件事」补一条</div>'; return; }
    body.innerHTML = items.map((it, i) => `
      <div class="ch" data-id="${it.id}" style="cursor:pointer">
        <span class="no">${i+1}</span>
        <span class="dd2">${it.start_at ? new Date(it.start_at).toTimeString().slice(0,5) : "全天"}</span>
        <span class="bd2"><b>${escapeHtml(it.title)}</b>${it.note?`<em>${escapeHtml(it.note)}</em>`:""}</span>
      </div>`).join("");
  }
  document.getElementById("stDPrev").onclick = () => { stCurD.setDate(stCurD.getDate()-1); renderStudyDay(); };
  document.getElementById("stDNext").onclick = () => { stCurD.setDate(stCurD.getDate()+1); renderStudyDay(); };
  document.getElementById("stDayBody").addEventListener("click", (e) => {
    const el = e.target.closest(".ch"); if (!el) return;
    const item = cache.study.find(x => x.id === el.dataset.id);
    if (item) openPop("study", item);
  });

  function switchStudySub(sub) {
    document.querySelectorAll("#stSub button").forEach(b => b.classList.toggle("on", b.dataset.sub === sub));
    document.getElementById("st-m").classList.toggle("on", sub === "m");
    document.getElementById("st-w").classList.toggle("on", sub === "w");
    document.getElementById("st-d").classList.toggle("on", sub === "d");
  }
  document.getElementById("stSub").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    switchStudySub(b.dataset.sub);
    if (b.dataset.sub === "w") renderStudyWeek();
    if (b.dataset.sub === "d") renderStudyDay();
  });
  document.getElementById("stAdd").addEventListener("click", () => openPop("study", null, iso(stCurD)));

  const aiBtn = document.getElementById("aiGen");
  if (aiBtn) aiBtn.addEventListener("click", () => {
    alert("这个功能还没设置好。需要先开一个带账单的 AI 接口账号，等设置好我再通知你。");
  });

  // =========================================================
  // 通用弹窗：新建 / 编辑一条
  // =========================================================
  const pop = document.getElementById("itemPop");
  const elT = document.getElementById("itemPopT");
  const elTitle = document.getElementById("itemTitle");
  const elDate = document.getElementById("itemDate");
  const elNote = document.getElementById("itemNote");
  const elSave = document.getElementById("itemSave");
  const elDel = document.getElementById("itemDelete");
  const elCancel = document.getElementById("itemCancel");
  let editing = null;

  function openPop(kind, item, presetDate) {
    editing = { kind, id: item ? item.id : null };
    elT.textContent = item ? "编辑" : "加一件事";
    elTitle.value = item ? item.title : "";
    elDate.value = item ? (item.date || "") : (presetDate || "");
    elNote.value = item ? (item.note || "") : "";
    elDel.hidden = !item;
    pop.classList.add("on");
    setTimeout(() => elTitle.focus(), 40);
  }
  function closePop() { pop.classList.remove("on"); editing = null; }
  elCancel.onclick = closePop;
  pop.addEventListener("click", (e) => { if (e.target === pop) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop.classList.contains("on")) closePop(); });

  async function refresh(kind) {
    await loadAll(kind);
    if (kind === "event") { renderEventCal(); toggleImportBtn("event"); }
    else { renderStudyMonth(); renderStudyWeek(); renderStudyDay(); toggleImportBtn("study"); }
  }

  elSave.onclick = async () => {
    const title = elTitle.value.trim();
    if (!title) { elTitle.focus(); return; }
    const fields = { title, date: elDate.value || null, note: elNote.value.trim() };
    elSave.disabled = true;
    try {
      if (editing.id) await window.Store.update(editing.id, fields);
      else await window.Store.add(editing.kind, fields);
      const k = editing.kind;
      closePop();
      await refresh(k);
    } catch (e) { alert("保存失败：" + (e.message || e)); }
    elSave.disabled = false;
  };
  elDel.onclick = async () => {
    if (!editing || !editing.id) return;
    if (!confirm("删掉这一条？")) return;
    try { const k = editing.kind; await window.Store.remove(editing.id); closePop(); await refresh(k); }
    catch (e) { alert("删除失败：" + (e.message || e)); }
  };

  // =========================================================
  // 导入历史整理好的数据（只在对应日历完全是空的时候出现）
  // =========================================================
  function toggleImportBtn(kind) {
    const btn = document.getElementById(kind === "event" ? "evImport" : "stImport");
    if (btn) btn.hidden = cache[kind].length > 0;
  }
  async function doImport(kind) {
    const seed = (window.SEED && window.SEED[kind]) || [];
    if (!seed.length) return;
    const btn = document.getElementById(kind === "event" ? "evImport" : "stImport");
    const label = "↓ 导入之前整理好的" + (kind === "event" ? "重大事件" : "学业日程");
    if (btn) { btn.disabled = true; btn.textContent = "导入中…"; }
    try {
      for (const it of seed) await window.Store.add(kind, it);
      await refresh(kind);
    } catch (e) {
      alert("导入失败：" + (e.message || e));
    }
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
  document.getElementById("evImport").addEventListener("click", () => doImport("event"));
  document.getElementById("stImport").addEventListener("click", () => doImport("study"));

  // =========================================================
  // 登录后：首次加载 + 实时订阅
  // =========================================================
  async function boot() {
    await Promise.all([loadAll("event"), loadAll("study")]);
    renderEventCal();
    renderStudyMonth();
    renderStudyWeek();
    renderStudyDay();
    toggleImportBtn("event");
    toggleImportBtn("study");
    ["event", "study"].forEach(kind => {
      if (unsub[kind]) unsub[kind]();
      unsub[kind] = window.Store.subscribe(kind, () => refresh(kind));
    });
  }
  if (document.getElementById("appRoot") && !document.getElementById("appRoot").hidden) boot();
  window.addEventListener("app:authed", boot);
})();
