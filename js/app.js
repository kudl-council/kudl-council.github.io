/* ============================================================
   학생회 사이트 본체
   ※ 국 이름, 직책, 기수, 회의록 폴더 주소 등은 이 파일이 아니라
     사이트의 [관리] → [사이트 설정] 화면에서 바꾸세요.
   ============================================================ */
(function () {
  "use strict";
  const DB = window.DB;
  const CFG = window.SITE_CONFIG || {};
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");

  const DEFAULTS = {
    generation: "제29대",
    councilName: "윤슬",
    depts: ["회장단", "내무국", "소통국", "홍보국", "재무국", "대외협력국"],
    execPositions: ["회장", "부회장"],   // 회장단(국 목록 맨 위) 직책
    positions: ["국장", "국원"],         // 그 밖의 국 직책
    minuteTypes: ["전체회의", "집행부회의", "국회의", "기타"],
    minutesFolderUrl: "",
  };
  const GRADES = ["1학년", "2학년"];
  const STATUSES = ["기획중", "예정", "완료", "취소"];
  // 예전 상태 이름 '진행중'은 '예정'으로 보여줌 (수정해서 저장하면 '예정'으로 바뀜)
  const fixStatus = (list) => { (list || []).forEach((p) => { if (p.status === "진행중") p.status = "예정"; }); return list; };
  const PALETTE = ["#9b1c31", "#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c", "#475569"];
  const NAV = [
    ["home", "홈"], ["contacts", "비상연락망"], ["calendar", "업무 캘린더"], ["minutes", "회의록"],
    ["projects", "사업 기획안"], ["archive", "사업 아카이브"], ["talk", "소통방"], ["admin", "관리"],
  ];

  const navKey = (r) => (r === "messages" ? "talk" : r);   // 선배들의 한마디는 소통방 탭 안에 있음
  const S = { authUser: null, me: null, settings: Object.assign({}, DEFAULTS), cache: {}, route: "home",
    calMonth: null, calFilter: "", q: {}, archiveDept: "", projDept: "", minType: "" };

  /* ---------- 작은 도구들 ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
  const z = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  const today = () => ymd(new Date());
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  function fmtDate(s, withYear) {
    if (!s) return "";
    const p = s.split("-").map(Number);
    if (p.length < 3 || !p[0]) return esc(s);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return (withYear ? p[0] + "년 " : "") + p[1] + "월 " + p[2] + "일 (" + DOW[d.getDay()] + ")";
  }
  function dday(s) {
    const a = new Date(today() + "T00:00:00"), b = new Date(s + "T00:00:00");
    const n = Math.round((b - a) / 86400000);
    return n === 0 ? "D-day" : n > 0 ? "D-" + n : "D+" + -n;
  }
  // 사업 날짜 표시: "10월 20일 (화)" 또는 "11월 6일 (금) ~ 11월 7일 (토) · 1박 2일"
  function eventDateText(p) {
    if (!p.startDate) return "";
    if (!p.endDate || p.endDate <= p.startDate) return fmtDate(p.startDate);
    const n = Math.round((new Date(p.endDate + "T00:00:00") - new Date(p.startDate + "T00:00:00")) / 86400000);
    return fmtDate(p.startDate) + " ~ " + fmtDate(p.endDate) + " · " + (n <= 4 ? n + "박 " + (n + 1) + "일" : (n + 1) + "일간");
  }
  function ago(iso) {
    if (!iso) return "";
    const d = new Date(iso), sec = (Date.now() - d) / 1000;
    if (sec < 60) return "방금";
    if (sec < 3600) return Math.floor(sec / 60) + "분 전";
    if (sec < 86400) return Math.floor(sec / 3600) + "시간 전";
    if (sec < 86400 * 7) return Math.floor(sec / 86400) + "일 전";
    return fmtDate(ymd(d));
  }
  function normPhone(p) {
    const d = String(p || "").replace(/\D/g, "");
    if (d.length === 11) return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
    if (d.length === 10) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
    return String(p || "").trim();
  }
  function deptColor(dept) {
    const i = (S.settings.depts || []).indexOf(dept);
    return i < 0 ? "#64748b" : PALETTE[i % PALETTE.length];
  }
  const deptTag = (d) => d ? '<span class="tag" style="--c:' + deptColor(d) + '">' + esc(d) + "</span>" : "";
  // 국 목록 맨 위(기본: 회장단)는 회장·부회장, 나머지 국은 국장·국원
  const execDept = () => (S.settings.depts || [])[0] || "회장단";
  const execPositions = () => S.settings.execPositions || DEFAULTS.execPositions;
  const deptPositions = () => (S.settings.positions || DEFAULTS.positions).filter((x) => execPositions().indexOf(x) < 0);
  const positionsFor = (dept) => (dept === execDept() ? execPositions() : deptPositions());
  function posRank(p) { const i = execPositions().concat(deptPositions()).indexOf(p); return i < 0 ? 99 : i; }
  // 폼에서 국을 바꾸면 직책 목록도 그 국에 맞게 바뀜
  function bindDeptPosition(root) {
    const d = root.querySelector('select[name="dept"]'), p = root.querySelector('select[name="position"]');
    if (!d || !p) return;
    const fill = function () {
      const opts = d.value ? positionsFor(d.value) : [], cur = p.value;
      p.innerHTML = (opts.indexOf(cur) < 0 ? '<option value="" disabled selected>' + (d.value ? "선택하세요" : "국서를 먼저 선택하세요") + "</option>" : "") +
        opts.map((o) => '<option value="' + esc(o) + '"' + (o === cur ? " selected" : "") + ">" + esc(o) + "</option>").join("");
    };
    fill();
    d.addEventListener("change", fill);
  }
  function deptRank(d) { const i = (S.settings.depts || []).indexOf(d); return i < 0 ? 99 : i; }

  let toastTimer;
  function toast(msg, err) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "show" + (err ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ""), 2600);
  }
  function errMsg(e) {
    const m = (e && (e.code || e.message)) || String(e);
    if (/permission|insufficient/i.test(m)) return "권한이 없습니다. (승인 상태나 회장단 권한을 확인해 주세요)";
    if (/unavailable|network|offline/i.test(m)) return "인터넷 연결을 확인해 주세요.";
    return "문제가 생겼어요: " + (e.message || m);
  }

  /* ---------- 권한 ---------- */
  const isOwner = () => !!(S.authUser && CFG.ownerEmail && S.authUser.email === String(CFG.ownerEmail).trim().toLowerCase());
  // 임기를 마친 OB: 함께했던 학생회 기록만 볼 수 있음 (탈퇴한 사람은 해당 없음)
  const isAlumni = () => !!(S.me && S.me.status === "inactive" && S.me.inactiveReason === "임기 종료");
  const isApproved = () => isOwner() || !!(S.me && S.me.status === "approved");
  const isAdmin = () => isOwner() || !!(S.me && S.me.status === "approved" && S.me.isAdmin);
  /* ---------- 학생회(기수) ---------- */
  const councilLabel = (gen, name) => [gen, name].filter(Boolean).join(" ");
  const curCouncil = () => councilLabel(S.settings.generation, S.settings.councilName);
  // 지금 학생회의 사업인지: 기수로 판단 (기수 기록이 없는 옛 자료는 올해 것만)
  const isCurrent = (p) => (p.generation ? p.generation === S.settings.generation : Number(p.year) === S.settings.currentYear);
  const genNum = (g) => { const m = String(g || "").match(/\d+/); return m ? Number(m[0]) : 0; };
  // 활동 이력: 지금 학생회에서의 국서·직책을 회원 기록에 남김 (같은 기수는 덮어씀)
  function withHistory(u) {
    const h = (u.history || []).filter((x) => x.generation !== S.settings.generation);
    h.push({ generation: S.settings.generation, councilName: S.settings.councilName || "", dept: u.dept || "", position: u.position || "" });
    return h;
  }  // 회원 문서에 넣을 이력 묶음: history(표시용) + generations(보안 규칙에서 OB 회의록 권한 확인용)
  function historyPatch(u) {
    const h = withHistory(u);
    return { history: h, generations: h.map((x) => x.generation) };
  }

  const councilDocId = (gen) => String(gen || "").replace(/[\/\s]+/g, "-") || "unknown";
  const canDelete = (item) => isAdmin() || (item && item.createdBy === (S.authUser && S.authUser.uid));

  /* ---------- 데이터 ---------- */
  // 회의록·한마디·자유게시판은 "지금 학생회 + 바로 이전 학생회" 것만 불러옴 (보안 규칙도 같음)
  const RECENT_ONLY = ["minutes", "messages", "talk", "talkComments"];
  // 볼 수 있는 학생회: 지금 학생회 + 내가 예전에 속했던 학생회 (보안 규칙도 같음)
  //   공용 계정은 개인 이력이 없으니 지금 + 바로 이전 학생회를 보여줌
  const recentGens = () => {
    const g = [S.settings.generation].concat(S.me ? (S.me.generations || []) : [S.settings.prevGeneration]);
    return g.filter((x, i) => x && g.indexOf(x) === i);
  };
  const isSenior = () => !!(S.me && S.me.status === "approved" && S.me.grade === "2학년");
  async function col(name) {
    if (!S.cache[name]) {
      if (RECENT_ONLY.indexOf(name) >= 0) {
        if (name === "minutes" && isAdmin()) await stampOldMinutes();
        const gens = recentGens();
        if (isAdmin()) {
          // 회장단은 전체를 읽을 수 있으니 한 번에 받아서 걸러냄
          S.cache[name] = (await DB.list(name)).filter((x) => gens.indexOf(x.generation || S.settings.generation) >= 0);
        } else if (name === "messages") {
          // 공개된 선배들의 한마디: 내가 속했던 지난 학생회 것만 (지금 학생회 것은 아직 봉인 중)
          const past = ((S.me && S.me.generations) || []).filter((g) => g !== S.settings.generation);
          S.cache[name] = past.length ? await DB.queryIn(name, "generation", past) : [];
        } else S.cache[name] = await DB.queryIn(name, "generation", gens);
      } else S.cache[name] = await DB.list(name);
      if (name === "projects") fixStatus(S.cache[name]);
    }
    return S.cache[name];
  }
  // 예전 버전에서 학생회 표시 없이 등록된 회의록에 지금 학생회를 표시 (회장단이 회의록을 열 때 한 번)
  let stamped = false;
  async function stampOldMinutes() {
    if (stamped) return;
    stamped = true;
    try {
      for (const m of (await DB.list("minutes")).filter((x) => !x.generation))
        await DB.update("minutes", m.id, { generation: S.settings.generation, councilName: S.settings.councilName || "" });
    } catch (e) { console.warn(e); }
  }
  const dirty = (name) => { delete S.cache[name]; };
  // 사이트 설정 저장용 (화면에서만 쓰는 값은 빼고 기존 설정에 덧붙임)
  function settingsDoc(extra) {
    const d = Object.assign({}, S.settings, extra || {});
    delete d.id; delete d.currentYear;
    return d;
  }
  async function loadSettings() {
    try {
      const s = await DB.get("settings", "site");
      S.settings = Object.assign({}, DEFAULTS, s || {});
      // 사이트 설정이 한 번도 저장되지 않았으면 회장단 접속 시 저장 (보안 규칙이 '지금 학생회'를 여기서 읽음)
      if ((!s || !s.generation) && isAdmin()) {
        const d = Object.assign({}, S.settings); delete d.id; delete d.currentYear;
        try { await DB.set("settings", "site", d); } catch (e) { console.warn(e); }
      }
    } catch (e) { S.settings = Object.assign({}, DEFAULTS); }
    S.settings.currentYear = new Date().getFullYear();
  }
  async function loadMe() {
    S.me = null;
    try { S.me = await DB.get("users", S.authUser.uid); } catch (e) { console.warn(e); }
    await loadSettings();
  }

  /* ---------- 폼 만들기 (모달·화면 공용) ---------- */
  /* 날짜는 YYYY.MM.DD 로 입력 (저장은 YYYY-MM-DD), 예산은 숫자만 입력하면 쉼표와 '원'이 붙음 */
  const dotDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.replace(/-/g, ".") : (iso || "");
  function isoDate(text) {
    const d = String(text || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length !== 8) return null;
    const y = +d.slice(0, 4), m = +d.slice(4, 6), dd = +d.slice(6);
    const t = new Date(y, m - 1, dd);
    if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== dd) return null;
    return d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6);
  }
  const fmtDots = (digits) => digits.slice(0, 4) + (digits.length > 4 ? "." + digits.slice(4, 6) : "") + (digits.length > 6 ? "." + digits.slice(6, 8) : "");
  const commas = (digits) => digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const CAL_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
  function dateInputHTML(attrs, value) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
    return '<span class="dwrap"><input type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="YYYY.MM.DD" data-date ' + attrs +
      ' value="' + esc(dotDate(value)) + '"><span class="dpick" title="달력에서 고르기">' + CAL_ICON +
      '<input type="date" class="dnative" tabindex="-1" aria-hidden="true" value="' + esc(iso) + '"></span></span>';
  }
  function fieldsHTML(fields, values) {
    values = values || {};
    return fields.map(function (f) {
      const v = values[f.name] != null ? values[f.name] : f.value != null ? f.value : "";
      const id = "f_" + f.name;
      const req = f.required ? " required" : "";
      const label = '<label for="' + id + '">' + esc(f.label) + (f.required ? ' <b class="req">*</b>' : "") + "</label>";
      const help = f.help ? '<small class="help">' + esc(f.help) + "</small>" : "";
      let input;
      if (f.type === "select") {
        const opts = (f.options || []).slice();
        if (v && opts.indexOf(v) < 0) opts.push(v);
        input = '<select id="' + id + '" name="' + f.name + '"' + req + ">" + (f.required ? "" : '<option value="">선택 안 함</option>') +
          (f.required && !v ? '<option value="" disabled selected>선택하세요</option>' : "") +
          opts.map((o) => '<option value="' + esc(o) + '"' + (String(o) === String(v) ? " selected" : "") + ">" + esc((f.labels && f.labels[o]) || o) + "</option>").join("") + "</select>";
      } else if (f.type === "textarea") {
        input = '<textarea id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || "") + '"' + req + ">" + esc(Array.isArray(v) ? v.join("\n") : v) + "</textarea>";
      } else if (f.type === "checkbox") {
        return '<div class="field check"><label><input type="checkbox" id="' + id + '" name="' + f.name + '"' + (v ? " checked" : "") + "> " + esc(f.label) + "</label>" + help + "</div>";
      } else if (f.type === "date") {
        input = dateInputHTML('id="' + id + '" name="' + f.name + '"' + req, v);
      } else if (f.type === "money") {
        const digits = String(v || "").replace(/\D/g, "");
        input = '<span class="mwrap"><input id="' + id + '" name="' + f.name + '" type="text" inputmode="numeric" autocomplete="off" data-money placeholder="' + esc(f.placeholder || "") + '" value="' + esc(digits ? commas(digits) : "") + '"' + req + '><span class="unit">원</span></span>';
      } else {
        input = '<input id="' + id + '" name="' + f.name + '" type="' + (f.type || "text") + '" value="' + esc(v) + '" placeholder="' + esc(f.placeholder || "") + '"' + req + (f.type === "number" ? ' step="1"' : "") + ">";
      }
      return '<div class="field' + (f.half ? " half" : "") + '">' + label + input + help + "</div>";
    }).join("");
  }
  function readFields(root, fields) {
    const out = {};
    for (const f of fields) {
      const el = root.querySelector('[name="' + f.name + '"]');
      if (!el) continue;
      let v = f.type === "checkbox" ? el.checked : el.value.trim();
      if (f.type === "number") v = v === "" ? "" : Number(v);
      if (f.type === "tel") v = normPhone(v);
      if (f.type === "date") {
        const iso = isoDate(v);
        if (iso === null) throw new Error("'" + f.label + "'을(를) YYYY.MM.DD 형식으로 넣어 주세요. (예: 2026.10.26)");
        v = iso;
      }
      if (f.type === "money") { const digits = v.replace(/\D/g, ""); v = digits ? commas(digits) + "원" : ""; }
      if (f.type === "lines") v = v;
      if (f.required && (v === "" || v == null)) throw new Error("'" + f.label + "' 항목을 입력해 주세요.");
      if (f.type === "url" && v && !safeUrl(v)) throw new Error("'" + f.label + "'에는 https:// 로 시작하는 링크를 넣어 주세요.");
      out[f.name] = v;
    }
    return out;
  }
  function closeModal() { modalRoot.innerHTML = ""; document.body.classList.remove("noscroll"); }
  function openForm(o) {
    const extra = (o.extraButtons || []).map((b, i) => '<button type="button" class="btn ' + (b.cls || "") + '" data-extra="' + i + '">' + esc(b.label) + "</button>").join("");
    modalRoot.innerHTML =
      '<div class="modal-bg"><form class="modal" novalidate>' +
      '<div class="modal-head"><h3>' + esc(o.title) + '</h3><button type="button" class="x" data-close aria-label="닫기">×</button></div>' +
      (o.intro ? '<div class="modal-intro">' + o.intro + "</div>" : "") +
      '<div class="fields">' + fieldsHTML(o.fields || [], o.values) + "</div>" + (o.after || "") +
      '<p class="form-err" hidden></p>' +
      '<div class="modal-foot"><div class="left">' + extra + '</div><button type="button" class="btn ghost" data-close>취소</button>' +
      (o.onSubmit ? '<button type="submit" class="btn primary">' + esc(o.submitLabel || "저장") + "</button>" : "") + "</div>" +
      "</form></div>";
    document.body.classList.add("noscroll");
    const form = modalRoot.querySelector("form");
    const errEl = form.querySelector(".form-err");
    modalRoot.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
    modalRoot.querySelector(".modal-bg").addEventListener("mousedown", (e) => { if (e.target.classList.contains("modal-bg")) closeModal(); });
    (o.extraButtons || []).forEach(function (b, i) {
      form.querySelector('[data-extra="' + i + '"]').addEventListener("click", async function () {
        try { await b.onClick(); } catch (e) { errEl.hidden = false; errEl.textContent = errMsg(e); }
      });
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      errEl.hidden = true;
      let vals;
      try { vals = readFields(form, o.fields || []); } catch (er) { errEl.hidden = false; errEl.textContent = er.message; return; }
      btn.disabled = true; btn.textContent = "저장 중…";
      try { await o.onSubmit(vals); closeModal(); }
      catch (er) { errEl.hidden = false; errEl.textContent = er.message && !er.code ? er.message : errMsg(er); btn.disabled = false; btn.textContent = o.submitLabel || "저장"; }
    });
    bindDeptPosition(form);
    const first = form.querySelector("input:not([type=checkbox]),select,textarea");
    if (first && window.innerWidth > 700) first.focus();
  }
  function infoModal(title, html) { openForm({ title: title, intro: html, fields: [] }); }

  /* ---------- 필드 정의 ---------- */
  const profileFields = () => [
    { name: "name", label: "이름", required: true, half: true },
    { name: "studentId", label: "학번", required: true, half: true, placeholder: "예: 2024250000" },
    { name: "grade", label: "학년", type: "select", options: GRADES, required: true, half: true, help: "학번과 상관없이 학생회에서의 학년 (1학년 = 배우는 중, 2학년 = 주로 운영)" },
    { name: "dept", label: "소속 국서", type: "select", options: S.settings.depts, required: true, half: true },
    { name: "position", label: "직책", type: "select", options: execPositions().concat(deptPositions()), required: true, half: true },
    { name: "phone", label: "전화번호", type: "tel", required: true, placeholder: "010-1234-5678", help: "승인된 학생회원에게만 비상연락망으로 보입니다." },
    { name: "obPhone", label: "임기가 끝난 뒤에도 같은 학생회였던 사람들에게 내 번호 보여주기", type: "checkbox", value: true,
      help: "OB 기록실의 멤버 명단에 쓰여요. 같은 기수였던 사람만 볼 수 있어요." },
  ];
  // projects: 연결할 수 있는 사업 목록 (지금 학생회 사업)
  const taskFields = (projects) => {
    const ps = projects || [];
    const labels = {};
    ps.forEach((p) => (labels[p.id] = p.name));
    return [
      { name: "title", label: "할 일", required: true, placeholder: "예: 개강파티 가수요조사 공지글 작성" },
      { name: "dept", label: "담당 국서", type: "select", options: S.settings.depts, required: true, half: true },
      { name: "dueDate", label: "마감일", type: "date", required: true, half: true },
      { name: "projectId", label: "관련 사업 (선택)", type: "select", options: ps.map((p) => p.id), labels: labels },
      { name: "assignee", label: "담당자", placeholder: "예: 강다은 (비워도 됨)" },
      { name: "memo", label: "메모", type: "textarea", rows: 2 },
    ];
  };
  async function linkableProjects(keepId) {
    return (await col("projects")).filter((p) => isCurrent(p) || p.id === keepId)
      .sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
  }
  async function tasksByProject() {
    const m = {};
    (await col("tasks")).forEach((t) => { if (t.projectId) (m[t.projectId] = m[t.projectId] || []).push(t); });
    Object.values(m).forEach((a) => a.sort((x, y) => (x.dueDate || "").localeCompare(y.dueDate || "") || deptRank(x.dept) - deptRank(y.dept)));
    return m;
  }
  // 회의록이 어느 학생회 것인지: 기록이 없는 옛 회의록은 지금 학생회 것으로 봄
  const minuteGen = (m) => m.generation || S.settings.generation;
  async function knownCouncils() {
    const map = {};
    map[S.settings.generation] = S.settings.councilName || "";
    (await col("projects")).concat(await col("minutes")).forEach((x) => { if (x.generation && !(x.generation in map)) map[x.generation] = x.councilName || ""; });
    return Object.keys(map).sort((a, b) => genNum(b) - genNum(a)).map((g) => ({ g: g, name: map[g] }));
  }
  const minuteFields = (councils) => [
    { name: "councilKey", label: "어느 학생회 회의록인가요?", type: "select", required: true,
      options: (councils || [{ g: S.settings.generation }]).map((c) => c.g),
      labels: Object.fromEntries((councils || [{ g: S.settings.generation, name: S.settings.councilName }]).map((c) => [c.g, councilLabel(c.g, c.name) + (c.g === S.settings.generation ? " (지금)" : "")])),
      help: "지난 학생회 회의록을 옮겨 적을 때만 바꾸세요." },
    { name: "title", label: "제목", required: true, placeholder: "예: 제13차 정기 전체회의" },
    { name: "type", label: "회의 종류", type: "select", options: S.settings.minuteTypes, required: true, half: true },
    { name: "date", label: "회의 날짜", type: "date", required: true, half: true },
    { name: "url", label: "구글 독스 링크", type: "url", required: true, placeholder: "https://docs.google.com/…", help: "구글 독스에서 [공유] → [링크 복사] 한 주소를 붙여넣으세요." },
    { name: "memo", label: "메모 (주요 결정사항 등)", type: "textarea", rows: 2 },
  ];
  const projectFields = (o) => [
    { name: "name", label: "사업 이름", required: true, placeholder: "예: 개강파티" },
  ].concat(o && o.council ? [
    { name: "generation", label: "진행한 학생회 기수", required: !!o.past, half: true, placeholder: "예: 제28대", help: "아카이브에서 학생회별로 묶이는 기준이에요." },
    { name: "councilName", label: "학생회 이름", half: true, placeholder: "예: 윤슬" },
  ] : []).concat([
    { name: "year", label: "연도", type: "number", required: true, half: true },
    { name: "dept", label: "담당 국서", type: "select", options: S.settings.depts, required: true, half: true },
    { name: "status", label: "진행 상태", type: "select", options: STATUSES, required: true, half: true },
    { name: "owner", label: "담당자", half: true },
    { name: "startDate", label: "사업 날짜 (시행일)", type: "date", half: true, help: "캘린더에 사업 일정으로 표시돼요." },
    { name: "endDate", label: "끝나는 날 (여러 날일 때만)", type: "date", half: true, help: "1박 2일 등일 때만 넣으세요." },
    { name: "budget", label: "예산", type: "money", placeholder: "숫자만 입력 (예: 1200000)" },
    { name: "summary", label: "한 줄 요약 · 다음 기수에게 남길 말", type: "textarea", rows: 3, placeholder: "예: 장소가 좁았음 → 내년엔 더 큰 곳 추천" },
    { name: "planUrl", label: "기획안 링크", type: "url", placeholder: "https://docs.google.com/…" },
    { name: "extraUrl", label: "기타 자료 (드라이브 폴더 등)", type: "url", placeholder: "https://drive.google.com/…" },
  ]);

  /* ============================================================
     화면 그리기
     ============================================================ */
  function render() {
    closeModal();
    if (!S.authUser) return renderLogin();
    if (!S.me && !isOwner()) return renderSignup();
    if (!isApproved()) return isAlumni() ? renderAlumni() : renderWaiting();
    renderShell();
  }

  function demoBar() {
    if (DB.mode !== "demo") return "";
    return '<div class="demobar">데모 모드 — 연습용 가짜 데이터라 새로고침하면 초기화돼요. <button class="linkbtn" data-act="demoSwitch">다른 역할로 보기</button></div>';
  }

  function inAppBrowser() {
    const ua = navigator.userAgent || "";
    if (/KAKAOTALK/i.test(ua)) return "kakao";
    if (/Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|everytimeApp|DaumApps/i.test(ua)) return "other";
    return "";
  }

  function renderLogin() {
    const iab = inAppBrowser();
    let body;
    if (DB.mode === "demo") {
      body = '<p class="muted">아직 Firebase가 연결되지 않아 <b>데모 모드</b>로 열렸어요. 아래에서 역할을 골라 화면을 둘러보세요.</p>' +
        '<div class="persona">' + DB.personas.map((p) => '<button class="btn persona-btn" data-act="demoLogin" data-uid="' + p.uid + '"><b>' + esc(p.label) + "</b><span>" + esc(p.desc) + "</span></button>").join("") + "</div>";
    } else if (iab) {
      body = '<div class="notice warn"><b>카카오톡·인스타 등 앱 안에서는 구글 로그인이 막혀 있어요.</b><br>크롬이나 사파리 같은 일반 브라우저로 열어 주세요.</div>' +
        (iab === "kakao" ? '<button class="btn primary wide" data-act="openExternal">외부 브라우저로 열기</button>' : '<p class="muted small">오른쪽 위(또는 아래) ⋯ 메뉴 → "다른 브라우저로 열기"를 눌러 주세요.</p>') +
        '<button class="btn ghost wide" data-act="login" style="margin-top:8px">그래도 여기서 로그인 시도</button>';
    } else {
      body = '<button class="btn google wide" data-act="login"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> 구글 계정으로 로그인</button>' +
        '<p class="muted small center">처음이라면 로그인 후 가입 신청서를 작성하고, 회장단 승인을 기다리면 돼요.</p>';
    }
    app.innerHTML = demoBar() + '<main class="center-screen"><div class="card login">' +
      '<div class="mark big">BIO</div><h1>' + esc(CFG.siteName || "학생회") + "</h1>" +
      '<p class="muted">학생회 구성원 전용 공간입니다.</p>' + body + "</div></main>";
  }

  function renderSignup() {
    const f = profileFields();
    app.innerHTML = demoBar() + '<main class="center-screen"><form class="card signup" id="signupForm" novalidate>' +
      "<h2>학생회 가입 신청</h2>" +
      '<p class="muted">작성하고 제출하면 회장단이 확인 후 승인해 드려요. <br><span class="small">로그인 계정: ' + esc(S.authUser.email) + "</span></p>" +
      '<div class="fields">' + fieldsHTML(f, { name: S.authUser.name }) + "</div>" +
      '<p class="form-err" hidden></p>' +
      '<button class="btn primary wide" type="submit">가입 신청하기</button>' +
      '<button class="btn ghost wide" type="button" data-act="logout">다른 계정으로 로그인</button>' +
      "</form></main>";
    const form = document.getElementById("signupForm");
    bindDeptPosition(form);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const err = form.querySelector(".form-err");
      err.hidden = true;
      try {
        const v = readFields(form, f);
        const owner = isOwner();
        await DB.set("users", S.authUser.uid, Object.assign(v, {
          email: S.authUser.email, status: owner ? "approved" : "pending", isAdmin: owner, createdAt: new Date().toISOString(),
        }));
        await loadMe();
        render();
      } catch (er) { err.hidden = false; err.textContent = er.code ? errMsg(er) : er.message; }
    });
  }

  function renderWaiting() {
    const st = S.me.status;
    const msg = {
      pending: ["승인을 기다리고 있어요", "회장단이 가입 신청을 확인하면 사이트를 쓸 수 있어요. 승인 후 아래 [다시 확인]을 눌러 주세요."],
      rejected: ["가입 신청이 반려되었어요", "학생회 구성원이 맞다면 회장단에게 문의한 뒤 다시 신청해 주세요."],
      inactive: S.me.inactiveReason === "탈퇴"
        ? ["학생회를 탈퇴한 계정이에요", "다시 학생회에 들어오게 되었다면 가입을 다시 신청해 주세요."]
        : ["임기가 종료된 계정이에요", "다시 학생회에서 활동하게 되었다면 재승인을 요청해 주세요."],
    }[st] || ["접근할 수 없는 계정이에요", "회장단에게 문의해 주세요."];
    app.innerHTML = demoBar() + '<main class="center-screen"><div class="card login">' +
      '<div class="mark big ' + (st === "pending" ? "wait" : "") + '">' + (st === "pending" ? "…" : "!") + "</div>" +
      "<h2>" + msg[0] + '</h2><p class="muted">' + msg[1] + "</p>" +
      '<div class="mini-profile">' + esc(S.me.name) + " · " + esc(S.me.dept) + " " + esc(S.me.position) + "</div>" +
      (st === "pending" ? '<button class="btn primary wide" data-act="recheck">다시 확인</button><button class="btn ghost wide" data-act="editMe">신청 내용 수정</button>' :
        '<button class="btn primary wide" data-act="reapply">다시 신청하기</button>') +
      '<button class="btn ghost wide" data-act="logout">로그아웃</button></div></main>';
  }

  /* ----- OB(임기 종료) 화면: 내 활동 이력 + 함께한 학생회 멤버·사업 (읽기 전용) ----- */
  /* 학생회(기수)별 기록: 함께한 사람들(명단) · 사업 · 회의록. OB 기록실과 [나의 기록]에서 같이 씀 */
  async function councilSectionsHTML(hist, projects, minutes) {
    const councils = {};
    for (const h of hist) { try { councils[h.generation] = await DB.get("councils", councilDocId(h.generation)); } catch (e) { /* 없음 */ } }
    return hist.map((h) => {
      const c = councils[h.generation];
      const mine = projects.filter((p) => p.generation === h.generation).sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
      let roster = "";
      if (c && c.members && c.members.length) {
        const g = {};
        c.members.forEach((m) => (g[m.dept || "기타"] = g[m.dept || "기타"] || []).push(m));
        roster = '<div class="roster">' + Object.keys(g).sort((a, b) => deptRank(a) - deptRank(b)).map((d) =>
          '<div class="rgroup" style="--c:' + deptColor(d) + '"><h4><span class="dot"></span>' + esc(d) + "</h4><ul>" +
          g[d].sort((a, b) => posRank(a.position) - posRank(b.position)).map((m) =>
            '<li><span class="' + (m.position && m.position !== "국원" ? "lead" : "") + '">' + esc(m.name) + '</span><small class="muted">' + esc(m.position || "") + "</small>" +
            (m.phone ? '<a class="ph" href="tel:' + esc(m.phone.replace(/[^\d+]/g, "")) + '">' + esc(m.phone) + "</a>" : "") + "</li>").join("") +
          "</ul></div>").join("") + "</div>" +
          '<p class="muted small" style="margin:-4px 0 14px">전화번호는 ' + esc(c.endedAt || "임기 종료") + " 기준이에요. 번호 공개에 동의한 사람만 보여요.</p>";
      } else roster = '<p class="muted small">멤버 명단은 이 학생회가 다음 학생회로 넘어갈 때 기록돼요.</p>';
      const mins = minutes.filter((m) => m.generation === h.generation).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return '<section class="card ob-sec"><h3>' + esc(councilLabel(h.generation, h.councilName)) + ' <small>내 역할: ' + esc([h.dept, h.position].filter(Boolean).join(" ")) + "</small></h3>" +
        '<h4 class="ob-h">함께한 사람들</h4>' + roster +
        '<h4 class="ob-h">사업 <small>' + mine.length + "개</small></h4>" +
        (mine.length ? '<div class="pgrid">' + mine.map((p) => projectCard(p, { readonly: true })).join("") + "</div>" : '<p class="empty-s">기록된 사업이 없어요.</p>') +
        (mins.length ? '<details class="year ob-min"><summary><b>회의록</b> <small>' + mins.length + "개</small></summary>" + minutesListHTML(mins, false) + "</details>" : '<p class="empty-s">기록된 회의록이 없어요.</p>') + "</section>";
    }).join("");
  }

  async function renderAlumni() {
    const me = S.me;
    app.innerHTML = demoBar() + '<header class="topbar"><div class="topbar-in">' +
      '<a class="brand" href="#"><span class="mark">BIO</span><span><b>' + esc(CFG.siteName || "학생회") + '</b><small>OB 기록실</small></span></a>' +
      '<div class="me"><span class="who">' + esc(me.name) + ' <span class="muted">OB</span></span><button class="btn sm ghost" data-act="logout">로그아웃</button></div></div></header>' +
      '<main class="page" id="page"><div class="loading">불러오는 중…</div></main>';
    const page = document.getElementById("page");
    try {
      const hist = (me.history || []).slice().sort((a, b) => genNum(b.generation) - genNum(a.generation));
      const projects = fixStatus(await DB.list("projects"));
      let myMsgs = [];
      try { myMsgs = await DB.queryEq("messages", "authorUid", S.authUser.uid); } catch (e) { /* 없음 */ }
      let obMinutes = [];
      const gens = hist.map((h) => h.generation).filter(Boolean);
      if (gens.length) { try { obMinutes = await DB.queryIn("minutes", "generation", gens.slice(0, 30)); } catch (e) { console.warn(e); } }
      const histHTML = hist.length ? '<ul class="hist">' + hist.map((h) =>
        '<li><b>' + esc(councilLabel(h.generation, h.councilName)) + "</b>" + deptTag(h.dept) + "<span>" + esc(h.position) + "</span></li>").join("") + "</ul>"
        : '<p class="empty-s">기록된 활동 이력이 없어요.</p>';
      const sections = await councilSectionsHTML(hist, projects, obMinutes);
      page.innerHTML = '<div class="hello"><h2>' + esc(me.name) + "님, 그동안 수고 많으셨어요</h2>" +
        '<p class="muted">임기가 끝나 지금 학생회의 연락망·회의록·캘린더는 볼 수 없지만, 함께했던 학생회의 사업·회의록·멤버는 언제든 여기서 볼 수 있어요.</p></div>' +
        '<section class="card"><h3>나의 학생회 활동</h3>' + histHTML + "</section>" +
        '<section class="card"><div class="card-head"><h3>후배들에게 한마디</h3><button class="btn sm primary" data-act="addMsg">+ 한마디 남기기</button></div>' +
        (myMsgs.length ? '<div class="msg-grid">' + myMsgs.map((m) => msgCard(m, true)).join("") + "</div>" : '<p class="muted small">남긴 한마디는 지금 학생회 후배들의 [선배들의 한마디]에 보여요.</p>') + "</section>" +
        sections +
        '<p class="muted small center" style="margin-top:24px">다시 학생회에서 활동하게 됐다면 <button class="linkbtn" data-act="reapply">재승인 요청하기</button></p>';
    } catch (e) {
      page.innerHTML = '<div class="card empty">' + esc(errMsg(e)) + "</div>";
    }
  }

  // 학년 칸이 생기기 전에 가입한 회원에게 한 번 물어봄
  function askGrade() {
    if (modalRoot.innerHTML || !S.me || S.me.grade) return;
    openForm({ title: "학년을 알려주세요", submitLabel: "저장",
      intro: '<p class="small">학생회를 다음 기수로 넘길 때 누가 남고 누가 떠나는지 구분하는 데 쓰여요. <b>학번과 상관없이 학생회에서의 학년</b>으로 골라 주세요.</p>',
      fields: [{ name: "grade", label: "학년", type: "select", options: GRADES, required: true }],
      onSubmit: async (v) => { await DB.update("users", S.authUser.uid, { grade: v.grade }); await loadMe(); dirty("users"); toast("저장했어요."); } });
  }

  function renderShell() {
    const route = S.route;
    const me = S.me;
    const who = me ? esc(me.name) + ' <span class="muted">' + esc(me.dept || "") + " " + esc(me.position || "") + "</span>" : "학생회 공용계정";
    const nav = NAV.filter((n) => (n[0] !== "admin" || isAdmin()))
      .map((n) => '<a href="#' + n[0] + '" class="' + (navKey(route) === n[0] ? "on" : "") + '">' + n[1] + (n[0] === "admin" ? '<span class="badge" id="pendingBadge" hidden></span>' : "") + "</a>").join("");
    app.innerHTML = demoBar() +
      '<header class="topbar"><div class="topbar-in">' +
      '<a class="brand" href="#home"><span class="mark">BIO</span><span><b>' + esc(CFG.siteName || "학생회") + '</b><small>' + esc(councilLabel(S.settings.generation + " 학생회", S.settings.councilName)) + "</small></span></a>" +
      '<div class="me"><span class="who">' + who + "</span>" +
      (me ? '<button class="btn sm ghost" data-act="editMe">내 정보</button>' : "") +
      '<button class="btn sm ghost" data-act="logout">로그아웃</button></div></div>' +
      '<nav class="tabs">' + nav + "</nav></header>" +
      '<main class="page" id="page"><div class="loading">불러오는 중…</div></main>' +
      '<footer class="foot">' + esc(CFG.siteName || "") + " " + esc(curCouncil()) + " · 문의는 회장단에게</footer>";
    renderPage();
    if (isAdmin()) updatePendingBadge();
    if (me && me.status === "approved" && !me.grade) setTimeout(askGrade, 300);
  }

  async function updatePendingBadge() {
    try {
      const n = (await col("users")).filter((u) => u.status === "pending").length;
      const b = document.getElementById("pendingBadge");
      if (b) { b.hidden = !n; b.textContent = n; }
    } catch (e) { /* 무시 */ }
  }

  async function renderPage() {
    const page = document.getElementById("page");
    if (!page) return;
    const fn = PAGES[S.route] || PAGES.home;
    try {
      page.innerHTML = await fn();
    } catch (e) {
      console.error(e);
      page.innerHTML = '<div class="card empty">' + esc(errMsg(e)) + '<br><button class="btn" data-act="reload">다시 시도</button></div>';
    }
  }

  /* ============================================================
     각 페이지
     ============================================================ */
  const PAGES = {};

  /* ----- 선배들의 한마디 ----- */
  // 내가 지금(또는 마지막으로) 속한 학생회 정보: 활동 중이면 지금 학생회, OB면 마지막 이력
  function myCouncilInfo() {
    if (S.me && S.me.status === "approved") return { generation: S.settings.generation, councilName: S.settings.councilName || "", dept: S.me.dept, position: S.me.position };
    const h = ((S.me && S.me.history) || []).slice().sort((a, b) => genNum(b.generation) - genNum(a.generation))[0];
    return h ? { generation: h.generation, councilName: h.councilName, dept: h.dept, position: h.position } : { generation: S.settings.generation, councilName: S.settings.councilName || "", dept: "", position: "" };
  }
  const msgFields = () => [
    { name: "text", label: "후배들에게 남기는 한마디", type: "textarea", rows: 5, required: true, placeholder: "예: 개강파티 장소는 최소 한 달 전에 예약하세요! 힘들 때는 서로 꼭 기대기 :)" },
    { name: "toDept", label: "받는 사람", type: "select", options: ["모두에게"].concat(S.settings.depts.map((d) => "다음 " + d + "에게")), required: true },
    { name: "showName", label: "내 이름 보여주기 (끄면 '○○국 선배'로만 표시)", type: "checkbox", value: true },
  ];
  function msgByline(m) {
    const who = m.showName ? [m.authorDept, m.authorPosition, m.authorName].filter(Boolean).join(" ") : (m.authorDept || "") + " 선배";
    return "— " + councilLabel(m.generation, m.councilName) + " · " + who;
  }
  function msgCard(m, canEdit) {
    return '<article class="msg" style="--c:' + deptColor((m.toDept || "").replace(/^다음 |에게$/g, "") || m.authorDept) + '">' +
      '<span class="to">' + esc(m.toDept === "모두에게" ? "To. 모두" : "To. " + m.toDept.replace(/^다음 |에게$/g, "")) + "</span>" +
      '<p class="mtext">' + esc(m.text) + "</p>" +
      '<p class="by">' + esc(msgByline(m)) + "</p>" +
      (canEdit ? '<button class="linkbtn small" data-act="editMsg" data-id="' + esc(m.id) + '"' + (m.sealed ? ' data-sealed="1"' : "") + ">수정</button>" : "") + "</article>";
  }
  const talkTabs = (cur) => '<div class="seg"><a href="#talk" class="' + (cur === "talk" ? "on" : "") + '">자유게시판</a><a href="#messages" class="' + (cur === "messages" ? "on" : "") + '">선배들의 한마디 🔒</a></div>';
  // 봉인된 한마디(타임캡슐): 회장단은 전부, 2학년은 지금 학생회 것 전부, 그 외에는 내가 쓴 것만
  async function loadCapsules() {
    if (!S.authUser) return [];
    try {
      if (isAdmin()) return await DB.list("capsules");
      if (isSenior()) return await DB.queryEq("capsules", "generation", S.settings.generation);
      return await DB.queryEq("capsules", "authorUid", S.authUser.uid);
    } catch (e) { console.warn(e); return []; }
  }
  const canEditMsg = (m) => isAdmin() || (S.authUser && m.authorUid === S.authUser.uid);
  PAGES.messages = async function () {
    const all = (await col("messages")).slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const f = S.msgTo || "";
    const list = all.filter((m) => !f || m.toDept === "모두에게" || m.toDept === "다음 " + f + "에게");
    const groups = {};
    list.forEach((m) => (groups[m.generation || "기타"] = groups[m.generation || "기타"] || []).push(m));
    const keys = Object.keys(groups).sort((a, b) => genNum(b) - genNum(a));
    const chips = '<button class="fchip' + (!f ? " on" : "") + '" data-act="msgTo" data-dept="">전체</button>' +
      S.settings.depts.map((d) => '<button class="fchip' + (f === d ? " on" : "") + '" style="--c:' + deptColor(d) + '" data-act="msgTo" data-dept="' + esc(d) + '"><i></i>' + esc(d) + "</button>").join("");
    const body = keys.map((k) => {
      const name = (groups[k].find((m) => m.councilName) || {}).councilName || "";
      return '<section class="msg-sec"><h3>' + esc(councilLabel(k, name)) + ' 선배들이 남긴 말 <small>' + groups[k].length + "개</small></h3>" +
        '<div class="msg-grid">' + groups[k].map((m) => msgCard(m, canEditMsg(m))).join("") + "</div></section>";
    }).join("");
    const caps = (await loadCapsules()).filter((m) => m.generation === S.settings.generation)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const canSeal = isSenior() || isAdmin();
    const sealed = canSeal
      ? '<section class="card sealed"><div class="card-head"><h3>🔒 ' + esc(curCouncil()) + ' 타임캡슐 <small>2학년 전용</small></h3>' +
        (isSenior() ? '<button class="btn sm primary" data-act="addMsg">+ 한마디 봉인하기</button>' : "") + "</div>" +
        '<p class="muted small">2학년이 1학년 후배들에게 남기는 한마디예요. 지금은 <b>2학년끼리만</b> 볼 수 있고, 학생회를 다음 기수로 넘기는 날 <b>지금의 1학년들</b>에게 공개돼요.</p>' +
        (caps.length ? '<div class="msg-grid">' + caps.map((m) => msgCard(Object.assign({ sealed: true }, m), canEditMsg(m))).join("") + "</div>"
          : '<p class="empty-s">아직 봉인된 한마디가 없어요.</p>') + "</section>"
      : '<section class="card sealed center"><h3>🔒 2학년 선배들이 한마디를 준비하고 있어요</h3><p class="muted small">학생회를 다음 기수로 넘기는 날 열려요. 조금만 기다려 주세요!</p></section>';
    return '<div class="page-head"><div><h2>소통방</h2><p class="muted">학생회끼리 자유롭게 떠드는 곳 + 선배들이 후배에게 남기는 한마디</p></div></div>' +
      talkTabs("messages") + sealed +
      '<h3 class="sec-h">선배들이 우리에게 남긴 한마디</h3>' +
      '<div class="filters">' + chips + "</div>" +
      (body || '<div class="card empty">아직 열린 한마디가 없어요.<br>선배들의 한마디는 학생회를 넘기는 날, 함께 활동했던 후배들에게 열려요.</div>');
  };

  /* ----- 소통방: 자유게시판 (활동 중인 회원끼리) ----- */
  function postHTML(p, comments) {
    const mine = S.authUser && p.authorUid === S.authUser.uid;
    return '<article class="card post"><div class="phead">' + deptTag(p.authorDept) + "<b>" + esc(p.authorName) + '</b><span class="muted small">' + esc(p.authorPosition || "") + " · " + ago(p.createdAt) + "</span>" +
      (mine || isAdmin() ? '<button class="linkbtn small del" data-act="delPost" data-id="' + esc(p.id) + '">삭제</button>' : "") + "</div>" +
      '<p class="ptext">' + esc(p.text) + "</p>" +
      '<div class="comments">' + comments.map((c) => '<div class="cmt"><b>' + esc(c.authorName) + "</b> " + esc(c.text) + ' <span class="muted small">' + ago(c.createdAt) + "</span>" +
        ((S.authUser && c.authorUid === S.authUser.uid) || isAdmin() ? ' <button class="linkbtn small" data-act="delComment" data-id="' + esc(c.id) + '">×</button>' : "") + "</div>").join("") +
      '<form class="cform" data-post="' + esc(p.id) + '"><input name="c" placeholder="댓글 달기" autocomplete="off" maxlength="500"><button class="btn sm">등록</button></form></div></article>';
  }
  PAGES.talk = async function () {
    if (!S.me) return talkTabs("talk") + '<div class="card empty">자유게시판은 개인 계정으로 가입한 학생회원끼리 쓰는 곳이에요.</div>';
    const [posts, comments] = await Promise.all([col("talk"), col("talkComments")]);
    const byPost = {};
    comments.slice().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).forEach((c) => (byPost[c.postId] = byPost[c.postId] || []).push(c));
    const sorted = posts.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const cur = sorted.filter((p) => p.generation === S.settings.generation);
    const pastG = {};
    sorted.filter((p) => p.generation !== S.settings.generation).forEach((p) => (pastG[p.generation] = pastG[p.generation] || []).push(p));
    return '<div class="page-head"><div><h2>소통방</h2><p class="muted">학생회끼리 자유롭게 떠드는 곳 + 선배들이 후배에게 남기는 한마디</p></div></div>' +
      talkTabs("talk") +
      '<form class="card compose" id="composeForm"><textarea name="t" rows="3" maxlength="2000" placeholder="' + esc(S.me.name) + '님, 학생회 사람들에게 하고 싶은 말을 자유롭게 써 보세요 :)"></textarea>' +
      '<div class="compose-foot"><span class="muted small">지금 활동 중인 학생회원만 볼 수 있어요.</span><button class="btn primary sm">올리기</button></div></form>' +
      (cur.map((p) => postHTML(p, byPost[p.id] || [])).join("") || '<div class="card empty">아직 글이 없어요. 첫 글을 남겨 보세요!</div>') +
      Object.keys(pastG).sort((a, b) => genNum(b) - genNum(a)).map((g) =>
        '<details class="year"><summary><b>' + esc(councilLabel(g, (pastG[g][0] || {}).councilName)) + " 자유게시판</b> <small>" + pastG[g].length + "개</small></summary>" +
        pastG[g].map((p) => postHTML(p, byPost[p.id] || [])).join("") + "</details>").join("");
  };

  /* ----- 나의 기록 (활동 중인 회원): 지금 활동 + 지난 학생회 때의 명단·사업·회의록 ----- */
  PAGES.mine = async function () {
    if (!S.me) return '<div class="card empty">개인 계정으로 로그인하면 볼 수 있어요.</div>';
    const past = (S.me.history || []).filter((h) => h.generation !== S.settings.generation)
      .sort((a, b) => genNum(b.generation) - genNum(a.generation));
    const [projects, minutes] = await Promise.all([col("projects"), col("minutes")]);
    const sections = past.length ? await councilSectionsHTML(past, projects, minutes) : "";
    const line = (gen, name, dept, pos, now) => '<li><b>' + esc(councilLabel(gen, name)) + "</b>" + deptTag(dept) + "<span>" + esc(pos || "") + "</span>" + (now ? '<span class="now">지금</span>' : "") + "</li>";
    return '<div class="page-head"><div><h2>나의 기록</h2><p class="muted">내가 활동한 학생회들의 사람·사업·회의록을 모아 봐요. 임기가 끝나도 OB 기록실에서 계속 볼 수 있어요.</p></div></div>' +
      '<section class="card"><h3>나의 학생회 활동</h3><ul class="hist">' +
      line(S.settings.generation, S.settings.councilName, S.me.dept, S.me.position, true) +
      past.map((h) => line(h.generation, h.councilName, h.dept, h.position, false)).join("") + "</ul></section>" +
      (sections || '<div class="card empty">아직 지난 학생회 기록이 없어요.<br>학생회를 다음 기수로 넘길 때, 그때 함께한 선배들과 사업·회의록이 여기에 기록돼요.</div>');
  };

  /* ----- 홈 ----- */
  PAGES.home = async function () {
    const [tasks, projects, minutes, msgs] = await Promise.all([col("tasks"), col("projects"), col("minutes"), col("messages").catch(() => [])]);
    const mine = S.me && S.me.dept;
    const pool = msgs.filter((m) => m.toDept === "모두에게" || (mine && m.toDept === "다음 " + mine + "에게"));
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const t = today();
    const in14 = ymd(new Date(Date.now() + 14 * 86400000));
    const open = tasks.filter((x) => !x.done);
    const late = open.filter((x) => x.dueDate < t).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const soon = open.filter((x) => x.dueDate >= t && x.dueDate <= in14).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const myDept = S.me && S.me.dept;
    const live = projects.filter((p) => isCurrent(p) && (p.status === "예정" || p.status === "기획중"))
      .sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
    const recent = minutes.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
    let pendingNote = "";
    if (isAdmin()) {
      const n = (await col("users")).filter((u) => u.status === "pending").length;
      if (n) pendingNote = '<a class="notice info link" href="#admin"><b>가입 승인 대기 ' + n + "명</b> — 눌러서 확인하기 →</a>";
    }
    const taskRow = (x) => '<li class="trow ' + (x.dueDate < t ? "late" : "") + (x.dept === myDept ? " mine" : "") + '" data-act="editTask" data-id="' + esc(x.id) + '">' +
      '<span class="dd">' + dday(x.dueDate) + "</span>" + deptTag(x.dept) + '<span class="tt">' + esc(x.title) + '</span><span class="dt">' + fmtDate(x.dueDate) + "</span></li>";
    if (S.me && S.me.profileCheck) pendingNote = '<div class="notice info"><b>' + esc(curCouncil()) + ' 학생회가 시작됐어요!</b> 소속 국서나 직책이 바뀌었다면 연락망이 맞게 나오도록 수정해 주세요.' +
      '<div class="actions" style="margin-top:8px"><button class="btn sm primary" data-act="editMe">내 정보 수정</button><button class="btn sm" data-act="profileOk">그대로 맞아요</button></div></div>' + pendingNote;
    return pendingNote +
      '<div class="hello"><h2>' + (S.me ? esc(S.me.name) + "님, 안녕하세요" : "안녕하세요") + '</h2><p class="muted">' + fmtDate(t, true) + "</p></div>" +
      (pick ? '<a class="home-msg" href="#messages"><span class="lbl">선배의 한마디</span><span class="mtext">' + esc(pick.text) + '</span><span class="by">' + esc(msgByline(pick)) + "</span></a>" : "") +
      '<div class="grid2">' +
      '<section class="card"><div class="card-head"><h3>다가오는 마감 <small>2주 이내</small></h3><a href="#calendar" class="more">캘린더 →</a></div>' +
      (soon.length ? '<ul class="tlist">' + soon.map(taskRow).join("") + "</ul>" : '<p class="empty-s">2주 안에 마감되는 업무가 없어요.</p>') +
      (late.length ? '<h4 class="late-h">마감 지난 업무 ' + late.length + "개</h4><ul class=\"tlist\">" + late.map(taskRow).join("") + "</ul>" : "") +
      "</section>" +
      '<section class="card"><div class="card-head"><h3>다가오는 사업</h3><a href="#projects" class="more">전체 →</a></div>' +
      (live.length ? '<ul class="plist">' + live.map((p) => '<li data-act="viewProject" data-id="' + esc(p.id) + '"><span class="st st-' + esc(p.status) + '">' + esc(p.status) + "</span>" + deptTag(p.dept) + "<b>" + esc(p.name) + '</b><span class="dt">' + (p.startDate ? fmtDate(p.startDate) + (p.startDate >= t ? " · " + dday(p.startDate) : "") : "") + "</span></li>").join("") + "</ul>" : '<p class="empty-s">예정된 사업이 없어요.</p>') +
      '<div class="card-head" style="margin-top:18px"><h3>최근 회의록</h3><a href="#minutes" class="more">전체 →</a></div>' +
      (recent.length ? '<ul class="mlist">' + recent.map((m) => '<li><a href="' + esc(safeUrl(m.url)) + '" target="_blank" rel="noopener"><span class="dt">' + fmtDate(m.date) + "</span> " + esc(m.title) + "</a></li>").join("") + "</ul>" : '<p class="empty-s">아직 등록된 회의록이 없어요.</p>') +
      "</section></div>";
  };

  /* ----- 비상연락망 ----- */
  PAGES.contacts = async function () {
    const users = (await col("users")).filter((u) => u.status === "approved");
    const q = (S.q.contacts || "").toLowerCase();
    const shown = users.filter((u) => !q || [u.name, u.dept, u.position, u.phone, u.studentId].join(" ").toLowerCase().includes(q));
    const groups = {};
    shown.forEach((u) => (groups[u.dept || "소속 없음"] = groups[u.dept || "소속 없음"] || []).push(u));
    const order = Object.keys(groups).sort((a, b) => deptRank(a) - deptRank(b) || a.localeCompare(b));
    const html = order.map(function (d) {
      const list = groups[d].sort((a, b) => posRank(a.position) - posRank(b.position) || a.name.localeCompare(b.name));
      return '<section class="card dept-card" style="--c:' + deptColor(d) + '"><h3><span class="dot"></span>' + esc(d) + ' <small>' + list.length + "명</small></h3>" +
        '<ul class="clist">' + list.map((u) => {
          const lead = u.position && u.position !== "국원";
          return '<li class="' + (lead ? "lead" : "") + '"><span class="pos">' + esc(u.position || "") + '</span><span class="nm">' + esc(u.name) + '</span><span class="sid">' + esc(u.studentId || "") + "</span>" +
            '<a class="ph" href="tel:' + esc((u.phone || "").replace(/[^\d+]/g, "")) + '">' + esc(u.phone || "") + "</a></li>";
        }).join("") + "</ul></section>";
    }).join("");
    return '<div class="page-head"><div><h2>비상연락망</h2><p class="muted">승인된 학생회원 ' + users.length + "명 · 국서별 / 직책순</p></div>" +
      '<div class="actions"><button class="btn" data-act="copyContacts">명단 복사</button><button class="btn" data-act="print">인쇄</button><button class="btn primary" data-act="editMe">내 정보 수정</button></div></div>' +
      '<input class="search" data-search="contacts" placeholder="이름 · 국서 · 전화번호로 검색" value="' + esc(S.q.contacts || "") + '">' +
      '<div class="dept-grid">' + (html || '<div class="card empty">검색 결과가 없어요.</div>') + "</div>";
  };

  /* ----- 업무 캘린더 ----- */
  PAGES.calendar = async function () {
    const tasks = await col("tasks");
    const projects = await col("projects");
    const pname = {};
    projects.forEach((p) => (pname[p.id] = p.name));
    if (!S.calMonth) { const n = new Date(); S.calMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
    const y = S.calMonth.getFullYear(), m = S.calMonth.getMonth();
    const first = new Date(y, m, 1), dim = new Date(y, m + 1, 0).getDate();
    const startDow = first.getDay();
    const cells = Math.ceil((startDow + dim) / 7) * 7;
    const t = today();
    const filt = tasks.filter((x) => !S.calFilter || x.dept === S.calFilter);
    const byDay = {};
    filt.forEach((x) => (byDay[x.dueDate] = byDay[x.dueDate] || []).push(x));
    Object.values(byDay).forEach((a) => a.sort((p, q) => (p.done - q.done) || deptRank(p.dept) - deptRank(q.dept)));
    // 사업 날짜(시행일): 여러 날이면 그 기간 매일 표시. 국서 필터는 주관 국서 또는 업무를 맡은 국서 기준
    const evs = projects.filter((p) => p.startDate && p.status !== "취소" && (!S.calFilter || p.dept === S.calFilter ||
      tasks.some((x) => x.projectId === p.id && x.dept === S.calFilter)));
    const evByDay = {};
    evs.forEach((p) => {
      const end = p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate;
      for (let d = new Date(p.startDate + "T00:00:00"), k = 0; ymd(d) <= end && k < 31; d.setDate(d.getDate() + 1), k++)
        (evByDay[ymd(d)] = evByDay[ymd(d)] || []).push(p);
    });
    let grid = "";
    for (let i = 0; i < cells; i++) {
      const d = new Date(y, m, 1 - startDow + i);
      const key = ymd(d);
      const items = byDay[key] || [];
      const dayEvs = evByDay[key] || [];
      const other = d.getMonth() !== m;
      grid += '<div class="cell' + (other ? " other" : "") + (key === t ? " today" : "") + (d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : "") + '" data-act="addTask" data-date="' + key + '">' +
        '<span class="num">' + d.getDate() + "</span>" +
        dayEvs.map((p) => '<span class="chip ev" style="--c:' + deptColor(p.dept) + '" data-act="viewProject" data-id="' + esc(p.id) + '" title="사업 · ' + esc(p.name) + '">' + esc(p.name) + "</span>").join("") +
        items.slice(0, Math.max(1, 3 - dayEvs.length)).map((x) => '<span class="chip' + (x.done ? " done" : !x.done && x.dueDate < t ? " late" : "") + '" style="--c:' + deptColor(x.dept) + '" data-act="editTask" data-id="' + esc(x.id) + '" title="' + esc(x.dept + " · " + (pname[x.projectId] ? "[" + pname[x.projectId] + "] " : "") + x.title) + '">' +
          (pname[x.projectId] ? '<small class="cp">' + esc(pname[x.projectId]) + "</small>" : "") + esc(x.title) + "</span>").join("") +
        (items.length > Math.max(1, 3 - dayEvs.length) ? '<span class="more-n">+' + (items.length - Math.max(1, 3 - dayEvs.length)) + "</span>" : "") +
        (items.length || dayEvs.length ? '<span class="dots">' + dayEvs.map((p) => '<i class="e" style="--c:' + deptColor(p.dept) + '"></i>').join("") + items.map((x) => '<i style="--c:' + deptColor(x.dept) + '"></i>').join("") + "</span>" : "") +
        "</div>";
    }
    const monthKey = y + "-" + z(m + 1);
    const monthList = filt.filter((x) => (x.dueDate || "").startsWith(monthKey)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.done - b.done);
    const monthEvs = evs.filter((p) => p.startDate.slice(0, 7) <= monthKey && (p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate).slice(0, 7) >= monthKey)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const evSection = monthEvs.length ? '<section class="card"><h3>' + (m + 1) + "월 사업 일정 <small>" + monthEvs.length + "개</small></h3><ul class=\"tlist big\">" +
      monthEvs.map((p) => '<li class="trow evrow" data-act="viewProject" data-id="' + esc(p.id) + '"><span class="evdot" style="--c:' + deptColor(p.dept) + '"></span>' +
        '<span class="dt">' + eventDateText(p) + "</span>" + deptTag(p.dept) + '<span class="tt"><b>' + esc(p.name) + "</b></span>" +
        '<span class="dd">' + (p.startDate < t ? (p.status === "완료" ? "완료" : "") : dday(p.startDate)) + "</span></li>").join("") + "</ul></section>" : "";
    const chips = '<button class="fchip' + (!S.calFilter ? " on" : "") + '" data-act="calFilter" data-dept="">전체</button>' +
      S.settings.depts.map((d) => '<button class="fchip' + (S.calFilter === d ? " on" : "") + '" style="--c:' + deptColor(d) + '" data-act="calFilter" data-dept="' + esc(d) + '"><i></i>' + esc(d) + "</button>").join("");
    return '<div class="page-head"><div><h2>업무 캘린더</h2><p class="muted">색이 꽉 찬 칸은 <b>사업 날짜</b>, 연한 칸은 국서별 <b>업무 마감</b> · 날짜를 누르면 업무 추가</p></div>' +
      '<div class="actions"><button class="btn primary" data-act="addTask" data-date="">+ 업무 추가</button></div></div>' +
      '<div class="filters">' + chips + "</div>" +
      '<div class="card cal-card"><div class="cal-nav"><button class="btn sm ghost" data-act="calMove" data-d="-1" aria-label="이전 달">‹</button>' +
      "<h3>" + y + "년 " + (m + 1) + '월</h3><button class="btn sm ghost" data-act="calMove" data-d="1" aria-label="다음 달">›</button>' +
      '<button class="btn sm" data-act="calMove" data-d="0">오늘</button></div>' +
      '<div class="cal-dow">' + DOW.map((d) => "<span>" + d + "</span>").join("") + '</div><div class="cal-grid">' + grid + "</div></div>" +
      evSection +
      '<section class="card"><h3>' + (m + 1) + "월 업무 목록 <small>" + monthList.length + "개</small></h3>" +
      (monthList.length ? '<ul class="tlist big">' + monthList.map((x) =>
        '<li class="trow' + (x.done ? " done" : x.dueDate < t ? " late" : "") + '">' +
        '<input type="checkbox" class="tick" data-act="toggleTask" data-id="' + esc(x.id) + '"' + (x.done ? " checked" : "") + ' aria-label="완료 표시">' +
        '<span class="dt">' + fmtDate(x.dueDate) + "</span>" + deptTag(x.dept) +
        '<span class="tt" data-act="editTask" data-id="' + esc(x.id) + '">' + esc(x.title) + (pname[x.projectId] ? ' <span class="ptag">' + esc(pname[x.projectId]) + "</span>" : "") + (x.assignee ? ' <small class="muted">· ' + esc(x.assignee) + "</small>" : "") + "</span>" +
        '<span class="dd">' + (x.done ? "완료" : dday(x.dueDate)) + "</span></li>").join("") + "</ul>" : '<p class="empty-s">이 달에 등록된 업무가 없어요.</p>') +
      "</section>";
  };

  /* ----- 회의록 ----- */
  PAGES.minutes = async function () {
    const all = (await col("minutes")).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const q = (S.q.minutes || "").toLowerCase();
    const list = all.filter((m) => (!S.minType || m.type === S.minType) && (!q || [m.title, m.memo, m.type, m.date].join(" ").toLowerCase().includes(q)));
    const folder = safeUrl(S.settings.minutesFolderUrl);
    const cur = list.filter((m) => minuteGen(m) === S.settings.generation);
    const body = minutesListHTML(cur, true);
    // 지난 학생회 회의록: 학생회별로 접어서
    const pastG = {};
    list.filter((m) => minuteGen(m) !== S.settings.generation).forEach((m) => (pastG[m.generation] = pastG[m.generation] || []).push(m));
    const pastHTML = Object.keys(pastG).sort((a, b) => genNum(b) - genNum(a)).map((g) =>
      '<details class="year"' + (q ? " open" : "") + '><summary><b>' + esc(councilLabel(g, (pastG[g].find((m) => m.councilName) || {}).councilName)) + " 회의록</b> <small>" + pastG[g].length + "개</small></summary>" +
      '<div class="card">' + minutesListHTML(pastG[g], true) + "</div></details>").join("");
    const chips = '<button class="fchip' + (!S.minType ? " on" : "") + '" data-act="minType" data-t="">전체</button>' +
      S.settings.minuteTypes.map((t) => '<button class="fchip' + (S.minType === t ? " on" : "") + '" data-act="minType" data-t="' + esc(t) + '">' + esc(t) + "</button>").join("");
    return '<div class="page-head"><div><h2>회의록 모음</h2><p class="muted">회의록은 지금처럼 구글 독스로 쓰고, 링크만 여기 등록하세요.</p></div>' +
      '<div class="actions">' + (folder ? '<a class="btn" href="' + esc(folder) + '" target="_blank" rel="noopener">구글 드라이브 폴더 열기 ↗</a>' : "") +
      '<button class="btn primary" data-act="addMinute">+ 회의록 등록</button></div></div>' +
      (!folder && isAdmin() ? '<div class="notice info">관리 → 사이트 설정에서 <b>회의록 구글 드라이브 폴더 주소</b>를 넣으면 여기 바로가기 버튼이 생겨요.</div>' : "") +
      '<input class="search" data-search="minutes" placeholder="제목 · 메모로 검색" value="' + esc(S.q.minutes || "") + '">' +
      '<div class="filters">' + chips + "</div>" +
      '<h3 class="sec-h">' + esc(curCouncil()) + " 회의록</h3>" +
      '<div class="card">' + (body || '<p class="empty-s">등록된 회의록이 없어요.</p>') + "</div>" +
      (pastHTML ? '<h3 class="sec-h">지난 학생회 회의록</h3>' + pastHTML : "");
  };
  function minutesListHTML(list, editable) {
    const groups = {};
    list.forEach((m) => { const k = (m.date || "").slice(0, 7) || "날짜 없음"; (groups[k] = groups[k] || []).push(m); });
    return Object.keys(groups).map((k) => {
      const lbl = /^\d{4}-\d{2}$/.test(k) ? k.slice(0, 4) + "년 " + Number(k.slice(5)) + "월" : k;
      return '<h4 class="grp">' + lbl + "</h4>" + groups[k].map((mm) =>
        '<div class="mrow' + (editable ? "" : " ro") + '"><a class="mlink" href="' + esc(safeUrl(mm.url)) + '" target="_blank" rel="noopener">' +
        '<span class="mtype">' + esc(mm.type || "") + '</span><span class="mt">' + esc(mm.title) + '</span><span class="dt">' + fmtDate(mm.date) + "</span></a>" +
        (mm.memo ? '<p class="memo">' + esc(mm.memo) + "</p>" : "") +
        (editable ? '<button class="btn sm ghost edit" data-act="editMinute" data-id="' + esc(mm.id) + '">수정</button>' : "") + "</div>").join("");
    }).join("");
  }

  /* ----- 사업 카드 ----- */
  function projectCard(p, opts) {
    opts = opts || {};
    const links = [["기획안", p.planUrl], ["기타 자료", p.extraUrl]]
      .filter((l) => safeUrl(l[1])).map((l) => '<a class="btn sm" href="' + esc(safeUrl(l[1])) + '" target="_blank" rel="noopener">' + l[0] + " ↗</a>").join("");
    const period = eventDateText(p);
    return '<article class="card pcard" style="--c:' + deptColor(p.dept) + '">' +
      '<div class="ptop">' + deptTag(p.dept) + '<span class="st st-' + esc(p.status) + '">' + esc(p.status || "") + "</span>" + (opts.showYear ? '<span class="yr">' + esc(p.year) + "</span>" : "") + "</div>" +
      "<h4>" + esc(p.name) + "</h4>" +
      '<dl class="meta">' + (period ? "<dt>사업일</dt><dd>" + period + "</dd>" : "") + (p.owner ? "<dt>담당</dt><dd>" + esc(p.owner) + "</dd>" : "") + (p.budget ? "<dt>예산</dt><dd>" + esc(p.budget) + "</dd>" : "") + "</dl>" +
      (p.summary ? '<p class="summary">' + esc(p.summary) + "</p>" : "") +
      (p.prevNote ? '<p class="prev">참고: ' + esc(p.prevNote) + (safeUrl(p.prevPlanUrl) ? ' <a href="' + esc(safeUrl(p.prevPlanUrl)) + '" target="_blank" rel="noopener">이전 기획안 ↗</a>' : "") + "</p>" : "") +
      (links ? '<div class="plinks">' + links + "</div>" : "") +
      projectTasksHTML(p, opts) +
      (opts.readonly ? "" : '<div class="pfoot">' + (opts.archive ? '<button class="btn sm" data-act="reuseProject" data-id="' + esc(p.id) + '">참고해서 새로 기획하기</button>' : "") +
      '<button class="btn sm ghost" data-act="editProject" data-id="' + esc(p.id) + '">수정</button></div>') + "</article>";
  }
  // 사업 카드 안의 "업무 분배" 목록
  function projectTasksHTML(p, opts) {
    const ts = opts.tasks || [];
    const canAdd = !opts.readonly && !opts.archive;
    if (!ts.length) return canAdd ? '<button class="btn sm ptask-add" data-act="distribute" data-id="' + esc(p.id) + '">+ 국서별 업무 분배하기</button>' : "";
    const t = today(), done = ts.filter((x) => x.done).length;
    const depts = [];
    ts.forEach((x) => { if (depts.indexOf(x.dept) < 0) depts.push(x.dept); });
    return '<div class="ptasks"><div class="ptasks-head"><b>업무 분배</b><small>' + done + "/" + ts.length + " 완료</small>" +
      (canAdd ? '<button class="linkbtn small" data-act="distribute" data-id="' + esc(p.id) + '">+ 추가</button>' : "") + "</div>" +
      '<div class="pbar"><i style="width:' + Math.round((done / ts.length) * 100) + '%"></i></div>' +
      "<ul>" + ts.map((x) => '<li class="' + (x.done ? "done" : x.dueDate < t ? "late" : "") + '"' + (opts.readonly ? "" : ' data-act="editTask" data-id="' + esc(x.id) + '"') + ">" +
        deptTag(x.dept) + '<span class="tt">' + esc(x.title) + "</span>" +
        '<span class="dt">' + (x.done ? "완료" : opts.archive ? fmtDate(x.dueDate) : dday(x.dueDate)) + "</span></li>").join("") + "</ul></div>";
  }
  function deptFilterChips(key, act) {
    return '<button class="fchip' + (!S[key] ? " on" : "") + '" data-act="' + act + '" data-dept="">전체</button>' +
      S.settings.depts.map((d) => '<button class="fchip' + (S[key] === d ? " on" : "") + '" style="--c:' + deptColor(d) + '" data-act="' + act + '" data-dept="' + esc(d) + '"><i></i>' + esc(d) + "</button>").join("");
  }

  /* ----- 사업 기획안 (지금 학생회) ----- */
  PAGES.projects = async function () {
    const tmap = await tasksByProject();
    const list = (await col("projects")).filter((p) => isCurrent(p) && (!S.projDept || p.dept === S.projDept ||
      (tmap[p.id] || []).some((t) => t.dept === S.projDept)));
    const cols = STATUSES.map((st) => {
      const items = list.filter((p) => p.status === st).sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
      if (st === "취소" && !items.length) return "";
      return '<div class="kcol"><h3><span class="st st-' + st + '">' + st + "</span> <small>" + items.length + "</small></h3>" +
        (items.map((p) => projectCard(p, { tasks: tmap[p.id] })).join("") || '<p class="empty-s">없음</p>') + "</div>";
    }).join("");
    return '<div class="page-head"><div><h2>사업 기획안</h2><p class="muted">' + esc(curCouncil()) + " 학생회가 진행하는 사업 " + list.length + "개 · 이미 끝난 올해 사업도 여기에 '완료'로 넣으세요</p></div>" +
      '<div class="actions"><a class="btn" href="#archive">지난 학생회 사업 참고하기</a><button class="btn primary" data-act="addProject">+ 사업 추가</button></div></div>' +
      '<div class="filters">' + deptFilterChips("projDept", "projDept") + "</div>" +
      '<div class="kanban">' + cols + "</div>";
  };

  /* ----- 사업 아카이브 (지난 학생회별) ----- */
  PAGES.archive = async function () {
    const q = (S.q.archive || "").toLowerCase();
    const all = await col("projects");
    const tmap = await tasksByProject();
    const past = all.filter((p) => !isCurrent(p));
    const list = past.filter((p) => (!S.archiveDept || p.dept === S.archiveDept) &&
      (!q || [p.name, p.summary, p.dept, p.owner, p.generation, p.councilName].join(" ").toLowerCase().includes(q)));
    // 학생회(기수)별로 묶기. 기수 기록이 없는 자료는 연도로 묶음
    const groups = {};
    list.forEach((p) => {
      const k = p.generation ? "g:" + p.generation : "y:" + p.year;
      (groups[k] = groups[k] || []).push(p);
    });
    const info = Object.keys(groups).map((k) => {
      const items = groups[k];
      const years = items.map((p) => Number(p.year)).filter(Boolean);
      const minY = Math.min.apply(null, years), maxY = Math.max.apply(null, years);
      const name = (items.find((p) => p.councilName) || {}).councilName || "";
      const isGen = k.startsWith("g:");
      return { k: k, items: items, maxY: maxY || 0, gnum: isGen ? genNum(k.slice(2)) : 0,
        title: isGen ? councilLabel(k.slice(2), name) : k.slice(2) + "년",
        sub: (isGen ? (years.length ? (minY === maxY ? minY + "년" : minY + "–" + maxY + "년") + " · " : "") : "학생회 기록 없음 · ") + items.length + "개 사업" };
    }).sort((a, b) => b.maxY - a.maxY || b.gnum - a.gnum);
    const body = info.map((g, i) =>
      '<details class="year"' + (i < 2 || q ? " open" : "") + '><summary><b>' + esc(g.title) + "</b> <small>" + esc(g.sub) + "</small></summary>" +
      '<div class="pgrid">' + g.items.sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9")).map((p) => projectCard(p, { archive: true, tasks: tmap[p.id] })).join("") + "</div></details>").join("");
    return '<div class="page-head"><div><h2>사업 아카이브</h2><p class="muted">역대 학생회가 진행한 사업이 학생회별로 쌓여요 · 지금까지 ' + past.length + "개</p></div>" +
      '<div class="actions"><button class="btn primary" data-act="addPastProject">+ 지난 사업 기록하기</button></div></div>' +
      '<div class="notice info small">학생회가 바뀔 때 관리 → 사이트 설정에서 <b>기수와 학생회 이름</b>을 바꾸면, ' + esc(curCouncil()) + '의 사업이 자동으로 이곳에 쌓여요.</div>' +
      '<input class="search" data-search="archive" placeholder="사업 이름 · 학생회 이름으로 검색 (예: 개강파티, 윤슬)" value="' + esc(S.q.archive || "") + '">' +
      '<div class="filters">' + deptFilterChips("archiveDept", "archiveDept") + "</div>" +
      (body || '<div class="card empty">아직 기록된 지난 사업이 없어요.<br>[+ 지난 사업 기록하기]로 이전 학생회 자료를 옮겨 두면 후배들이 참고할 수 있어요.</div>');
  };

  /* ----- 관리 (회장단) ----- */
  PAGES.admin = async function () {
    if (!isAdmin()) return '<div class="card empty">회장단만 볼 수 있는 화면이에요.</div>';
    const users = await col("users");
    const pending = users.filter((u) => u.status === "pending");
    const byDeptPos = (a, b) => deptRank(a.dept) - deptRank(b.dept) || posRank(a.position) - posRank(b.position) || a.name.localeCompare(b.name);
    const active = users.filter((u) => u.status === "approved").sort(byDeptPos);
    // 임기를 마친 OB는 "마지막으로 활동한 학생회"별로 묶어서 접어 둠 (그 학생회의 2학년이 그 묶음에 들어감)
    const lastGen = (u) => { const h = (u.history || []).slice().sort((a, b) => genNum(b.generation) - genNum(a.generation))[0]; return h ? h : null; };
    const obs = users.filter((u) => u.status === "inactive" && u.inactiveReason !== "탈퇴");
    const left = users.filter((u) => u.status === "rejected" || (u.status === "inactive" && u.inactiveReason === "탈퇴")).sort(byDeptPos);
    const obG = {};
    obs.forEach((u) => { const h = lastGen(u); const k = h ? h.generation : "기록 없음"; (obG[k] = obG[k] || { name: h ? h.councilName : "", list: [] }).list.push(Object.assign({}, u, h ? { dept: h.dept || u.dept, position: h.position || u.position } : {})); });
    const stLabel = { approved: "활동 중", inactive: "임기 종료", rejected: "반려" };
    const pendingHTML = pending.length ? pending.map((u) =>
      '<div class="prow"><div><b>' + esc(u.name) + "</b> " + deptTag(u.dept) + " " + esc(u.position) +
      '<div class="muted small">' + esc(u.studentId) + " · " + esc(u.phone) + " · " + esc(u.email) + "</div></div>" +
      '<div class="btns"><button class="btn sm ghost" data-act="rejectUser" data-id="' + esc(u.id) + '">반려</button><button class="btn sm primary" data-act="approveUser" data-id="' + esc(u.id) + '">승인</button></div></div>').join("")
      : '<p class="empty-s">대기 중인 가입 신청이 없어요.</p>';
    const userRow = (u) =>
      '<tr class="' + (u.status !== "approved" ? "dim" : "") + '"><td><input type="checkbox" class="sel" value="' + esc(u.id) + '"' + (u.id === S.authUser.uid ? " disabled" : "") + "></td>" +
      "<td><b>" + esc(u.name) + "</b>" + (u.isAdmin ? ' <span class="adm">회장단 권한</span>' : "") + '</td><td class="muted">' + (u.grade ? esc(u.grade) : '<span class="warn-t">미입력</span>') + "</td><td>" + deptTag(u.dept) + "</td><td>" + esc(u.position) + "</td>" +
      "<td>" + esc(u.status === "inactive" ? (u.inactiveReason || "임기 종료") : (stLabel[u.status] || u.status)) + '</td><td><button class="btn sm ghost" data-act="adminEditUser" data-id="' + esc(u.id) + '">편집</button></td></tr>';
    const table = (list, withSel) => '<div class="tablewrap"><table class="utable"><thead><tr><th></th><th>이름</th><th>학년</th><th>국서</th><th>직책</th><th>상태</th><th></th></tr></thead><tbody>' +
      list.map((u) => withSel ? userRow(u) : userRow(u).replace(/<input type="checkbox" class="sel"[^>]*>/, "")).join("") + "</tbody></table></div>";
    const obHTML = Object.keys(obG).sort((a, b) => genNum(b) - genNum(a)).map((g) =>
      '<details class="year"><summary><b>' + esc(g === "기록 없음" ? "학생회 기록 없음" : councilLabel(g, obG[g].name)) + "</b> <small>" + obG[g].list.length + "명</small></summary>" +
      table(obG[g].list.sort(byDeptPos), false) + "</details>").join("");
    return '<div class="page-head"><div><h2>관리</h2><p class="muted">회장단 권한이 있는 사람만 보이는 화면이에요.</p></div></div>' +
      '<section class="card"><h3>가입 승인 대기 <small>' + pending.length + "명</small></h3>" + pendingHTML + "</section>" +
      '<section class="card"><div class="card-head"><h3>지금 활동 중인 회원 <small>' + active.length + "명</small></h3>" +
      '<button class="btn sm" data-act="bulkInactive">선택한 회원 임기 종료</button></div>' +
      '<p class="muted small">· <b>회장단 권한</b>을 주면 그 사람도 가입 승인과 이 관리 화면을 쓸 수 있어요. <br>· 임기가 끝난 회원은 체크 후 <b>임기 종료</b>, 중간에 그만두는 회원은 <b>[편집] → [탈퇴 처리]</b>. 둘 다 연락망에서 빠지고 사이트에 못 들어와요. (남긴 기록은 유지, 탈퇴는 전화번호도 삭제)<br>· 회원 본인도 [내 정보] → [학생회 탈퇴]로 직접 탈퇴할 수 있어요.</p>' +
      table(active, true) + "</section>" +
      (obHTML || left.length ? '<section class="card"><h3>지난 회원 <small>' + obs.length + "명" + (left.length ? " · 탈퇴·반려 " + left.length + "명" : "") + "</small></h3>" +
        '<p class="muted small">임기를 마친 회원은 마지막으로 활동한 학생회별로 묶여 있어요. 눌러서 펼쳐 보세요. 다시 활동하게 되면 [편집]에서 상태를 "활동 중"으로 바꾸면 돼요.</p>' +
        obHTML +
        (left.length ? '<details class="year"><summary><b>탈퇴 · 가입 반려</b> <small>' + left.length + "명</small></summary>" + table(left, false) + "</details>" : "") +
        "</section>" : "") +
      '<section class="card"><div class="card-head"><h3>사이트 설정</h3><button class="btn sm primary" data-act="editSettings">설정 바꾸기</button></div>' +
      '<dl class="meta wide"><dt>지금 학생회</dt><dd><b>' + esc(curCouncil()) + "</b></dd>" +
      "</dd><dt>국서 목록</dt><dd>" + S.settings.depts.map(deptTag).join(" ") + "</dd><dt>직책</dt><dd>" + esc(execDept()) + ": " + esc(execPositions().join(", ")) + " / 그 밖의 국서: " + esc(deptPositions().join(", ")) +
      "</dd><dt>회의 종류</dt><dd>" + esc(S.settings.minuteTypes.join(", ")) + "</dd><dt>회의록 폴더</dt><dd>" + (safeUrl(S.settings.minutesFolderUrl) ? '<a href="' + esc(safeUrl(S.settings.minutesFolderUrl)) + '" target="_blank" rel="noopener">열기 ↗</a>' : '<span class="muted">미등록</span>') + "</dd></dl></section>" +
      '<section class="card"><div class="card-head"><h3>새 학생회 인수인계 순서</h3><button class="btn sm primary" data-act="handover">새 학생회로 넘기기</button></div><ol class="steps">' +
      "<li>새 학생회원들이 사이트에 로그인해서 <b>가입 신청</b></li>" +
      "<li>지금 회장단이 신청을 <b>승인</b>하고, 새 회장·부회장에게 <b>회장단 권한</b> 부여</li>" +
      "<li>[새 학생회로 넘기기]에서 새 <b>기수와 학생회 이름</b> 입력, <b>계속 활동할 회원</b> 체크 → 나머지는 자동 임기 종료, " + esc(curCouncil()) + "의 사업은 아카이브로</li>" +
      "<li>마지막으로 새 회장단이 <b>넘긴 사람(이전 회장단) 계정</b>을 회원 관리에서 임기 종료</li>" +
      "<li>학생회 공용 gmail 비밀번호를 새 회장단에게 전달하고, 공용 gmail의 <b>복구 이메일·전화번호를 새 회장 것으로 변경</b> (사이트·Firebase·GitHub 모두 이 계정 하나로 관리)</li></ol></section>";
  };

  /* ============================================================
     버튼 동작
     ============================================================ */
  async function after(...names) { names.forEach(dirty); await renderPage(); }
  const stamp = () => ({ createdBy: S.authUser.uid, createdAt: new Date().toISOString() });

  async function findIn(c, id) { return (await col(c)).find((x) => x.id === id); }

  /* 사업 하나에 국서별 업무를 한 번에 나눠 넣기 → 업무 캘린더에도 표시 */
  function openDistribute(p, rows, fromWho) {
    rows = rows && rows.length ? rows : [{}, {}, {}];
    const deptOpts = (sel) => '<option value="">국서 선택</option>' + S.settings.depts.map((d) => '<option value="' + esc(d) + '"' + (d === sel ? " selected" : "") + ">" + esc(d) + "</option>").join("");
    const rowHTML = (r) => '<div class="drow"><select class="d-dept" aria-label="담당 국서">' + deptOpts(r.dept || "") + "</select>" +
      '<input class="d-title" placeholder="할 일 (예: 공지글 작성)" value="' + esc(r.title || "") + '" aria-label="할 일">' +
      dateInputHTML('class="d-date" aria-label="마감일"', r.dueDate || "") +
      '<button type="button" class="x d-del" aria-label="이 줄 지우기">×</button></div>';
    openForm({ title: "'" + p.name + "' 업무 분배", submitLabel: "캘린더에 추가",
      intro: (fromWho
        ? '<p class="small"><b>' + esc(fromWho) + "</b>의 업무 분배를 불러왔어요. <b>마감일만 새로 넣고</b>, 필요 없는 줄은 ×로 지우세요.</p>"
        : '<p class="muted small">국서마다 맡을 일과 마감일을 적으면 업무 캘린더에도 국서별 색깔로 표시돼요. 빈 줄은 무시돼요.</p>') +
        (p.startDate ? '<p class="small"><b>사업 날짜: ' + eventDateText(p) + "</b> (" + dday(p.startDate) + ")</p>" : '<p class="small muted">사업 날짜를 넣어 두면 여기에 표시돼서 마감일 정하기가 쉬워요.</p>'),
      fields: [],
      after: '<div class="dlist">' + rows.map(rowHTML).join("") + '</div><button type="button" class="btn sm" id="dAdd">+ 줄 추가</button>',
      onSubmit: async () => {
        const list = Array.from(modalRoot.querySelectorAll(".drow")).map((r) => ({
          dept: r.querySelector(".d-dept").value, title: r.querySelector(".d-title").value.trim(), dueDate: isoDate(r.querySelector(".d-date").value) || "",
        })).filter((r) => r.title);
        if (!list.length) throw new Error("할 일을 한 줄 이상 적어 주세요.");
        const bad = list.find((r) => !r.dept || !r.dueDate);
        if (bad) throw new Error("'" + bad.title + "'의 " + (!bad.dept ? "담당 국서를" : "마감일을") + " 넣어 주세요.");
        for (const r of list) await DB.add("tasks", Object.assign(r, { projectId: p.id, assignee: "", memo: "", done: false }, stamp()));
        await after("tasks", "projects"); toast(list.length + "개 업무를 캘린더에 추가했어요.");
      } });
    const box = modalRoot.querySelector(".dlist");
    modalRoot.querySelector("#dAdd").addEventListener("click", () => { box.insertAdjacentHTML("beforeend", rowHTML({})); box.lastElementChild.querySelector(".d-dept").focus(); });
    box.addEventListener("click", (e) => { if (e.target.classList.contains("d-del")) e.target.closest(".drow").remove(); });
  }

  /* 탈퇴: 사이트 접속 막고, 연락망에서 빼고, 전화번호는 개인정보라 지움. 이름과 남긴 기록은 유지 */
  async function withdraw(u, self) {
    if (u.isAdmin) {
      const others = (await col("users")).filter((x) => x.id !== u.id && x.status === "approved" && x.isAdmin);
      if (!others.length && self) throw new Error("회장단 권한이 있는 사람이 혼자예요. 다른 사람에게 회장단 권한을 준 뒤 탈퇴해 주세요.");
    }
    const msg = self
      ? "정말 학생회를 탈퇴할까요?\n· 사이트에 더 이상 들어올 수 없어요\n· 연락망에서 빠지고 전화번호는 삭제돼요\n· 내가 남긴 업무·회의록·사업 기록은 그대로 남아요"
      : u.name + " 님을 탈퇴 처리할까요?\n· 사이트에 들어올 수 없게 되고 연락망에서 빠져요\n· 전화번호는 삭제돼요\n· 남긴 업무·회의록·사업 기록은 그대로 남아요";
    if (!confirm(msg)) return;
    await DB.update("users", u.id, { status: "inactive", inactiveReason: "탈퇴", isAdmin: false, phone: "", leftAt: today() });
    closeModal(); dirty("users");
    if (self) { await loadMe(); render(); }
    else { await renderPage(); updatePendingBadge(); toast(u.name + " 님을 탈퇴 처리했어요."); }
  }

  // 활동 중인 회원의 한마디 → 봉인(capsules), 임기를 마친 OB의 한마디 → 바로 공개(messages)
  function openMsgForm(m, sealedEdit) {
    const sealedNew = !m && isSenior();
    if (!m && S.me && S.me.status === "approved" && !isSenior()) { toast("선배들의 한마디는 2학년이 남기는 공간이에요.", true); return; }
    const colName = m ? (sealedEdit ? "capsules" : "messages") : (sealedNew ? "capsules" : "messages");
    openForm({ title: m ? "한마디 수정" : (sealedNew ? "후배들에게 한마디 봉인하기 🔒" : "후배들에게 한마디 남기기"), fields: msgFields(), values: m || { toDept: "모두에게" }, submitLabel: m ? "저장" : (sealedNew ? "봉인하기" : "남기기"),
      intro: m ? "" : (sealedNew
        ? '<p class="small">이 한마디는 <b>봉인</b>돼서 지금은 나만 볼 수 있어요. 학생회를 다음 기수로 넘기는 날 <b>' + esc(councilLabel(myCouncilInfo().generation, myCouncilInfo().councilName)) + " 선배의 한마디</b>로 후배들에게 공개돼요.</p>"
        : '<p class="muted small">' + esc(councilLabel(myCouncilInfo().generation, myCouncilInfo().councilName)) + " 선배의 한마디로 바로 공개돼요. 지금 학생회 후배들이 볼 수 있어요.</p>"),
      extraButtons: m ? [{ label: "삭제", cls: "danger", onClick: async () => {
        if (!confirm("이 한마디를 삭제할까요?")) return;
        await DB.remove(colName, m.id); closeModal(); dirty("messages"); isApproved() ? renderPage() : render(); toast("삭제했어요.");
      } }] : [],
      onSubmit: async (v) => {
        if (m) await DB.update(colName, m.id, v);
        else {
          const c = myCouncilInfo();
          await DB.add(colName, Object.assign(v, { authorUid: S.authUser.uid, authorName: (S.me && S.me.name) || "학생회",
            authorDept: c.dept || "", authorPosition: c.position || "", generation: c.generation, councilName: c.councilName, createdAt: new Date().toISOString() }));
        }
        dirty("messages"); if (isApproved()) { if (!m && sealedNew && S.route !== "messages") location.hash = "messages"; else await renderPage(); } else render();
        toast(m ? "저장했어요." : sealedNew ? "봉인했어요. 넘기는 날 열려요!" : "한마디를 남겼어요. 고마워요!");
      } });
  }

  const ACTS = {
    addMsg() { openMsgForm(); },
    async editMsg(el) {
      const sealed = !!el.dataset.sealed;
      const m = sealed ? (await loadCapsules()).find((x) => x.id === el.dataset.id) : await findIn("messages", el.dataset.id);
      if (m) openMsgForm(m, sealed);
    },
    async delPost(el) {
      if (!confirm("이 글을 삭제할까요? 달린 댓글도 함께 지워져요.")) return;
      const id = el.dataset.id;
      for (const c of (await col("talkComments")).filter((x) => x.postId === id)) { try { await DB.remove("talkComments", c.id); } catch (e) { /* 남의 댓글은 회장단만 */ } }
      await DB.remove("talk", id); await after("talk", "talkComments"); toast("삭제했어요.");
    },
    async delComment(el) {
      if (!confirm("댓글을 삭제할까요?")) return;
      await DB.remove("talkComments", el.dataset.id); await after("talkComments");
    },
    msgTo(el) { S.msgTo = el.dataset.dept; renderPage(); },
    async login() { try { await DB.signIn(); } catch (e) { toast(errMsg(e), true); } },
    async demoLogin(el) { await DB.signInAs(el.dataset.uid); },
    demoSwitch() { S.cache = {}; DB.signOut(); },
    async logout() { S.cache = {}; S.route = "home"; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* 무시 */ } await DB.signOut(); },
    openExternal() { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href); },
    reload() { S.cache = {}; renderPage(); },
    async recheck() { await loadMe(); render(); if (S.me && S.me.status === "pending") toast("아직 승인 전이에요."); },
    reapply() {
      openForm({ title: "다시 신청하기", fields: profileFields(), values: S.me, submitLabel: "신청",
        intro: '<p class="muted small">정보를 확인하고 신청하면 회장단이 승인해 드려요.</p>',
        onSubmit: async (v) => {
          await DB.update("users", S.authUser.uid, Object.assign(v, { status: "pending", inactiveReason: "", profileCheck: false }));
          await loadMe(); render(); toast("다시 신청했어요.");
        } });
    },
    print() { window.print(); },
    async copyContacts() {
      const users = (await col("users")).filter((u) => u.status === "approved")
        .sort((a, b) => deptRank(a.dept) - deptRank(b.dept) || posRank(a.position) - posRank(b.position));
      const txt = "[" + curCouncil() + " 학생회 비상연락망]\n" + users.map((u) => u.dept + " " + u.position + " " + u.name + " " + u.phone).join("\n");
      try { await navigator.clipboard.writeText(txt); toast("명단을 복사했어요. 카톡 등에 붙여넣기 하세요."); }
      catch (e) { infoModal("명단 복사", '<textarea class="copybox" rows="12">' + esc(txt) + "</textarea>"); }
    },
    editMe() {
      if (!S.me) return;
      openForm({ title: "내 정보 수정", fields: profileFields(), values: S.me,
        extraButtons: S.me.status === "approved" ? [{ label: "학생회 탈퇴", cls: "danger", onClick: () => withdraw(S.me, true) }] : [],
        onSubmit: async (v) => {
        await DB.update("users", S.authUser.uid, Object.assign(v, { profileCheck: false }));
        await loadMe(); dirty("users"); render(); toast("저장했어요.");
      } });
    },

    /* 캘린더 */
    calMove(el) {
      const d = Number(el.dataset.d);
      if (d === 0) { const n = new Date(); S.calMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
      else S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + d, 1);
      renderPage();
    },
    calFilter(el) { S.calFilter = el.dataset.dept; renderPage(); },
    async addTask(el) {
      openForm({ title: "업무 추가", fields: taskFields(await linkableProjects()),
        values: { dueDate: el.dataset.date || today(), dept: S.calFilter || (S.me && S.me.dept) || "" },
        submitLabel: "추가", onSubmit: async (v) => {
          await DB.add("tasks", Object.assign(v, { done: false }, stamp()));
          await after("tasks"); toast("캘린더에 추가했어요.");
        } });
    },
    async editTask(el) {
      const t = await findIn("tasks", el.dataset.id);
      if (!t) return;
      const fields = taskFields(await linkableProjects(t.projectId)).concat([{ name: "done", label: "완료한 업무예요", type: "checkbox" }]);
      openForm({ title: "업무 보기 · 수정", fields: fields, values: t,
        extraButtons: canDelete(t) ? [{ label: "삭제", cls: "danger", onClick: async () => {
          if (!confirm("이 업무를 삭제할까요?")) return;
          await DB.remove("tasks", t.id); closeModal(); await after("tasks"); toast("삭제했어요.");
        } }] : [],
        onSubmit: async (v) => { await DB.update("tasks", t.id, v); await after("tasks"); toast("저장했어요."); } });
    },
    async distribute(el) {
      const p = await findIn("projects", el.dataset.id);
      if (p) openDistribute(p);
    },
    async toggleTask(el) {
      try { await DB.update("tasks", el.dataset.id, { done: el.checked }); await after("tasks"); }
      catch (e) { toast(errMsg(e), true); el.checked = !el.checked; }
    },

    /* 회의록 */
    minType(el) { S.minType = el.dataset.t; renderPage(); },
    async addMinute() {
      const cs = await knownCouncils();
      const nameOf = (g) => (cs.find((c) => c.g === g) || {}).name || "";
      openForm({ title: "회의록 등록", fields: minuteFields(cs), values: { councilKey: S.settings.generation, date: today(), type: S.settings.minuteTypes[0] }, submitLabel: "등록",
        onSubmit: async (v) => {
          const g = v.councilKey; delete v.councilKey;
          await DB.add("minutes", Object.assign(v, { generation: g, councilName: nameOf(g) }, stamp())); await after("minutes"); toast("등록했어요.");
        } });
    },
    async editMinute(el) {
      const m = await findIn("minutes", el.dataset.id);
      if (!m) return;
      const cs = await knownCouncils();
      const nameOf = (g) => (cs.find((c) => c.g === g) || {}).name || "";
      openForm({ title: "회의록 수정", fields: minuteFields(cs), values: Object.assign({ councilKey: minuteGen(m) }, m),
        extraButtons: canDelete(m) ? [{ label: "삭제", cls: "danger", onClick: async () => {
          if (!confirm("목록에서 삭제할까요? (구글 독스 파일은 지워지지 않아요)")) return;
          await DB.remove("minutes", m.id); closeModal(); await after("minutes"); toast("삭제했어요.");
        } }] : [],
        onSubmit: async (v) => {
          const g = v.councilKey; delete v.councilKey;
          await DB.update("minutes", m.id, Object.assign(v, { generation: g, councilName: nameOf(g) })); await after("minutes"); toast("저장했어요.");
        } });
    },

    /* 사업 */
    projDept(el) { S.projDept = el.dataset.dept; renderPage(); },
    archiveDept(el) { S.archiveDept = el.dataset.dept; renderPage(); },
    addProject() {
      openForm({ title: "사업 추가", fields: projectFields(), submitLabel: "추가",
        values: { year: S.settings.currentYear, status: "기획중", dept: S.projDept || (S.me && S.me.dept) || "" },
        onSubmit: async (v) => {
          // 지금 학생회 이름이 자동으로 기록됨
          await DB.add("projects", Object.assign(v, { generation: S.settings.generation, councilName: S.settings.councilName }, stamp()));
          await after("projects"); toast("추가했어요.");
        } });
    },
    addPastProject() {
      openForm({ title: "지난 사업 기록하기", fields: projectFields({ council: true, past: true }), submitLabel: "기록",
        intro: '<p class="muted small">이전 학생회의 기획안 링크와 남길 말을 기록해 두면, 다음 학생회가 같은 사업을 할 때 큰 도움이 돼요.</p>',
        values: { year: S.settings.currentYear - 1, status: "완료" },
        onSubmit: async (v) => {
          if (v.generation && v.generation === S.settings.generation) throw new Error("지금 학생회(" + S.settings.generation + ") 사업은 [사업 기획안] 메뉴에서 추가해 주세요.");
          await DB.add("projects", Object.assign(v, stamp())); await after("projects"); toast("아카이브에 기록했어요.");
        } });
    },
    async editProject(el) {
      const p = await findIn("projects", el.dataset.id);
      if (!p) return;
      openForm({ title: "사업 수정", fields: projectFields({ council: true }), values: p,
        extraButtons: canDelete(p) ? [{ label: "삭제", cls: "danger", onClick: async () => {
          if (!confirm("'" + p.name + "' 사업을 삭제할까요? 되돌릴 수 없어요.\n(분배된 업무는 캘린더에 그대로 남아요)")) return;
          await DB.remove("projects", p.id);
          for (const t of (await col("tasks")).filter((x) => x.projectId === p.id)) await DB.update("tasks", t.id, { projectId: "" });
          closeModal(); await after("projects", "tasks"); toast("삭제했어요.");
        } }] : [],
        onSubmit: async (v) => { await DB.update("projects", p.id, v); await after("projects"); toast("저장했어요."); } });
    },
    async viewProject(el) {
      const p = await findIn("projects", el.dataset.id);
      if (p) { location.hash = isCurrent(p) ? "projects" : "archive"; }
    },
    async reuseProject(el) {
      const p = await findIn("projects", el.dataset.id);
      if (!p) return;
      const who = councilLabel(p.generation, p.councilName) || p.year + "년";
      openForm({ title: "참고해서 새로 기획하기", submitLabel: "만들기",
        intro: '<p class="muted small">' + esc(who) + "의 '" + esc(p.name) + "'을 바탕으로 " + esc(curCouncil()) + " 사업을 새로 만들어요. 이전 기획안 링크는 참고용으로 함께 붙어요.</p>",
        fields: projectFields(),
        values: { name: p.name, dept: p.dept, year: S.settings.currentYear, status: "기획중", budget: p.budget, summary: "" },
        onSubmit: async (v) => {
          const data = Object.assign(v, {
            generation: S.settings.generation, councilName: S.settings.councilName,
            prevNote: who + " " + p.name + (p.summary ? " — " + p.summary : ""), prevPlanUrl: safeUrl(p.planUrl) || safeUrl(p.resultUrl),
          }, stamp());
          const id = await DB.add("projects", data);
          const oldTasks = (await tasksByProject())[p.id] || [];
          dirty("projects"); location.hash = "projects"; toast("사업 기획안에 추가했어요.");
          // 이전 업무 분배를 불러와서 마감일만 새로 넣게 함
          if (oldTasks.length) setTimeout(() => openDistribute(Object.assign({ id: id }, data),
            oldTasks.map((t) => ({ dept: t.dept, title: t.title, dueDate: "" })), who), 0);
        } });
    },

    /* 관리 */
    async approveUser(el) {
      try { await DB.update("users", el.dataset.id, { status: "approved" }); await after("users"); updatePendingBadge(); toast("승인했어요."); }
      catch (e) { toast(errMsg(e), true); }
    },
    async rejectUser(el) {
      if (!confirm("가입 신청을 반려할까요?")) return;
      try { await DB.update("users", el.dataset.id, { status: "rejected" }); await after("users"); updatePendingBadge(); toast("반려했어요."); }
      catch (e) { toast(errMsg(e), true); }
    },
    async adminEditUser(el) {
      const u = await findIn("users", el.dataset.id);
      if (!u) return;
      const self = u.id === S.authUser.uid;
      const fields = profileFields().map((f) => (f.name === "phone" ? Object.assign({}, f, { required: false }) : f)).concat([
        { name: "status", label: "상태", type: "select", options: ["approved", "pending", "inactive", "rejected"], required: true,
          labels: { approved: "활동 중", pending: "승인 대기", inactive: "활동 종료 (임기 종료·탈퇴)", rejected: "가입 반려" } },
        { name: "isAdmin", label: "회장단 권한 (가입 승인·관리 화면 사용)", type: "checkbox" },
      ]);
      const btns = [];
      if (!self && u.status === "approved") btns.push({ label: "탈퇴 처리", cls: "danger", onClick: () => withdraw(u, false) });
      if (!self) btns.push({ label: "완전 삭제", cls: "danger", onClick: async () => {
        if (!confirm(u.name + " 회원 정보를 완전히 삭제할까요? 되돌릴 수 없어요.\n(보통은 '탈퇴 처리'를 권장해요. 다시 로그인하면 새로 가입 신청할 수 있게 돼요)")) return;
        await DB.remove("users", u.id); closeModal(); await after("users"); toast("삭제했어요.");
      } });
      openForm({ title: u.name + " 회원 편집", fields: fields, values: u,
        intro: '<p class="muted small">로그인 계정: ' + esc(u.email) + (u.inactiveReason ? " · " + esc(u.inactiveReason) + (u.leftAt ? " (" + esc(u.leftAt) + ")" : "") : "") + "</p>",
        extraButtons: btns,
        onSubmit: async (v) => {
          if (self && (!v.isAdmin || v.status !== "approved") && !isOwner() && !confirm("본인의 회장단 권한/활동 상태를 해제하면 이 화면에 다시 못 들어와요. 계속할까요?")) return;
          if (v.status === "approved" && !v.phone) throw new Error("활동 중인 회원은 전화번호가 있어야 해요.");
          v.inactiveReason = v.status === "inactive" ? (u.inactiveReason || "임기 종료") : "";
          if (v.status === "inactive" && u.status === "approved") Object.assign(v, historyPatch(Object.assign({}, u, v)));
          if (v.status !== "approved") v.isAdmin = false;
          await DB.update("users", u.id, v);
          if (self) { await loadMe(); dirty("users"); render(); } else await after("users");
          toast("저장했어요.");
        } });
    },
    async bulkInactive() {
      const ids = Array.from(document.querySelectorAll(".sel:checked")).map((c) => c.value);
      if (!ids.length) return toast("임기 종료할 회원을 먼저 체크해 주세요.", true);
      if (!confirm(ids.length + "명을 임기 종료 처리할까요? 연락망에서 빠지고 사이트에 못 들어오게 돼요.")) return;
      try {
        const all = await col("users");
        for (const id of ids) {
          const u = all.find((x) => x.id === id) || {};
          await DB.update("users", id, Object.assign({ status: "inactive", inactiveReason: "임기 종료", isAdmin: false }, historyPatch(u)));
        }
        await after("users"); toast(ids.length + "명 임기 종료 처리했어요.");
      } catch (e) { toast(errMsg(e), true); await after("users"); }
    },
    editSettings() {
      const fields = [
        { name: "generation", label: "학생회 기수", required: true, half: true, placeholder: "예: 제29대" },
        { name: "councilName", label: "학생회 이름", half: true, placeholder: "예: 윤슬" },
        { name: "fixExisting", label: "오타 수정이에요 — 지금 학생회의 기존 사업 기록에도 바뀐 기수·이름을 똑같이 적용", type: "checkbox",
          help: "새 학생회로 넘기는 거라면 체크하지 말고 [새 학생회로 넘기기] 버튼을 쓰세요." },
        { name: "depts", label: "국서 목록 (한 줄에 하나씩, 위에서부터 순서대로 — 맨 위는 회장단 자리)", type: "textarea", rows: 7, required: true },
        { name: "execPositions", label: "회장단 직책 (국서 목록 맨 위 국서에 쓰여요, 한 줄에 하나씩)", type: "textarea", rows: 2, required: true },
        { name: "positions", label: "그 밖의 국서 직책 (한 줄에 하나씩, 높은 직책부터)", type: "textarea", rows: 2, required: true },
        { name: "minuteTypes", label: "회의 종류 (한 줄에 하나씩)", type: "textarea", rows: 4, required: true },
        { name: "minutesFolderUrl", label: "회의록 구글 드라이브 폴더 주소", type: "url", placeholder: "https://drive.google.com/drive/folders/…" },
      ];
      openForm({ title: "사이트 설정", fields: fields, values: S.settings,
        intro: '<p class="muted small">국서 이름을 바꾸면, 기존에 그 이름으로 등록된 회원·업무는 예전 이름 그대로 남아요. 필요하면 각 항목에서 다시 골라 주세요.</p>',
        onSubmit: async (v) => {
          const lines = (s) => String(s).split(/\n|,/).map((x) => x.trim()).filter(Boolean);
          v.depts = lines(v.depts); v.positions = lines(v.positions); v.execPositions = lines(v.execPositions); v.minuteTypes = lines(v.minuteTypes);
          if (!v.depts.length || !v.positions.length || !v.execPositions.length || !v.minuteTypes.length) throw new Error("목록은 하나 이상 있어야 해요.");
          const fix = v.fixExisting; delete v.fixExisting;
          const oldGen = S.settings.generation;
          const changed = v.generation !== oldGen || v.councilName !== S.settings.councilName;
          if (changed && !fix && v.generation !== oldGen &&
              !confirm("기수를 바꾸면 " + curCouncil() + "의 사업이 모두 아카이브로 넘어가요.\n오타 수정이라면 [취소]를 누르고 '오타 수정이에요'에 체크해 주세요.\n계속할까요?")) return;
          if (changed && fix) {
            const mine = (await col("projects")).filter((p) => p.generation === oldGen);
            for (const p of mine) await DB.update("projects", p.id, { generation: v.generation, councilName: v.councilName });
            dirty("projects");
          }
          await DB.set("settings", "site", settingsDoc(v));
          await loadSettings(); render(); toast("설정을 저장했어요.");
        } });
    },
    async handover() {
      const me = S.authUser.uid;
      const members = (await col("users")).filter((u) => u.status === "approved")
        .sort((a, b) => String(b.studentId || "").localeCompare(String(a.studentId || "")) || a.name.localeCompare(b.name));
      // 학번 앞 4자리가 올해인 사람(1학년)을 '계속 활동'으로 미리 체크
      const row = (u) => {
        const self = u.id === me;
        // 1학년이면 계속 활동. 학년을 아직 안 적은 사람은 직책이 국원이면 1학년으로 짐작
        const keep = self || (u.grade ? u.grade === "1학년" : u.position === "국원");
        return '<label class="keeprow' + (self ? " self" : "") + '"><input type="checkbox" class="keep" value="' + esc(u.id) + '"' + (keep ? " checked" : "") + (self ? " disabled" : "") + ">" +
          "<b>" + esc(u.name) + "</b>" + deptTag(u.dept) + '<span class="muted small">' + esc(u.position) + " · " + (u.grade ? esc(u.grade) : "학년 미입력") + "</span>" +
          (u.isAdmin ? '<span class="adm">회장단 권한</span>' : "") + (self ? '<span class="muted small">(본인)</span>' : "") + "</label>";
      };
      openForm({ title: "새 학생회로 넘기기", submitLabel: "넘기기",
        intro: '<p class="small">[넘기기]를 누르면:</p><ul class="small" style="margin:0 0 8px;padding-left:18px">' +
          "<li><b>" + esc(curCouncil()) + "</b>의 사업이 학생회 이름과 함께 사업 아카이브로 이동해요</li>" +
          "<li>🔒 <b>타임캡슐이 열려요</b> — 지금 학생회가 봉인해 둔 한마디가 후배들에게 공개돼요. 넘기기 전에 다들 [소통방 → 선배들의 한마디]에 남겼는지 확인해 주세요</li>" +
          "<li>사이트 위쪽 이름이 새 학생회로 바뀌어요</li>" +
          "<li><b>체크하지 않은 회원은 임기 종료</b> — 사이트에 못 들어오고 연락망에서 빠져요 (기록은 남아요)</li>" +
          "<li>계속 활동하는 회원에게는 바뀐 국서·직책을 수정하라는 안내가 떠요</li></ul>",
        fields: [
          { name: "generation", label: "새 학생회 기수", required: true, half: true, placeholder: "예: 제30대" },
          { name: "councilName", label: "새 학생회 이름", required: true, half: true, placeholder: "새 학생회 이름" },
        ],
        after: '<div class="keepbox"><div class="keephead"><b>새 학생회에서도 계속 활동하는 회원</b>' +
          '<span><button type="button" class="linkbtn small" id="keepAll">전체 선택</button> · <button type="button" class="linkbtn small" id="keepNone">전체 해제</button></span></div>' +
          '<p class="muted small"><b>1학년</b>을 미리 체크해 뒀어요(학년 미입력이면 국원을 체크). 남는 2학년이 있거나 떠나는 1학년이 있으면 직접 바꿔 주세요. 남는 1학년은 넘긴 뒤 자동으로 2학년이 돼요. <b>새 회장에게 회장단 권한</b>이 있어야 넘길 수 있어요.</p>' +
          '<div class="keeplist">' + members.map(row).join("") + "</div></div>",
        values: { generation: genNum(S.settings.generation) ? "제" + (genNum(S.settings.generation) + 1) + "대" : "" },
        onSubmit: async (v) => {
          if (v.generation === S.settings.generation) throw new Error("기수가 지금과 같아요. 새 학생회 기수를 넣어 주세요. (이름만 고치려면 [설정 바꾸기]를 쓰세요)");
          const keepIds = Array.from(modalRoot.querySelectorAll(".keep:checked")).map((c) => c.value).concat([me]);
          const keepers = members.filter((u) => keepIds.indexOf(u.id) >= 0 && u.id !== me);
          const leavers = members.filter((u) => keepIds.indexOf(u.id) < 0);
          if (!keepers.some((u) => u.isAdmin))
            throw new Error("계속 활동하는 회원 중에 회장단 권한이 있는 사람이 없어요. 먼저 회원 관리에서 새 회장·부회장에게 회장단 권한을 준 뒤 넘겨 주세요.");
          if (!confirm(leavers.length + "명을 임기 종료하고 " + councilLabel(v.generation, v.councilName) + " 학생회로 넘길까요?")) return;
          // 이번 학생회 멤버 명단을 기록으로 남김 (OB 화면에서 이름·국서·직책만 보여줌)
          // 임기 중간에 먼저 임기 종료된 사람도 이번 학생회 멤버로 함께 기록
          const earlyOB = (await col("users")).filter((u) => u.status === "inactive" && u.inactiveReason === "임기 종료" &&
            (u.history || []).some((h) => h.generation === S.settings.generation));
          const roster = members.concat(earlyOB.map((u) => Object.assign({}, u, (u.history || []).find((h) => h.generation === S.settings.generation) || {})));
          await DB.set("councils", councilDocId(S.settings.generation), {
            generation: S.settings.generation, councilName: S.settings.councilName || "", endedAt: today(),
            // 번호는 본인이 공개에 동의한 경우만, 같은 학생회 멤버(memberUids)만 볼 수 있음
            members: roster.map((u) => ({ name: u.name, dept: u.dept || "", position: u.position || "", phone: u.obPhone === false ? "" : (u.phone || "") })),
            memberUids: roster.map((u) => u.id),
          });
          for (const u of leavers) await DB.update("users", u.id, Object.assign({ status: "inactive", inactiveReason: "임기 종료", isAdmin: false }, historyPatch(u)));
          for (const u of keepers) await DB.update("users", u.id, Object.assign({ profileCheck: true, grade: "2학년" }, historyPatch(u)));
          const selfU = members.find((u) => u.id === me);
          if (selfU) await DB.update("users", me, historyPatch(selfU));
          // 타임캡슐 공개: 이번 학생회가 봉인한 한마디를 공개 한마디로 옮김
          for (const cp of (await DB.list("capsules")).filter((x) => x.generation === S.settings.generation)) {
            const d = Object.assign({}, cp); delete d.id;
            await DB.add("messages", d); await DB.remove("capsules", cp.id);
          }
          // 기수 기록이 없는 회의록은 지금(넘기는) 학생회 것으로 표시해서 지난 회의록으로 보냄
          for (const mm of (await DB.list("minutes")).filter((x) => !x.generation))
            await DB.update("minutes", mm.id, { generation: S.settings.generation, councilName: S.settings.councilName || "" });
          await DB.set("settings", "site", Object.assign({}, S.settings, v, { currentYear: null, prevGeneration: S.settings.generation }));
          await loadSettings(); S.cache = {}; render();
          toast(curCouncil() + " 학생회로 넘겼어요. " + leavers.length + "명 임기 종료.");
        } });
      const setAll = (on) => modalRoot.querySelectorAll(".keep:not([disabled])").forEach((c) => (c.checked = on));
      modalRoot.querySelector("#keepAll").addEventListener("click", () => setAll(true));
      modalRoot.querySelector("#keepNone").addEventListener("click", () => setAll(false));
    },
    async profileOk() {
      await DB.update("users", S.authUser.uid, { profileCheck: false });
      await loadMe(); dirty("users"); renderPage(); toast("확인했어요.");
    },
  };

  /* ---------- 이벤트 연결 ---------- */
  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "INPUT") return;
    const fn = ACTS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    Promise.resolve(fn(el, e)).catch((er) => toast(errMsg(er), true));
  });
  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.matches("input[data-act]")) { const fn = ACTS[el.dataset.act]; if (fn) fn(el, e); }
  });
  // 날짜 칸: 숫자만 쳐도 YYYY.MM.DD 로 정리 / 달력 아이콘으로 고르기
  document.addEventListener("input", function (e) {
    const el = e.target;
    if (el.matches && el.matches("input[data-date]")) {
      el.value = fmtDots(el.value.replace(/\D/g, "").slice(0, 8));
      const iso = isoDate(el.value), nat = el.parentNode.querySelector(".dnative");
      if (nat && iso) nat.value = iso;
    } else if (el.matches && el.matches("input[data-money]")) {
      const digits = el.value.replace(/\D/g, "").slice(0, 12);
      el.value = digits ? commas(digits) : "";
    }
  });
  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.classList && el.classList.contains("dnative")) {
      const t = el.closest(".dwrap").querySelector("input[data-date]");
      if (t) t.value = dotDate(el.value);
    }
  });
  document.addEventListener("click", function (e) {
    const nat = e.target.classList && e.target.classList.contains("dnative") ? e.target : null;
    if (nat && nat.showPicker) { try { nat.showPicker(); } catch (x) {} }
  });
  let searchTimer;
  document.addEventListener("input", function (e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.search) return;
    S.q[el.dataset.search] = el.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async function () {
      const pos = el.selectionStart;
      await renderPage();
      const n = document.querySelector('[data-search="' + el.dataset.search + '"]');
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
    }, 200);
  });
  document.addEventListener("submit", async function (e) {
    const f = e.target;
    if (f.id !== "composeForm" && !f.classList.contains("cform")) return;
    e.preventDefault();
    const input = f.querySelector("textarea, input");
    const text = input.value.trim();
    if (!text) return;
    const btn = f.querySelector("button"); btn.disabled = true;
    const base = { text: text, authorUid: S.authUser.uid, authorName: (S.me && S.me.name) || "학생회", authorDept: (S.me && S.me.dept) || "",
      authorPosition: (S.me && S.me.position) || "", generation: S.settings.generation, councilName: S.settings.councilName || "", createdAt: new Date().toISOString() };
    try {
      if (f.id === "composeForm") { await DB.add("talk", base); await after("talk"); toast("올렸어요."); }
      else { await DB.add("talkComments", Object.assign(base, { postId: f.dataset.post })); await after("talkComments"); }
    } catch (er) { toast(errMsg(er), true); btn.disabled = false; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modalRoot.innerHTML) closeModal(); });
  window.addEventListener("hashchange", function () {
    S.route = (location.hash || "#home").slice(1);
    if (!PAGES[S.route]) S.route = "home";
    if (S.authUser && isApproved()) {
      document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + navKey(S.route)));
      window.scrollTo(0, 0);
      renderPage();
    }
  });

  /* ---------- 시작 ---------- */
  (async function boot() {
    S.route = (location.hash || "#home").slice(1);
    if (!PAGES[S.route]) S.route = "home";
    try {
      await DB.init();
    } catch (e) {
      app.innerHTML = '<main class="center-screen"><div class="card login"><h2>사이트를 불러오지 못했어요</h2><p class="muted">' + esc(e.message) + '</p><button class="btn primary wide" onclick="location.reload()">새로고침</button></div></main>';
      return;
    }
    DB.onAuth(async function (u) {
      S.authUser = u;
      S.cache = {};
      if (u) { app.innerHTML = '<div class="loading">불러오는 중…</div>'; await loadMe(); }
      else S.me = null;
      render();
    });
  })();
})();
