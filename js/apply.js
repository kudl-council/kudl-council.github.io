/* 행사 신청 페이지 (apply.html) — 수정할 필요 없음 */
(function () {
  const A = window.APPLY, DB = window.DB, esc = A.esc;
  const box = document.getElementById("ap");
  let toastTimer;
  function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.className = "show"; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), 2400); }
  const fail = (t, m) => { box.innerHTML = '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div><div class="ap-closed"><b>' + esc(t) + "</b><span>" + esc(m) + "</span></div>"; };

  let F = null, id = "", count = null, E = null, editKey = "", U = null, mode = "key";
  // 제출 시작 시각 (예: 선착순 6시 정각). 미리 들어와 답을 다 써 두고, 시각이 되면 [제출하기]가 켜짐
  // 내 폰 시계가 틀릴 수 있어서 서버 시계와의 차이(skew)를 한 번 재 둠. 그래도 최종 판정은 서버(보안 규칙)가 함
  let skew = 0, tick = null;
  const now = () => Date.now() + skew;
  const startMs = () => Number(F && F.startMs) || 0;
  const notYet = () => !E && startMs() > now();
  async function syncClock() {
    try {
      const t0 = Date.now();
      const res = await fetch(location.pathname + "?t=" + t0, { method: "HEAD", cache: "no-store" });
      const t1 = Date.now(), d = Date.parse(res.headers.get("date") || "");
      if (d) skew = d + 500 - (t0 + t1) / 2; // Date 머리말은 초 단위라 0.5초 보정
      if (Math.abs(skew) < 300) skew = 0;
    } catch (e) { skew = 0; }
  }
  const hhmm = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, "0"); return (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + p(d.getHours()) + ":" + p(d.getMinutes()) + (d.getSeconds() ? ":" + p(d.getSeconds()) : ""); };
  function left(ms) {
    const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + "시간 " : "") + (h || m ? m + "분 " : "") + x + "초";
  }
  function armStart(form) {
    clearInterval(tick);
    const b = form.querySelector('[type="submit"]'), note = form.querySelector(".ap-startnote");
    if (!b || !notYet()) { if (note) note.remove(); return; }
    b.disabled = true; b.classList.add("ap-wait");
    const run = () => {
      const ms = startMs() - now();
      if (ms <= 0) { clearInterval(tick); b.disabled = false; b.classList.remove("ap-wait"); b.textContent = "제출하기"; if (note) note.innerHTML = "<b>지금 제출할 수 있어요!</b>"; return; }
      b.textContent = left(ms) + " 뒤에 제출할 수 있어요";
    };
    run(); tick = setInterval(run, 200);
  }
  // 구글 로그인 양식: 로그인한 본인이 학번·이름·전화번호까지 고칠 수 있음 (학번+전화번호 찾기는 안 씀)
  const LOGIN = () => !!(F && F.login === true);
  const canEdit = () => F && F.allowEdit !== false && !LOGIN() && canHash();
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
      (LOGIN() && U ? '<div class="ap-editbar soft ap-who"><span><b>' + esc(U.name || U.email) + "</b>" + (U.name && U.email ? ' <small>' + esc(U.email) + "</small>" : "") + " 계정으로 " + (E ? "낸 응답이에요" : "신청해요") + '</span><button type="button" class="ap-findbtn sub" data-ap-logout>다른 계정으로</button></div>' : "") +
      (E && mode === "owner" ? '<div class="ap-editbar"><b>이미 신청했어요 · 내 응답을 고칠 수 있어요</b><span>' + (F.allowEdit === false ? "이 신청은 고칠 수 없어요. 고칠 게 있으면 학생회에 말해 주세요." : F.mode === "first" ? "학번·이름·전화번호와 다른 답을 고쳐도 선착순 순서는 그대로예요. 참석 여부는 바꿀 수 없어요 (취소하려면 학생회에 말해 주세요)." : "학번·이름·전화번호도 고칠 수 있어요. 고친 뒤 [수정하기]를 눌러 주세요.") + "</span></div>" : "") +
      (E && F.mode === "first" ? '<div class="ap-myrank">' + (E.rank ? A.rankHTML(F, E.rank) : E.slotId ? '<div class="ap-rank"><span>순서를 불러오지 못했어요. 새로고침해 보세요.</span></div>' : '<div class="ap-rank"><b>참석 안 함</b><span>으로 냈어요</span></div>') + "</div>" : "") +
      (E && mode === "key" ? '<div class="ap-editbar"><b>제출한 응답을 고치는 중이에요</b><span>' + (F.mode === "first" ? "다른 답을 고쳐도 선착순 순서는 그대로예요. 학번·전화번호·참석 여부는 바꿀 수 없어요 (취소하려면 학생회에 말해 주세요)." : "학번·전화번호는 바꿀 수 없어요. 고친 뒤 [수정하기]를 눌러 주세요.") + "</span>" +
        '<span class="ap-eb-acts"><button type="button" class="ap-findbtn sub" data-ap-find>다른 학번으로 찾기</button><button type="button" class="ap-findbtn sub" data-ap-new>새로 신청하기</button></span></div>' : "") +
      (!E && canEdit() && F.open ? '<div class="ap-editbar soft"><span>' + (mine ? "이 기기에서 이미 신청했어요." : "이미 신청했나요?") + "</span>" +
        (mine ? '<span class="ap-eb-acts"><a href="' + esc(editUrl(mine)) + '">' + (F.mode === "first" ? "내 순서 확인 · 고치기 →" : "내 응답 고치기 →") + '</a><button type="button" class="ap-findbtn sub" data-ap-find>다른 학번으로 찾기</button></span>' : '<button type="button" class="ap-findbtn" data-ap-find>' + (F.mode === "first" ? "내 순서 확인 · 고치기 →" : "내 응답 고치기 →") + "</button>") + "</div>" : "") +
      A.formHTML(F, { count: E ? null : count });
    const form = box.querySelector("form");
    if (!form) return;
    form.addEventListener("submit", submit);
    if (notYet()) {
      const b = form.querySelector('[type="submit"]');
      if (b) b.insertAdjacentHTML("beforebegin", '<div class="ap-startnote"><b>' + esc(hhmm(startMs())) + "</b>부터 제출할 수 있어요. 미리 다 써 두고, 시간이 되면 바로 [제출하기]를 눌러 주세요.</div>");
      armStart(form);
    }
    if (E && mode === "owner") {
      A.fillAnswers(F, form, E.answers);
      const sq = A.qOf(F, "sid"); if (sq) { const el = form.querySelector('[name="a_' + sq.id + '"]'); if (el) el.value = E.sid || E.id; }
      const aq = A.attendQ(F);
      if (F.mode === "first" && aq) form.querySelectorAll('[name="a_' + aq.id + '"]').forEach((x) => (x.disabled = true));
      const b = form.querySelector('[type="submit"]');
      if (b) { b.textContent = "수정하기"; if (F.allowEdit === false) { b.disabled = true; form.querySelectorAll("input, textarea").forEach((x) => (x.disabled = true)); } }
    } else if (E) {
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
    if (E && mode === "owner") {
      const patch = { sid: r.sid, name: r.name, depositName: A.depositName(r.sid, r.name), answers: r.answers };
      try {
        await DB.ownerEdit(id, E.id, patch);
        E = Object.assign({}, E, patch);
        box.innerHTML = A.doneHTML(F, patch, { edited: true, loginHint: true });
        window.scrollTo(0, 0);
      } catch (er) {
        btn.disabled = false; btn.textContent = "수정하기";
        const m = String((er && (er.code || er.message)) || er);
        say(/permission|insufficient/i.test(m) ? "지금은 고칠 수 없어요. 신청이 마감됐을 수 있어요. 학생회에 말해 주세요." : "고치지 못했어요. 잠시 뒤 다시 시도해 주세요. (" + m + ")");
      }
      return;
    }
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
    if (LOGIN()) { if (!U) return showLogin(); data.ownerUid = U.uid; }
    const first = F.mode === "first" && A.isGoing(F, data);
    try {
      const slotId = await DB.submitResponse(id, r.sid, data, first);
      if (key) remember(key);
      let rank = 0;
      // 선착순: 내가 몇 번째인지 서버에 물어봄 (안 되면 그냥 넘어감)
      if (first && slotId) { try { rank = await DB.slotRank(id, slotId); } catch (e) { console.warn(e); } }
      const shown = Object.assign({ at: Date.now(), rank: rank }, data); delete shown.editKey;
      box.innerHTML = A.doneHTML(F, shown, key ? { editHint: true } : LOGIN() ? { loginHint: F.allowEdit !== false } : {});
      window.scrollTo(0, 0);
    } catch (er) {
      btn.disabled = false; btn.textContent = "제출하기";
      const m = String((er && (er.code || er.message)) || er);
      if (/permission|insufficient/i.test(m) && startMs() && now() < startMs() + 5000) { say("아직 시작 전이었을 수 있어요(폰 시계 차이). 1~2초 뒤 다시 눌러 주세요. 이미 이 학번으로 냈다면 맨 위 [내 순서 확인]을 눌러 주세요."); return; }
      if (/permission|insufficient/i.test(m) && LOGIN()) say("이 학번으로 이미 다른 계정에서 신청했거나, 방금 신청이 마감됐어요. 학번을 확인하고, 그래도 안 되면 학생회에 말해 주세요.");
      else if (/permission|insufficient/i.test(m)) say("이미 이 학번으로 신청했거나, 방금 신청이 마감됐어요." + (canEdit() ? " 이미 신청했다면 맨 위 [내 응답 고치기]에서 학번·전화번호로 고칠 수 있어요." : " 잘못 신청했다면 학생회에 말해 주세요."));
      else if (/unavailable|network|offline/i.test(m)) say("인터넷 연결을 확인하고 다시 눌러 주세요.");
      else say("제출하지 못했어요. 잠시 뒤 다시 시도해 주세요. (" + m + ")");
    }
  }
  // ---------- 구글 로그인 양식 ----------
  // 카카오톡·인스타 등 앱 안 브라우저에서는 구글 로그인이 막혀 있음 → 바깥 브라우저로
  const UA = navigator.userAgent || "";
  const IN_KAKAO = /KAKAOTALK/i.test(UA);
  // 아이폰·아이패드(모든 브라우저)와 맥 사파리: 구글 원탭이 '계속하기'만 반복되는 문제가 있어 원탭을 안 쓰고 기본 로그인 창만 씀
  const APPLE_WEBKIT = /iP(hone|ad|od)/i.test(UA) || (/Macintosh/i.test(UA) && navigator.maxTouchPoints > 1) || (/Safari/i.test(UA) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(UA));
  const IN_APP = IN_KAKAO || /Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|everytime|DaumApps|; wv\)/i.test(UA);
  function showLogin(msg) {
    const head = '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div><div class="ap-ev"><h1>' + esc(F.title || "행사 신청") + "</h1>" + (F.desc ? "<p>" + esc(F.desc) + "</p>" : "") + "</div>";
    if (!F.open) { box.innerHTML = A.formHTML(F, {}); return; }
    if (IN_APP) {
      // 카카오톡: 처음 한 번은 자동으로 바깥 브라우저(사파리·크롬)로 넘김
      if (IN_KAKAO && !showLogin.moved) { showLogin.moved = true; setTimeout(() => { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href); }, 400); }
      box.innerHTML = head + '<div class="ap-login"><b>크롬이나 사파리에서 열어 주세요</b><span>이 신청은 구글 로그인이 필요한데, ' + (IN_KAKAO ? "카카오톡" : "이 앱") + " 안에서는 구글 로그인이 막혀 있어요.</span>" +
        (IN_KAKAO ? '<a class="ap-submit" href="kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href) + '">다른 브라우저로 열기</a>' : "") +
        '<div class="ap-copy"><span class="ap-url">' + esc(location.href) + '</span><button type="button" data-copy="' + esc(location.href) + '" data-copy-label="링크">복사</button></div>' +
        '<span class="ap-hint">' + (IN_KAKAO ? "버튼이 안 되면 " : "") + "오른쪽 위 ⋮ 또는 공유 버튼 → ‘다른 브라우저로 열기’ / ‘Safari로 열기’를 누르거나, 링크를 복사해 크롬·사파리에 붙여 넣어 주세요.</span></div>";
      return;
    }
    box.innerHTML = head + '<div class="ap-login"><b>구글 계정으로 로그인하고 신청해요</b><span>계정 하나당 한 번 신청할 수 있고, 나중에 같은 계정으로 들어오면 학번·이름·전화번호까지 고칠 수 있어요.</span>' +
      (msg ? '<p class="ap-err">' + esc(msg) + "</p>" : "") +
      '<div id="gsiBtn" class="ap-gsi"></div>' +
      '<button type="button" class="ap-gbtn" data-ap-login><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>구글로 로그인하고 신청하기</button></div>';
  }
  // 구글 원탭: 이 브라우저에 로그인된 구글 계정으로 "○○(으)로 계속" 버튼·자동 로그인 (설정에 클라이언트 ID가 있을 때만)
  let gsiReady = null;
  function oneTap() {
    const cid = (window.SITE_CONFIG || {}).googleClientId;
    if (!cid || DB.mode !== "firebase" || APPLE_WEBKIT) return;
    if (!gsiReady) gsiReady = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    gsiReady.then(() => {
      const g = window.google && google.accounts && google.accounts.id; if (!g) return;
      if (!oneTap.init) {
        g.initialize({ client_id: cid, auto_select: true, itp_support: true, use_fedcm_for_prompt: true, cancel_on_tap_outside: false, context: "signin",
          callback: (r) => { DB.signInWithIdToken(r.credential).catch((er) => showLogin("로그인하지 못했어요. 아래 버튼을 눌러 주세요. (" + ((er && (er.code || er.message)) || er) + ")")); } });
        oneTap.init = true;
      }
      const el = document.getElementById("gsiBtn");
      if (el) {
        g.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: Math.min(360, el.clientWidth || 320), locale: "ko" });
        const alt = box.querySelector("[data-ap-login]"); if (alt) { alt.classList.add("ap-gbtn-alt"); alt.lastChild.textContent = "위 버튼이 안 되면 여기를 눌러 주세요"; }
      }
      g.prompt();
    }).catch(() => { /* 원탭을 못 불러오면 그냥 기본 버튼 */ });
  }
  async function afterLogin() {
    try { window.google && google.accounts && google.accounts.id.cancel(); } catch (e) { /* 무시 */ }
    E = null; mode = "key";
    let mine = null;
    try { mine = await DB.getMine(id, U.uid); } catch (e) { console.warn(e); }
    if (mine) { E = mine; mode = "owner"; await loadRank(); }
    if (!E && F.mode === "first" && F.open) { try { count = await DB.countSlots(id); } catch (e) { count = null; } }
    showForm(); window.scrollTo(0, 0);
  }
  // 선착순: 지금 내 순서 (앞사람이 빠지면 자동으로 당겨짐)
  async function loadRank() {
    if (!E || F.mode !== "first" || !E.slotId) return;
    try { E.rank = await DB.slotRank(id, E.slotId); } catch (e) { E.rank = 0; }
  }
  // [내 응답 고치기] → 학번·전화번호로 찾기
  function showFind(msg) {
    box.innerHTML = '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div><div class="ap-ev"><h1>' + esc(F.title || "행사 신청") + "</h1></div>" +
      '<form class="ap-form ap-find" novalidate><div class="ap-ql" style="font-size:17px">내 응답 찾기</div><p class="ap-note" style="margin:-4px 0 4px">신청할 때 넣은 학번과 전화번호를 똑같이 넣어 주세요.</p>' +
      (F.mode === "first" ? '<p class="ap-note" style="margin:-4px 0 4px">찾으면 지금 내 선착순 순서(확정·대기)가 보여요.</p>' : "") +
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
      E = found; editKey = key; remember(key); await loadRank();
      try { history.replaceState(null, "", editUrl(key)); } catch (er) { /* 무시 */ }
      showForm(); window.scrollTo(0, 0);
    });
  }
  document.addEventListener("click", async function (e) {
    if (e.target.closest("[data-ap-login]")) {
      const b = e.target.closest("[data-ap-login]"); b.disabled = true;
      try { await DB.signIn(true, APPLE_WEBKIT); } catch (er) {
        b.disabled = false;
        const c = String((er && (er.code || er.message)) || er);
        showLogin(/popup-blocked/.test(c) ? "로그인 창이 막혔어요. 버튼을 한 번 더 눌러 주세요. (계속 막히면 설정 → Safari → ‘팝업 차단’을 잠깐 꺼 주세요)" : "로그인하지 못했어요. 다시 눌러 주세요. (" + c + ")");
      }
      return;
    }
    if (e.target.closest("[data-ap-logout]")) { try { await DB.signOut(); } catch (er) { /* 무시 */ } U = null; E = null; showLogin(); return; }
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
    if (startMs() && startMs() > Date.now() - 3600000) await syncClock();
    if (LOGIN()) {
      // 로그인 상태가 바뀔 때마다 (팝업 로그인 · 다른 계정) 다시 그림
      let first = true;
      DB.onAuth(function (u) {
        U = u;
        if (!U) { showLogin(); if (!IN_APP && F.open) oneTap(); }
        else afterLogin();
        first = false;
      });
      return;
    }
    if (editKey) {
      if (!F.open) return fail("지금은 고칠 수 없어요", "신청이 마감돼서 응답을 고칠 수 없어요. 고칠 게 있으면 학생회에 말해 주세요.");
      if (!canEdit()) return fail("이 신청은 고칠 수 없어요", "고칠 게 있으면 학생회에 말해 주세요.");
      try { E = await DB.get("forms/" + id + "/edits", editKey); } catch (e) { E = null; }
      if (!E) { forget(); clearUrlKey(); editKey = ""; showFind("저장된 응답을 찾지 못했어요. 학번·전화번호로 다시 찾아 주세요."); return; }
      remember(editKey); await loadRank();
    }
    // 선착순이면 지금까지 몇 명 신청했는지 보여 줌
    if (!E && F.mode === "first" && F.open) { try { count = await DB.countSlots(id); } catch (e) { count = null; } }
    showForm();
  })();
})();
