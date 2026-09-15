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
  let stMSel = iso(new Date());

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
      if (k === stMSel) cls.push("sel");
      h += `<button class="${cls.join(" ")}" data-k="${k}">
        <span class="dn2">${dd}</span>
        ${items.length ? `<span class="pl">${items.length} 项</span><span class="dot"></span>` : ""}
      </button>`;
    }
    document.getElementById("stGrid").innerHTML = h;
    document.getElementById("stMinfo").innerHTML = `本月共 <b>${cnt}</b> 项`;
    renderStudyMonthDay();
  }
  function renderStudyMonthDay() {
    document.getElementById("stMDayTitle").textContent = fmtDateShort(stMSel) + " 的安排";
    const items = itemsOnDate("study", stMSel).sort((a,b) => (a.start_at||"").localeCompare(b.start_at||""));
    document.getElementById("stMDayList").innerHTML = items.length ? items.map(row).join("") : '<div class="empty">这天没有安排，点上面「加一件事」补一条</div>';
  }
  document.getElementById("stGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".cell"); if (!c || c.disabled) return;
    stMSel = c.dataset.k;
    document.querySelectorAll("#stGrid .cell").forEach(x => x.classList.toggle("sel", x.dataset.k === stMSel));
    renderStudyMonthDay();
  });
  wireRowClicks(document.getElementById("stMDayList"), "study");
  document.getElementById("stMPrev").onclick = () => { stCurM.setMonth(stCurM.getMonth()-1); renderStudyMonth(); };
  document.getElementById("stMNext").onclick = () => { stCurM.setMonth(stCurM.getMonth()+1); renderStudyMonth(); };

  function mondayOf(d) { const x = new Date(d); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); x.setHours(0,0,0,0); return x; }

  // 课表格子：08:00–23:30，每 15 分钟一行
  const TT0 = 8*60, TT1 = 23*60+30, TSTEP = 15;
  function ttRow(min) { return Math.round((min-TT0)/TSTEP) + 1; }
  function minsOf(iso_) { const d = new Date(iso_); return d.getHours()*60 + d.getMinutes(); }

  function renderStudyWeek() {
    const mon = mondayOf(stCurW);
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    document.getElementById("stWlabel").textContent = `${mon.getMonth()+1}/${mon.getDate()} – ${sun.getMonth()+1}/${sun.getDate()}`;

    const days = []; for (let i=0;i<7;i++){ const d=new Date(mon); d.setDate(mon.getDate()+i); days.push(d); }
    const nRows = Math.round((TT1-TT0)/TSTEP);

    // 全天 / 没填时间的事项，列成小胶囊放在格子上面（不进滚动区）
    const allday = [];
    days.forEach((d,i) => { itemsOnDate("study", iso(d)).forEach(it => { if (!it.start_at) allday.push(it); }); });
    const alldayHtml = allday.length ? '<div class="tt-allday">' + allday.map(it =>
      `<span class="tt-chip" data-id="${it.id}">${fmtDateShort(it.date)} · ${escapeHtml(it.title)}</span>`).join("") + '</div>' : '';

    // 格子本体单独拼，外面统一包一层横向滚动容器
    let h = '<div class="ttable">';
    h += '<div class="tt-corner"></div>';
    days.forEach((d,i) => { h += `<div class="tt-dh">周${WD[i]}<small>${d.getMonth()+1}/${d.getDate()}</small></div>`; });

    h += `<div class="tt-gutter" style="grid-template-rows:repeat(${nRows},7px)">`;
    for (let t=TT0; t<TT1; t+=60) h += `<div class="tt-tick" style="grid-row:${ttRow(t)}/span 4"><span>${String(Math.floor(t/60)).padStart(2,"0")}</span></div>`;
    h += '</div>';

    days.forEach((d) => {
      const k = iso(d);
      const items = itemsOnDate("study", k).filter(it => it.start_at);
      h += `<div class="tt-col" style="grid-template-rows:repeat(${nRows},7px)">`;
      for (let t=TT0; t<TT1; t+=60) h += `<div class="tt-tick" style="grid-row:${ttRow(t)}/span 4"></div>`;
      items.forEach(it => {
        const s0 = Math.max(TT0, Math.min(TT1, minsOf(it.start_at)));
        const e0 = it.end_at ? Math.max(s0+TSTEP, Math.min(TT1, minsOf(it.end_at))) : Math.min(TT1, s0+90);
        h += `<div class="tt-blk" data-id="${it.id}" style="grid-row:${ttRow(s0)}/${ttRow(e0)}">
          <b>${escapeHtml(it.title)}</b><small>${String(Math.floor(s0/60)).padStart(2,"0")}:${String(s0%60).padStart(2,"0")}</small></div>`;
      });
      h += '</div>';
    });
    h += '</div>';
    document.getElementById("stWeekBody").innerHTML = alldayHtml + '<div class="ttwrap">' + h + '</div>';
  }
  document.getElementById("stWPrev").onclick = () => { stCurW.setDate(stCurW.getDate()-7); renderStudyWeek(); };
  document.getElementById("stWNext").onclick = () => { stCurW.setDate(stCurW.getDate()+7); renderStudyWeek(); };
  document.getElementById("stWeekBody").addEventListener("click", (e) => {
    const el = e.target.closest(".tt-blk, .tt-chip"); if (!el) return;
    const item = cache.study.find(x => x.id === el.dataset.id);
    if (item) openPop("study", item);
  });

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

  async function callAI(prompt) {
    const { data, error } = await window.sb.functions.invoke("ai-generate", { body: { prompt } });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error + (data.detail ? "："+data.detail : ""));
    return data.text || "（AI 没有返回内容）";
  }

  const aiBtn = document.getElementById("aiGen");
  const aiOut = document.getElementById("aiOut");
  if (aiBtn) aiBtn.addEventListener("click", async () => {
    aiBtn.disabled = true; aiOut.style.display = "block"; aiOut.textContent = "生成中…";
    try {
      const mon = mondayOf(stCurW);
      const days = []; for (let i=0;i<7;i++){ const d=new Date(mon); d.setDate(mon.getDate()+i); days.push(d); }
      const fixed = [];
      days.forEach(d => itemsOnDate("study", iso(d)).forEach(it => fixed.push(`${iso(d)} ${it.start_at?new Date(it.start_at).toTimeString().slice(0,5):"全天"} ${it.title}`)));
      const prompt = `你在帮一个梨花女子大学学生排本周（${iso(mon)} 起 7 天）的学习计划。
她本周已经固定的课程和事项：
${fixed.length ? fixed.join("\n") : "（这周没有录入任何固定课程）"}

请在这些固定时间之外，给她安排具体的自习时段（比如背单词、复习、预习、作业），
每条一行，格式「星期几 几点-几点 内容」，中文回答，8条以内，不要太啰嗦。`;
      aiOut.textContent = await callAI(prompt);
    } catch (e) {
      aiOut.textContent = "生成失败：" + (e.message || e);
    }
    aiBtn.disabled = false;
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
  const elStart = document.getElementById("itemStart");
  const elEnd = document.getElementById("itemEnd");
  let editing = null;

  function hhmm(iso) { if (!iso) return ""; const d = new Date(iso); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }

  function openPop(kind, item, presetDate) {
    editing = { kind, id: item ? item.id : null };
    elT.textContent = item ? "编辑" : "加一件事";
    elTitle.value = item ? item.title : "";
    elDate.value = item ? (item.date || "") : (presetDate || "");
    elStart.value = item ? hhmm(item.start_at) : "";
    elEnd.value = item ? hhmm(item.end_at) : "";
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

  function toIso(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [y,m,d] = dateStr.split("-").map(Number);
    const [hh,mm] = timeStr.split(":").map(Number);
    return new Date(y, m-1, d, hh, mm).toISOString();
  }
  elSave.onclick = async () => {
    const title = elTitle.value.trim();
    if (!title) { elTitle.focus(); return; }
    const fields = {
      title, date: elDate.value || null, note: elNote.value.trim(),
      start_at: toIso(elDate.value, elStart.value),
      end_at: toIso(elDate.value, elEnd.value)
    };
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
      for (const it of seed) await window.Store.upsertByTitle(kind, it.title, { date: it.date, note: it.note || "" });
      await refresh(kind);
    } catch (e) {
      alert("导入失败：" + (e.message || e));
    }
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
  document.getElementById("evImport").addEventListener("click", () => doImport("event"));
  document.getElementById("stImport").addEventListener("click", () => doImport("study"));

  document.getElementById("evVisaUpdate").addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); const label = btn.textContent;
    btn.disabled = true; btn.textContent = "更新中…";
    try {
      for (const it of (window.SEED_VISA_UPDATE || [])) {
        await window.Store.upsertByTitle("event", it.title, { date: it.date, note: it.note || "" });
      }
      await refresh("event");
      btn.textContent = "已更新 ✓";
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2000);
    } catch (e2) {
      alert("更新失败：" + (e2.message || e2));
      btn.textContent = label; btn.disabled = false;
    }
  });

  document.getElementById("stLAHw").addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); const label = btn.textContent;
    btn.disabled = true; btn.textContent = "添加中…";
    try {
      for (const it of (window.SEED_LA_HW || [])) {
        await window.Store.upsertByTitle("study", it.title, { date: it.date, note: it.note || "" });
      }
      await refresh("study");
      btn.textContent = "已添加 ✓";
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2000);
    } catch (e2) {
      alert("添加失败：" + (e2.message || e2));
      btn.textContent = label; btn.disabled = false;
    }
  });

  document.getElementById("stAdVideo").addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); const label = btn.textContent;
    btn.disabled = true; btn.textContent = "添加中…";
    try {
      for (const it of (window.SEED_AD_VIDEO || [])) {
        await window.Store.upsertByTitle("study", it.title, { date: it.date, note: it.note || "" });
      }
      await refresh("study");
      btn.textContent = "已添加 ✓";
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2000);
    } catch (e2) {
      alert("添加失败：" + (e2.message || e2));
      btn.textContent = label; btn.disabled = false;
    }
  });

  document.getElementById("stEnglish").addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); const label = btn.textContent;
    btn.disabled = true;
    try {
      const items = window.SEED_ENGLISH || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        btn.textContent = `添加中…${i+1}/${items.length}`;
        await window.Store.upsertByTitle("study", it.title, {
          date: it.date, note: it.note || "",
          start_at: toIso(it.date, it.start), end_at: toIso(it.date, it.end)
        });
      }
      await refresh("study");
      btn.textContent = "已添加 ✓";
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2000);
    } catch (e2) {
      alert("添加失败：" + (e2.message || e2));
      btn.textContent = label; btn.disabled = false;
    }
  });

  async function doDedupe(kind, btn) {
    btn.disabled = true; const label = btn.textContent; btn.textContent = "清理中…";
    try {
      const n = await window.Store.dedupe(kind);
      await refresh(kind);
      alert(n ? `删掉了 ${n} 条重复的` : "没找到重复的");
    } catch (e) { alert("清理失败：" + (e.message || e)); }
    btn.disabled = false; btn.textContent = label;
  }
  document.getElementById("evDedupe").addEventListener("click", (e) => doDedupe("event", e.target.closest("button")));
  document.getElementById("stDedupe").addEventListener("click", (e) => doDedupe("study", e.target.closest("button")));

  async function doImportSchedule() {
    const items = window.SEED_SCHEDULE || [];
    if (!items.length) return;
    const btn = document.getElementById("stImportSched");
    btn.disabled = true; const label = btn.textContent; btn.textContent = "导入中…";
    try {
      for (const it of items) {
        await window.Store.upsertByTitle("study", it.title, {
          date: it.date, note: it.note || "",
          start_at: toIso(it.date, it.start), end_at: toIso(it.date, it.end)
        });
      }
      await refresh("study");
      btn.hidden = true;
    } catch (e) {
      alert("导入失败：" + (e.message || e));
      btn.disabled = false; btn.textContent = label;
    }
  }
  document.getElementById("stImportSched").addEventListener("click", doImportSchedule);

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
