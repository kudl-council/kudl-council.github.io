/* 행사 신청 페이지 (apply.html) — 수정할 필요 없음 */
(function () {
  const A = window.APPLY, DB = window.DB, esc = A.esc;
  const box = document.getElementById("ap");
  let toastTimer;
  function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.className = "show"; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), 2400); }
  const fail = (t, m) => { box.innerHTML = '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div><div class="ap-closed"><b>' + esc(t) + "</b><span>" + esc(m) + "</span></div>"; };

  let F = null, id = "";
  function showForm() {
    box.innerHTML = (DB.mode === "demo" ? '<div class="demobar" style="border-radius:10px">데모 모드 — 제출해도 실제로 저장되지 않아요.</div>' : "") + A.formHTML(F);
    const form = box.querySelector("form");
    if (form) form.addEventListener("submit", submit);
  }
  async function submit(e) {
    e.preventDefault();
    const form = e.target, err = form.querySelector(".ap-err"), btn = form.querySelector('[type="submit"]');
    const r = A.readAnswers(F, form);
    const say = (m) => { err.hidden = false; err.textContent = m; err.scrollIntoView({ block: "center", behavior: "smooth" }); };
    if (r.err) return say(r.err);
    err.hidden = true; btn.disabled = true; btn.textContent = "제출하는 중…";
    const data = { sid: r.sid, name: r.name, depositName: A.depositName(r.sid, r.name), answers: r.answers, paid: false, attended: false };
    try {
      await DB.submitResponse(id, r.sid, data);
      box.innerHTML = A.doneHTML(F, Object.assign({ at: Date.now() }, data));
      window.scrollTo(0, 0);
    } catch (er) {
      btn.disabled = false; btn.textContent = "제출하기";
      const m = String((er && (er.code || er.message)) || er);
      if (/permission|insufficient/i.test(m)) say("이미 이 학번으로 신청했거나, 방금 신청이 마감됐어요. 잘못 신청했다면 학생회에 말해 주세요.");
      else if (/unavailable|network|offline/i.test(m)) say("인터넷 연결을 확인하고 다시 눌러 주세요.");
      else say("제출하지 못했어요. 잠시 뒤 다시 시도해 주세요. (" + m + ")");
    }
  }
  document.addEventListener("click", function (e) {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const v = b.dataset.copy;
    Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(v)).then(() => toast("복사했어요: " + v)).catch(() => toast("길게 눌러서 복사해 주세요: " + v));
  });

  (async function boot() {
    try { await DB.init(); } catch (e) { return fail("페이지를 불러오지 못했어요", "인터넷 연결을 확인하고 새로고침해 주세요."); }
    id = new URLSearchParams(location.search).get("f") || (DB.mode === "demo" ? "p2" : "");
    if (!id) return fail("주소가 잘못됐어요", "학생회가 보낸 링크를 다시 눌러 주세요.");
    try { F = await DB.get("forms", id); } catch (e) { F = null; }
    if (!F) return fail("없는 신청 페이지예요", "학생회가 보낸 링크를 다시 확인해 주세요.");
    document.title = (F.title || "행사 신청") + " · 생명과학부 학생회";
    showForm();
  })();
})();
