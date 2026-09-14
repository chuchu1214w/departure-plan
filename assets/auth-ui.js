// 登录门禁：没登录就只显示一个输入邮箱的界面，登录后才放行看到正式内容。
(function () {
  const gate = document.getElementById("authGate");
  const app = document.getElementById("appRoot");
  const emailInput = document.getElementById("authEmail");
  const sendBtn = document.getElementById("authSend");
  const msg = document.getElementById("authMsg");
  const signOutBtn = document.getElementById("signOut");
  const whoEl = document.getElementById("whoAmI");

  function showApp(user) {
    gate.hidden = true;
    app.hidden = false;
    if (whoEl) whoEl.textContent = user.email;
    window.dispatchEvent(new CustomEvent("app:authed", { detail: { user } }));
  }
  function showGate() {
    gate.hidden = false;
    app.hidden = true;
  }

  sendBtn.addEventListener("click", async () => {
    const email = (emailInput.value || "").trim();
    if (!email) { msg.textContent = "先填邮箱"; return; }
    sendBtn.disabled = true; msg.textContent = "发送中…";
    try {
      const { error } = await window.sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.href.split("#")[0] }
      });
      if (error) throw error;
      msg.textContent = "登录链接已发到 " + email + "，去邮箱点一下。这个页面留着别关。";
    } catch (e) {
      msg.textContent = "发送失败：" + (e.message || "未知错误");
    }
    sendBtn.disabled = false;
  });

  if (signOutBtn) signOutBtn.addEventListener("click", async () => {
    await window.sb.auth.signOut();
    location.reload();
  });

  window.sb.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) showApp(session.user); else showGate();
  });
  window.sb.auth.getSession().then(({ data }) => {
    if (data.session && data.session.user) showApp(data.session.user); else showGate();
  });
})();
