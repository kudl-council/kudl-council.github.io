/* 행사 신청 페이지 (apply.html) — 수정할 필요 없음 */
(function () {
  const A = window.APPLY, DB = window.DB, esc = A.esc;
  const box = document.getElementById("ap");
  let toastTimer;
  function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.className = "show"; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), 2400); }
  const fail = (t, m) => { box.innerHTML = '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div><div class="ap-closed"><b>' + esc(t) + "</b><span>" + esc(m) + "</span></div>"; };

  let F = null, id = "", count = null, E = null, editKey = "";
  const canEdit = () => F && F.allowEdit !== false && canHash();
  const editUrl = (key) => location.href.split("?")[0] + "?f=" + encodeURIComponent(id) + "&e=" + encodeURIComponent(key);
  // 이 기기에서 낸 응답의 수정 열쇠 기억 (다시 들어오면 [내 응답 고치기] 안내)
  const memKey = () => "apEdit:" + id;
  const remember = (k) => { try { localStorage.setItem(memKey(), k); } catch (e) { /* 무시 */ } };
  const forget = () => { try { localStorage.removeItem(memKey()); } catch (e) { /* 무시 */ } };
  // 주소창의 &e=… 지우기 (다른 학번으로 찾거나 새로 신청할 때)
  const clearUrlKey = () => { try { history.replaceState(null, "", location.pathname + "?f=" + encodeURIComponent(id)); } catch (e) { /* 무시 */ } };
  const recall = () => { try { return localStorage.getItem(memKey()) || ""; } catch (e) { return ""; } };
  // 수정 열쇠 = 학번 + 전화번호로 만든 암호(SHA-256). 링크를 따로 받아 둘 필요 없이, 학번·전화번호를 다시 넣으면 내 응답을 찾음
  const canHash = () => !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  const keyFor = (sid, phone) => A.editKeyFor(id, sid, phone);
  const phoneOf = (answers) => { const q = A.qOf(F, "phone"); return q ? (answers || {})[q.id] : ""; };

  function showForm() {
    const mine = !E && canEdit() && recall();
    box.innerHTML = (DB.mode === "demo" ? '<div class="demobar" style="border-radius:10px">데모 모드 — 제출해도 실제로 저장되지 않아요.</div>' : "") +
      (E ? '<div class="ap-editbar"><b>제출한 응답을 고치는 중이에요</b><span>학번·전화번호는 바꿀 수 없어요. 고친 뒤 [수정하기]를 눌러 주세요.</span>' +
        '<span class="ap-eb-acts"><button type="button" class="ap-findbtn sub" data-ap-find>다른 학번으로 찾기</button><button type="button" class="ap-findbtn sub" data-ap-new>새로 신청하기</button></span></div>' : "") +
      (!E && canEdit() && F.open ? '<div class="ap-editbar soft"><span>' + (mine ? "이 기기에서 이미 신청했어요." : "이미 신청했나요?") + "</span>" +
        (mine ? '<span class="ap-eb-acts"><a href="' + esc(editUrl(mine)) + '">내 응답 고치기 →</a><button type="button" class="ap-findbtn sub" data-ap-find>다른 학번으로 찾기</button></span>' : '<button type="button" class="ap-findbtn" data-ap-find>내 응답 고치기 →</button>') + "</div>" : "") +
      A.formHTML(F, { count: E ? null : count });
    const form = box.querySelector("form");
    if (!form) return;
    form.addEventListener("submit", submit);
    if (E) {
      A.fillAnswers(F, form, E.answers);
      // 학번·전화번호는 내 응답을 찾는 열쇠라서 못 바꿈
      ["sid", "phone"].forEach((t) => { const q = A.qOf(F, t); if (!q) return; const el = form.querySelector('[name="a_' + q.id + '"]'); if (el) { if (t === "sid") el.value = E.sid; el.readOnly = true; el.classList.add("ap-locked"); } });
      // 선착순: 참여 여부를 바꾸면 순번이 꼬이니 고정
      const aq = A.attendQ(F);
      if (F.mode === "first" && aq) form.querySelectorAll('[name="a_' + aq.id + '"]').forEach((x) => (x.disabled = true));
      const b = form.querySelector('[type="submit"]'); if (b) b.textContent = "수정하기";
    }
  }
  async function submit(e) {
    e.preventDefault();
    const form = e.target, err = form.querySelector(".ap-err"), btn = form.querySelector('[type="submit"]');
    // 고정된 칸(선착순 참여 여부)은 잠깐 풀어서 값 읽기
    const locked = Array.from(form.querySelectorAll("input:disabled")); locked.forEach((x) => (x.disabled = false));
    const r = A.readAnswers(F, form);
    locked.forEach((x) => (x.disabled = true));
    const say = (m) => { err.hidden = false; err.textContent = m; err.scrollIntoView({ block: "center", behavior: "smooth" }); };
    if (r.err) return say(r.err);
    err.hidden = true; btn.disabled = true; btn.textContent = E ? "고치는 중…" : "제출하는 중…";
    if (E) {
      const patch = { name: r.name, depositName: A.depositName(E.sid, r.name), answers: r.answers };
      try {
        await DB.editResponse(id, editKey, E.sid, patch);
        E = Object.assign({}, E, patch);
        box.innerHTML = A.doneHTML(F, Object.assign({ sid: E.sid }, patch), { edited: true, editHint: true });
        window.scrollTo(0, 0);
      } catch (er) {
        btn.disabled = false; btn.textContent = "수정하기";
        const m = String((er && (er.code || er.message)) || er);
        if (/permission|insufficient/i.test(m)) say("지금은 고칠 수 없어요. 신청이 마감됐을 수 있어요. 학생회에 말해 주세요.");
        else if (/unavailable|network|offline/i.test(m)) say("인터넷 연결을 확인하고 다시 눌러 주세요.");
        else say("고치지 못했어요. 잠시 뒤 다시 시도해 주세요. (" + m + ")");
      }
      return;
    }
    const data = { sid: r.sid, name: r.name, depositName: A.depositName(r.sid, r.name), answers: r.answers, paid: false, attended: false };
    const key = canEdit() ? await keyFor(r.sid, phoneOf(r.answers)) : "";
    if (key) data.editKey = key;
    const first = F.mode === "first" && A.isGoing(F, data);
    try {
      const slotId = await DB.submitResponse(id, r.sid, data, first);
      if (key) remember(key);
      let rank = 0;
      // 선착순: 내가 몇 번째인지 서버에 물어봄 (안 되면 그냥 넘어감)
      if (first && slotId) { try { rank = await DB.slotRank(id, slotId); } catch (e) { console.warn(e); } }
      const shown = Object.assign({ at: Date.now(), rank: rank }, data); delete shown.editKey;
      box.innerHTML = A.doneHTML(F, shown, key ? { editHint: true } : {});
      window.scrollTo(0, 0);
    } catch (er) {
      btn.disabled = false; btn.textContent = "제출하기";
      const m = String((er && (er.code || er.message)) || er);
      if (/permission|insufficient/i.test(m)) say("이미 이 학번으로 신청했거나, 방금 신청이 마감됐어요." + (canEdit() ? " 이미 신청했다면 맨 위 [내 응답 고치기]에서 학번·전화번호로 고칠 수 있어요." : " 잘못 신청했다면 학생회에 말해 주세요."));
      else if (/unavailable|network|offline/i.test(m)) say("인터넷 연결을 확인하고 다시 눌러 주세요.");
      else say("제출하지 못했어요. 잠시 뒤 다시 시도해 주세요. (" + m + ")");
    }
  }
  // [내 응답 고치기] → 학번·전화번호로 찾기
  function showFind(msg) {
    box.innerHTML = '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div><div class="ap-ev"><h1>' + esc(F.title || "행사 신청") + "</h1></div>" +
      '<form class="ap-form ap-find" novalidate><div class="ap-ql" style="font-size:17px">내 응답 찾기</div><p class="ap-note" style="margin:-4px 0 4px">신청할 때 넣은 학번과 전화번호를 똑같이 넣어 주세요.</p>' +
      '<div class="ap-q"><label class="ap-ql" for="fSid">학번</label><input id="fSid" type="text" inputmode="numeric" maxlength="10" placeholder="' + esc(A.sidExample()) + '" autocomplete="off"></div>' +
      '<div class="ap-q"><label class="ap-ql" for="fPh">전화번호</label><input id="fPh" type="tel" inputmode="numeric" maxlength="13" placeholder="010-1234-5678" autocomplete="off"></div>' +
      '<p class="ap-err"' + (msg ? "" : " hidden") + ">" + esc(msg || "") + '</p><button type="submit" class="ap-submit">찾기</button>' +
      '<button type="button" class="ap-link" data-ap-back2>처음 화면으로</button></form>';
    box.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const sid = box.querySelector("#fSid").value.replace(/\D/g, ""), ph = box.querySelector("#fPh").value, btn = e.target.querySelector(".ap-submit");
      if (sid.length !== 10) return showFind("학번 10자리를 넣어 주세요.");
      if (ph.replace(/\D/g, "").length < 10) return showFind("전화번호를 확인해 주세요.");
      btn.disabled = true; btn.textContent = "찾는 중…";
      const key = await keyFor(sid, ph);
      let found = null;
      try { found = await DB.get("forms/" + id + "/edits", key); } catch (er) { found = null; }
      if (!found) return showFind("찾지 못했어요. 신청할 때와 같은 학번·전화번호인지 확인해 주세요. 그래도 안 되면 학생회에 말해 주세요.");
      E = found; editKey = key; remember(key);
      try { history.replaceState(null, "", editUrl(key)); } catch (er) { /* 무시 */ }
      showForm(); window.scrollTo(0, 0);
    });
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-ap-find]")) { E = null; editKey = ""; clearUrlKey(); showFind(); window.scrollTo(0, 0); return; }
    if (e.target.closest("[data-ap-new]")) { E = null; editKey = ""; clearUrlKey(); forget(); showForm(); window.scrollTo(0, 0); return; }
    if (e.target.closest("[data-ap-back2]")) { showForm(); return; }
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const v = b.dataset.copy, label = b.dataset.copyLabel;
    Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(v)).then(() => toast(label ? label + "를 복사했어요" : "복사했어요: " + v)).catch(() => toast("길게 눌러서 복사해 주세요"));
  });

  (async function boot() {
    try { await DB.init(); } catch (e) { return fail("페이지를 불러오지 못했어요", "인터넷 연결을 확인하고 새로고침해 주세요."); }
    const qp = new URLSearchParams(location.search);
    id = qp.get("f") || (DB.mode === "demo" ? "p2" : "");
    editKey = qp.get("e") || "";
    if (!id) return fail("주소가 잘못됐어요", "학생회가 보낸 링크를 다시 눌러 주세요.");
    try { F = await DB.get("forms", id); } catch (e) { F = null; }
    if (!F) return fail("없는 신청 페이지예요", "학생회가 보낸 링크를 다시 확인해 주세요.");
    document.title = (F.title || "행사 신청") + " · 생명과학부 학생회";
    if (editKey) {
      if (!F.open) return fail("지금은 고칠 수 없어요", "신청이 마감돼서 응답을 고칠 수 없어요. 고칠 게 있으면 학생회에 말해 주세요.");
      if (!canEdit()) return fail("이 신청은 고칠 수 없어요", "고칠 게 있으면 학생회에 말해 주세요.");
      try { E = await DB.get("forms/" + id + "/edits", editKey); } catch (e) { E = null; }
      if (!E) { forget(); clearUrlKey(); editKey = ""; showFind("저장된 응답을 찾지 못했어요. 학번·전화번호로 다시 찾아 주세요."); return; }
      remember(editKey);
    }
    // 선착순이면 지금까지 몇 명 신청했는지 보여 줌
    if (!E && F.mode === "first" && F.open) { try { count = await DB.countSlots(id); } catch (e) { count = null; } }
    showForm();
  })();
})();
