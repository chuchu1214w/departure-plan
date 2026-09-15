// 复盘页：日 / 周 / 月 三个粒度，基于真实的学习事项完成情况和打工收入统计。
// AI 点评先占位，等设好带账单的接口账号再接。
(function () {
  const WD = ["一","二","三","四","五","六","日"];
  const MN = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  let cache = { event: [], study: [] };
  let earn = {};

  function iso(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
  async function loadEarn() {
    earn = {};
    if (!window.Store) return;
    try {
      const rows = await window.Store.list("work");
      rows.forEach(r => { if (r.title === "income" && r.date && +r.amount > 0) earn[r.date] = Math.round(+r.amount); });
    } catch (e) { earn = {}; }
  }

  function statsBetween(fromIso, toIso) {
    // [fromIso, toIso] 闭区间，YYYY-MM-DD 字符串比较即可
    const inRange = k => k >= fromIso && k <= toIso;
    const st = cache.study.filter(x => x.date && inRange(x.date));
    const ev = cache.event.filter(x => x.date && inRange(x.date));
    let inc = 0, days = 0;
    Object.keys(earn).forEach(k => { if (inRange(k) && +earn[k] > 0) { inc += +earn[k]; days++; } });
    return {
      studyDone: st.filter(x => x.done).length, studyTotal: st.length,
      evDone: ev.filter(x => x.done).length, evTotal: ev.length,
      income: inc, workDays: days,
      items: st.concat(ev).sort((a,b) => (a.date||"").localeCompare(b.date||""))
    };
  }
  function statCards(s) {
    const rate = (a,b) => b ? Math.round(a/b*100) + "%" : "—";
    return `
      <div class="st"><dt>学习完成</dt><dd>${s.studyDone}<span class="u">/${s.studyTotal}</span></dd><small>${rate(s.studyDone,s.studyTotal)}</small></div>
      <div class="st"><dt>重大事件完成</dt><dd>${s.evDone}<span class="u">/${s.evTotal}</span></dd><small>${rate(s.evDone,s.evTotal)}</small></div>
      <div class="st"><dt>打工收入</dt><dd>${(s.income/10000).toFixed(1)}<span class="u">만</span></dd><small>已录 ${s.workDays} 天</small></div>
    `;
  }

  // ---- 日 ----
  let rvD = new Date();
  function renderDay() {
    const k = iso(rvD);
    document.getElementById("rvDlabel").textContent = `${rvD.getFullYear()}/${rvD.getMonth()+1}/${rvD.getDate()} 周${WD[(rvD.getDay()+6)%7]}`;
    const s = statsBetween(k, k);
    document.getElementById("rvDStats").innerHTML = statCards(s);
    const list = document.getElementById("rvDList");
    list.innerHTML = s.items.length ? s.items.map(it => `
      <div class="td ${it.done?'done':''}"><span class="cb" style="cursor:default"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.6 8.8 10 3.4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="tdt">${it.kind==='study'?'学习':'事件'}</span>
      <span><span class="ti">${escapeHtml(it.title)}</span></span></div>`).join("")
      : '<div class="empty">这天没有录入学习或事件</div>';
  }
  document.getElementById("rvDPrev").onclick = () => { rvD.setDate(rvD.getDate()-1); renderDay(); };
  document.getElementById("rvDNext").onclick = () => { rvD.setDate(rvD.getDate()+1); renderDay(); };

  // ---- 周 ----
  let rvW = new Date();
  function mondayOf(d) { const x = new Date(d); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); x.setHours(0,0,0,0); return x; }
  function renderWeek() {
    const mon = mondayOf(rvW), sun = new Date(mon); sun.setDate(mon.getDate()+6);
    document.getElementById("rvWlabel").textContent = `${mon.getMonth()+1}/${mon.getDate()} – ${sun.getMonth()+1}/${sun.getDate()}`;
    const s = statsBetween(iso(mon), iso(sun));
    document.getElementById("rvWStats").innerHTML = statCards(s);
  }
  document.getElementById("rvWPrev").onclick = () => { rvW.setDate(rvW.getDate()-7); renderWeek(); };
  document.getElementById("rvWNext").onclick = () => { rvW.setDate(rvW.getDate()+7); renderWeek(); };

  // ---- 月 ----
  let rvM = new Date(); rvM.setDate(1);
  function renderMonth() {
    const y = rvM.getFullYear(), m = rvM.getMonth();
    document.getElementById("rvMlabel").textContent = y + " 年 " + MN[m];
    const first = iso(new Date(y, m, 1)), last = iso(new Date(y, m+1, 0));
    const s = statsBetween(first, last);
    document.getElementById("rvMStats").innerHTML = statCards(s);
  }
  document.getElementById("rvMPrev").onclick = () => { rvM.setMonth(rvM.getMonth()-1); renderMonth(); };
  document.getElementById("rvMNext").onclick = () => { rvM.setMonth(rvM.getMonth()+1); renderMonth(); };

  async function renderAll() { await loadEarn(); renderDay(); renderWeek(); renderMonth(); }

  document.getElementById("rvSub").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#rvSub button").forEach(x => x.classList.toggle("on", x === b));
    document.getElementById("rv-d").classList.toggle("on", b.dataset.sub === "d");
    document.getElementById("rv-w").classList.toggle("on", b.dataset.sub === "w");
    document.getElementById("rv-m").classList.toggle("on", b.dataset.sub === "m");
  });

  const rvAIBtn = document.getElementById("rvAI");
  const rvAIOut = document.getElementById("rvAIOut");
  rvAIBtn.addEventListener("click", async () => {
    rvAIBtn.disabled = true; rvAIOut.style.display = "block"; rvAIOut.textContent = "生成中…";
    try {
      const active = ["d","w","m"].find(x => document.getElementById("rv-"+x).classList.contains("on")) || "d";
      let label, s;
      if (active === "d") { label = document.getElementById("rvDlabel").textContent; s = statsBetween(iso(rvD), iso(rvD)); }
      else if (active === "w") { const mon = mondayOf(rvW), sun = new Date(mon); sun.setDate(mon.getDate()+6); label = document.getElementById("rvWlabel").textContent; s = statsBetween(iso(mon), iso(sun)); }
      else { const y=rvM.getFullYear(), m=rvM.getMonth(); label = document.getElementById("rvMlabel").textContent; s = statsBetween(iso(new Date(y,m,1)), iso(new Date(y,m+1,0))); }
      const prompt = `帮一个梨花女子大学学生做${active==="d"?"当天":active==="w"?"这周":"这个月"}的复盘（${label}）。
数据：学习事项完成 ${s.studyDone}/${s.studyTotal}，重大事件完成 ${s.evDone}/${s.evTotal}，
打工收入 ${(s.income/10000).toFixed(1)}만，录入 ${s.workDays} 天。
用中文写一段简短点评（100字以内），说说做得好的地方和该注意的地方，语气直接不要客套。`;
      const { data, error } = await window.sb.functions.invoke("ai-generate", { body: { prompt } });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error + (data.detail ? "："+data.detail : ""));
      rvAIOut.textContent = data.text || "（AI 没有返回内容）";
    } catch (e) {
      rvAIOut.textContent = "生成失败：" + (e.message || e);
    }
    rvAIBtn.disabled = false;
  });

  async function loadCloud() {
    if (!window.Store) return;
    try { cache.event = await window.Store.list("event"); } catch (e) { cache.event = []; }
    try { cache.study = await window.Store.list("study"); } catch (e) { cache.study = []; }
  }

  async function boot() { await loadCloud(); await renderAll(); }
  window.addEventListener("app:authed", boot);
  window.addEventListener("view:switched", (e) => { if (e.detail && e.detail.v === "review") boot(); });
  if (document.getElementById("appRoot") && !document.getElementById("appRoot").hidden) boot();
})();
