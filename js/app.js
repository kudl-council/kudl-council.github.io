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
    homeMsg: true,   // 홈에 '선배의 한마디' (사람마다 [숨기기] 가능)
    slogan: "여러분과 다 함께 더 밝게 반짝일 미래를 위해",   // 학생회 슬로건 (관리 → 사이트 설정에서 바꿈)
    depts: ["회장단", "내무국", "소통국", "홍보국", "재무국", "대외협력국"],
    execPositions: ["회장", "부회장"],   // 회장단(국 목록 맨 위) 직책
    positions: ["국장", "국원"],         // 그 밖의 국 직책
    minuteTypes: ["전체회의", "집행부회의", "국회의", "기타"],
    minutesFolderUrl: "",
  };
  const GRADES = ["1학년", "2학년"];
  const STATUSES = ["기획중", "예정", "진행중", "완료", "취소"];
  // 사업 날짜에 맞춰 상태 자동 변경: 사업 기간 중이면 '진행중', 끝난 다음 날부터 '완료'
  //   (기획중·예정·진행중만 바뀜. 완료·취소, 날짜 없는 사업은 그대로)
  // 이미 '완료'된 사업의 날짜를 앞으로 미루면 다시 '예정'(또는 기간 중이면 '진행중')으로 되돌림
  function reviveStatus(before, v) {
    if (v.status !== "완료" || !v.startDate) return v;
    if (v.startDate === before.startDate && (v.endDate || "") === (before.endDate || "")) return v;
    const end = v.endDate && v.endDate > v.startDate ? v.endDate : v.startDate;
    if (end >= today()) v.status = today() >= v.startDate ? "진행중" : "예정";
    return v;
  }
  function autoStatus(p) {
    if (!p || !p.startDate || ["기획중", "예정", "진행중"].indexOf(p.status) < 0) return p && p.status;
    const t = today(), end = p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate;
    if (t > end) return "완료";
    if (t >= p.startDate) return "진행중";
    return p.status;
  }
  const PALETTE = ["#9b1c31", "#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c", "#475569"];
  const NAV = [
    ["home", "홈"], ["contacts", "비상연락망"], ["calendar", "업무 캘린더"], ["room", "국서방"], ["minutes", "회의록"],
    ["projects", "사업 기획안"], ["archive", "사업 아카이브"], ["talk", "소통방"], ["admin", "관리"],
  ];

  // 왼쪽 메뉴 아이콘 (선 아이콘)
  const NAV_ICON = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    contacts: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    room: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
    minutes: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
    projects: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    talk: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    admin: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  };
  const navIcon = (k) => NAV_ICON[k] ? '<svg class="nico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + NAV_ICON[k] + "</svg>" : "";
  const navKey = (r) => (r === "messages" ? "talk" : r === "form" ? "projects" : r);   // 신청 페이지는 사업 기획안 안에 있음   // 선배들의 한마디는 소통방 탭 안에 있음
  const S = { authUser: null, me: null, settings: Object.assign({}, DEFAULTS), cache: {}, route: "home",
    routeArg: "", calMonth: null, calFilter: "", q: {}, archiveDept: "", projDept: "", minType: "", room: "" };

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
  // 사업 세부 일정 (가수요조사 기간, 공지 올리는 날 등): [{ title, start, end }]
  const schedOf = (p) => (Array.isArray(p.schedule) ? p.schedule : []).filter((s) => s && s.title);
  const schedEnd = (s) => (s.end && s.end > s.start ? s.end : s.start);
  function rangeText(s, e) {
    if (!s) return "날짜 미정";
    return !e || e <= s ? fmtDate(s) : fmtDate(s) + " ~ " + fmtDate(e);
  }
  function schedState(s) {
    if (!s.start) return "";
    const t = today();
    if (t < s.start) return dday(s.start);
    return t <= schedEnd(s) ? "진행 중" : "끝남";
  }
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
  // 국장·회장·부회장(그리고 회장단 권한자): 업무 추가·국서별 업무 분배·맡기기를 할 수 있음
  const isHead = () => isAdmin() || !!(S.me && S.me.status === "approved" &&
    (S.me.position === deptPositions()[0] || execPositions().indexOf(S.me.position) >= 0));
  // 업무 완료 체크: 국장·회장단 또는 그 업무를 맡은 국서 사람
  // 회장·부회장(회장단 직책)과 회장단 권한자: 모든 국서 관리 / 국장: 자기 국서만
  const isExecPos = () => !!(S.me && S.me.status === "approved" && execPositions().indexOf(S.me.position) >= 0);
  const isDeptHead = () => !!(S.me && S.me.status === "approved" && S.me.position === deptPositions()[0]);
  const canManage = (d) => isAdmin() || isExecPos() || (isDeptHead() && S.me.dept === d);
  const manageableDepts = () => (S.settings.depts || []).filter(canManage);
  const canTickTask = (t) => canManage(t && t.dept) || !!(S.me && S.me.status === "approved" && t && S.me.dept === t.dept);
  const membersOf = (d) => (S.cache.users || []).filter((u) => u.status === "approved" && u.dept === d)
    .sort((a, b) => posRank(a.position) - posRank(b.position) || (a.name || "").localeCompare(b.name || ""));
  // 담당자 칸: 국서를 고르면 그 국서 사람만 나옴. 예전에 글자로 적어 둔 담당자는 "txt:이름"으로 유지
  const memberValue = (dept, uid, name) => {
    if (uid) return uid;
    if (!name) return "";
    const u = membersOf(dept).find((x) => x.name === name);
    return u ? u.id : "txt:" + name;
  };
  const memberOf = (v) => {
    if (!v) return { uid: "", name: "" };
    if (v.indexOf("txt:") === 0) return { uid: "", name: v.slice(4) };
    const u = (S.cache.users || []).find((x) => x.id === v);
    return { uid: v, name: u ? u.name : "" };
  };
  function memberOptions(dept, cur) {
    const ms = membersOf(dept);
    let html = '<option value="">' + (dept ? "정하지 않음" : "국서를 먼저 고르세요") + "</option>" +
      ms.map((u) => '<option value="' + esc(u.id) + '"' + (u.id === cur ? " selected" : "") + ">" + esc(u.name + " · " + u.position) + "</option>").join("");
    if (cur && cur.indexOf("txt:") === 0) html += '<option value="' + esc(cur) + '" selected>' + esc(cur.slice(4)) + " (직접 적은 이름)</option>";
    else if (cur && !ms.some((u) => u.id === cur)) { const u = memberOf(cur); if (u.name) html += '<option value="' + esc(cur) + '" selected>' + esc(u.name) + "</option>"; }
    return html;
  }
  // 맡은 사람 여러 명: assigneeUids 배열 (예전 자료는 assigneeUid 하나)
  const uidsOf = (x) => (Array.isArray(x.assigneeUids) && x.assigneeUids.length ? x.assigneeUids : (x.assigneeUid ? [x.assigneeUid] : []));
  function membersChecksHTML(name, dept, cur, emptyLabel) {
    cur = cur || [];
    const ms = membersOf(dept);
    if (!dept) return '<p class="muted small">국서를 먼저 고르세요.</p>';
    let html = ms.map((u) => '<label class="mchk"><input type="checkbox" name="' + esc(name) + '" value="' + esc(u.id) + '"' + (cur.indexOf(u.id) >= 0 ? " checked" : "") + "> " + esc(u.name) + ' <small>' + esc(u.position) + "</small></label>").join("");
    cur.filter((v) => v.indexOf("txt:") === 0).forEach((v) => { html += '<label class="mchk"><input type="checkbox" name="' + esc(name) + '" value="' + esc(v) + '" checked> ' + esc(v.slice(4)) + " <small>직접 적은 이름</small></label>"; });
    return html + '<small class="help">' + esc(emptyLabel || "아무도 안 고르면 국서 전체 일이 돼요.") + "</small>";
  }
  function membersFrom(arr) {
    const uids = [], names = [];
    (arr || []).forEach((v) => { const m = memberOf(v); if (m.uid) uids.push(m.uid); if (m.name) names.push(m.name); });
    return { uids: uids, names: names };
  }
  function bindDeptMember(root) {
    root.querySelectorAll("[data-members-of]").forEach(function (box) {
      const d = root.querySelector('[name="' + box.dataset.membersOf + '"]');
      if (!d) return;
      d.addEventListener("change", function () { box.innerHTML = membersChecksHTML(box.dataset.name, d.value, [], box.dataset.empty); });
    });
    root.querySelectorAll("select[data-member-of]").forEach(function (m) {
      const d = root.querySelector('[name="' + m.dataset.memberOf + '"]');
      if (!d) return;
      d.addEventListener("change", function () { m.innerHTML = memberOptions(d.value, ""); });
    });
  }
  // 국서방: 우리 국서 방만 보임. 회장단(국서 목록 맨 위)과 회장단 권한자는 모든 국서 방을 볼 수 있음
  const canSeeAllRooms = () => isAdmin() || !!(S.me && S.me.dept === execDept());
  // 그 국서 방의 할 일을 쓰고 고칠 수 있는 사람: 그 국서의 국장(회장단은 회장·부회장) + 회장단 권한자
  const isRoomHead = (d) => canManage(d);
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
  // 완료·취소된 사업은 사업 날짜(끝나는 날)로부터 2주가 지나면 [사업 기획안]에서 빠지고 [사업 아카이브]로 감
  const ARCHIVE_AFTER_DAYS = 14;
  const isAutoArchived = (p) => {
    if (!p || (p.status !== "완료" && p.status !== "취소") || !p.startDate) return false;
    const end = p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate;
    return ymd(new Date(new Date(end + "T00:00:00").getTime() + ARCHIVE_AFTER_DAYS * 86400000)) < today();
  };
  const isActive = (p) => isCurrent(p) && !isAutoArchived(p);
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
    if (!S.cache[name] && name === "projects") {
      const list = await DB.list(name);
      const fix = [];
      list.forEach((p) => { const st = autoStatus(p); if (st !== p.status) { p.status = st; fix.push(p); } });
      S.cache[name] = list;
      // 바뀐 상태는 저장해 둠 (조용히, 실패해도 화면엔 맞게 보임)
      if (fix.length && isHead())
        fix.forEach((p) => DB.update("projects", p.id, { status: p.status }).catch((e) => console.warn(e)));
    }
    if (!S.cache[name] && name === "deptTasks") {
      // 국서방 할 일: 지금 학생회 것만. 회장단은 전체, 나머지는 우리 국서 것만 불러옴 (보안 규칙도 같은 기준)
      const all = canSeeAllRooms() ? await DB.list(name) : (S.me && S.me.dept ? await DB.queryEq(name, "dept", S.me.dept) : []);
      S.cache[name] = all.filter((x) => (x.generation || S.settings.generation) === S.settings.generation);
    }
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
    // 로그인 화면에 보일 학생회 이름 (기수·이름만, 누구나 볼 수 있음) — 회장단이 접속할 때 맞춰 둠
    if (isAdmin()) {
      try {
        const pub = await DB.get("settings", "public");
        if (!pub || pub.generation !== S.settings.generation || (pub.councilName || "") !== (S.settings.councilName || "") || (pub.slogan || "") !== (S.settings.slogan || ""))
          await DB.set("settings", "public", { generation: S.settings.generation, councilName: S.settings.councilName || "", slogan: S.settings.slogan || "" });
      } catch (e) { console.warn(e); }
    }
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
      } else if (f.type === "members") {
        const dept = f.dept || values[f.deptField || "dept"] || "";
        input = '<div class="mchecks" id="' + id + '" data-name="' + esc(f.name) + '"' + (f.dept ? "" : ' data-members-of="' + esc(f.deptField || "dept") + '"') + ' data-empty="' + esc(f.emptyLabel || "") + '">' +
          membersChecksHTML(f.name, dept, Array.isArray(v) ? v : [], f.emptyLabel) + "</div>";
        return '<div class="field' + (f.half ? " half" : "") + '"><label>' + esc(f.label) + "</label>" + input + help + "</div>";
      } else if (f.type === "member") {
        input = '<select id="' + id + '" name="' + f.name + '" data-member-of="' + esc(f.deptField || "dept") + '">' + memberOptions(values[f.deptField || "dept"] || "", v) + "</select>";
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
      if (f.type === "members") { out[f.name] = Array.from(root.querySelectorAll('input[name="' + f.name + '"]:checked')).map((x) => x.value); continue; }
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
    bindDeptMember(form);
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
      { name: "dept", label: "담당 국서", type: "select", options: manageableDepts(), required: true, half: true,
        help: isAdmin() || isExecPos() ? "" : "국장은 우리 국서 업무만 넣을 수 있어요." },
      { name: "dueDate", label: "마감일", type: "date", required: true, half: true },
      { name: "projectId", label: "관련 사업 (선택)", type: "select", options: ps.map((p) => p.id), labels: labels },
      { name: "assigneeSel", label: "맡을 사람 (여러 명 가능)", type: "members", deptField: "dept", emptyLabel: "고른 사람의 국서방에 보여요. 아무도 안 고르면 국서 전체 일이 돼요." },
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
    { name: "status", label: "진행 상태", type: "select", options: STATUSES, required: true, half: true, help: "사업 날짜가 되면 자동으로 '진행중', 끝나면 '완료'가 돼요." },
    o && o.past ? { name: "owner", label: "담당자", half: true } : { name: "ownerSel", label: "담당자", type: "member", deptField: "dept", half: true, help: "담당 국서를 고르면 그 국서 사람이 나와요." },
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
    // 왼쪽: 학생회 소개 (지금 학생회 이름은 로그인 전에도 볼 수 있는 settings/public 에서 가져옴)
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem("councilPublic") || "null"); } catch (e) { /* 무시 */ }
    app.innerHTML = demoBar() + '<main class="split">' +
      '<section class="lg-brand"><div class="mark lg-mark">DLS</div>' +
      '<div class="lg-mid"><p class="eyebrow">고려대학교 · 생명과학부</p><h1 id="brandName">' + esc((cached && cached.councilName) || "학생회") + "</h1>" +
      '<p class="lg-sub" id="brandSub">' + esc(cached && cached.generation ? cached.generation + " 생명과학부 학생회" : "생명과학부 학생회 업무 공간") + "</p>" +
      '<p class="lg-slogan" id="brandSlogan"' + (cached && cached.slogan ? "" : " hidden") + ">" + esc((cached && cached.slogan) || "") + "</p></div>" +
      '<p class="lg-foot">비상연락망 · 업무 캘린더 · 회의록 · 사업 기획안</p></section>' +
      '<section class="panel"><div class="card login2"><h2>학생회 로그인</h2>' +
      '<p class="muted small">학생회 구성원만 들어올 수 있는 공간이에요.</p>' + body + "</div></section></main>";
    DB.get("settings", "public").then((pub) => {
      if (!pub || !pub.generation) return;
      try { localStorage.setItem("councilPublic", JSON.stringify({ generation: pub.generation, councilName: pub.councilName || "", slogan: pub.slogan || "" })); } catch (e) { /* 무시 */ }
      const sl = document.getElementById("brandSlogan");
      if (sl) { sl.textContent = pub.slogan || ""; sl.hidden = !pub.slogan; }
      const n = document.getElementById("brandName"), sub = document.getElementById("brandSub");
      if (n) n.textContent = pub.councilName || "학생회";
      if (sub) sub.textContent = pub.generation + " 생명과학부 학생회";
    }).catch(() => {});
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
      '<a class="brand" href="#"><span class="mark">DLS</span><span><b>' + esc(CFG.siteName || "학생회") + '</b><small>OB 기록실</small></span></a>' +
      '<div class="me"><span class="who">' + esc(me.name) + ' <span class="muted">OB</span></span><button class="btn sm ghost" data-act="logout">로그아웃</button></div></div></header>' +
      '<main class="page" id="page"><div class="loading">불러오는 중…</div></main>';
    const page = document.getElementById("page");
    try {
      const hist = (me.history || []).slice().sort((a, b) => genNum(b.generation) - genNum(a.generation));
      const projects = (await DB.list("projects")).map((p) => Object.assign(p, { status: autoStatus(p) }));
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
    const nav = NAV.filter((n) => (n[0] !== "admin" || isAdmin()))
      .map((n) => '<a href="#' + n[0] + '" title="' + n[1] + '" class="' + (navKey(route) === n[0] ? "on" : "") + '">' + navIcon(n[0]) + "<span>" + n[1] + "</span>" + (n[0] === "admin" ? '<span class="badge" id="pendingBadge" hidden></span>' : "") + "</a>").join("");
    const LOGOUT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>';
    let folded = false;
    try { folded = localStorage.getItem("sideFolded") === "1"; } catch (e) { /* 무시 */ }
    app.innerHTML = demoBar() +
      '<div class="shell' + (folded ? " folded" : "") + '">' +
      // 폰에서만 보이는 위쪽 머리글
      '<header class="topbar"><div class="topbar-in">' +
      '<a class="brand" href="#home"><span class="mark">DLS</span><span><b>' + esc(CFG.siteName || "학생회") + '</b><small>' + esc(councilLabel(S.settings.generation + " 학생회", S.settings.councilName)) + "</small></span></a>" +
      '<div class="me">' + (me ? '<button class="btn sm ghost" data-act="editMe">내 정보</button>' : "") +
      '<button class="btn sm ghost" data-act="logout">로그아웃</button></div></div></header>' +
      // 컴퓨터: 왼쪽 메뉴 (학생회 이름 · 메뉴 · 접기 · 내 정보) / 폰: 위쪽 가로 메뉴
      '<aside class="side">' +
      '<a class="side-brand" href="#home"><span class="mark">DLS</span><span class="side-txt"><b>' + esc(S.settings.councilName || "학생회") + "</b><small>" + esc(CFG.siteName || "") + "</small></span></a>" +
      '<nav class="tabs">' + nav + "</nav>" +
      '<button class="side-fold" data-act="sideFold" title="메뉴 접기/펴기"><span class="fold-ico">«</span><span class="side-txt">접기</span></button>' +
      '<div class="side-me"><button class="side-who" data-act="' + (me ? "editMe" : "logout") + '" title="내 정보"><b>' + esc(me ? me.name : "학생회 공용계정") + "</b><small>" +
      esc(me ? [me.dept, me.position].filter(Boolean).join(" ") + " · 내 정보" : "로그아웃") + "</small></button>" +
      '<button class="side-out" data-act="logout" title="로그아웃" aria-label="로그아웃">' + LOGOUT + "</button></div>" +
      "</aside>" +
      '<div class="shell-main"><main class="page" id="page"><div class="loading">불러오는 중…</div></main>' +
      '<footer class="foot">' + esc(CFG.siteName || "") + " " + esc(curCouncil()) + " · 문의는 회장단에게</footer></div></div>";
    setHeaderHeight();
    renderPage();
    if (isAdmin()) updatePendingBadge();
    if (me && me.status === "approved" && !me.grade) setTimeout(askGrade, 300);
  }

  // 왼쪽 메뉴가 위쪽 머리글 바로 아래에 붙도록 머리글 높이를 기록
  function setHeaderHeight() {
    const h = document.querySelector(".topbar");
    if (h) document.documentElement.style.setProperty("--hh", h.offsetHeight + "px");
  }
  window.addEventListener("resize", setHeaderHeight);
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
      if (S.scrollTo) {
        const el = page.querySelector('[data-act="toggleProj"][data-id="' + S.scrollTo + '"]');
        S.scrollTo = "";
        if (el) setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
      }
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
    const showBack = S.me && S.me.hideHomeMsg && S.settings.homeMsg;
    return '<div class="page-head"><div><h2>소통방</h2><p class="muted">학생회끼리 자유롭게 떠드는 곳 + 선배들이 후배에게 남기는 한마디</p></div></div>' +
      talkTabs("messages") + sealed +
      '<div class="sec-h hm-row"><h3>선배들이 우리에게 남긴 한마디</h3>' + (showBack ? '<button class="btn sm" data-act="showHomeMsg">홈에 다시 보이기</button>' : "") + "</div>" +
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
  // 회장단 공지 (홈 맨 위에 고정). 표시 종료일이 지나면 자동으로 안 보임
  function noticeBoardHTML(list) {
    const t = today();
    const act = (list || []).filter((n) => !n.until || n.until >= t).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (!act.length) return isAdmin() ? '<div class="nb-empty"><button class="btn sm" data-act="addNotice">📌 공지 올리기</button> <span class="muted small">홈 맨 위에 모두에게 보여요</span></div>' : "";
    return '<section class="noticeboard"><div class="nb-head"><b>📌 공지</b>' + (isAdmin() ? '<button class="linkbtn small" data-act="addNotice">+ 공지 올리기</button>' : "") + "</div>" +
      act.map((n) => '<div class="nb-item"><p class="nb-text">' + esc(n.text).replace(/\n/g, "<br>") + "</p>" +
        '<div class="nb-meta">' + (safeUrl(n.url) ? '<a class="btn sm" href="' + esc(safeUrl(n.url)) + '" target="_blank" rel="noopener">자세히 보기 ↗</a>' : "") +
        '<span class="muted small">' + esc(n.authorName || "회장단") + " · " + fmtDate((n.createdAt || "").slice(0, 10)) + (n.until ? " · " + fmtDate(n.until) + "까지" : "") + "</span>" +
        (isAdmin() ? '<button class="linkbtn small" data-act="editNotice" data-id="' + esc(n.id) + '">수정</button><button class="linkbtn small del" data-act="delNotice" data-id="' + esc(n.id) + '">내리기</button>' : "") +
        "</div></div>").join("") + "</section>";
  }
  const noticeFields = () => [
    { name: "text", label: "공지 내용", type: "textarea", rows: 4, required: true, placeholder: "예: 이번 주 전체회의는 목요일 저녁 7시, 과방에서 해요." },
    { name: "url", label: "관련 링크 (선택)", type: "url", placeholder: "https://…" },
    { name: "until", label: "언제까지 보여줄까요? (선택)", type: "date", help: "이 날이 지나면 자동으로 내려가요. 비워 두면 직접 [내리기]를 누를 때까지 보여요." },
  ];
  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "아직 안 잤어요? 무리하지 말아요";
    if (h < 11) return "좋은 아침이에요";
    if (h < 17) return "오늘도 반짝이는 하루 보내요";
    if (h < 22) return "오늘 하루도 수고했어요";
    return "오늘도 고마워요, 푹 쉬어요";
  }
  // 홈 '이번 주 일정' — 일~토 7칸, 업무 마감 · 사업 · 세부 일정
  function weekHTML(tasks, projects) {
    const now = new Date(today() + "T00:00:00");
    const sun = new Date(now); sun.setDate(now.getDate() - now.getDay());   // 이번 주 일요일
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(sun); d.setDate(sun.getDate() + i); days.push(ymd(d)); }
    const byDay = {};
    tasks.filter((x) => days.indexOf(x.dueDate) >= 0).forEach((x) => (byDay[x.dueDate] = byDay[x.dueDate] || []).push(x));
    Object.values(byDay).forEach((a) => a.sort((p, q) => (p.done - q.done) || deptRank(p.dept) - deptRank(q.dept)));
    const all = calSpans(projects).filter((x) => x.a <= days[6] && x.b >= days[0]);
    const spans = all.filter((x) => spanDays(x) <= LONG_DAYS), longs = all.filter((x) => spanDays(x) > LONG_DAYS);
    const n = all.filter((x) => x.a <= days[6] && x.b >= days[0]).length + Object.values(byDay).reduce((k, a) => k + a.length, 0);
    const md = (k) => { const d = new Date(k + "T00:00:00"); return (d.getMonth() + 1) + "." + d.getDate(); };
    return '<section class="card week"><div class="card-head"><h3>이번 주 일정 <small>' + md(days[0]) + " – " + md(days[6]) + (n ? " · " + n + "개" : "") + '</small></h3><a href="#calendar" class="more">캘린더 →</a></div>' +
      longSpansHTML(longs, "진행 중") + weekRowHTML(days, spans, byDay, null, false, 3) + "</section>";
  }
  PAGES.home = async function () {
    const [tasks, projects, minutes, msgs, notices, roomTasks] = await Promise.all([col("tasks"), col("projects"), col("minutes"), col("messages").catch(() => []), col("notices").catch(() => []), col("deptTasks").catch(() => [])]);
    const myUid = S.authUser && S.authUser.uid;
    const myRoom = roomTasks.filter((x) => !x.done && S.me && x.dept === S.me.dept && (uidsOf(x).indexOf(myUid) >= 0 || !uidsOf(x).length))
      .concat(tasks.filter((x) => !x.done && uidsOf(x).indexOf(myUid) >= 0));
    const mine = S.me && S.me.dept;
    const pool = msgs.filter((m) => m.toDept === "모두에게" || (mine && m.toDept === "다음 " + mine + "에게"));
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const t = today();
    const in14 = ymd(new Date(Date.now() + 14 * 86400000));
    const open = tasks.filter((x) => !x.done);
    const late = open.filter((x) => x.dueDate < t).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const soon = open.filter((x) => x.dueDate >= t && x.dueDate <= in14).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const myDept = S.me && S.me.dept;
    const live = projects.filter((p) => isCurrent(p) && (p.status === "예정" || p.status === "기획중" || p.status === "진행중"))
      .sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
    const recent = minutes.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
    let pendingNote = "";
    if (isAdmin()) {
      const n = (await col("users")).filter((u) => u.status === "pending").length;
      if (n) pendingNote = '<a class="notice info link" href="#admin"><b>가입 승인 대기 ' + n + "명</b> — 눌러서 확인하기 →</a>";
    }
    const taskRow = (x) => '<li class="trow ' + (x.dueDate < t ? "late" : "") + (x.dept === myDept ? " mine" : "") + '" data-act="editTask" data-id="' + esc(x.id) + '">' +
      '<span class="dd">' + dday(x.dueDate) + "</span>" + deptTag(x.dept) + '<span class="tt">' + esc(x.title) + '</span><span class="dt">' + fmtDate(x.dueDate) + "</span></li>";
    if (S.me && S.me.profileCheck) pendingNote = '<div class="notice info"><b>' + esc(curCouncil()) + ' 학생회가 시작됐어요!</b> 지금 연락망에 <b>' + esc([S.me.grade, S.me.dept, S.me.position].filter(Boolean).join(" · ")) + "</b>(으)로 나와요. " +
      (isAdmin() ? "바뀌었다면 내 정보에서 수정해 주세요." : "소속 국서나 직책이 바뀌었다면 회장단에게 말해 주세요. 회장단이 [관리]에서 바꿔 줘요.") +
      '<div class="actions" style="margin-top:8px">' + (isAdmin() ? '<button class="btn sm primary" data-act="editMe">내 정보 수정</button>' : "") + '<button class="btn sm" data-act="profileOk">확인했어요</button></div></div>' + pendingNote;
    return pendingNote +
      '<div class="hello"><p class="muted">' + fmtDate(t, true) + "</p><h2>" + greeting() + (S.me ? ", " + esc(S.me.name) + "님" : "") + " 👋</h2>" +
        (S.settings.slogan ? '<p class="hello-slogan"><span>' + esc(councilLabel(S.settings.generation, S.settings.councilName)) + "</span>" + esc(S.settings.slogan) + "</p>" : "") + "</div>" +
      noticeBoardHTML(notices) +
      (myRoom.length ? '<a class="notice info link roomlink" href="#room"><b>📋 ' + esc(S.me.dept) + "방에 내가 할 일 " + myRoom.length + "개</b> — " +
        esc(myRoom.slice(0, 2).map((x) => x.title).join(", ")) + (myRoom.length > 2 ? " 외" : "") + " →</a>" : "") +
      weekHTML(tasks, projects) +
      (pick && S.settings.homeMsg && !(S.me && S.me.hideHomeMsg) ? '<a class="home-msg" href="#messages"><button class="hm-hide" data-act="hideHomeMsg" title="내 홈에서 숨기기">숨기기 ×</button><span class="lbl">선배의 한마디</span><span class="mtext">' + esc(pick.text) + '</span><span class="by">' + esc(msgByline(pick)) + "</span></a>" : "") +
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
  /* 달력 한 주 (업무 캘린더 · 홈 '이번 주 일정' 공용)
     여러 날짜에 걸친 사업·세부 일정은 이어진 색 띠 하나로, 이름은 시작하는 칸에 한 번만 */
  function calSpans(projects, filterDept, tasks) {
    const evsAll = projects.filter((p) => p.status !== "취소" && (!filterDept || p.dept === filterDept ||
      (tasks || []).some((x) => x.projectId === p.id && x.dept === filterDept)));
    return evsAll.filter((p) => p.startDate).map((p) => ({ kind: "ev", p: p, a: p.startDate, b: p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate, label: p.name, tip: "사업 · " + p.name + " · " + eventDateText(p) }))
      .concat([].concat.apply([], evsAll.map((p) => schedOf(p).filter((sc) => sc.start).map((sc) => ({ kind: "sch", p: p, a: sc.start, b: schedEnd(sc), label: sc.title, sub: p.name,
        tip: "[" + p.name + "] " + sc.title + " · " + rangeText(sc.start, sc.end) })))));
  }
  // 2주보다 긴 사업·일정(예: 9월~11월 내내 하는 사업)은 매주 띠로 그리면 달력이 꽉 차 보여서 달력 위에 따로 한 줄로
  const LONG_DAYS = 14;
  const spanDays = (x) => Math.round((new Date(x.b + "T00:00:00") - new Date(x.a + "T00:00:00")) / 86400000) + 1;
  function longSpansHTML(list, label) {
    if (!list.length) return "";
    const md = (k) => { const d = new Date(k + "T00:00:00"); return (d.getMonth() + 1) + "." + d.getDate(); };
    return '<div class="cal-long"><span class="muted small">' + label + "</span>" + list.map((x) => '<button class="cl-chip ' + x.kind + '" style="--c:' + deptColor(x.p.dept) + '" data-act="viewProject" data-id="' + esc(x.p.id) + '" title="' + esc(x.tip) + '"><i></i><b>' + esc(x.label) + "</b>" +
      (x.sub ? '<small>' + esc(x.sub) + "</small>" : "") + '<span class="muted">' + md(x.a) + "–" + md(x.b) + "</span></button>").join("") + "</div>";
  }
  function weekRowHTML(days, spans, byDay, month, clickAdd, maxT) {
    maxT = maxT || 3;
    const t = today(), ws = days[0], we = days[6];
    const pn = {};
    (S.cache.projects || []).forEach((p) => (pn[p.id] = p.name));
    const segs = spans.filter((x) => x.a <= we && x.b >= ws)
      .map((x) => ({ x: x, s: Math.max(0, days.indexOf(x.a < ws ? ws : x.a)), e: days.indexOf(x.b > we ? we : x.b) }))
      .sort((p, q) => p.s - q.s || (q.e - q.s) - (p.e - p.s) || (p.x.kind === "ev" ? -1 : 1));
    const lanes = [];
    segs.forEach((g) => { let l = 0; while (lanes[l] && lanes[l].some((h) => !(g.e < h.s || g.s > h.e))) l++; (lanes[l] = lanes[l] || []).push(g); g.l = l; });
    // 모든 칸 높이를 똑같이: 띠는 최대 3줄, 업무는 남는 자리만큼 (넘치면 +n)
    const MAXL = 3, H = month == null ? 84 : 96;
    const hidden = segs.filter((g) => g.l >= MAXL);
    const L = Math.min(lanes.length, MAXL);
    const hiddenOn = {};
    hidden.forEach((g) => { for (let i = g.s; i <= g.e; i++) hiddenOn[i] = (hiddenOn[i] || 0) + 1; });
    const fit = Math.max(1, Math.floor((H - 24 - L * 19 - 8) / 16));
    maxT = Math.min(maxT, fit);
    let row = "";
    days.forEach((key, i) => {
      const d = new Date(key + "T00:00:00"), other = month != null && d.getMonth() !== month;
      const cls = (other ? " other" : "") + (key === t ? " today" : "") + (key < t && month == null ? " past" : "") + (d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : "");
      const items = (byDay[key] || []);
      const more = Math.max(0, items.length - maxT) + (hiddenOn[i] || 0);
      row += '<div class="cday' + cls + '" style="grid-column:' + (i + 1) + '"' + (clickAdd ? ' data-act="addTask" data-date="' + key + '"' : "") + "></div>" +
        '<span class="cnum' + cls + '" style="grid-column:' + (i + 1) + '">' + (month == null ? '<small>' + DOW[d.getDay()] + "</small>" : "") + d.getDate() + "</span>" +
        (items.length || more ? '<div class="ctasks" style="grid-column:' + (i + 1) + ";grid-row:" + (L + 2) + '">' +
          items.slice(0, more && items.length > maxT ? maxT - 1 : maxT).map((x) => '<span class="ctask' + (x.done ? " done" : x.dueDate < t ? " late" : "") + '" style="--c:' + deptColor(x.dept) + '" data-act="editTask" data-id="' + esc(x.id) + '" title="' + esc(x.dept + " · " + (pn[x.projectId] ? "[" + pn[x.projectId] + "] " : "") + x.title) + '"><i></i>' + esc(x.title) + "</span>").join("") +
          (more ? '<span class="cmore">+' + (more + (items.length > maxT ? 1 : 0)) + "개 더</span>" : "") + "</div>" : "");
    });
    segs.filter((g) => g.l < MAXL).forEach((g) => {
      const x = g.x, contL = x.a < days[g.s], contR = x.b > days[g.e];
      row += '<span class="cbar ' + x.kind + (contL ? " cl" : "") + (contR ? " cr" : "") + '" style="--c:' + deptColor(x.p.dept) + ";grid-column:" + (g.s + 1) + " / " + (g.e + 2) + ";grid-row:" + (g.l + 2) +
        '" data-act="viewProject" data-id="' + esc(x.p.id) + '" title="' + esc(x.tip) + '">' + (contL ? "" : esc(x.label) + (x.sub ? '<small>' + esc(x.sub) + "</small>" : "")) + "</span>";
    });
    return '<div class="cweek' + (month == null ? " wk" : "") + '" style="height:' + H + 'px;grid-template-rows:22px' + (L ? " repeat(" + L + ", 17px)" : "") + ' 1fr">' + row + "</div>";
  }
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
    const evsAll = projects.filter((p) => p.status !== "취소" && (!S.calFilter || p.dept === S.calFilter ||
      tasks.some((x) => x.projectId === p.id && x.dept === S.calFilter)));
    const evs = evsAll.filter((p) => p.startDate);
    const evByDay = {};
    evs.forEach((p) => {
      const end = p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate;
      for (let d = new Date(p.startDate + "T00:00:00"), k = 0; ymd(d) <= end && k < 31; d.setDate(d.getDate() + 1), k++)
        (evByDay[ymd(d)] = evByDay[ymd(d)] || []).push(p);
    });
    // 사업 세부 일정 (기간이면 그 기간 매일)
    const schByDay = {}, monthSch = [];
    const monthKey0 = y + "-" + z(m + 1);
    evsAll.forEach((p) => schedOf(p).forEach((sc) => {
      if (!sc.start) return;
      const item = { p: p, s: sc };
      for (let d = new Date(sc.start + "T00:00:00"), k = 0; ymd(d) <= schedEnd(sc) && k < 62; d.setDate(d.getDate() + 1), k++)
        (schByDay[ymd(d)] = schByDay[ymd(d)] || []).push(item);
      if (sc.start.slice(0, 7) <= monthKey0 && schedEnd(sc).slice(0, 7) >= monthKey0) monthSch.push(item);
    }));
    // 보기 고르기 (사업 · 세부 일정 · 업무) — 한 번 고르면 이 기기에서 기억
    if (!S.calShow) { S.calShow = { ev: true, sch: true, task: true }; try { Object.assign(S.calShow, JSON.parse(localStorage.getItem("calShow") || "{}")); } catch (e) { /* 무시 */ } }
    const allSpans = calSpans(projects, S.calFilter, tasks).filter((x) => S.calShow[x.kind]);
    const monFirst = ymd(new Date(y, m, 1)), monLast = ymd(new Date(y, m + 1, 0));
    const longs = allSpans.filter((x) => spanDays(x) > LONG_DAYS && x.a <= monLast && x.b >= monFirst);
    const spans = allSpans.filter((x) => spanDays(x) <= LONG_DAYS);
    let grid = "";
    for (let w = 0; w < cells / 7; w++) {
      const days = [];
      for (let i = 0; i < 7; i++) days.push(ymd(new Date(y, m, 1 - startDow + w * 7 + i)));
      grid += weekRowHTML(days, spans, S.calShow.task ? byDay : {}, m, isHead());
    }
    const monthKey = y + "-" + z(m + 1);
    const monthList = filt.filter((x) => (x.dueDate || "").startsWith(monthKey)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.done - b.done);
    const monthEvs = evs.filter((p) => p.startDate.slice(0, 7) <= monthKey && (p.endDate && p.endDate > p.startDate ? p.endDate : p.startDate).slice(0, 7) >= monthKey)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const evRow = (p) => '<li class="trow evrow" data-act="viewProject" data-id="' + esc(p.id) + '"><span class="evdot" style="--c:' + deptColor(p.dept) + '"></span>' +
        '<span class="dt">' + eventDateText(p) + "</span>" + deptTag(p.dept) + '<span class="tt"><b>' + esc(p.name) + "</b></span>" +
        '<span class="dd">' + (p.startDate < t ? (p.status === "완료" ? "완료" : "") : dday(p.startDate)) + "</span></li>";
    const rows = monthEvs.map((p) => ({ key: p.startDate, p: p })).concat(monthSch.map((it) => ({ key: it.s.start, p: it.p, s: it.s })))
      .sort((a, b) => a.key.localeCompare(b.key));
    const evSection = rows.length ? '<section class="card"><h3>' + (m + 1) + "월 사업 일정 <small>" + rows.length + "개</small></h3><ul class=\"tlist big\">" +
      rows.map((r) => r.s ? '<li class="trow evrow sch" data-act="viewProject" data-id="' + esc(r.p.id) + '"><span class="evdot s" style="--c:' + deptColor(r.p.dept) + '"></span>' +
        '<span class="dt">' + rangeText(r.s.start, r.s.end) + "</span>" + deptTag(r.p.dept) + '<span class="tt">' + esc(r.s.title) + ' <span class="ptag">' + esc(r.p.name) + "</span></span>" +
        '<span class="dd">' + schedState(r.s) + "</span></li>" : evRow(r.p)).join("") + "</ul></section>" : "";
    const chips = '<button class="fchip' + (!S.calFilter ? " on" : "") + '" data-act="calFilter" data-dept="">전체</button>' +
      S.settings.depts.map((d) => '<button class="fchip' + (S.calFilter === d ? " on" : "") + '" style="--c:' + deptColor(d) + '" data-act="calFilter" data-dept="' + esc(d) + '"><i></i>' + esc(d) + "</button>").join("");
    return '<div class="page-head"><div><h2>업무 캘린더</h2><p class="muted">사업·세부 일정은 기간만큼 막대로, 업무는 마감일에 표시돼요' + (isHead() ? " · 빈 날짜를 누르면 업무 추가" : "") + "</p></div>" +
      (isHead() ? '<div class="actions"><button class="btn primary" data-act="addTask" data-date="">+ 업무 추가</button></div>' : "") + "</div>" +
      '<div class="filters">' + chips + "</div>" +
      '<div class="card cal-card"><div class="cal-nav"><button class="btn sm ghost" data-act="calMove" data-d="-1" aria-label="이전 달">‹</button>' +
      "<h3>" + y + "년 " + (m + 1) + '월</h3><button class="btn sm ghost" data-act="calMove" data-d="1" aria-label="다음 달">›</button>' +
      '<button class="btn sm" data-act="calMove" data-d="0">오늘</button></div>' +
      longSpansHTML(longs, "이번 달 내내") +
      '<div class="cal-dow">' + DOW.map((d) => "<span>" + d + "</span>").join("") + '</div><div class="cal-weeks">' + grid + "</div>" +
      '<div class="cal-show"><span class="muted small">보기</span>' + [["ev", "사업"], ["sch", "세부 일정"], ["task", "업무 마감"]].map((k) =>
        '<button class="cs-chip cs-' + k[0] + (S.calShow[k[0]] ? " on" : "") + '" data-act="calShow" data-k="' + k[0] + '"><i></i>' + k[1] + "</button>").join("") + "</div></div>" +
      evSection +
      '<section class="card"><h3>' + (m + 1) + "월 업무 목록 <small>" + monthList.length + "개</small></h3>" +
      (monthList.length ? '<ul class="tlist big">' + monthList.map((x) =>
        '<li class="trow' + (x.done ? " done" : x.dueDate < t ? " late" : "") + '">' +
        '<input type="checkbox" class="tick" data-act="toggleTask" data-id="' + esc(x.id) + '"' + (x.done ? " checked" : "") + (canTickTask(x) ? "" : " disabled") + ' aria-label="완료 표시">' +
        '<span class="dt">' + fmtDate(x.dueDate) + "</span>" + deptTag(x.dept) +
        '<span class="tt" data-act="editTask" data-id="' + esc(x.id) + '">' + esc(x.title) + (pname[x.projectId] ? ' <span class="ptag">' + esc(pname[x.projectId]) + "</span>" : "") + (x.assignee ? ' <small class="muted">· ' + esc(x.assignee) + "</small>" : "") + "</span>" +
        '<span class="dd">' + (x.done ? "완료" : dday(x.dueDate)) + "</span></li>").join("") + "</ul>" : '<p class="empty-s">이 달에 등록된 업무가 없어요.</p>') +
      "</section>";
  };

  /* ----- 국서방: 국장이 국원별로 할 일을 적고, 국원은 끝나면 체크 ----- */
  PAGES.room = async function () {
    const myDept = (S.me && S.me.dept) || "";
    const all = canSeeAllRooms();
    if (!S.room || (!all && S.room !== myDept)) S.room = myDept || execDept();
    const room = S.room;
    const [items, users, calTasks, projects] = await Promise.all([col("deptTasks"), col("users"), col("tasks"), col("projects")]);
    const ago30 = ymd(new Date(Date.now() - 30 * 86400000));
    const pname = {};
    projects.forEach((p) => (pname[p.id] = p.name));
    // 국서방 할 일 + 업무 캘린더에서 이 국서에 분배된 업무(📅)를 같이 보여 줌
    const list = items.filter((x) => x.dept === room)
      .concat(calTasks.filter((x) => x.dept === room && (!x.done || (x.dueDate || "") >= ago30)).map((x) => Object.assign({ cal: true }, x)));
    const myProjects = projects.filter((p) => isCurrent(p) && p.dept === room && p.status !== "완료" && p.status !== "취소")
      .sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
    const members = users.filter((u) => u.status === "approved" && u.dept === room)
      .sort((a, b) => posRank(a.position) - posRank(b.position) || (a.name || "").localeCompare(b.name || ""));
    const head = isRoomHead(room);
    const me = S.authUser && S.authUser.uid;
    const t = today();
    const done = list.filter((x) => x.done).length;
    const canTick = (x) => head || (myDept === room && (!uidsOf(x).length || uidsOf(x).indexOf(me) >= 0));
    const assignSel = (x) => head && x.cal && !uidsOf(x).length && !x.done ? '<select class="assign" data-act="assignTask" data-id="' + esc(x.id) + '" aria-label="맡을 사람">' +
      '<option value="">맡을 사람 정하기…</option>' + members.map((u) => '<option value="' + esc(u.id) + '">' + esc(u.name) + "</option>").join("") + "</select>" : "";
    const row = (x) => '<li class="rrow' + (x.done ? " done" : x.dueDate && x.dueDate < t ? " late" : "") + '">' +
      '<input type="checkbox" class="tick" data-act="' + (x.cal ? "toggleTask" : "toggleRoomTask") + '" data-id="' + esc(x.id) + '"' + (x.done ? " checked" : "") + (canTick(x) ? "" : " disabled") + ' aria-label="끝냄 표시">' +
      '<span class="tt"' + (x.cal ? ' data-act="editTask" data-id="' + esc(x.id) + '"' : head ? ' data-act="editRoomTask" data-id="' + esc(x.id) + '"' : "") + ">" +
      (x.cal ? '<span class="calb" title="업무 캘린더에 있는 분배 업무">📅</span> ' : "") + esc(x.title) +
      (x.cal && pname[x.projectId] ? ' <span class="ptag">' + esc(pname[x.projectId]) + "</span>" : "") +
      (uidsOf(x).length > 1 ? '<small class="muted">함께: ' + esc((x.assignee || x.assigneeName || "")) + "</small>" : "") +
      (x.memo ? '<small class="muted">' + esc(x.memo) + "</small>" : "") + assignSel(x) + "</span>" +
      '<span class="dd">' + (x.done ? "완료" : x.dueDate ? dday(x.dueDate) : "") + "</span></li>";
    const block = (title, sub, arr, isMe) => {
      const open = arr.filter((x) => !x.done).sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));
      const fin = arr.filter((x) => x.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
      return '<section class="card rblock' + (isMe ? " myblock" : "") + '"><div class="card-head"><h3>' + esc(title) + (sub ? " <small>" + esc(sub) + "</small>" : "") + "</h3>" +
        '<span class="muted small">' + fin.length + "/" + arr.length + " 완료</span></div>" +
        (open.length ? '<ul class="rlist">' + open.map(row).join("") + "</ul>" : '<p class="empty-s">' + (arr.length ? "다 끝냈어요 👏" : "맡은 일이 없어요.") + "</p>") +
        (fin.length ? '<details class="rdone"><summary>끝낸 일 ' + fin.length + "개</summary><ul class=\"rlist\">" + fin.map(row).join("") + "</ul></details>" : "") + "</section>";
    };
    const common = list.filter((x) => !uidsOf(x).length);
    const known = {};
    members.forEach((u) => (known[u.id] = true));
    const orphan = list.filter((x) => uidsOf(x).length && !uidsOf(x).some((u) => known[u]));
    const ownLabel = (u) => { const ps = myProjects.filter((p) => p.ownerUid === u.id).map((p) => p.name); return u.position + (ps.length ? " · 담당 사업: " + ps.join(", ") : ""); };
    const blocks = members.map((u) => block(u.name + (u.id === me ? " (나)" : ""), ownLabel(u), list.filter((x) => uidsOf(x).indexOf(u.id) >= 0), u.id === me))
      .concat(common.length || head ? [block(room + " 전체", "누구나 체크", common)] : [])
      .concat(orphan.length ? [block("예전 담당자", "지금은 이 국서에 없음", orphan)] : []);
    const tabs = all ? '<div class="filters">' + S.settings.depts.map((d) => '<button class="fchip' + (room === d ? " on" : "") + '" style="--c:' + deptColor(d) + '" data-act="roomTab" data-dept="' + esc(d) + '"><i></i>' + esc(d) + "방</button>").join("") + "</div>" : "";
    return '<div class="page-head"><div><h2>' + esc(room) + "방</h2>" +
      '<p class="muted">' + (head ? "국원별로 할 일을 적어 주세요. 끝나면 각자 체크해요." : "내 이름 아래 할 일을 끝내면 체크해 주세요.") +
      (all && room !== myDept ? " · 회장단은 모든 국서 방을 볼 수 있어요" : "") + "</p></div>" +
      (head ? '<div class="actions"><button class="btn primary" data-act="addRoomTask">+ 할 일 추가</button></div>' : "") + "</div>" + tabs +
      '<div class="card rsum" style="--c:' + deptColor(room) + '"><b>' + esc(room) + " 진행률</b><span>" + done + " / " + list.length + '</span><div class="pbar"><i style="width:' + (list.length ? Math.round((done / list.length) * 100) : 0) + '%"></i></div></div>' +
      (myProjects.length ? '<section class="card rproj"><div class="card-head"><h3>' + esc(room) + ' 담당 사업</h3><a href="#projects" class="more">사업 기획안 →</a></div><ul class="plist">' +
        myProjects.map((p) => '<li data-act="viewProject" data-id="' + esc(p.id) + '"><span class="st st-' + esc(p.status) + '">' + esc(p.status) + "</span><b>" + esc(p.name) + "</b>" +
          (p.owner ? '<span class="muted small">담당 ' + esc(p.owner) + "</span>" : "") + '<span class="dt">' + (p.startDate ? fmtDate(p.startDate) + (p.startDate >= t ? " · " + dday(p.startDate) : "") : "") + "</span></li>").join("") + "</ul></section>" : "") +
      '<div class="rgrid">' + blocks.join("") + "</div>" +
      '<p class="muted small center">국서방은 ' + (all ? "회장단과 " : "") + "같은 국서 사람만 볼 수 있어요. 📅 표시는 업무 캘린더에서 이 국서에 분배된 업무예요 (캘린더에서도 같이 체크돼요).</p>";
  };
  const roomFields = (room) => {
    const members = (S.cache.users || []).filter((u) => u.status === "approved" && u.dept === room)
      .sort((a, b) => posRank(a.position) - posRank(b.position));
    return [
      { name: "title", label: "할 일", required: true, placeholder: "예: 9월 영수증 정리해서 드라이브에 올리기" },
      { name: "assigneeSel", label: "맡을 사람 (여러 명 가능)", type: "members", dept: room, emptyLabel: "아무도 안 고르면 '" + room + " 전체' 일이 돼서 누구나 체크할 수 있어요." },
      { name: "dueDate", label: "마감일 (선택)", type: "date", half: true },
      { name: "memo", label: "메모 (선택)", type: "textarea", rows: 2 },
    ];
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
      (opts.forms ? (function () { const b = projectFormBtn(p, opts.forms[p.id], opts); return b ? '<div class="plinks pform">' + b + "</div>" : ""; })() : "") +
      projectSchedHTML(p, opts) +
      projectTasksHTML(p, opts) +
      (opts.readonly ? "" : '<div class="pfoot">' + (opts.archive && isHead() ? '<button class="btn sm" data-act="reuseProject" data-id="' + esc(p.id) + '">참고해서 새로 기획하기</button>' : "") +
      (isHead() ? '<button class="btn sm ghost" data-act="editProject" data-id="' + esc(p.id) + '">수정</button>' : "") + "</div>") + "</article>";
  }
  const schedRowHTML = (r) => '<div class="srow"><input class="s-title" placeholder="예: 가수요조사 기간" value="' + esc(r.title || "") + '" aria-label="일정 이름">' +
    dateInputHTML('class="s-start" aria-label="시작일"', r.start || "") + dateInputHTML('class="s-end" aria-label="끝나는 날 (선택)"', r.end || "") +
    '<button type="button" class="x s-del" aria-label="이 줄 지우기">×</button></div>';
  // 사업 카드 안의 "세부 일정" (가수요조사 기간 등)
  function projectSchedHTML(p, opts) {
    const list = schedOf(p).slice().sort((a, b) => (a.start || "9").localeCompare(b.start || "9"));
    const canEdit = !opts.readonly && !opts.archive && isHead();
    if (!list.length) return canEdit ? '<button class="btn sm ptask-add" data-act="editSchedule" data-id="' + esc(p.id) + '">+ 세부 일정 (조사 기간 등)</button> ' : "";
    return '<div class="ptasks psched"><div class="ptasks-head"><b>세부 일정</b>' +
      (canEdit ? '<button class="linkbtn small" data-act="editSchedule" data-id="' + esc(p.id) + '">수정</button>' : "") + "</div>" +
      "<ul>" + list.map((x) => { const st = opts.archive ? "" : schedState(x);
        return '<li class="' + (st === "진행 중" ? "now" : st === "끝남" ? "done" : "") + '"' + (canEdit ? ' data-act="editSchedule" data-id="' + esc(p.id) + '"' : "") + ">" +
          '<span class="tt">' + esc(x.title) + '</span><span class="dt">' + rangeText(x.start, x.end) + (st ? " · " + st : "") + "</span></li>"; }).join("") + "</ul></div>";
  }
  // 사업 카드 안의 "업무 분배" 목록
  function projectTasksHTML(p, opts) {
    const ts = opts.tasks || [];
    const canAdd = !opts.readonly && !opts.archive && isHead();
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

  /* 사업 한 줄 (사업 기획안 목록) — 누르면 아래로 펼쳐져서 세부 일정·업무 분배·신청 페이지가 보임 */
  S.openProj = {};
  function projectRow(p, opts) {
    const ts = opts.tasks || [], done = ts.filter((x) => x.done).length, t = today();
    const f = opts.forms && opts.forms[p.id];
    const when = p.startDate ? fmtDate(p.startDate) + (p.endDate && p.endDate > p.startDate ? " ~ " + fmtDate(p.endDate) : "") : "날짜 미정";
    const dd = p.startDate && p.startDate >= t && (p.status === "예정" || p.status === "기획중") ? '<span class="pr-dd">' + dday(p.startDate) + "</span>" : "";
    const links = [["기획안", p.planUrl], ["기타 자료", p.extraUrl]]
      .filter((l) => safeUrl(l[1])).map((l) => '<a class="btn sm" href="' + esc(safeUrl(l[1])) + '" target="_blank" rel="noopener">' + l[0] + " ↗</a>").join("");
    const formBtn = opts.forms ? projectFormBtn(p, f, opts) : "";
    // 세부 일정·업무 분배가 비어 있으면 '+ 추가' 버튼만 나오는데, 이걸 신청 양식 버튼과 한 줄에 같은 크기로
    const sch = projectSchedHTML(p, opts), tsk = projectTasksHTML(p, opts);
    const isBtn = (h) => /^<button/.test(h);
    const addBtns = [sch, tsk].filter(isBtn).map((h) => h.replace("btn sm ptask-add", "btn sm")).join("");
    const blocks = [sch, tsk].filter((h) => h && !isBtn(h)).join("");
    const open = !!S.openProj[p.id];
    return '<div class="prow' + (open ? " open" : "") + '" style="--c:' + deptColor(p.dept) + '">' +
      '<button class="pr-head" data-act="toggleProj" data-id="' + esc(p.id) + '" aria-expanded="' + open + '">' +
      '<span class="pr-chev" aria-hidden="true">›</span>' + deptTag(p.dept) +
      '<span class="pr-name">' + esc(p.name) + (p.owner ? '<small>' + esc(p.owner) + "</small>" : "") + "</span>" +
      '<span class="pr-meta">' +
      (ts.length ? '<span class="pr-prog" title="업무 분배 ' + done + "/" + ts.length + ' 완료"><i style="width:' + Math.round((done / ts.length) * 100) + '%"></i></span><span class="pr-cnt">업무 ' + done + "/" + ts.length + "</span>" : "") +
      (f ? '<span class="fm-pill ' + (f.open ? "ok" : "") + '">' + (f.open ? "신청 받는 중" : "신청 닫힘") + "</span>" : "") +
      '<span class="pr-when">' + when + "</span>" + dd + "</span></button>" +
      '<div class="pr-body">' +
      '<dl class="meta">' + (p.owner ? "<dt>담당</dt><dd>" + esc(p.owner) + "</dd>" : "") + (p.budget ? "<dt>예산</dt><dd>" + esc(p.budget) + "</dd>" : "") + "</dl>" +
      (p.summary ? '<p class="summary">' + esc(p.summary) + "</p>" : "") +
      (p.prevNote ? '<p class="prev">참고: ' + esc(p.prevNote) + (safeUrl(p.prevPlanUrl) ? ' <a href="' + esc(safeUrl(p.prevPlanUrl)) + '" target="_blank" rel="noopener">이전 기획안 ↗</a>' : "") + "</p>" : "") +
      (links || formBtn || addBtns ? '<div class="plinks">' + links + formBtn + addBtns + "</div>" : "") +
      (blocks ? '<div class="pr-cols">' + blocks + "</div>" : "") +
      (isHead() ? '<div class="pfoot"><button class="btn sm ghost" data-act="editProject" data-id="' + esc(p.id) + '">수정</button></div>' : "") +
      "</div></div>";
  }

  /* ----- 사업 기획안 (지금 학생회) ----- */
  PAGES.projects = async function () {
    const tmap = await tasksByProject();
    const forms = await formsMap();
    const list = (await col("projects")).filter((p) => isActive(p) && (!S.projDept || p.dept === S.projDept ||
      (tmap[p.id] || []).some((t) => t.dept === S.projDept)));
    // 진행중 → 예정 → 기획중 → 완료 → 취소 순서로, 사업마다 한 줄씩
    const cols = ["진행중", "예정", "기획중", "완료", "취소"].map((st) => {
      const items = list.filter((p) => p.status === st).sort((a, b) => (a.startDate || "9").localeCompare(b.startDate || "9"));
      if ((st === "취소" || st === "진행중") && !items.length) return "";
      return '<section class="pgroup"><h3><span class="st st-' + st + '">' + st + "</span> <small>" + items.length + "</small></h3>" +
        (items.length ? '<div class="prows">' + items.map((p) => projectRow(p, { tasks: tmap[p.id], forms: forms })).join("") + "</div>" : '<p class="empty-s">없음</p>') + "</section>";
    }).join("");
    return '<div class="page-head"><div><h2>사업 기획안</h2><p class="muted">' + esc(curCouncil()) + " 학생회가 진행하는 사업 " + list.length + "개 · 사업 날짜가 되면 '진행중', 끝나면 '완료'로 바뀌고, 끝난 지 2주가 지나면 [사업 아카이브]로 옮겨져요</p></div>" +
      '<div class="actions"><a class="btn" href="#archive">지난 학생회 사업 참고하기</a>' + (isHead() ? '<button class="btn primary" data-act="addProject">+ 사업 추가</button>' : "") + "</div></div>" +
      '<div class="filters">' + deptFilterChips("projDept", "projDept") + "</div>" +
      '<div class="plist2">' + cols + "</div>";
  };

  /* ----- 사업 아카이브 (지난 학생회별) ----- */
  PAGES.archive = async function () {
    const q = (S.q.archive || "").toLowerCase();
    const all = await col("projects");
    const tmap = await tasksByProject();
    const past = all.filter((p) => !isActive(p));
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
    return '<div class="page-head"><div><h2>사업 아카이브</h2><p class="muted">역대 학생회 사업과, 지금 학생회에서 끝난 지 2주가 지난 사업이 학생회별로 쌓여요 · 지금까지 ' + past.length + "개</p></div>" +
      (isHead() ? '<div class="actions"><button class="btn primary" data-act="addPastProject">+ 지난 사업 기록하기</button></div>' : "") + "</div>" +
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
      '<div class="prow"><div><b>' + esc(u.name) + "</b> " + (u.grade ? '<span class="gtag">' + esc(u.grade) + "</span> " : "") + deptTag(u.dept) + " " + esc(u.position) +
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
      '<section class="card"><div class="card-head"><h3>전체 백업</h3><button class="btn sm primary" data-act="backup">백업 파일 받기</button></div>' +
      '<p class="muted small">회원 명단·사업·업무·회의록·소통방 등 사이트에 저장된 내용을 파일 하나로 내려받아요. 사이트 안에서 지운 건 되살릴 수 없으니, <b>학기마다·인수인계 전에</b> 한 번씩 받아서 학생회 구글 드라이브(회장단만 볼 수 있는 폴더)에 넣어 두세요. 전화번호가 들어 있으니 단톡방 등에 올리지 마세요.</p></section>' +
      '<section class="card"><div class="card-head"><h3>새 학생회 인수인계 순서</h3><button class="btn sm primary" data-act="handover">새 학생회로 넘기기</button></div><ol class="steps">' +
      "<li>넘기기 전에 위의 <b>[백업 파일 받기]</b>로 지금까지의 기록을 받아 두기</li>" +
      "<li>새 학생회원들이 사이트에 로그인해서 <b>가입 신청</b></li>" +
      "<li>지금 회장단이 신청을 <b>승인</b>하고, 새 회장·부회장에게 <b>회장단 권한</b> 부여</li>" +
      "<li>[새 학생회로 넘기기]에서 새 <b>기수와 학생회 이름</b> 입력, <b>계속 활동할 회원</b> 체크 → 나머지는 자동 임기 종료, " + esc(curCouncil()) + "의 사업은 아카이브로</li>" +
      "<li>마지막으로 새 회장단이 <b>넘긴 사람(이전 회장단) 계정</b>을 회원 관리에서 임기 종료</li>" +
      "<li>학생회 공용 gmail 비밀번호를 새 회장단에게 전달하고, 공용 gmail의 <b>복구 이메일·전화번호를 새 회장 것으로 변경</b> (사이트·Firebase·GitHub 모두 이 계정 하나로 관리)</li></ol></section>";
  };

  /* ============================================================
     버튼 동작
     ============================================================ */
  /* ============================================================
     행사 신청 양식 · 참여자 명단 (사업 기획안 → 사업 카드 → 📝 신청 페이지)
     - 학생은 apply.html?f=사업번호 링크로 로그인 없이 신청
     - 양식 만들기·고치기: 양식 담당 국서(기본 소통국, 대협국 행사는 대협국)의 모든 국원 + 회장단
     - 명단 보기·입금·출석 체크: 위 사람들 + 그 사업 담당 국서 사람들
     - 개인정보: 보관 기한(기본: 행사 끝나고 2주)이 지나면 명단이 자동으로 지워짐
     ============================================================ */
  const AP = window.APPLY;
  const respPath = (pid) => "forms/" + pid + "/responses";
  const applyUrl = (pid) => location.href.split("#")[0].replace(/index\.html$/, "").replace(/[^/]*$/, "") + "apply.html?f=" + encodeURIComponent(pid);
  const isExecMember = () => isAdmin() || isExecPos() || !!(S.me && S.me.status === "approved" && S.me.dept === execDept());
  const formDeptFor = (p) => {
    if (/대외|대협/.test(p.dept || "")) return p.dept;
    return (S.settings.depts || []).find((d) => /소통/.test(d)) || p.dept;
  };
  // 권한 (보안 규칙 forms 부분과 같은 기준)
  //  양식 고치기: 회장단 · 양식 담당 국서(대협국 사업은 대협국, 그 외는 소통국)의 국장과 2학년 · 따로 지정한 담당자(1학년 등)
  //  명단 보기·입금·출석: 위 사람들 · 재무국 전원 · 그 사업 국서의 국장 · 회장단이 사업별로 추가한 사람
  const meOK = () => !!(S.me && S.me.status === "approved");
  const myUid = () => (S.authUser && S.authUser.uid) || "";
  const isMyHead = () => meOK() && (S.me.position === "국장" || S.me.position === deptPositions()[0]);
  const isFinance = () => meOK() && /재무/.test(S.me.dept || "");
  const canEditForm = (f) => !!f && (isExecMember() || (meOK() && ((S.me.dept === f.ownerDept && (isMyHead() || S.me.grade === "2학년")) || (f.editorUids || []).indexOf(myUid()) >= 0)));
  const canSeeRoster = (f) => !!f && (canEditForm(f) || isFinance() || (meOK() && ((S.me.dept === f.projectDept && isMyHead()) || (f.viewerUids || []).indexOf(myUid()) >= 0)));
  const canSetEditors = (f) => !!f && (isExecMember() || (meOK() && S.me.dept === f.ownerDept && isMyHead()));
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
  const keepDefault = (p) => addDays((p.endDate && p.endDate > (p.startDate || "") ? p.endDate : p.startDate) || today(), 14);
  S.fm = { pid: "" };

  async function formsMap() {
    if (!S.cache.forms) { try { S.cache.forms = await DB.list("forms"); } catch (e) { S.cache.forms = []; } }
    const m = {};
    S.cache.forms.forEach((f) => (m[f.id] = f));
    return m;
  }
  // 사업 카드에 붙는 버튼
  function projectFormBtn(p, f, opts) {
    if (f) return '<a class="btn sm" href="#form/' + encodeURIComponent(p.id) + '">📝 신청 페이지 <span class="fm-pill ' + (f.open ? "ok" : "") + '">' + (f.open ? "받는 중" : "닫힘") + "</span></a>";
    if (opts.readonly || opts.archive || !canEditForm({ ownerDept: formDeptFor(p) })) return "";
    return '<a class="btn sm ghost" href="#form/' + encodeURIComponent(p.id) + '">+ 신청 양식 만들기</a>';
  }

  // 명단: 제출 순서대로 정렬하고 번호·선착순 대기 계산
  function ordered(f, list) {
    list.sort((a, b) => (a.at || 0) - (b.at || 0) || String(a.id).localeCompare(String(b.id)));
    return AP.place(f, list);
  }
  async function loadFm(pid, force) {
    const fm = S.fm;
    if (fm.pid !== pid || force) {
      stopWatch();
      Object.assign(fm, { pid: pid, form: null, draft: null, dirty: false, resp: null, q: "", pv: null });
      fm.form = await DB.get("forms", pid);
      if (!fm.tab || !force) fm.tab = "";
    }
    const f = fm.form;
    if (f && canSeeRoster(f) && !fm.resp) {
      fm.resp = ordered(f, await DB.list(respPath(pid)));
      // 보관 기한이 지난 명단은 자동으로 지움 (개인정보 보호)
      if (fm.resp.length && f.keepUntil && today() > f.keepUntil) {
        let n = 0;
        for (const r of fm.resp) { try { await DB.remove(respPath(pid), r.id); n++; } catch (e) { console.warn(e); } }
        await clearSlots(pid);
        fm.resp = ordered(f, await DB.list(respPath(pid)));
        if (n) setTimeout(() => toast("보관 기한이 지나서 명단 " + n + "명을 지웠어요."), 300);
      }
    }
    if (f && canSeeRoster(f) && fm.watching !== pid) startWatch(pid);
  }
  // 명단을 보고 있는 동안 새 응답·입금·출석 체크가 바로바로 반영되게 (새로고침 필요 없음)
  function startWatch(pid) {
    stopWatch();
    S.fm.watching = pid;
    S.fm.unsub = DB.watch(respPath(pid), function (list) {
      const fm = S.fm;
      if (fm.pid !== pid || !fm.form) return;
      const before = fm.resp ? fm.resp.length : 0;
      fm.resp = ordered(fm.form, list);
      refreshRoster();
      const tab = document.getElementById("fmRespTab");
      if (tab) tab.textContent = "참여자 명단 (" + fm.resp.length + ")";
      if (fm.resp.length > before && before >= 0 && fm.seen) toast("새 응답 " + (fm.resp.length - before) + "명이 들어왔어요");
      fm.seen = true;
    });
  }
  function stopWatch() {
    if (S.fm && S.fm.unsub) { try { S.fm.unsub(); } catch (e) { /* 무시 */ } }
    if (S.fm) { S.fm.unsub = null; S.fm.watching = ""; S.fm.seen = false; }
  }
  const curForm = () => S.fm.draft || S.fm.form;
  // 선착순 순서표 지우기
  async function clearSlots(pid) {
    try { for (const x of await DB.list("forms/" + pid + "/slots")) await DB.remove("forms/" + pid + "/slots", x.id); } catch (e) { console.warn(e); }
  }

  PAGES.form = async function () {
    const pid = S.routeArg;
    const p = (await col("projects")).find((x) => x.id === pid);
    if (!p) return '<div class="card empty">사업을 찾을 수 없어요.<br><a class="btn" href="#projects">사업 기획안으로</a></div>';
    await loadFm(pid);
    const fm = S.fm, f = fm.form;
    const editable = canEditForm(f || { ownerDept: formDeptFor(p) });
    const viewer = canSeeRoster(f);
    if (!fm.tab) fm.tab = f ? (viewer ? "resp" : "preview") : "build";
    if (fm.tab === "resp" && !viewer) fm.tab = "preview";
    if (fm.tab === "build" && !editable) fm.tab = "preview";

    let head = '<div class="fm-head"><a class="fm-back" href="#projects">← 사업 기획안</a>' +
      '<div class="fm-title"><h2>' + esc(p.name) + "</h2>" + deptTag(p.dept) +
      (f ? '<span class="fm-pill ' + (f.open ? "ok" : "") + '">' + (f.open ? "신청 받는 중" : "신청 닫힘") + "</span>" : "") + "</div>";
    if (f) {
      head += '<div class="fm-link"><code>' + esc(applyUrl(pid)) + "</code>" +
        '<button class="btn sm primary" data-act="fmCopyMsg" title="행사 이름·안내·링크를 한 번에 복사">공지 문구 복사</button><button class="btn sm" data-act="fmCopy">링크만 복사</button><a class="btn sm" href="' + esc(applyUrl(pid)) + '" target="_blank" rel="noopener">열어 보기 ↗</a>' +
        (editable ? '<button class="btn sm" data-act="fmOpen">' + (f.open ? "신청 닫기" : "신청 받기 시작") + "</button>" : "") + "</div>" +
        '<p class="muted small" style="margin:0">양식 고치기: 회장단 · <b>' + esc(f.ownerDept) + "</b> 국장·2학년" + ((f.editorUids || []).length ? " · 담당자 " + (f.editorUids || []).length + "명" : "") +
        " / 명단 보기: 위 사람들 + 재무국 · " + esc(f.projectDept) + " 국장" + ((f.viewerUids || []).length ? " · 추가 " + (f.viewerUids || []).length + "명" : "") +
        (canSetEditors(f) ? ' <button class="linkbtn small" data-act="fmPerm">권한 설정</button>' : "") +
        (f.keepUntil ? " · 명단 보관 기한 <b>" + esc(dotDate(f.keepUntil)) + "</b> (지나면 자동 삭제)" : "") + "</p>";
    }
    head += "</div>";

    if (!f && !fm.draft) {
      if (!editable) return head + '<div class="card empty">아직 신청 양식이 없어요.<br><span class="small">양식은 ' + esc(formDeptFor(p)) + " 국장·2학년이나 회장단이 만들어요.</span></div>";
      return head + '<div class="card" style="max-width:560px"><h3>신청 양식 만들기</h3><p class="muted small">틀을 하나 고르면 질문이 미리 들어가요. 만든 뒤에 질문을 마음대로 고칠 수 있어요.</p>' +
        '<div class="fm-tpl">' + Object.keys(AP.TEMPLATES).map((k, i) => '<label><input type="radio" name="fmTpl" value="' + k + '"' + (i === 0 ? " checked" : "") + "> " + esc(AP.TEMPLATES[k].label) + "</label>").join("") + "</div>" +
        '<div style="margin-top:12px"><button class="btn primary" data-act="fmStart">이 틀로 시작하기</button></div></div>';
    }

    const tabs = [["resp", "참여자 명단" + (fm.resp ? " (" + fm.resp.length + ")" : ""), viewer && f], ["build", "양식 만들기", editable], ["preview", "학생 화면 미리보기", !editable]]
      .filter((t) => t[2]).map((t) => '<a href="#" class="' + (fm.tab === t[0] ? "on" : "") + '" data-act="fmTab" data-tab="' + t[0] + '"' + (t[0] === "resp" ? ' id="fmRespTab"' : "") + ">" + t[1] + "</a>").join("");
    let body = "";
    if (fm.tab === "resp") body = rosterHTML(f);
    else if (fm.tab === "build") body = buildHTML(p);
    else body = '<div style="max-width:440px"><div class="fm-preview-label">학생이 보는 화면</div><div class="fm-preview" id="fmPreview">' + previewHTML() + "</div></div>";
    return head + '<nav class="fm-tabs">' + tabs + "</nav>" + body;
  };

  /* ---------- 참여자 명단 ---------- */
  function rosterStats(f, list) {
    const going = list.filter((r) => AP.isGoing(f, r)), inn = going.filter((r) => !r.wait), fee = Number(f.fee) || 0;
    const stat = (k, v) => '<div class="fm-stat"><span>' + k + "</span><b>" + v + "</b></div>";
    return '<div class="fm-stats">' + stat("응답", list.length) +
      stat(f.mode === "first" ? "정원 안 / 대기" : "참여", f.mode === "first" ? inn.length + " / " + (going.length - inn.length) : going.length) +
      (AP.attendQ(f) ? stat("불참", list.length - going.length) : "") +
      (fee ? stat("입금", inn.filter((r) => r.paid).length + "/" + inn.length) : "") +
      stat("출석", inn.filter((r) => r.attended).length + "/" + inn.length) + "</div>" +
      '<p class="muted small" style="margin:0">' + (fee ? "받을 돈 " + AP.won(inn.length * fee) + " · 입금 확인 " + AP.won(inn.filter((r) => r.paid).length * fee) : "참가비 없는 행사예요") + "</p>";
  }
  function rosterRows(f) {
    const fm = S.fm, q = (fm.q || "").replace(/\s/g, "");
    const list = fm.resp.filter((r) => !q || [r.name, r.sid, r.depositName].some((x) => String(x || "").indexOf(q) >= 0));
    const qs = f.qs || [];
    const editable = canEditForm(f), fee = Number(f.fee) > 0;
    const cell = (x, r) => {
      const v = (r.answers || {})[x.id];
      if (x.type === "name") return "<b>" + esc(r.name || v) + "</b>";
      if (x.type === "sid") return esc(r.sid || v);
      if (x.type === "agree") return v ? '<span class="fm-pill ok">동의</span>' : "";
      if (x.type === "yesno" && x.attend) return v === "예" ? '<span class="fm-pill ok">참여</span>' : v ? '<span class="fm-pill">불참</span>' : "";
      return esc(Array.isArray(v) ? v.join(", ") : v);
    };
    const th = "<tr><th>번호</th><th>제출 시각</th>" + qs.map((x) => "<th>" + esc(x.label) + "</th>").join("") +
      (f.mode === "first" ? "<th>선착순</th>" : "") + (fee ? "<th>입금자명</th><th>입금</th>" : "") + "<th>출석</th>" + (editable ? "<th></th>" : "") + "</tr>";
    const n = 3 + qs.length + (fee ? 2 : 0) + (f.mode === "first" ? 1 : 0) + (editable ? 1 : 0);
    const rows = list.map((r) => {
      const going = AP.isGoing(f, r), active = going && !r.wait, sid = esc(r.id);
      return '<tr class="' + (active ? "" : "off") + '">' +
        '<td class="num">' + (r.no ? r.no : "–") + '</td><td class="num">' + esc(AP.stampText(r.at)) + "</td>" +
        qs.map((x) => '<td class="' + (x.type === "phone" || x.type === "sid" || x.type === "name" ? "num" : "ans") + '">' + cell(x, r) + "</td>").join("") +
        (f.mode === "first" ? "<td>" + (!going ? "" : r.wait ? '<span class="fm-pill warn">대기 ' + r.waitNo + "</span>" : '<span class="fm-pill ok">정원 안</span>') + "</td>" : "") +
        (fee ? '<td class="num"><b>' + (active ? esc(r.depositName || AP.depositName(r.sid, r.name)) : "–") + "</b></td>" +
          "<td>" + (active ? '<label class="fm-paid"><input type="checkbox" data-act="fmPaid" data-sid="' + sid + '"' + (r.paid ? " checked" : "") + "> " + (r.paid ? "확인" : "입금 전") + "</label>" : "") + "</td>" : "") +
        "<td>" + (active ? '<button class="fm-att' + (r.attended ? " on" : "") + '" data-act="fmAtt" data-sid="' + sid + '">' + (r.attended ? "✓ " + esc(r.attendedAt || "") : "확인") + "</button>" : "") + "</td>" +
        (editable ? '<td><button class="x" data-act="fmDelResp" data-sid="' + sid + '" aria-label="이 응답 지우기" title="이 응답 지우기">×</button></td>' : "") + "</tr>";
    }).join("") || '<tr><td colspan="' + n + '" class="muted" style="text-align:center;padding:28px">' + (q ? "찾는 사람이 없어요." : "아직 응답이 없어요. 링크를 단톡방에 올려 보세요.") + "</td></tr>";
    return "<thead>" + th + "</thead><tbody>" + rows + "</tbody>";
  }
  function rosterHTML(f) {
    const fee = Number(f.fee) > 0;
    return '<div id="fmStats">' + rosterStats(f, S.fm.resp) + "</div>" +
      '<div class="fm-tools"><input type="search" data-fm-search placeholder="이름 · 학번 · 입금자명 찾기" value="' + esc(S.fm.q || "") + '">' +
      (fee ? '<button class="btn sm" data-act="fmBank">통장 내역으로 입금 확인</button>' : "") +
      '<button class="btn sm" data-act="fmCsv">엑셀(CSV) 받기</button><span class="fm-live" title="새 응답이 들어오면 자동으로 바뀌어요"><i></i>실시간</span></div>' +
      '<div class="fm-tablewrap"><table class="fm-table" id="fmTable">' + rosterRows(f) + "</table></div>" +
      '<p class="muted small">입금자명 = 입학연도 2자리 + 학번 뒤 3자리 + 이름 (예: 24123이다홍). 행사 당일엔 이 화면에서 [확인]을 눌러 출석을 체크해요.</p>';
  }
  function refreshRoster() {
    const f = S.fm.form, t = document.getElementById("fmTable"), s = document.getElementById("fmStats");
    if (t) t.innerHTML = rosterRows(f);
    if (s) s.innerHTML = rosterStats(f, S.fm.resp);
  }
  const hm = () => { const d = new Date(); return z(d.getHours()) + ":" + z(d.getMinutes()); };

  /* ---------- 양식 만들기 ---------- */
  function buildHTML(p) {
    const fm = S.fm;
    if (!fm.draft) fm.draft = JSON.parse(JSON.stringify(fm.form));
    const f = fm.draft;
    const inp = (k, label, o) => { o = o || {};
      return '<div class="field' + (o.half ? " half" : "") + '"' + (o.id ? ' id="' + o.id + '"' : "") + (o.hidden ? " hidden" : "") + '><label>' + label + "</label>" +
        (o.area ? '<textarea data-fm="' + k + '" rows="' + (o.rows || 3) + '">' + esc(f[k]) + "</textarea>" : '<input data-fm="' + k + '" value="' + esc(f[k] == null ? "" : f[k]) + '"' + (o.num ? ' inputmode="numeric"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + ">") +
        (o.help ? '<small class="help">' + o.help + "</small>" : "") + "</div>"; };
    const sel = (k, label, opts, o) => '<div class="field' + (o && o.half ? " half" : "") + '"><label>' + label + '</label><select data-fm="' + k + '"' + (o && o.disabled ? " disabled" : "") + ">" +
      opts.map((x) => '<option value="' + esc(x[0]) + '"' + (String(f[k]) === String(x[0]) ? " selected" : "") + ">" + esc(x[1]) + "</option>").join("") + "</select>" + (o && o.help ? '<small class="help">' + o.help + "</small>" : "") + "</div>";
    const basics = '<div class="card"><h3>기본 정보</h3><div class="fields">' +
      inp("title", "신청서 제목") + inp("desc", "안내문 (일시·장소 등)", { area: true }) +
      sel("mode", "모집 방식", [["normal", "일반 (기간 안에 누구나)"], ["first", "선착순 (정원 넘으면 대기)"]], { half: true }) +
      inp("cap", "정원", { half: true, num: true, id: "fmCapWrap", hidden: f.mode !== "first" }) +
      inp("fee", "참가비 (0이면 입금 안내 없음)", { half: true, num: true }) +
      inp("due", "입금 기한", { half: true, ph: "예: 10월 23일 (금)까지" }) +
      inp("account", "입금 계좌", { ph: "예: 국민 123456-01-234567 (생명과학부 학생회)" }) +
      sel("ownerDept", "양식 담당 국서", (S.settings.depts || []).map((d) => [d, d]), { half: true, disabled: !isExecMember(), help: isExecMember() ? "이 국서 사람 모두가 양식을 고칠 수 있어요" : "회장단만 바꿀 수 있어요" }) +
      '<div class="field half"><label>명단 보관 기한</label>' + dateInputHTML('data-fm-date="keepUntil"', f.keepUntil || keepDefault(p)) + '<small class="help">이 날이 지나면 명단이 자동으로 지워져요</small></div>' +
      "</div></div>";
    return '<div class="fm-build"><div class="fm-edit">' + basics +
      '<div class="card"><div class="fm-qhead" style="margin-bottom:10px"><h3>질문 <small>' + f.qs.length + "개</small></h3></div>" +
      '<div id="fmQs" style="display:grid;gap:10px">' + qsHTML() + "</div>" +
      '<div style="margin-top:12px"><div class="muted small" style="font-weight:700;margin-bottom:6px">질문 추가</div><div class="fm-add">' +
      Object.keys(AP.TYPES).map((k) => '<button class="btn sm" data-act="fmAddQ" data-type="' + k + '">+ ' + AP.TYPES[k].label + "</button>").join("") + "</div></div></div>" +
      '<div class="fm-save"><button class="btn primary" data-act="fmSave">저장</button><span class="dirty" id="fmDirty"' + (fm.dirty || !fm.form ? "" : " hidden") + ">" + (fm.form ? "저장 안 한 변경이 있어요" : "아직 저장 전이에요") + "</span>" +
      (fm.form ? '<button class="btn ghost" data-act="fmDiscard">되돌리기</button><span style="flex:1"></span><button class="btn danger sm" data-act="fmDelete">양식·명단 삭제</button>' : '<button class="btn ghost" data-act="fmDiscard">취소</button>') + "</div></div>" +
      '<div><div class="fm-preview-label">학생이 보는 화면 (고치면 바로 바뀌어요)</div><div class="fm-preview" id="fmPreview">' + previewHTML() + "</div></div></div>";
  }
  function qsHTML() {
    const qs = S.fm.draft.qs;
    if (!qs.length) return '<p class="muted small">질문이 없어요. 아래에서 추가해 주세요.</p>';
    return qs.map(function (q, i) {
      const t = AP.TYPES[q.type] || { label: q.type };
      return '<div class="fm-q" data-q="' + esc(q.id) + '"><div class="fm-qhead"><span class="ord">질문 ' + (i + 1) + " · " + t.label + (t.hint ? " · " + t.hint : "") + "</span>" +
        '<div class="fm-qtools"><button data-act="fmMoveQ" data-dir="-1" data-q="' + esc(q.id) + '" aria-label="위로"' + (i ? "" : " disabled") + ">↑</button>" +
        '<button data-act="fmMoveQ" data-dir="1" data-q="' + esc(q.id) + '" aria-label="아래로"' + (i < qs.length - 1 ? "" : " disabled") + ">↓</button>" +
        '<button data-act="fmDelQ" data-q="' + esc(q.id) + '" aria-label="삭제">×</button></div></div>' +
        '<div class="fields"><div class="field"><label>질문</label><input data-fq="label" data-q="' + esc(q.id) + '" value="' + esc(q.label) + '"></div>' +
        (q.type === "choice" || q.type === "multi" ? '<div class="field"><label>보기 (한 줄에 하나씩)</label><textarea rows="3" data-fq="options" data-q="' + esc(q.id) + '">' + esc((q.options || []).join("\n")) + "</textarea></div>" : "") +
        (q.type === "agree" ? '<div class="field"><label>동의 안내문</label><textarea rows="4" data-fq="text" data-q="' + esc(q.id) + '">' + esc(q.text || "") + "</textarea></div>" : "") + "</div>" +
        "<div>" + (t.fixed ? '<span class="muted small">항상 필수</span>' : '<label class="fm-chk"><input type="checkbox" data-fq="required" data-q="' + esc(q.id) + '"' + (q.required ? " checked" : "") + "> 필수</label>") +
        (q.type === "yesno" ? '<label class="fm-chk"><input type="checkbox" data-fq="attend" data-q="' + esc(q.id) + '"' + (q.attend ? " checked" : "") + "> 참여 여부 질문 (‘아니오’면 입금 안내·명단 번호에서 빠짐)</label>" : "") + "</div></div>";
    }).join("");
  }
  function previewHTML() {
    const fm = S.fm, f = curForm();
    if (!f) return "";
    if (fm.pv) return AP.doneHTML(f, fm.pv, { preview: true });
    return AP.formHTML(f, { preview: true });
  }
  let pvTimer;
  function refreshPreview(now) {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () {
      const box = document.getElementById("fmPreview");
      if (!box) return;
      // 미리보기에 쓰던 답은 그대로 남김
      const keep = [];
      box.querySelectorAll('[name^="a_"]').forEach((el) => keep.push({ n: el.name, v: el.value, t: el.type, c: el.checked }));
      box.innerHTML = previewHTML();
      keep.forEach((k) => box.querySelectorAll('[name="' + k.n + '"]').forEach((el) => {
        if (k.t === "radio" || k.t === "checkbox") { if (el.value === k.v) el.checked = k.c; } else el.value = k.v;
      }));
    }, now ? 0 : 120);
  }
  function markDirty() { S.fm.dirty = true; const d = document.getElementById("fmDirty"); if (d) { d.hidden = false; d.textContent = "저장 안 한 변경이 있어요"; } }
  function redrawQs() { const b = document.getElementById("fmQs"); if (b) b.innerHTML = qsHTML(); markDirty(); refreshPreview(true); }
  const findQ = (id) => S.fm.draft.qs.find((q) => q.id === id);

  // 입력할 때마다 초안에 반영
  document.addEventListener("input", function (e) {
    const el = e.target;
    if (!el.dataset) return;
    if (el.dataset.fmSearch !== undefined) {
      S.fm.q = el.value; refreshRoster(); return;
    }
    const f = S.fm.draft;
    if (!f) return;
    if (el.dataset.fm) {
      const k = el.dataset.fm;
      if (k === "cap" || k === "fee") { const d = el.value.replace(/\D/g, "").slice(0, 7); el.value = d; f[k] = Number(d) || 0; }
      else f[k] = el.value;
      if (k === "mode") { const w = document.getElementById("fmCapWrap"); if (w) w.hidden = f.mode !== "first"; }
      markDirty(); refreshPreview();
    } else if (el.dataset.fmDate) {
      const iso = isoDate(fmtDots(el.value.replace(/\D/g, "").slice(0, 8))); if (iso) { f[el.dataset.fmDate] = iso; markDirty(); }
    } else if (el.dataset.fq) {
      const q = findQ(el.dataset.q); if (!q) return;
      const k = el.dataset.fq;
      if (k === "options") q.options = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
      else if (k === "required" || k === "attend") q[k] = el.checked;
      else q[k] = el.value;
      markDirty(); refreshPreview();
    }
  });
  document.addEventListener("change", function (e) {
    const el = e.target;
    if (!el.dataset || !S.fm.draft) return;
    if (el.dataset.fm === "mode" || el.dataset.fm === "ownerDept") el.dispatchEvent(new Event("input", { bubbles: true }));
    else if (el.dataset.fq === "required" || el.dataset.fq === "attend") el.dispatchEvent(new Event("input", { bubbles: true }));
    else if (el.classList.contains("dnative") && el.closest(".dwrap") && el.closest(".dwrap").querySelector("[data-fm-date]")) {
      S.fm.draft[el.closest(".dwrap").querySelector("[data-fm-date]").dataset.fmDate] = el.value; markDirty();
    }
  });
  // 미리보기에서 제출 눌러 보기 (저장은 안 됨)
  document.addEventListener("submit", function (e) {
    const form = e.target;
    if (!form.classList || !form.classList.contains("ap-form") || !form.closest("#fmPreview")) return;
    e.preventDefault();
    const f = curForm(), r = AP.readAnswers(f, form), err = form.querySelector(".ap-err");
    if (r.err) { err.hidden = false; err.textContent = r.err; return; }
    S.fm.pv = { name: r.name, sid: r.sid, answers: r.answers, at: Date.now() };
    refreshPreview(true);
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-ap-back]")) { S.fm.pv = null; refreshPreview(true); return; }
    const b = e.target.closest("#fmPreview [data-copy]");
    if (b) toast("복사했어요: " + b.dataset.copy);
  });

  const FORM_ACTS = {
    fmTab(el) { S.fm.tab = el.dataset.tab; S.fm.pv = null; renderPage(); },
    fmStart() {
      const p = (S.cache.projects || []).find((x) => x.id === S.fm.pid);
      const tpl = (document.querySelector('input[name="fmTpl"]:checked') || {}).value || "basic";
      S.fm.draft = Object.assign(AP.newForm(tpl, p.name), { ownerDept: formDeptFor(p), projectDept: p.dept, keepUntil: keepDefault(p) });
      S.fm.tab = "build"; S.fm.dirty = true; renderPage();
    },
    fmAddQ(el) {
      const t = el.dataset.type, multi = t === "choice" || t === "multi";
      if ((t === "name" || t === "sid") && AP.qOf(S.fm.draft, t)) return toast("‘" + AP.TYPES[t].label + "’ 질문은 하나만 있으면 돼요.", true);
      S.fm.draft.qs.push(AP.Q(t, multi || t === "text" ? "새 질문" : t === "agree" ? "안내 내용에 동의합니다" : AP.TYPES[t].label, multi ? { options: ["보기 1", "보기 2"] } : {}));
      redrawQs();
      const last = document.getElementById("fmQs").lastElementChild;
      if (last) { last.scrollIntoView({ block: "center", behavior: "smooth" }); const i = last.querySelector("input"); if (i) i.select(); }
    },
    fmDelQ(el) {
      const q = findQ(el.dataset.q);
      if (q && AP.TYPES[q.type] && AP.TYPES[q.type].fixed) return toast("이름·학번 질문은 지울 수 없어요. (입금자명·중복 확인에 써요)", true);
      S.fm.draft.qs = S.fm.draft.qs.filter((x) => x.id !== el.dataset.q); redrawQs();
    },
    fmMoveQ(el) {
      const qs = S.fm.draft.qs, i = qs.findIndex((x) => x.id === el.dataset.q), j = i + Number(el.dataset.dir);
      if (i < 0 || j < 0 || j >= qs.length) return;
      const t = qs[i]; qs[i] = qs[j]; qs[j] = t; redrawQs();
    },
    async fmSave(el) {
      const fm = S.fm, f = fm.draft, p = (S.cache.projects || []).find((x) => x.id === fm.pid);
      const bad = AP.checkForm(f);
      if (bad) return toast(bad, true);
      const doc = Object.assign({}, f, { projectId: fm.pid, projectName: p ? p.name : f.projectName || "", projectDept: p ? p.dept : f.projectDept,
        ownerDept: f.ownerDept || formDeptFor(p), keepUntil: f.keepUntil || keepDefault(p), cap: Number(f.cap) || 0, fee: Number(f.fee) || 0,
        open: !!f.open, updatedAt: new Date().toISOString(), updatedBy: S.authUser.uid });
      delete doc.id;
      // 권한 명단은 [권한 설정]에서만 바뀜 (양식을 고치는 동안 바뀌었을 수도 있으니 최신 값 유지)
      doc.editorUids = (fm.form && fm.form.editorUids) || [];
      doc.viewerUids = (fm.form && fm.form.viewerUids) || [];
      if (!canEditForm(doc)) return toast("양식 담당 국서를 우리 국서가 아닌 곳으로 바꾸면 저장할 수 없어요.", true);
      el.disabled = true;
      try { await DB.set("forms", fm.pid, doc); } catch (e) { el.disabled = false; throw e; }
      const first = !fm.form;
      dirty("forms");
      await loadFm(fm.pid, true);
      S.fm.tab = "build";
      await renderPage();
      toast(first ? "저장했어요. 준비되면 [신청 받기 시작]을 누르고 링크를 공유하세요." : "저장했어요. 학생 화면에 바로 반영돼요.");
    },
    fmDiscard() {
      if (S.fm.dirty && !confirm("저장 안 한 변경을 버릴까요?")) return;
      S.fm.draft = null; S.fm.dirty = false; S.fm.pv = null;
      if (!S.fm.form) { location.hash = "projects"; return; }
      renderPage();
    },
    async fmOpen() {
      const f = S.fm.form;
      if (S.fm.dirty) return toast("먼저 [저장]을 눌러 주세요.", true);
      if (!f.open && !confirm("신청을 받기 시작할까요? 링크를 받은 학생이 바로 신청할 수 있어요.")) return;
      await DB.update("forms", S.fm.pid, { open: !f.open });
      dirty("forms"); await loadFm(S.fm.pid, true); await renderPage();
      toast(S.fm.form.open ? "신청을 받기 시작했어요. 링크를 복사해서 공유하세요." : "신청을 닫았어요.");
    },
    fmCopyMsg() {
      const f = S.fm.form;
      const bits = [];
      if (f.mode === "first") bits.push("선착순 " + f.cap + "명");
      if (Number(f.fee) > 0) bits.push("참가비 " + AP.won(f.fee));
      const msg = "📢 " + (f.title || "행사 신청") + "\n" + (f.desc ? "\n" + f.desc + "\n" : "") + (bits.length ? "\n" + bits.join(" · ") + "\n" : "") +
        (f.due && Number(f.fee) > 0 ? "입금 기한: " + f.due + "\n" : "") + "\n👉 신청하기\n" + applyUrl(S.fm.pid);
      Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(msg)).then(() => toast("공지 문구를 복사했어요. 단톡방에 붙여넣으면 돼요.")).catch(() => infoModal("공지 문구", '<textarea rows="9" style="width:100%">' + esc(msg) + "</textarea>"));
    },
    async fmPerm() {
      const f = S.fm.form; if (!f) return;
      const users = (await col("users")).filter((u) => u.status === "approved");
      const isHeadU = (u) => u.position === "국장" || u.position === deptPositions()[0];
      const autoEdit = (u) => execPositions().indexOf(u.position) >= 0 || u.dept === execDept() || u.isAdmin || (u.dept === f.ownerDept && (isHeadU(u) || u.grade === "2학년"));
      const autoView = (u) => autoEdit(u) || /재무/.test(u.dept || "") || (u.dept === f.projectDept && isHeadU(u));
      const ed = f.editorUids || [], vw = f.viewerUids || [];
      const box = (cls, u, on, dis) => '<label class="pm-row"><input type="checkbox" class="' + cls + '" value="' + esc(u.id) + '"' + (on ? " checked" : "") + (dis ? " disabled" : "") + "> <b>" + esc(u.name) + "</b> " + deptTag(u.dept) + '<span class="muted small">' + esc([u.position, u.grade].filter(Boolean).join(" · ")) + "</span></label>";
      const editCands = users.filter((u) => !autoEdit(u)).sort((a, b) => (a.dept === f.ownerDept ? 0 : 1) - (b.dept === f.ownerDept ? 0 : 1) || deptRank(a.dept) - deptRank(b.dept) || a.name.localeCompare(b.name));
      const viewCands = users.filter((u) => !autoView(u)).sort((a, b) => deptRank(a.dept) - deptRank(b.dept) || a.name.localeCompare(b.name));
      const exec = isExecMember();
      openForm({ title: "신청 양식 권한", submitLabel: "저장",
        intro: '<p class="small" style="margin:0 0 6px"><b>양식 고치기</b> — 자동: 회장단, ' + esc(f.ownerDept) + ' 국장·2학년</p>' +
          '<p class="muted small" style="margin:0 0 6px">이 양식을 맡은 사람(예: 만드는 1학년)을 체크하면 그 사람도 고칠 수 있어요. ' + esc(f.ownerDept) + " 국장과 회장단이 정해요.</p>" +
          '<div class="pm-list">' + (editCands.map((u) => box("pm-ed", u, ed.indexOf(u.id) >= 0, false)).join("") || '<p class="muted small">추가할 사람이 없어요.</p>') + "</div>" +
          '<p class="small" style="margin:14px 0 6px"><b>참여자 명단 보기</b> (입금·출석 체크 포함) — 자동: 위 사람들, 재무국 전원, ' + esc(f.projectDept) + " 국장</p>" +
          '<p class="muted small" style="margin:0 0 6px">' + (exec ? "이 사업만 명단을 따로 볼 사람을 체크하세요. (회장단만 정할 수 있어요)" : "명단을 볼 사람 추가는 회장단만 할 수 있어요.") + "</p>" +
          '<div class="pm-list">' + (viewCands.map((u) => box("pm-vw", u, vw.indexOf(u.id) >= 0, !exec)).join("") || '<p class="muted small">추가할 사람이 없어요.</p>') + "</div>",
        fields: [],
        onSubmit: async () => {
          const pick = (c) => Array.from(modalRoot.querySelectorAll("." + c + ":checked")).map((x) => x.value);
          const patch = { editorUids: pick("pm-ed") };
          if (exec) patch.viewerUids = pick("pm-vw");
          await DB.update("forms", S.fm.pid, patch);
          dirty("forms"); await loadFm(S.fm.pid, true); await renderPage(); toast("권한을 저장했어요.");
        } });
    },
    fmCopy() {
      const u = applyUrl(S.fm.pid);
      Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(u)).then(() => toast("신청 링크를 복사했어요.")).catch(() => toast("링크를 길게 눌러 복사해 주세요."));
    },
    async fmDelete() {
      if (!confirm("이 신청 양식과 참여자 명단(" + (S.fm.resp ? S.fm.resp.length : 0) + "명)을 모두 지울까요? 되돌릴 수 없어요.")) return;
      for (const r of (await DB.list(respPath(S.fm.pid)))) await DB.remove(respPath(S.fm.pid), r.id);
      await clearSlots(S.fm.pid);
      await DB.remove("forms", S.fm.pid);
      dirty("forms"); S.fm = { pid: "" }; location.hash = "projects"; toast("삭제했어요.");
    },
    async fmReload() { S.fm.resp = null; await loadFm(S.fm.pid); refreshRoster(); toast("새로 불러왔어요."); },
    async fmAtt(el) {
      const r = S.fm.resp.find((x) => x.id === el.dataset.sid); if (!r) return;
      const v = !r.attended, patch = { attended: v, attendedAt: v ? hm() : "" };
      await DB.update(respPath(S.fm.pid), r.id, patch);
      Object.assign(r, patch); refreshRoster();
      if (v) toast(r.name + " 출석 확인 (" + patch.attendedAt + ")");
    },
    async fmPaid(el) {
      const r = S.fm.resp.find((x) => x.id === el.dataset.sid); if (!r) return;
      const patch = { paid: el.checked, paidAt: el.checked ? new Date().toISOString() : "" };
      try { await DB.update(respPath(S.fm.pid), r.id, patch); } catch (e) { el.checked = !el.checked; throw e; }
      Object.assign(r, patch); refreshRoster();
    },
    async fmDelResp(el) {
      const r = S.fm.resp.find((x) => x.id === el.dataset.sid); if (!r) return;
      if (!confirm(r.name + " (" + r.sid + ") 응답을 지울까요? 같은 학번으로 다시 신청할 수 있게 돼요.")) return;
      await DB.remove(respPath(S.fm.pid), r.id);
      if (r.slotId) { try { await DB.remove("forms/" + S.fm.pid + "/slots", r.slotId); } catch (e) { console.warn(e); } }
      S.fm.resp = ordered(S.fm.form, S.fm.resp.filter((x) => x !== r)); refreshRoster(); toast("지웠어요.");
    },
    fmBank() {
      const f = S.fm.form;
      openForm({ title: "통장 내역으로 입금 확인",
        intro: '<p class="muted small" style="margin:0">은행 앱 거래내역을 복사해서 붙여넣으면, 명단의 <b>입금자명</b>(예: 24123이다홍)이 보이는 사람을 입금 확인으로 체크해요. 띄어쓰기는 무시해요.</p>',
        fields: [{ name: "text", label: "거래내역 붙여넣기", type: "textarea", rows: 8, required: true, placeholder: "10.20 14:02  24123이다홍  3,000\n10.20 14:10  25088김민준  3,000" }],
        submitLabel: "맞춰 보기",
        onSubmit: async function (v) {
          const txt = String(v.text || "").replace(/\s/g, "");
          const todo = S.fm.resp.filter((r) => AP.needPay(f, r) && !r.paid);
          const hit = todo.filter((r) => txt.indexOf(r.depositName || AP.depositName(r.sid, r.name)) >= 0);
          const nameOnly = todo.filter((r) => hit.indexOf(r) < 0 && r.name && txt.indexOf(r.name) >= 0);
          for (const r of hit) { const patch = { paid: true, paidAt: new Date().toISOString() }; await DB.update(respPath(S.fm.pid), r.id, patch); Object.assign(r, patch); }
          setTimeout(function () {
            refreshRoster();
            infoModal("입금 확인 결과", "<p><b>" + hit.length + "명</b>을 입금 확인으로 체크했어요." + (hit.length ? "<br><span class='muted small'>" + hit.map((r) => esc(r.name)).join(", ") + "</span>" : "") + "</p>" +
              (nameOnly.length ? '<div class="notice warn"><b>직접 확인해 주세요 (' + nameOnly.length + "명)</b><br>입금자명 형식은 다르지만 이름은 보여요: " + nameOnly.map((r) => esc(r.name) + " (" + esc(r.depositName) + ")").join(", ") + "</div>" : "") +
              '<p class="muted small">아직 입금 안 된 사람: ' + (todo.length - hit.length) + "명</p>");
          }, 0);
        } });
    },
    fmCsv() {
      const f = S.fm.form, extra = (f.qs || []).filter((x) => x.type !== "name" && x.type !== "sid");
      const head = ["번호", "이름", "학번", "입금자명", f.mode === "first" ? "선착순" : "", "입금", "출석", "제출 시각"].filter(Boolean).concat(extra.map((x) => x.label));
      const rows = S.fm.resp.map((r) => [r.no || "", r.name, r.sid, r.depositName, f.mode === "first" ? (!AP.isGoing(f, r) ? "" : r.wait ? "대기 " + r.waitNo : "정원 안") : null,
        r.paid ? "O" : "", r.attended ? "O " + (r.attendedAt || "") : "", AP.stampText(r.at)].filter((x) => x !== null)
        .concat(extra.map((x) => { const v = (r.answers || {})[x.id]; return x.type === "agree" ? (v ? "동의" : "") : Array.isArray(v) ? v.join(", ") : (v == null ? "" : v); })));
      const csv = "﻿" + [head].concat(rows).map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = "roster-" + S.fm.pid + "-" + today() + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
      toast("받았어요. 개인정보가 있으니 회장단 드라이브에만 보관하세요.");
    },
  };

  async function after(...names) { names.forEach(dirty); await renderPage(); }
  const stamp = () => ({ createdBy: S.authUser.uid, createdAt: new Date().toISOString() });
  function ownerFrom(v) {
    if (!("ownerSel" in v)) return v;
    const m = memberOf(v.ownerSel); delete v.ownerSel;
    v.owner = m.name; v.ownerUid = m.uid; return v;
  }
  function assigneeFrom(v) {
    if (!("assigneeSel" in v)) return v;
    const m = membersFrom(v.assigneeSel); delete v.assigneeSel;
    v.assigneeUids = m.uids; v.assigneeUid = m.uids[0] || ""; v.assignee = m.names.join(", "); return v;
  }

  async function findIn(c, id) { return (await col(c)).find((x) => x.id === id); }

  /* 사업 하나에 국서별 업무를 한 번에 나눠 넣기 → 업무 캘린더에도 표시 */
  function openDistribute(p, rows, fromWho) {
    const okDepts = manageableDepts();
    rows = (rows || []).filter((r) => !r.dept || okDepts.indexOf(r.dept) >= 0);
    rows = rows.length ? rows : [{}, {}, {}];
    if (okDepts.length === 1) rows.forEach((r) => (r.dept = r.dept || okDepts[0]));
    const deptOpts = (sel) => '<option value="">국서 선택</option>' + okDepts.map((d) => '<option value="' + esc(d) + '"' + (d === sel ? " selected" : "") + ">" + esc(d) + "</option>").join("");
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
    toggleProj(el) {
      const row = el.closest(".prow"), id = el.dataset.id;
      S.openProj[id] = !S.openProj[id];
      row.classList.toggle("open", S.openProj[id]);
      el.setAttribute("aria-expanded", S.openProj[id]);
    },
    async hideHomeMsg() {
      if (!S.me) return;
      await DB.update("users", S.authUser.uid, { hideHomeMsg: true });
      S.me.hideHomeMsg = true; dirty("users"); await renderPage();
      toast("내 홈에서 숨겼어요. 소통방 → 선배들의 한마디에서 다시 켤 수 있어요.");
    },
    async showHomeMsg() {
      if (!S.me) return;
      await DB.update("users", S.authUser.uid, { hideHomeMsg: false });
      S.me.hideHomeMsg = false; dirty("users"); await renderPage();
      toast("홈에 다시 보여요.");
    },
    sideFold() {
      const sh = document.querySelector(".shell"); if (!sh) return;
      sh.classList.toggle("folded");
      try { localStorage.setItem("sideFolded", sh.classList.contains("folded") ? "1" : "0"); } catch (e) { /* 무시 */ }
    },
    async logout() { stopWatch(); S.cache = {}; S.route = "home"; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* 무시 */ } await DB.signOut(); },
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
      // 활동 중인 회원은 학년·국서·직책을 직접 못 바꿈 (회장단이 [관리 → 회원 편집]에서 변경)
      const locked = S.me.status !== "pending" && !isAdmin();
      const lockKeys = ["grade", "dept", "position"];
      const fields = locked ? profileFields().filter((f) => lockKeys.indexOf(f.name) < 0) : profileFields();
      openForm({ title: "내 정보 수정", fields: fields, values: S.me,
        intro: locked ? '<p class="muted small">지금: <b>' + esc([S.me.grade, S.me.dept, S.me.position].filter(Boolean).join(" · ")) +
          "</b><br>학년 · 소속 국서 · 직책이 바뀌었으면 회장단에게 말해 주세요. 회장단이 [관리]에서 바꿔 줘요.</p>" : "",
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
    calShow(el) {
      S.calShow[el.dataset.k] = !S.calShow[el.dataset.k];
      try { localStorage.setItem("calShow", JSON.stringify(S.calShow)); } catch (e) { /* 무시 */ }
      renderPage();
    },
    async addTask(el) {
      if (!isHead()) { if (!el.classList.contains("cell")) toast("업무 추가·분배는 국장과 회장단만 할 수 있어요.", true); return; }
      await col("users");
      openForm({ title: "업무 추가", fields: taskFields(await linkableProjects()),
        values: { dueDate: el.dataset.date || today(), dept: (canManage(S.calFilter) && S.calFilter) || (canManage(S.me && S.me.dept) ? S.me.dept : manageableDepts()[0] || "") },
        submitLabel: "추가", onSubmit: async (v) => {
          assigneeFrom(v);
          await DB.add("tasks", Object.assign(v, { done: false }, stamp()));
          await after("tasks"); toast("캘린더에 추가했어요.");
        } });
    },
    async editTask(el) {
      const t = await findIn("tasks", el.dataset.id);
      if (!t) return;
      await col("users");
      if (!canManage(t.dept)) {
        // 국원·다른 국서 국장: 내용 보기 + (우리 국서 업무면) 완료 체크만
        const pn = t.projectId ? ((await col("projects")).find((p) => p.id === t.projectId) || {}).name : "";
        openForm({ title: "업무 보기", fields: [],
          intro: '<dl class="meta wide"><dt>할 일</dt><dd><b>' + esc(t.title) + "</b></dd><dt>국서</dt><dd>" + deptTag(t.dept) + "</dd><dt>마감일</dt><dd>" + fmtDate(t.dueDate) + " (" + (t.done ? "완료" : dday(t.dueDate)) + ")</dd>" +
            (pn ? "<dt>관련 사업</dt><dd>" + esc(pn) + "</dd>" : "") + (t.assignee ? "<dt>맡은 사람</dt><dd>" + esc(t.assignee) + "</dd>" : "") +
            (t.memo ? "<dt>메모</dt><dd>" + esc(t.memo) + "</dd>" : "") + "</dl>" +
            '<p class="muted small">업무 내용은 ' + esc(t.dept) + " 국장과 회장·부회장이 고칠 수 있어요.</p>",
          extraButtons: canTickTask(t) ? [{ label: t.done ? "완료 취소" : "완료했어요 ✓", cls: t.done ? "" : "primary", onClick: async () => {
            await DB.update("tasks", t.id, { done: !t.done }); closeModal(); await after("tasks"); toast(t.done ? "완료를 취소했어요." : "완료했어요!");
          } }] : [] });
        return;
      }
      const fields = taskFields(await linkableProjects(t.projectId)).concat([{ name: "done", label: "완료한 업무예요", type: "checkbox" }]);
      openForm({ title: "업무 보기 · 수정", fields: fields, values: Object.assign({}, t, { assigneeSel: uidsOf(t).length ? uidsOf(t) : (t.assignee ? t.assignee.split(/,\s*/).map((n) => memberValue(t.dept, "", n)) : []) }),
        extraButtons: [{ label: "삭제", cls: "danger", onClick: async () => {
          if (!confirm("이 업무를 삭제할까요?")) return;
          await DB.remove("tasks", t.id); closeModal(); await after("tasks"); toast("삭제했어요.");
        } }],
        onSubmit: async (v) => { assigneeFrom(v); await DB.update("tasks", t.id, v); await after("tasks"); toast("저장했어요."); } });
    },
    async distribute(el) {
      if (!isHead()) { toast("국서별 업무 분배는 국장과 회장단만 할 수 있어요.", true); return; }
      const p = await findIn("projects", el.dataset.id);
      if (p) openDistribute(p);
    },
    async assignTask(el) {
      const m = memberOf(el.value);
      try { await DB.update("tasks", el.dataset.id, { assigneeUid: m.uid, assigneeUids: m.uid ? [m.uid] : [], assignee: m.name }); await after("tasks"); toast(m.name ? m.name + "에게 맡겼어요." : "담당자를 비웠어요."); }
      catch (e) { toast(errMsg(e), true); }
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
    async addProject() {
      await col("users");
      openForm({ title: "사업 추가", fields: projectFields(), submitLabel: "추가",
        values: { year: S.settings.currentYear, status: "기획중", dept: S.projDept || (S.me && S.me.dept) || "" },
        onSubmit: async (v) => {
          ownerFrom(v); v.status = autoStatus(v);
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
      await col("users");
      openForm({ title: "사업 수정", fields: projectFields({ council: true }), values: Object.assign({}, p, { ownerSel: memberValue(p.dept, p.ownerUid, p.owner) }),
        extraButtons: isHead() ? [{ label: "삭제", cls: "danger", onClick: async () => {
          if (!confirm("'" + p.name + "' 사업을 삭제할까요? 되돌릴 수 없어요.\n(분배된 업무는 캘린더에 그대로 남아요)")) return;
          await DB.remove("projects", p.id);
          // 신청 양식·명단도 함께 지움 (권한이 없으면 보관 기한에 자동으로 지워짐)
          try { if (await DB.get("forms", p.id)) { for (const r of await DB.list(respPath(p.id))) await DB.remove(respPath(p.id), r.id); await DB.remove("forms", p.id); dirty("forms"); } } catch (e) { console.warn(e); }
          try { for (const t of (await col("tasks")).filter((x) => x.projectId === p.id)) await DB.update("tasks", t.id, { projectId: "" }); } catch (e) { /* 국원은 업무를 못 고침 — 업무는 그대로 남음 */ }
          closeModal(); await after("projects", "tasks"); toast("삭제했어요.");
        } }] : [],
        onSubmit: async (v) => { ownerFrom(v); v.status = autoStatus(reviveStatus(p, v)); await DB.update("projects", p.id, v); await after("projects"); toast("저장했어요."); } });
    },
    roomTab(el) { S.room = el.dataset.dept; renderPage(); },
    async addRoomTask() {
      const room = S.room;
      await col("users");
      openForm({ title: room + "방 · 할 일 추가", fields: roomFields(room), submitLabel: "추가",
        onSubmit: async (v) => {
          assigneeFrom(v); v.assigneeName = v.assignee; delete v.assignee;
          await DB.add("deptTasks", Object.assign(v, { dept: room, done: false, generation: S.settings.generation }, stamp()));
          await after("deptTasks"); toast("추가했어요.");
        } });
    },
    async editRoomTask(el) {
      const x = await findIn("deptTasks", el.dataset.id);
      if (!x) return;
      await col("users");
      openForm({ title: x.dept + "방 · 할 일 수정", fields: roomFields(x.dept), values: Object.assign({}, x, { assigneeSel: uidsOf(x) }),
        extraButtons: [{ label: "삭제", cls: "danger", onClick: async () => {
          if (!confirm("이 할 일을 지울까요?")) return;
          await DB.remove("deptTasks", x.id); closeModal(); await after("deptTasks"); toast("지웠어요.");
        } }],
        onSubmit: async (v) => {
          assigneeFrom(v); v.assigneeName = v.assignee; delete v.assignee;
          await DB.update("deptTasks", x.id, v);
          await after("deptTasks"); toast("저장했어요.");
        } });
    },
    async toggleRoomTask(el) {
      const on = el.checked;
      try {
        await DB.update("deptTasks", el.dataset.id, on ? { done: true, doneAt: new Date().toISOString(), doneBy: S.authUser.uid } : { done: false, doneAt: "", doneBy: "" });
        await after("deptTasks");
      } catch (e) { toast(errMsg(e), true); el.checked = !on; }
    },
    addNotice() {
      openForm({ title: "📌 공지 올리기", fields: noticeFields(), submitLabel: "올리기",
        intro: '<p class="muted small">활동 중인 학생회원 모두의 홈 화면 맨 위에 보여요.</p>',
        onSubmit: async (v) => {
          await DB.add("notices", Object.assign(v, { authorName: (S.me && S.me.name) || "회장단", generation: S.settings.generation }, stamp()));
          await after("notices"); toast("공지를 올렸어요.");
        } });
    },
    async editNotice(el) {
      const n = await findIn("notices", el.dataset.id);
      if (!n) return;
      openForm({ title: "공지 수정", fields: noticeFields(), values: n,
        onSubmit: async (v) => { await DB.update("notices", n.id, v); await after("notices"); toast("저장했어요."); } });
    },
    async delNotice(el) {
      if (!confirm("이 공지를 내릴까요?")) return;
      await DB.remove("notices", el.dataset.id); await after("notices"); toast("공지를 내렸어요.");
    },
    async backup() {
      const names = ["settings", "users", "projects", "tasks", "deptTasks", "minutes", "notices", "councils", "messages", "capsules", "talk", "talkComments"];
      const data = {};
      toast("백업 파일을 만드는 중…");
      for (const n of names) { try { data[n] = await DB.list(n); } catch (e) { data[n] = { error: errMsg(e) }; } }
      const out = { site: CFG.siteName, council: curCouncil(), exportedAt: new Date().toISOString(), data: data };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "council-backup-" + today() + ".json";
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 3000);
      toast("백업 파일을 내려받았어요. 학생회 구글 드라이브에 보관해 주세요.");
    },
    async editSchedule(el) {
      const p = await findIn("projects", el.dataset.id);
      if (!p) return;
      const list = schedOf(p);
      const rows = (list.length ? list : [{}, {}]).map(schedRowHTML).join("");
      openForm({ title: "'" + p.name + "' 세부 일정", submitLabel: "저장",
        intro: '<p class="muted small">가수요조사 기간, 실수요조사 기간, 공지 올리는 날처럼 <b>사업의 날짜·기간</b>을 적어 두면 업무 캘린더에 테두리 칸으로 표시돼요. 하루짜리는 끝나는 날을 비워 두세요. 누가 언제까지 할 <b>일</b>(공지글 작성 등)은 [국서별 업무 분배]에 넣어 주세요.</p>' +
          (p.startDate ? '<p class="small"><b>사업 날짜: ' + eventDateText(p) + "</b></p>" : ""),
        fields: [],
        after: '<div class="shead"><span>일정 이름</span><span>시작일</span><span>끝나는 날 (선택)</span><span></span></div><div class="slist">' + rows + '</div><button type="button" class="btn sm" data-sch-add>+ 줄 추가</button>',
        onSubmit: async () => {
          const out = [];
          for (const r of Array.from(modalRoot.querySelectorAll(".srow"))) {
            const title = r.querySelector(".s-title").value.trim();
            const sRaw = r.querySelector(".s-start").value, eRaw = r.querySelector(".s-end").value;
            if (!title) { if (sRaw || eRaw) throw new Error("날짜를 넣은 줄에 일정 이름도 적어 주세요."); continue; }
            const start = isoDate(sRaw), end = isoDate(eRaw);
            if (!start) throw new Error("'" + title + "'의 시작일을 YYYY.MM.DD 형식으로 넣어 주세요.");
            if (end === null) throw new Error("'" + title + "'의 끝나는 날을 YYYY.MM.DD 형식으로 넣어 주세요.");
            if (end && end < start) throw new Error("'" + title + "'의 끝나는 날이 시작일보다 빨라요.");
            out.push({ title: title, start: start, end: end && end > start ? end : "" });
          }
          await DB.update("projects", p.id, { schedule: out });
          await after("projects"); toast(out.length ? "세부 일정을 저장했어요." : "세부 일정을 비웠어요.");
        } });
    },
    async viewProject(el) {
      const p = await findIn("projects", el.dataset.id);
      if (!p) return;
      // 사업 기획안에서 그 사업 줄을 펼쳐서 보여 줌
      if (isActive(p)) { S.openProj[p.id] = true; S.projDept = ""; S.scrollTo = p.id; location.hash = "projects"; if (S.route === "projects") await renderPage(); }
      else location.hash = "archive";
    },
    async reuseProject(el) {
      const p = await findIn("projects", el.dataset.id);
      if (!p) return;
      const who = councilLabel(p.generation, p.councilName) || p.year + "년";
      await col("users");
      openForm({ title: "참고해서 새로 기획하기", submitLabel: "만들기",
        intro: '<p class="muted small">' + esc(who) + "의 '" + esc(p.name) + "'을 바탕으로 " + esc(curCouncil()) + " 사업을 새로 만들어요. 이전 기획안 링크는 참고용으로 함께 붙어요.</p>",
        fields: projectFields(),
        values: { name: p.name, dept: p.dept, year: S.settings.currentYear, status: "기획중", budget: p.budget, summary: "" },
        onSubmit: async (v) => {
          ownerFrom(v);
          const data = Object.assign(v, {
            generation: S.settings.generation, councilName: S.settings.councilName,
            prevNote: who + " " + p.name + (p.summary ? " — " + p.summary : ""), prevPlanUrl: safeUrl(p.planUrl) || safeUrl(p.resultUrl),
            schedule: schedOf(p).map((x) => ({ title: x.title, start: "", end: "" })),
          }, stamp());
          const id = await DB.add("projects", data);
          const oldTasks = (await tasksByProject())[p.id] || [];
          dirty("projects"); location.hash = "projects"; toast("사업 기획안에 추가했어요.");
          // 이전 업무 분배를 불러와서 마감일만 새로 넣게 함
          if (oldTasks.length && isHead()) setTimeout(() => openDistribute(Object.assign({ id: id }, data),
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
        { name: "slogan", label: "학생회 슬로건 (한 줄)", placeholder: "예: 여러분과 다 함께 더 밝게 반짝일 미래를 위해", help: "왼쪽 메뉴 위, 홈 화면, 로그인 화면에 보여요. 비워 두면 안 보여요." },
        { name: "homeMsg", label: "홈 화면에 '선배의 한마디' 보여주기 (끄면 모두의 홈에서 사라지고 소통방에서만 보여요. 켜 두면 각자 [숨기기]로 끌 수 있어요)", type: "checkbox" },
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
          { name: "slogan", label: "새 학생회 슬로건 (나중에 [사이트 설정]에서 넣어도 돼요)", placeholder: "새 학생회의 한 줄 슬로건" },
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
  Object.assign(ACTS, FORM_ACTS);
  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    const fn = ACTS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    Promise.resolve(fn(el, e)).catch((er) => toast(errMsg(er), true));
  });
  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.matches("input[data-act], select[data-act]")) { const fn = ACTS[el.dataset.act]; if (fn) fn(el, e); }
  });
  // 세부 일정 창의 줄 추가 / 지우기
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-sch-add]")) {
      const box = modalRoot.querySelector(".slist");
      if (box) { box.insertAdjacentHTML("beforeend", schedRowHTML({})); box.lastElementChild.querySelector(".s-title").focus(); }
    } else if (e.target.classList && e.target.classList.contains("s-del")) e.target.closest(".srow").remove();
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
  // 주소 뒤 #사업기획안 처럼 화면 이름 (#form/사업번호 처럼 뒤에 값이 붙기도 함)
  function parseRoute() {
    const h = (location.hash || "#home").slice(1), i = h.indexOf("/");
    S.route = i < 0 ? h : h.slice(0, i);
    S.routeArg = i < 0 ? "" : decodeURIComponent(h.slice(i + 1));
    if (!PAGES[S.route]) S.route = "home";
  }
  window.addEventListener("hashchange", function () {
    if (!/^#form\//.test(location.hash)) stopWatch();   // 신청 명단 화면을 떠나면 실시간 연결 끊기
    parseRoute();
    if (S.authUser && isApproved()) {
      document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + navKey(S.route)));
      window.scrollTo(0, 0);
      renderPage();
    }
  });

  /* ---------- 시작 ---------- */
  (async function boot() {
    parseRoute();
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
