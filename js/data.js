/* ============================================================
   데이터 저장소 연결 (수정할 필요 없음)
   - config.js에 Firebase 값이 있으면 → 진짜 Firebase에 저장
   - 비어 있으면 → 데모 모드 (새로고침하면 초기화되는 연습용 데이터)
   ============================================================ */
(function () {
  const cfg = window.SITE_CONFIG || {};
  const fb = cfg.firebase || {};
  const configured = !!(fb.apiKey && fb.projectId);
  const FB_VER = "10.12.2";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("인터넷 연결을 확인해 주세요 (" + src + ")")); };
      document.head.appendChild(s);
    });
  }
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  /* ---------------- Firebase (실제 운영) ---------------- */
  const FirebaseBackend = {
    mode: "firebase",
    async init() {
      const base = "https://www.gstatic.com/firebasejs/" + FB_VER + "/";
      await loadScript(base + "firebase-app-compat.js");
      await loadScript(base + "firebase-auth-compat.js");
      await loadScript(base + "firebase-firestore-compat.js");
      firebase.initializeApp(fb);
      this.auth = firebase.auth();
      this.fs = firebase.firestore();
      try { await this.auth.getRedirectResult(); } catch (e) { console.warn(e); }
    },
    onAuth(cb) {
      this.auth.onAuthStateChanged(function (u) {
        cb(u ? { uid: u.uid, email: (u.email || "").toLowerCase(), name: u.displayName || "" } : null);
      });
    },
    async signIn() {
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      try {
        await this.auth.signInWithPopup(p);
      } catch (e) {
        if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
          await this.auth.signInWithRedirect(p);
        } else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
          throw e;
        }
      }
    },
    signOut() { return this.auth.signOut(); },
    async get(col, id) {
      const d = await this.fs.collection(col).doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    async list(col) {
      const s = await this.fs.collection(col).get();
      return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    },
    async queryEq(col, field, value) {
      const snap = await this.fs.collection(col).where(field, "==", value).get();
      return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    },
    // 조건에 맞는 문서만 가져오기 (보안 규칙이 일부만 허용할 때 사용)
    async queryIn(col, field, values) {
      // 값마다 '같음' 조건으로 따로 조회 (보안 규칙이 확실히 확인할 수 있게)
      const out = [];
      for (const v of values) {
        const snap = await this.fs.collection(col).where(field, "==", v).get();
        snap.docs.forEach((d) => out.push(Object.assign({ id: d.id }, d.data())));
      }
      return out;
    },
    async set(col, id, data) { await this.fs.collection(col).doc(id).set(data); },
    async add(col, data) { const r = await this.fs.collection(col).add(data); return r.id; },
    async update(col, id, data) { await this.fs.collection(col).doc(id).update(data); },
    async remove(col, id) { await this.fs.collection(col).doc(id).delete(); },
  };

  /* ---------------- 데모 모드 (연습용) ---------------- */
  function ymd(d) {
    const z = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }
  function seed() {
    const t = new Date();
    const day = (n) => { const d = new Date(t); d.setDate(d.getDate() + n); return ymd(d); };
    const Y = t.getFullYear();
    const now = new Date().toISOString();
    const users = {};
    const people = [
      ["demo-president", "김하늘", "회장단", "회장", true],
      ["demo-vp", "이서준", "회장단", "부회장", true],
      ["demo-member", "박지민", "재무국", "국장", false],
      ["u4", "최유나", "재무국", "국원", false],
      ["u5", "정민호", "재무국", "국원", false],
      ["u6", "강다은", "소통국", "국장", false],
      ["u7", "윤시우", "소통국", "국원", false],
      ["u8", "임채원", "소통국", "국원", false],
      ["u9", "한도윤", "홍보국", "국장", false],
      ["u10", "오수아", "홍보국", "국원", false],
      ["u11", "서예준", "홍보국", "국원", false],
      ["u12", "신지호", "내무국", "국장", false],
      ["u13", "권나연", "내무국", "국원", false],
      ["u14", "황준서", "내무국", "국장", false],
      ["u15", "문하린", "대외협력국", "국장", false],
    ];
    people.forEach(function (p, i) {
      users[p[0]] = {
        name: p[1], dept: p[2], position: p[3], isAdmin: p[4], status: "approved",
        phone: "010-0000-" + String(1000 + i * 37).slice(-4), studentId: (p[3] === "국원" ? t.getFullYear() : t.getFullYear() - 1) + "2500" + String(10 + i), grade: i === 4 ? undefined : (p[3] === "국원" ? "1학년" : "2학년"),
        email: p[0] + "@example.com", createdAt: now,
      };
    });
    ["demo-president", "demo-vp", "demo-member"].forEach((k) => (users[k].generations = ["제28대"]));
    users["demo-pending"] = { name: "조은별", dept: "내무국", position: "국원", isAdmin: false, status: "pending", phone: "010-0000-9999", studentId: "2026250099", email: "pending@example.com", createdAt: now };
    users["demo-ob"] = { name: "정하람", dept: "홍보국", position: "국장", isAdmin: false, status: "inactive", inactiveReason: "임기 종료", phone: "010-0000-7777", studentId: (t.getFullYear() - 2) + "250077", email: "ob@example.com", createdAt: now,
      history: [{ generation: "제27대", councilName: "다온(예시)", dept: "홍보국", position: "국원" }, { generation: "제28대", councilName: "새벽(예시)", dept: "홍보국", position: "국장" }], generations: ["제27대", "제28대"] };
    users["u16"] = { name: "배수현", dept: "소통국", position: "국원", isAdmin: false, status: "pending", phone: "010-0000-8888", studentId: "2026250088", email: "u16@example.com", createdAt: now };

    const tasks = {};
    [
      ["축제 부스 운영 인원 배정표 공유", "홍보국", day(-3), true],
      ["중간고사 간식 행사 예산안 제출", "재무국", day(-1), false],
      ["중간고사 간식 행사 신청 폼 공지", "소통국", day(1), false],
      ["9월 회계 장부 정리", "재무국", day(3), false],
      ["간식 업체 견적 3곳 비교", "내무국", day(5), false],
      ["타 학과 학생회 교류회 일정 조율", "대외협력국", day(8), false],
      ["정기 전체회의 안건 수합", "내무국", day(10), false],
      ["학술제 기획안 초안", "홍보국", day(13), false],
      ["학생회 SNS 월간 결산 게시물", "소통국", day(20), false],
      ["2학기 중간 회계 감사 자료 제출", "재무국", day(26), false],
    ].forEach(function (x, i) {
      tasks["t" + i] = { title: x[0], dept: x[1], dueDate: x[2], done: x[3], assignee: "", memo: "", createdBy: "demo-president", createdAt: now };
    });

    const minutes = {};
    [
      ["제12차 정기 전체회의", "전체회의", day(-6)],
      ["재무국 국회의 (2학기 예산 점검)", "국회의", day(-9)],
      ["집행부 회의 – 축제 준비", "집행부회의", day(-13)],
      ["제11차 정기 전체회의", "전체회의", day(-20)],
    ].forEach(function (x, i) {
      minutes["m" + i] = { title: x[0], type: x[1], date: x[2], url: "https://docs.google.com/document/d/example" + i, memo: "", createdBy: "demo-president", createdAt: now };
    });

    minutes.old1 = { title: "제28대 마지막 전체회의", type: "전체회의", date: (Y - 1) + "-11-20", url: "https://docs.google.com/document/d/old-m1", memo: "인수인계 일정 확정", generation: "제28대", councilName: "새벽(예시)", createdBy: "x1", createdAt: now };
    minutes.old2 = { title: "제28대 홍보국 회의", type: "국회의", date: (Y - 1) + "-09-02", url: "https://docs.google.com/document/d/old-m2", memo: "", generation: "제28대", councilName: "새벽(예시)", createdBy: "x1", createdAt: now };
    const projects = {};
    const G = { [Y]: ["제29대", "윤슬"], [Y - 1]: ["제28대", "새벽(예시)"], [Y - 2]: ["제27대", "다온(예시)"] };
    const P = (id, o) => { projects[id] = Object.assign({ generation: G[o.year][0], councilName: G[o.year][1], owner: "", budget: "", summary: "", planUrl: "", resultUrl: "", extraUrl: "", createdBy: "demo-president", createdAt: now }, o); };
    P("p1", { name: "개강파티", year: Y, dept: "홍보국", status: "완료", startDate: Y + "-09-05", endDate: Y + "-09-05", owner: "한도윤", budget: "1,200,000원", summary: "가수요조사 → 장소 대관 → 당일 운영. 참여 140명.", planUrl: "https://docs.google.com/document/d/plan1", resultUrl: "https://docs.google.com/document/d/result1" });
    P("p2", { name: "중간고사 간식 행사", year: Y, dept: "내무국", status: "예정", startDate: day(6), endDate: day(7), owner: "신지호", budget: "800,000원", summary: "학생회비 납부자 대상 간식 배부.", schedule: [{ title: "가수요조사 기간", start: day(-2), end: day(0) }, { title: "실수요조사 기간", start: day(2), end: day(4) }, { title: "공지 업로드", start: day(1), end: "" }], planUrl: "https://docs.google.com/document/d/plan2" });
    P("p3", { name: "생명과학부 학술제", year: Y, dept: "홍보국", status: "기획중", startDate: day(30), endDate: day(30), owner: "오수아", summary: "학부 연구실 소개 + 선배 대학원생 패널 토크.", planUrl: "" });
    P("p4", { name: "과잠 공동구매", year: Y, dept: "재무국", status: "완료", startDate: Y + "-04-01", endDate: Y + "-05-10", owner: "박지민", budget: "자부담", planUrl: "https://docs.google.com/document/d/plan4", resultUrl: "https://docs.google.com/document/d/result4" });
    P("p5", { name: "개강파티", year: Y - 1, dept: "홍보국", status: "완료", startDate: (Y - 1) + "-09-06", endDate: (Y - 1) + "-09-06", owner: "홍보국장", budget: "1,000,000원", summary: "참여 120명. 장소가 좁았다는 피드백 → 다음엔 더 큰 곳.", planUrl: "https://docs.google.com/document/d/old1", resultUrl: "https://docs.google.com/document/d/old1r" });
    P("p6", { name: "중간고사 간식 행사", year: Y - 1, dept: "내무국", status: "완료", startDate: (Y - 1) + "-10-20", endDate: (Y - 1) + "-10-21", owner: "내무국장", budget: "700,000원", summary: "수량 부족으로 2일차 오전에 조기 소진.", planUrl: "https://docs.google.com/document/d/old2", resultUrl: "https://docs.google.com/document/d/old2r" });
    P("p7", { name: "새내기 배움터", year: Y - 1, dept: "회장단", status: "완료", startDate: (Y - 1) + "-02-20", endDate: (Y - 1) + "-02-22", owner: "회장단", summary: "2박 3일, 신입생 85명 참여.", planUrl: "https://docs.google.com/document/d/old3" });
    P("p8", { name: "학과 체육대회", year: Y - 2, dept: "내무국", status: "완료", startDate: (Y - 2) + "-05-15", endDate: (Y - 2) + "-05-15", owner: "내무국장", summary: "풋살·피구·계주.", planUrl: "https://docs.google.com/document/d/old4" });
    // 사업에 연결된 업무 (업무 분배 예시)
    ["t1", "t2", "t4"].forEach((k) => (tasks[k].projectId = "p2"));
    [["내무국", "간식 업체 견적 비교", "-10-10"], ["재무국", "예산안 작성", "-10-12"], ["소통국", "신청 폼 공지", "-10-14"], ["홍보국", "자보 제작", "-10-15"]].forEach(function (x, i) {
      tasks["old" + i] = { title: x[1], dept: x[0], dueDate: (Y - 1) + x[2], done: true, projectId: "p6", assignee: "", memo: "", createdBy: "demo-president", createdAt: now };
    });

    const councils = {
      "제27대": { memberUids: ["demo-ob"], generation: "제27대", councilName: "다온(예시)", endedAt: (Y - 2) + "-11-28", members: [
        { name: "백도현", dept: "회장단", position: "회장", phone: "010-0000-3011" }, { name: "남궁윤", dept: "회장단", position: "부회장", phone: "010-0000-3022" },
        { name: "고은채", dept: "홍보국", position: "국장", phone: "010-0000-3033" }, { name: "정하람", dept: "홍보국", position: "국원", phone: "010-0000-3044" }, { name: "류태오", dept: "내무국", position: "국장", phone: "010-0000-3055" }, { name: "송아린", dept: "재무국", position: "국장", phone: "010-0000-3066" }] },
      "제28대": { memberUids: ["demo-ob", "demo-president", "demo-vp", "demo-member"], generation: "제28대", councilName: "새벽(예시)", endedAt: (Y - 1) + "-11-27", members: [
        { name: "고은채", dept: "회장단", position: "회장", phone: "010-0000-3077" }, { name: "류태오", dept: "회장단", position: "부회장", phone: "010-0000-3088" },
        { name: "정하람", dept: "홍보국", position: "국장", phone: "010-0000-3099" }, { name: "김하늘", dept: "홍보국", position: "국원", phone: "010-0000-3110" }, { name: "이서준", dept: "내무국", position: "국원", phone: "010-0000-3121" },
        { name: "진세아", dept: "소통국", position: "국장", phone: "010-0000-3132" }, { name: "탁민결", dept: "재무국", position: "국장", phone: "010-0000-3143" }, { name: "박지민", dept: "재무국", position: "국원", phone: "010-0000-3154" }] },
    };
    const messages = {
      msg1: { text: "개강파티 장소는 최소 한 달 전에 예약하세요. 작년에 2주 전에 했다가 큰일 날 뻔했어요 ㅠㅠ", toDept: "모두에게", showName: true, authorUid: "x1", authorName: "고은채", authorDept: "회장단", authorPosition: "회장", generation: "제28대", councilName: "새벽(예시)", createdAt: (Y - 1) + "-11-20T00:00:00Z" },
      msg2: { text: "영수증은 받은 날 바로 사진 찍어서 드라이브에 올리기! 학기 말에 몰아서 하면 절대 안 맞아요.", toDept: "다음 재무국에게", showName: false, authorUid: "x2", authorName: "탁민결", authorDept: "재무국", authorPosition: "국장", generation: "제28대", councilName: "새벽(예시)", createdAt: (Y - 1) + "-11-21T00:00:00Z" },
      msg3: { text: "힘들 때는 혼자 끙끙대지 말고 꼭 서로 기대세요. 1년 금방 지나가요 :)", toDept: "모두에게", showName: true, authorUid: "demo-ob", authorName: "정하람", authorDept: "홍보국", authorPosition: "국장", generation: "제28대", councilName: "새벽(예시)", createdAt: (Y - 1) + "-11-22T00:00:00Z" },
    };
    const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
    const talk = {
      tk1: { text: "오늘 회의 수고 많았어요!! 다들 푹 쉬어요 🙌", authorUid: "demo-president", authorName: "김하늘", authorDept: "회장단", authorPosition: "회장", generation: "제29대", councilName: "윤슬", createdAt: ago(3) },
      tk2: { text: "혹시 학생회실 열쇠 누가 가지고 있나요?", authorUid: "u8", authorName: "임채원", authorDept: "소통국", authorPosition: "국원", generation: "제29대", councilName: "윤슬", createdAt: ago(26) },
    };
    const talkComments = {
      tc1: { postId: "tk2", text: "저한테 있어요! 내일 과방에 둘게요", authorUid: "u6", authorName: "강다은", authorDept: "소통국", authorPosition: "국장", generation: "제29대", councilName: "윤슬", createdAt: ago(25) },
    };
    const capsules = {
      cp1: { text: "1학년들아, 1년 동안 진짜 고마웠어. 너희가 이끌 30대 학생회가 벌써 기대돼!", toDept: "모두에게", showName: true, authorUid: "demo-president", authorName: "김하늘", authorDept: "회장단", authorPosition: "회장", generation: "제29대", councilName: "윤슬", createdAt: ago(5) },
      cp2: { text: "회계 장부는 매주 금요일에 정리하는 습관 들이기! 화이팅", toDept: "다음 재무국에게", showName: true, authorUid: "demo-member", authorName: "박지민", authorDept: "재무국", authorPosition: "국장", generation: "제29대", councilName: "윤슬", createdAt: ago(8) },
    };
    const notices = {
      nt1: { text: "이번 주 전체회의는 목요일 저녁 7시, 과방에서 해요. 각 국서 진행 상황 정리해 오기!", url: "", until: day(5), authorName: "김하늘", createdAt: ago(1) },
    };
    return {
      notices: notices,
      talk: talk, talkComments: talkComments, capsules: capsules,
      messages: messages,
      councils: councils,
      users: users, tasks: tasks, minutes: minutes, projects: projects,
      settings: { public: { generation: "제29대", councilName: "윤슬" }, site: { generation: "제29대", councilName: "윤슬", prevGeneration: "제28대", minutesFolderUrl: "https://drive.google.com/drive/folders/example" } },
    };
  }

  const DemoBackend = {
    mode: "demo",
    store: {}, cb: null, user: null, n: 0,
    async init() { this.store = seed(); },
    onAuth(cb) { this.cb = cb; cb(this.user); },
    personas: [
      { uid: "demo-president", label: "회장단으로 보기", desc: "가입 승인 · 관리 화면까지 모두" },
      { uid: "demo-member", label: "2학년 국장으로 보기", desc: "재무국장 박지민 (2학년)" },
      { uid: "u8", label: "1학년 국원으로 보기", desc: "소통국 국원 임채원 (1학년)" },
      { uid: "demo-pending", label: "승인 대기 중인 회원", desc: "가입 신청만 한 상태" },
      { uid: "demo-ob", label: "임기를 마친 선배 (OB)", desc: "함께했던 학생회 기록만 보기" },
      { uid: "demo-new", label: "처음 가입하는 사람", desc: "가입 신청서 작성 화면" },
    ],
    async signInAs(uid) {
      const p = this.store.users[uid];
      this.user = { uid: uid, email: p ? p.email : "newbie@example.com", name: p ? p.name : "" };
      this.cb(clone(this.user));
    },
    async signIn() { return this.signInAs("demo-president"); },
    async signOut() { this.user = null; this.cb(null); },
    async get(col, id) { const c = this.store[col] || {}; return c[id] ? Object.assign({ id: id }, clone(c[id])) : null; },
    async list(col) { const c = this.store[col] || {}; return Object.keys(c).map((id) => Object.assign({ id: id }, clone(c[id]))); },
    async queryIn(col, field, values) { return (await this.list(col)).filter((x) => values.indexOf(x[field]) >= 0); },
    async queryEq(col, field, value) { return (await this.list(col)).filter((x) => x[field] === value); },
    async set(col, id, data) { (this.store[col] = this.store[col] || {})[id] = clone(data); },
    async add(col, data) { const id = "x" + Date.now() + (this.n++); await this.set(col, id, data); return id; },
    async update(col, id, data) {
      const c = this.store[col] || {};
      if (!c[id]) throw new Error("없는 항목입니다");
      c[id] = Object.assign(c[id], clone(data));
    },
    async remove(col, id) { if (this.store[col]) delete this.store[col][id]; },
  };

  window.DB = configured ? FirebaseBackend : DemoBackend;
})();
