/* ============================================================
   행사 신청 양식 — 공용 부품 (수정할 필요 없음)
   학생이 보는 신청 페이지(apply.html)와 사이트 안 '미리보기'가 같이 씀
   ============================================================ */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
  const z = (n, k) => String(n).padStart(k || 2, "0");

  /* ---------- 질문 종류 ---------- */
  const TYPES = {
    name:   { label: "이름", hint: "입금자명에 쓰여요 · 꼭 있어야 해요", fixed: true },
    sid:    { label: "학번", hint: "10자리 · 중복 신청을 막고 입금자명에 쓰여요 · 꼭 있어야 해요", fixed: true },
    phone:  { label: "전화번호", hint: "010-0000-0000" },
    text:   { label: "짧은 답" },
    choice: { label: "하나 고르기" },
    multi:  { label: "여러 개 고르기" },
    yesno:  { label: "예 / 아니오" },
    agree:  { label: "동의 (체크)" },
  };
  const rid = () => "q" + Math.random().toString(36).slice(2, 8);
  const Q = (type, label, extra) => Object.assign({ id: rid(), type: type, label: label, required: true, options: [], attend: false, text: "" }, extra || {});
  const agreeText = (what) => "수집 항목: 이름, 학번, 전화번호\n목적: " + what + " 참여 확인과 연락\n보관: 행사가 끝나고 2주 뒤 삭제\n학생회 안에서만 봐요.";

  // 처음 만들 때 고르는 틀
  const TEMPLATES = {
    basic: { label: "기본 (이름·학번·전화번호·참여 여부·동의)", make: (ev) => ({ mode: "normal", qs: [
      Q("name", "이름"), Q("sid", "학번"), Q("phone", "전화번호"),
      Q("yesno", "행사에 참여하시나요?", { attend: true }),
      Q("agree", "개인정보 수집·이용에 동의합니다", { text: agreeText(ev) })] }) },
    snack: { label: "간식행사 (기본 + 간식 고르기)", make: (ev) => ({ mode: "normal", fee: 3000, qs: [
      Q("name", "이름"), Q("sid", "학번"), Q("phone", "전화번호"),
      Q("yesno", "행사에 참여하시나요?", { attend: true }),
      Q("choice", "간식 선택", { options: ["샌드위치", "김밥", "도넛"] }),
      Q("agree", "개인정보 수집·이용에 동의합니다", { text: agreeText(ev) })] }) },
    party: { label: "개강파티 (기본 + 2차·알레르기)", make: (ev) => ({ mode: "normal", fee: 15000, qs: [
      Q("name", "이름"), Q("sid", "학번"), Q("phone", "전화번호"),
      Q("yesno", "개강파티에 참여하시나요?", { attend: true }),
      Q("yesno", "2차도 참여하시나요?", { required: false }),
      Q("text", "못 먹는 음식이나 알레르기가 있으면 적어 주세요", { required: false }),
      Q("agree", "개인정보 수집·이용에 동의합니다", { text: agreeText(ev) })] }) },
    first: { label: "선착순 (정원 넘으면 대기)", make: (ev) => ({ mode: "first", cap: 40, qs: [
      Q("name", "이름"), Q("sid", "학번"), Q("phone", "전화번호"),
      Q("agree", "개인정보 수집·이용에 동의합니다", { text: agreeText(ev) })] }) },
  };
  function newForm(tpl, eventName) {
    const t = (TEMPLATES[tpl] || TEMPLATES.basic).make(eventName || "행사");
    return Object.assign({ title: (eventName || "행사") + " 신청", desc: "", mode: "normal", cap: 30, fee: 0, due: "", account: "", open: false }, t);
  }

  /* ---------- 계산 ---------- */
  const qOf = (f, t) => (f.qs || []).find((q) => q.type === t);
  const attendQ = (f) => (f.qs || []).find((q) => q.type === "yesno" && q.attend);
  // 입금자명 = 입학연도 2자리 + 학번 뒤 3자리 + 이름 (예: 2024250123 이다홍 → 24123이다홍)
  const depositName = (sid, name) => (String(sid || "").length >= 7 ? String(sid).slice(2, 4) + String(sid).slice(-3) : "") + String(name || "").replace(/\s/g, "");
  const isGoing = (f, r) => { const a = attendQ(f); return !a || (r.answers || {})[a.id] === "예"; };
  // 선착순: 제출 시각 순서로 정원 안 / 대기 (참여 '아니오'는 세지 않음). list는 제출 순서대로 정렬된 상태여야 함
  function place(f, list) {
    let k = 0;
    list.forEach((r) => {
      r.no = 0; r.wait = false; r.waitNo = 0;
      if (!isGoing(f, r)) return;
      k++; r.no = k;
      if (f.mode === "first" && k > Number(f.cap || 0)) { r.wait = true; r.waitNo = k - Number(f.cap || 0); }
    });
    return list;
  }
  const needPay = (f, r) => isGoing(f, r) && !r.wait && Number(f.fee) > 0;
  function checkForm(f) {
    if (!qOf(f, "name") || !qOf(f, "sid")) return "‘이름’과 ‘학번’ 질문은 꼭 있어야 해요. (입금자명과 중복 신청 확인에 써요)";
    if (!String(f.title || "").trim()) return "행사 이름(신청서 제목)을 넣어 주세요.";
    if (f.mode === "first" && !(Number(f.cap) > 0)) return "선착순 정원을 넣어 주세요.";
    return "";
  }
  // 제출 시각 (천분의 1초까지)
  function stampText(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds()) + "." + z(d.getMilliseconds(), 3);
  }

  /* ---------- 학생 화면 ---------- */
  function qHTML(q) {
    const req = q.required ? ' <span class="req">*</span>' : "";
    const nm = 'name="a_' + q.id + '"';
    if (q.type === "name" || q.type === "sid" || q.type === "phone" || q.type === "text") {
      const ph = q.type === "sid" ? "2026250123" : q.type === "phone" ? "010-1234-5678" : q.type === "name" ? "홍길동" : "";
      return '<div class="ap-q"><label class="ap-ql" for="a_' + q.id + '">' + esc(q.label) + req + "</label>" +
        '<input id="a_' + q.id + '" ' + nm + ' type="' + (q.type === "phone" ? "tel" : "text") + '"' +
        (q.type === "sid" || q.type === "phone" ? ' inputmode="numeric"' : "") + ' placeholder="' + ph + '" autocomplete="off" maxlength="' + (q.type === "text" ? 200 : 30) + '"></div>';
    }
    if (q.type === "choice" || q.type === "multi" || q.type === "yesno") {
      const opts = q.type === "yesno" ? ["예", "아니오"] : (q.options && q.options.length ? q.options : ["보기 1"]);
      const it = q.type === "multi" ? "checkbox" : "radio";
      return '<div class="ap-q" role="group" aria-label="' + esc(q.label) + '"><div class="ap-ql">' + esc(q.label) + req + (q.type === "multi" ? ' <span class="ap-pill">여러 개</span>' : "") + "</div>" +
        opts.map((o) => '<label class="ap-opt"><input type="' + it + '" ' + nm + ' value="' + esc(o) + '"> ' + esc(o) + "</label>").join("") + "</div>";
    }
    if (q.type === "agree") {
      return '<div class="ap-q">' + (q.text ? '<div class="ap-agree">' + esc(q.text) + "</div>" : "") +
        '<label class="ap-opt"><input type="checkbox" ' + nm + ' value="동의"> <b>' + esc(q.label) + "</b>" + req + "</label></div>";
    }
    return "";
  }
  const headHTML = (f) => '<div class="ap-brand"><span class="ap-mark">DLS</span>고려대학교 생명과학부 학생회</div>' +
    '<div class="ap-ev"><h1>' + esc(f.title || "행사 신청") + "</h1>" + (f.desc ? "<p>" + esc(f.desc) + "</p>" : "") + "</div>";
  function infoHTML(f) {
    const bits = [];
    if (f.mode === "first") bits.push('<span class="ap-pill acc">선착순 ' + esc(f.cap) + "명</span>");
    if (Number(f.fee) > 0) bits.push('<span class="ap-pill">참가비 ' + won(f.fee) + "</span>");
    return bits.length ? '<div class="ap-bits">' + bits.join("") + "</div>" : "";
  }
  function formHTML(f, opts) {
    opts = opts || {};
    if (!f.open && !opts.preview) return headHTML(f) + '<div class="ap-closed"><b>신청 마감</b><span>지금은 신청을 받지 않아요.</span></div>';
    if (!(f.qs || []).length) return headHTML(f) + '<div class="ap-closed"><span>아직 질문이 없어요.</span></div>';
    return headHTML(f) + infoHTML(f) +
      (f.mode === "first" ? '<p class="ap-note">제출한 시각 순서대로 정원 ' + esc(f.cap) + "명까지 확정되고, 그 뒤는 대기로 접수돼요.</p>" : "") +
      '<form class="ap-form" novalidate>' + f.qs.map(qHTML).join("") +
      '<p class="ap-err" hidden></p>' +
      '<button type="submit" class="ap-submit">' + (opts.preview ? "제출하기 (미리보기라 저장 안 됨)" : "제출하기") + "</button></form>";
  }
  function readAnswers(f, formEl) {
    const out = {};
    let err = "";
    (f.qs || []).forEach((q) => {
      const els = Array.from(formEl.querySelectorAll('[name="a_' + q.id + '"]'));
      let v;
      if (q.type === "multi") v = els.filter((x) => x.checked).map((x) => x.value);
      else if (q.type === "choice" || q.type === "yesno") { const c = els.find((x) => x.checked); v = c ? c.value : ""; }
      else if (q.type === "agree") v = !!(els[0] && els[0].checked);
      else v = els[0] ? els[0].value.trim() : "";
      if (q.type === "sid") v = v.replace(/\D/g, "");
      if (q.type === "name") v = v.replace(/\s+/g, "");
      if (q.type === "phone") { const d = v.replace(/\D/g, ""); v = d.length === 11 ? d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7) : v; }
      const empty = v === "" || v === false || (Array.isArray(v) && !v.length);
      if (!err && (q.required || q.type === "name" || q.type === "sid") && empty) err = q.type === "agree" ? "‘" + q.label + "’에 체크해야 제출할 수 있어요." : "‘" + q.label + "’을(를) 입력해 주세요.";
      if (!err && q.type === "sid" && v && v.length !== 10) err = "학번 10자리를 넣어 주세요.";
      if (!err && q.type === "phone" && v && v.replace(/\D/g, "").length < 10) err = "전화번호를 확인해 주세요.";
      out[q.id] = v;
    });
    const n = qOf(f, "name"), s = qOf(f, "sid");
    return { answers: out, name: n ? out[n.id] : "", sid: s ? out[s.id] : "", err: err };
  }
  // 제출 후 화면
  function doneHTML(f, r, opts) {
    opts = opts || {};
    const going = isGoing(f, r), dn = depositName(r.sid, r.name);
    const pay = going && Number(f.fee) > 0;
    return headHTML(f) + '<div class="ap-done"><span class="ap-pill ok">' + (going ? "신청 완료" : "응답 제출") + "</span>" +
      "<div>" + esc(r.name) + "님, " + (going ? "신청이 접수됐어요." : "응답해 주셔서 고마워요.") + "</div>" +
      (r.at ? '<div class="ap-time">접수 시각 ' + esc(stampText(r.at)) + "</div>" : "") +
      (f.mode === "first" && going ? '<div class="ap-note">선착순은 접수 시각 순서로 정해져요. 정원 안인지는 학생회가 따로 알려 드려요.</div>' : "") + "</div>" +
      (pay ? '<div class="ap-pay"><b>입금 안내</b><div>' + (f.due ? esc(f.due) + " " : "") + "<b>" + won(f.fee) + "</b>을 보내 주세요." +
        (f.mode === "first" ? " (대기로 접수됐다면 연락받은 뒤에 보내 주세요)" : "") + "</div>" +
        (f.account ? '<div class="ap-copy"><span>' + esc(f.account) + '</span><button type="button" data-copy="' + esc(String(f.account).replace(/[^\d-]/g, "")) + '">복사</button></div>' : "") +
        '<div>입금자명은 꼭 이렇게 적어 주세요</div><div class="ap-copy"><b>' + esc(dn) + '</b><button type="button" data-copy="' + esc(dn) + '">복사</button></div>' +
        '<div class="ap-hint">입학연도 2자리 + 학번 뒤 3자리 + 이름</div></div>' : "") +
      '<p class="ap-hint ap-c">이 화면을 캡처해 두면 좋아요.' + (opts.preview ? "" : " 같은 학번으로는 한 번만 신청할 수 있어요.") + "</p>" +
      (opts.preview ? '<button type="button" class="ap-link" data-ap-back>처음 화면으로</button>' : "");
  }

  window.APPLY = { TYPES, Q, TEMPLATES, newForm, qOf, attendQ, depositName, isGoing, place, needPay, checkForm, stampText, formHTML, readAnswers, doneHTML, won, esc };
})();
