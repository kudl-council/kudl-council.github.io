/* ============================================================
   예결산 미리 점검 (재무국방)
   - 엑셀(.xlsx) 파일을 브라우저 안에서만 읽어서 체크리스트대로 확인 (서버에 안 올라감)
   - window.AUDIT.read(file) → 통합문서, window.AUDIT.run(통합문서) → 점검 결과
   ============================================================ */
(function () {
  /* ---------- 1. xlsx(zip) 열기 ---------- */
  async function inflate(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("엑셀(.xlsx) 파일이 아닌 것 같아요.");
    const n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const files = {}, dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = u8.subarray(start, start + csize);
      files[name] = { method: method, data: data };
      p += 46 + nlen + xlen + clen;
    }
    return {
      has: (name) => !!files[name],
      text: async (name) => {
        const f = files[name];
        if (!f) return null;
        return dec.decode(f.method === 8 ? await inflate(f.data) : f.data);
      },
    };
  }
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const tags = (el, name) => Array.from(el.getElementsByTagNameNS("*", name));
  const tag = (el, name) => el.getElementsByTagNameNS("*", name)[0] || null;

  /* ---------- 2. 셀 주소 ---------- */
  const colNum = (s) => s.toUpperCase().split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colStr = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const parseRef = (ref) => { const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref); return m ? { c: colNum(m[1]), r: Number(m[2]) } : null; };
  const refOf = (r, c) => colStr(c) + r;
  // 공유 수식(shared formula) 펼치기: 기준 셀에서 떨어진 만큼 상대 주소를 옮김
  function shiftFormula(f, dr, dc) {
    let out = "", i = 0;
    while (i < f.length) {
      const ch = f[i];
      if (ch === '"' || ch === "'") { const j = f.indexOf(ch, i + 1); const k = j < 0 ? f.length : j + 1; out += f.slice(i, k); i = k; continue; }
      let j = i;
      while (j < f.length && f[j] !== '"' && f[j] !== "'") j++;
      out += f.slice(i, j).replace(/(^|[^A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (m, pre, ca, col, ra, row) =>
        pre + ca + (ca ? col : colStr(colNum(col) + dc)) + ra + (ra ? row : Number(row) + dr));
      i = j;
    }
    return out;
  }

  /* ---------- 3. 통합문서 읽기 ---------- */
  async function read(file) {
    if (!("DecompressionStream" in window)) throw new Error("이 브라우저에서는 점검을 할 수 없어요. 크롬이나 최신 사파리로 열어 주세요.");
    const z = await unzip(await file.arrayBuffer());
    const wbx = xml(await z.text("xl/workbook.xml"));
    const rels = xml(await z.text("xl/_rels/workbook.xml.rels"));
    const relMap = {};
    tags(rels, "Relationship").forEach((r) => (relMap[r.getAttribute("Id")] = r.getAttribute("Target")));
    // 공유 문자열
    const ss = [];
    const sst = await z.text("xl/sharedStrings.xml");
    if (sst) tags(xml(sst), "si").forEach((si) => ss.push(tags(si, "t").map((t) => t.textContent).join("")));
    // 서식: 표시 형식 · 가운데 정렬 · 테두리
    const stx = xml(await z.text("xl/styles.xml"));
    const fmts = {};
    tags(stx, "numFmt").forEach((n) => (fmts[n.getAttribute("numFmtId")] = n.getAttribute("formatCode")));
    const borders = tags(tag(stx, "borders") || stx, "border").map((b) => {
      const side = (s) => { const e = Array.from(b.children).find((x) => x.localName === s); return !!(e && e.getAttribute("style") && e.getAttribute("style") !== "none"); };
      return { l: side("left") || side("start"), r: side("right") || side("end"), t: side("top"), b: side("bottom") };
    });
    const xfs = Array.from((tag(stx, "cellXfs") || stx).children).filter((x) => x.localName === "xf").map((x) => {
      const al = tag(x, "alignment"), id = x.getAttribute("numFmtId") || "0";
      return { fmtId: Number(id), fmt: fmts[id] || "", h: al ? al.getAttribute("horizontal") || "" : "", border: borders[Number(x.getAttribute("borderId") || 0)] || {} };
    });
    const sheets = [];
    for (const s of tags(wbx, "sheet")) {
      const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id");
      let target = relMap[rid] || "";
      target = target.replace(/^\/?xl\//, "").replace(/^\//, "");
      const sx = await z.text("xl/" + target);
      if (!sx) continue;
      const doc = xml(sx), cells = {}, shared = {};
      let maxR = 0, maxC = 0;
      tags(doc, "c").forEach((c) => {
        const ref = c.getAttribute("r"), p = parseRef(ref);
        if (!p) return;
        const t = c.getAttribute("t") || "n", vEl = tag(c, "v"), fEl = tag(c, "f"), isEl = tag(c, "is");
        let v = vEl ? vEl.textContent : isEl ? tags(isEl, "t").map((x) => x.textContent).join("") : null;
        if (t === "s" && v != null) v = ss[Number(v)];
        else if ((t === "n" || t === "d") && v != null && v !== "") v = Number(v);
        else if (t === "b" && v != null) v = v === "1";
        let f = null;
        if (fEl) {
          f = fEl.textContent || "";
          if (fEl.getAttribute("t") === "shared") {
            const si = fEl.getAttribute("si");
            if (f) shared[si] = { f: f, r: p.r, c: p.c };
            else if (shared[si]) f = shiftFormula(shared[si].f, p.r - shared[si].r, p.c - shared[si].c);
          }
        }
        cells[ref] = { r: p.r, c: p.c, v: v, t: t, f: f, err: t === "e", s: xfs[Number(c.getAttribute("s") || 0)] || {} };
        if (v != null || f) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); }
      });
      const merges = tags(doc, "mergeCell").map((m) => { const [a, b] = m.getAttribute("ref").split(":"); const A = parseRef(a), B = parseRef(b || a); return { r1: A.r, c1: A.c, r2: B.r, c2: B.c }; });
      sheets.push({ name: s.getAttribute("name"), cells: cells, merges: merges, maxR: maxR, maxC: maxC });
    }
    return { name: file.name, sheets: sheets };
  }

  /* ---------- 4. 도우미 ---------- */
  const txt = (c) => (c && c.v != null ? String(c.v).trim() : "");
  const num = (c) => (c && typeof c.v === "number" ? c.v : c && c.v != null && /^-?[\d,.]+$/.test(String(c.v).trim()) ? Number(String(c.v).replace(/,/g, "")) : 0);
  const codeStr = (c) => { if (!c || c.v == null) return ""; return typeof c.v === "number" ? String(Math.round(c.v * 1000) / 1000) : String(c.v).trim(); };
  const isAcct = (s) => { if (!s) return false; if (s.fmtId >= 41 && s.fmtId <= 44) return true; const f = s.fmt || "", sec = f.split(";"); return f.indexOf("*") >= 0 && sec.length >= 3 && /-/.test(sec[2]); };
  const fx = (c) => (c && c.f ? c.f.replace(/\s+/g, "").toUpperCase() : "");
  const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
  const at = (sh, r, c) => sh.cells[refOf(r, c)];
  const mergeOf = (sh, r, c) => sh.merges.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);
  const where = (sh, r, c) => sh.name + "!" + refOf(r, c);
  function findSheet(wb, test) { return wb.sheets.find(test) || null; }
  const dateStr = (n) => { if (typeof n !== "number" || !n) return ""; const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000); return d.getUTCFullYear() + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCDate()).padStart(2, "0"); };

  // 테두리: 셀 자기 테두리 또는 옆 셀의 맞닿은 테두리가 있으면 있는 것으로 봄. 합쳐진 셀 안쪽 선은 따지지 않음
  function missingBorders(sh, r1, r2, c1, c2) {
    const out = [];
    const side = (r, c, s) => { const x = at(sh, r, c); return !!(x && x.s && x.s.border && x.s.border[s]); };
    const has = (r, c, s) => {
      const m = mergeOf(sh, r, c);
      if (m) {
        if (s === "t" && r > m.r1) return true; if (s === "b" && r < m.r2) return true;
        if (s === "l" && c > m.c1) return true; if (s === "r" && c < m.c2) return true;
        // 합쳐진 셀의 바깥 선: 그 줄의 어느 칸이든, 또는 대표 칸에 있으면 됨
        const edge = s === "t" || s === "b" ? Array.from({ length: m.c2 - m.c1 + 1 }, (_, i) => [s === "t" ? m.r1 : m.r2, m.c1 + i]) : Array.from({ length: m.r2 - m.r1 + 1 }, (_, i) => [m.r1 + i, s === "l" ? m.c1 : m.c2]);
        if (side(m.r1, m.c1, s) || edge.some(([rr, cc]) => side(rr, cc, s))) return true;
      }
      if (side(r, c, s)) return true;
      const nb = { t: [r - 1, c, "b"], b: [r + 1, c, "t"], l: [r, c - 1, "r"], r: [r, c + 1, "l"] }[s];
      if (side(nb[0], nb[1], nb[2])) return true;
      const nm = mergeOf(sh, nb[0], nb[1]);
      return !!(nm && side(nm.r1, nm.c1, nb[2]));
    };
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const miss = ["t", "b", "l", "r"].filter((s) => !has(r, c, s));
      if (miss.length) out.push({ ref: where(sh, r, c), msg: miss.map((s) => ({ t: "위", b: "아래", l: "왼쪽", r: "오른쪽" }[s])).join("·") + " 테두리 없음" });
    }
    return out;
  }

  /* ---------- 5. 관항목 및 요약 표 읽기 ---------- */
  function parseSummary(sh) {
    const blocks = [];
    for (let r = 1; r <= sh.maxR; r++) {
      for (let c = 1; c <= sh.maxC; c++) {
        const t = txt(at(sh, r, c));
        if (!/^(수입액|지출액)$/.test(t)) continue;
        const kind = t === "수입액" ? "수" : "지";
        const hdr = (re) => { for (let k = 1; k <= sh.maxC; k++) if (re.test(txt(at(sh, r, k)))) return k; return 0; };
        const sub = (re) => { for (let k = 1; k <= sh.maxC; k++) if (re.test(txt(at(sh, r + 1, k)))) return k; return 0; };
        const b = { kind: kind, head: r, amt: c, ratio: hdr(/^비율/), base: hdr(/^(예산$|전년도)/), cmp: hdr(/대비/), note: hdr(/비고|근거/),
          gwan: sub(/^관$/) || 1, hang: sub(/^항$/) || 3, mok: sub(/^목$/) || 5, rows: [], total: 0 };
        for (let rr = r + 2; rr <= sh.maxR; rr++) {
          if (/^합계/.test(txt(at(sh, rr, 1)))) { b.total = rr; break; }
          if (txt(at(sh, rr, b.mok)) || at(sh, rr, b.amt)) b.rows.push(rr);
        }
        blocks.push(b);
        break;
      }
    }
    return blocks;
  }

  /* ---------- 6. 세부내역 표 읽기 ---------- */
  function parseDetail(sh) {
    let head = 0;
    for (let r = 1; r <= Math.min(sh.maxR, 30) && !head; r++) for (let c = 1; c <= sh.maxC; c++) if (txt(at(sh, r, c)) === "입금") { head = r; break; }
    if (!head) return null;
    const col = (re) => { for (let k = 1; k <= sh.maxC; k++) if (re.test(txt(at(sh, head, k)))) return k; return 0; };
    const d = { head: head, code: col(/^코드/), no: col(/^순번/), date: col(/일시|날짜/), desc: col(/^설명|내용/), inn: col(/^입금/), out: col(/^출금/), bal: col(/잔액/), proof: col(/증빙/), note: col(/^비고/), rows: [], total: 0 };
    for (let r = head + 1; r <= sh.maxR; r++) {
      const code = txt(at(sh, r, d.code)), amtIn = at(sh, r, d.inn), amtOut = at(sh, r, d.out);
      if (/^(수|지)-/.test(code) || (d.no && typeof (at(sh, r, d.no) || {}).v === "number")) { d.rows.push(r); continue; }
      if (d.rows.length && ((amtIn && /^SUM\(/.test(fx(amtIn))) || (amtOut && /^SUM\(/.test(fx(amtOut))) || /합계/.test(txt(at(sh, r, 1)) + txt(at(sh, r, d.desc))))) { d.total = r; break; }
    }
    return d;
  }

  /* ---------- 7. 점검 ---------- */
  function run(wb) {
    const items = [];
    const add = (sec, no, title, status, msg, cells) => items.push({ sec: sec, no: no, title: title, status: status, msg: msg || "", cells: cells || [] });
    const S = findSheet(wb, (s) => /결산/.test(s.name) && /(관항목|요약)/.test(s.name)) || findSheet(wb, (s) => !/예산안/.test(s.name) && !/세부/.test(s.name) && /결산/.test(txt(s.cells.A1)));
    const D = findSheet(wb, (s) => /세부내역/.test(s.name));
    const B = findSheet(wb, (s) => /예산안/.test(s.name) || /예산안/.test(txt(s.cells.A1)));
    const found = { S: S && S.name, D: D && D.name, B: B && B.name };
    const det = D ? parseDetail(D) : null;

    // 세부내역 코드별 합계 (관항목 값과 대조용)
    const detSum = {};
    if (D && det) det.rows.forEach((r) => {
      const code = txt(at(D, r, det.code));
      if (!code) return;
      detSum[code] = (detSum[code] || 0) + (/^수-/.test(code) ? num(at(D, r, det.inn)) : num(at(D, r, det.out)));
    });

    /* ===== 1. 결산 관항목 및 요약 ===== */
    const sec1 = "1. 결산 관항목 및 요약";
    if (!S) add(sec1, "-", "시트 찾기", "bad", "‘결산 … 관항목 및 요약’ 시트를 못 찾았어요. 시트 이름에 ‘결산’과 ‘관항목’이 들어 있어야 해요.");
    let mokCodes = { 수: {}, 지: {} };
    if (S) {
      const bl = parseSummary(S), inc = bl.find((b) => b.kind === "수"), exp = bl.find((b) => b.kind === "지");
      bl.forEach((b) => b.rows.forEach((r) => { const c = codeStr(at(S, r, b.mok)); if (c) mokCodes[b.kind][c] = r; }));
      if (!inc || !exp || !inc.total || !exp.total) add(sec1, "-", "표 찾기", "bad", "‘수입액’·‘지출액’ 머리글과 ‘합계’ 줄을 찾지 못했어요.");
      else {
        const gi = num(at(S, inc.total, inc.amt)), ge = num(at(S, exp.total, exp.amt));
        add(sec1, "1", "수입액 총합 = 지출액 총합", Math.round(gi) === Math.round(ge) ? "ok" : "bad",
          "수입 " + won(gi) + " / 지출 " + won(ge) + (Math.round(gi) === Math.round(ge) ? "" : " → " + won(Math.abs(gi - ge)) + " 차이"));
        const bi = num(at(S, inc.total, inc.base)), be = num(at(S, exp.total, exp.base));
        add(sec1, "2", "예산 총합(수입) = 예산 총합(지출)", inc.base && exp.base ? (Math.round(bi) === Math.round(be) ? "ok" : "bad") : "warn",
          inc.base && exp.base ? "수입 예산 " + won(bi) + " / 지출 예산 " + won(be) + (Math.round(bi) === Math.round(be) ? "" : " → " + won(Math.abs(bi - be)) + " 차이") : "‘예산’ 열을 찾지 못했어요.");
        // 3·4. SUMIF
        const noSumif = [], badCode = [], stale = [];
        bl.forEach((b) => b.rows.forEach((r) => {
          const c = at(S, r, b.amt), f = fx(c), mok = codeStr(at(S, r, b.mok));
          if (!/^SUMIF\(/.test(f)) { noSumif.push({ ref: where(S, r, b.amt), msg: c && c.f ? "=" + c.f : "숫자로 직접 입력됨" }); return; }
          const m = /^SUMIF\((.+?)!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+),"(수|지)-"&\$?([A-Z]+)\$?(\d+),(.+?)!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)\)$/.exec(f);
          const probs = [];
          if (!m) probs.push("SUMIF 모양이 예상과 달라요");
          else {
            const sheet1 = m[1].replace(/^'|'$/g, ""), sheet2 = m[9].replace(/^'|'$/g, "");
            if (m[6] !== b.kind) probs.push("‘" + m[6] + "-’ 대신 ‘" + b.kind + "-’이어야 해요");
            if (colNum(m[7]) !== b.mok || Number(m[8]) !== r) probs.push("코드 칸이 " + m[7] + m[8] + " (같은 줄 " + refOf(r, b.mok) + "이어야 해요)");
            if (D && (sheet1 !== D.name.toUpperCase() || sheet2 !== D.name.toUpperCase())) probs.push("세부내역 시트 이름이 달라요");
            if (det) {
              if (colNum(m[2]) !== det.code) probs.push("조건 범위가 코드 열(" + colStr(det.code) + ")이 아니에요");
              const want = b.kind === "수" ? det.inn : det.out;
              if (colNum(m[10]) !== want) probs.push("더하는 열이 " + m[10] + " (" + (b.kind === "수" ? "입금" : "출금") + " 열 " + colStr(want) + "이어야 해요)");
              const first = det.rows[0], last = det.rows[det.rows.length - 1];
              if (Number(m[3]) > first || Number(m[5]) < last || Number(m[11]) > first || Number(m[13]) < last) probs.push("범위가 세부내역 전체(" + first + "~" + last + "행)를 덮지 않아요");
            }
          }
          if (probs.length) badCode.push({ ref: where(S, r, b.amt), msg: probs.join(" · ") });
          if (det && mok) { const real = detSum[b.kind + "-" + mok] || 0, shown = num(c); if (Math.round(real) !== Math.round(shown)) stale.push({ ref: where(S, r, b.amt), msg: "표시 " + won(shown) + " / 세부내역 합 " + won(real) }); }
        }));
        add(sec1, "3", "수입액·지출액 칸이 SUMIF 함수로 입력됨", noSumif.length ? "bad" : "ok", noSumif.length ? noSumif.length + "칸이 SUMIF가 아니에요" : "모든 칸이 SUMIF예요", noSumif);
        add(sec1, "4", "SUMIF에 올바른 코드·범위", badCode.length || stale.length ? "bad" : "ok",
          badCode.length || stale.length ? (badCode.length ? "수식이 이상한 칸 " + badCode.length + "개" : "") + (stale.length ? (badCode.length ? " · " : "") + "세부내역 합과 다른 칸 " + stale.length + "개" : "") : "코드·범위가 맞고, 세부내역 합과도 같아요", badCode.concat(stale));
        // 5. 총합·비율 함수
        const fn = [];
        bl.forEach((b) => {
          const tc = at(S, b.total, b.amt);
          if (!/^SUM\(/.test(fx(tc))) fn.push({ ref: where(S, b.total, b.amt), msg: "합계가 SUM 함수가 아니에요" });
          else { const m = /^SUM\(\$?[A-Z]+\$?(\d+):\$?[A-Z]+\$?(\d+)\)$/.exec(fx(tc)); if (m && (Number(m[1]) > b.rows[0] || Number(m[2]) < b.rows[b.rows.length - 1])) fn.push({ ref: where(S, b.total, b.amt), msg: "SUM 범위가 " + m[1] + "~" + m[2] + "행 (표는 " + b.rows[0] + "~" + b.rows[b.rows.length - 1] + "행)" }); }
          if (b.base) { const bc = at(S, b.total, b.base); if (!/^SUM\(/.test(fx(bc))) fn.push({ ref: where(S, b.total, b.base), msg: "예산 합계가 SUM 함수가 아니에요" }); }
          if (b.ratio) b.rows.forEach((r) => { const c = at(S, r, b.ratio); if (c && !c.f && txt(c) !== "-") fn.push({ ref: where(S, r, b.ratio), msg: "비율이 함수가 아니에요" }); });
          if (b.cmp) b.rows.forEach((r) => { const c = at(S, r, b.cmp); if (c && !c.f && txt(c) !== "-") fn.push({ ref: where(S, r, b.cmp), msg: "예산 대비 비율이 함수가 아니에요" }); });
        });
        add(sec1, "5", "총합·비율이 함수로 입력됨", fn.length ? "bad" : "ok", fn.length ? fn.length + "칸 확인 필요" : "합계는 SUM, 비율은 함수예요", fn);
        // 6. 비고 '금액*수량'
        const memo = [];
        let explained = 0;
        bl.forEach((b) => b.rows.forEach((r) => {
          if (!b.note || Math.round(num(at(S, r, b.amt))) === 0) return;
          const name = txt(at(S, r, b.mok + 1)), note = txt(at(S, r, b.note));
          if (/이월/.test(name)) return;
          if (/[*×xX]\s*\d|\d\s*[*×]/.test(note)) return;
          if (!note || note === "-") memo.push({ ref: where(S, r, b.note), msg: (name || "") + " " + won(num(at(S, r, b.amt))) + " · 비고가 비어 있어요" });
          else explained++;
        }));
        add(sec1, "6", "비고에 ‘금액*수량’ 정리", memo.length ? "warn" : "ok", (memo.length ? "금액이 있는데 비고가 빈 칸 " + memo.length + "개 — ‘금액*수량’을 적어 주세요" : "금액이 있는 칸은 모두 비고가 있어요") +
          (explained ? " · 설명만 있고 ‘*’ 계산식이 없는 칸 " + explained + "개 (환급·수익금처럼 계산식이 필요 없는 항목인지 확인)" : ""), memo);

        // 형식
        const secF = "1. 결산 관항목 및 요약 · 형식";
        const title = txt(S.cells.A1);
        const tBad = /결산안/.test(title) || /결산안/.test(S.name) || (D && /결산안/.test(D.name + txt(D.cells.A1)));
        add(secF, "1", "제목·시트 이름 (결산안 ✕ → 결산 ○)", tBad ? "bad" : "ok", "제목: " + title + " / 시트: " + S.name);
        const align = [];
        bl.forEach((b) => b.rows.forEach((r) => [b.gwan, b.gwan + 1, b.hang, b.hang + 1, b.mok, b.mok + 1, b.note].forEach((c) => {
          if (!c) return; const m = mergeOf(S, r, c); if (m && (m.r1 !== r || m.c1 !== c)) return;
          const x = at(S, r, c); if (!x || x.v == null || x.v === "") return;
          if (!/^center/.test(x.s.h || "")) align.push({ ref: where(S, r, c), msg: "가운데 정렬이 아니에요 (" + (x.s.h || "기본") + ")" });
        })));
        add(secF, "2", "관·항·목과 비고란 가운데 정렬", align.length ? "bad" : "ok", align.length ? align.length + "칸이 가운데 정렬이 아니에요" : "모두 가운데 정렬이에요", align);
        const bd = [];
        bl.forEach((b) => bd.push.apply(bd, missingBorders(S, b.head, b.total, 1, Math.max(b.note, b.cmp, b.amt))));
        add(secF, "3", "셀 테두리 빠진 곳", bd.length ? "warn" : "ok", bd.length ? bd.length + "칸에서 테두리가 안 보여요 — 엑셀에서 한 번 더 확인해 주세요" : "빠진 테두리가 없어요", bd);
        const acct = [];
        bl.forEach((b) => b.rows.concat([b.total]).forEach((r) => [b.amt, b.base].forEach((c) => { if (!c) return; const x = at(S, r, c); if (!x || !isAcct(x.s)) acct.push({ ref: where(S, r, c), msg: x ? "표시 형식: " + (x.s.fmt || "일반") : "빈 칸" }); })));
        add(secF, "4", "금액 칸 표시 형식 ‘회계’", acct.length ? "bad" : "ok", acct.length ? acct.length + "칸이 회계 형식이 아니에요" : "금액 칸이 모두 회계 형식이에요", acct);
        const blank = [];
        bl.forEach((b) => b.rows.concat([b.total]).forEach((r) => [b.ratio, b.cmp].forEach((c) => {
          if (!c) return; const x = at(S, r, c);
          if (!x || x.v == null || x.v === "") blank.push({ ref: where(S, r, c), msg: "빈 칸" });
          else if (x.err || /^#/.test(txt(x))) blank.push({ ref: where(S, r, c), msg: txt(x) + " 오류 → ‘-’로" });
        })));
        bl.forEach((b) => { if (b.ratio) { const x = at(S, b.total, b.ratio); if (x && !/^SUM\(/.test(fx(x))) blank.push({ ref: where(S, b.total, b.ratio), msg: "비율 합계가 SUM 함수가 아니에요" }); } });
        add(secF, "5", "비율·예산 대비 비율 빈칸 없음 (합계는 SUM)", blank.length ? "bad" : "ok", blank.length ? blank.length + "칸 확인 필요" : "빈칸·오류가 없어요", blank);
      }
    }

    /* ===== 2. 결산 세부내역 ===== */
    const sec2 = "2. 결산 세부내역";
    if (!D || !det) add(sec2, "-", "시트 찾기", D ? "bad" : "bad", D ? "세부내역에서 ‘입금’ 머리글을 못 찾았어요." : "‘세부내역’ 시트를 못 찾았어요.");
    else if (!det.rows.length) add(sec2, "-", "표 찾기", "bad", "세부내역에 거래 줄이 없어요.");
    else {
      const first = det.rows[0], last = det.rows[det.rows.length - 1];
      const fRow = (r) => txt(at(D, r, det.desc)) + " " + won(num(at(D, r, det.inn)) || num(at(D, r, det.out))) + " (" + dateStr((at(D, r, det.date) || {}).v) + ")";
      add(sec2, "1", "전분기 이월금 = 개강일 통장 잔액", "manual", "첫 줄: " + fRow(first) + " — 통장 내역의 개강일 잔액과 같은지 확인해 주세요");
      add(sec2, "2", "차분기 이월금 = 방학 마지막 날 통장 잔액", "manual", "마지막 줄: " + fRow(last) + " — 통장 내역의 방학 마지막 날 잔액과 같은지 확인해 주세요");
      const ti = det.total ? num(at(D, det.total, det.inn)) : det.rows.reduce((s, r) => s + num(at(D, r, det.inn)), 0);
      const to = det.total ? num(at(D, det.total, det.out)) : det.rows.reduce((s, r) => s + num(at(D, r, det.out)), 0);
      add(sec2, "3", "입금 총액 = 출금 총액", Math.round(ti) === Math.round(to) ? "ok" : "bad", "입금 " + won(ti) + " / 출금 " + won(to) + (Math.round(ti) === Math.round(to) ? "" : " → " + won(Math.abs(ti - to)) + " 차이"));
      // 날짜 순서 · 이월금 날짜
      const order = [];
      let prev = 0;
      det.rows.forEach((r) => { const v = (at(D, r, det.date) || {}).v; if (typeof v !== "number") order.push({ ref: where(D, r, det.date), msg: "날짜가 비었거나 날짜 형식이 아니에요" }); else { if (v < prev) order.push({ ref: where(D, r, det.date), msg: dateStr(v) + " — 앞 줄보다 이른 날짜" }); prev = v; } });
      add(sec2, "4", "전분기·차분기 이월금 날짜", order.length ? "warn" : "manual", "이월금 날짜: " + dateStr((at(D, first, det.date) || {}).v) + " ~ " + dateStr((at(D, last, det.date) || {}).v) + (order.length ? " · 날짜 순서가 이상한 곳 " + order.length + "개" : " — 분기 시작·끝 날짜가 맞는지 확인해 주세요"), order);
      add(sec2, "4-2", "통장 거래내역이 한 줄씩 빠짐없이 입력됨", "manual", "거래 " + det.rows.length + "줄 — 통장 내역과 한 줄씩 대조해 주세요");
      // 순번 · 코드
      const seq = [], codes = [];
      det.rows.forEach((r, i) => {
        if (det.no && num(at(D, r, det.no)) !== i + 1) seq.push({ ref: where(D, r, det.no), msg: "순번 " + txt(at(D, r, det.no)) + " (" + (i + 1) + "이어야 해요)" });
        const code = txt(at(D, r, det.code)), m = /^(수|지)-(.+)$/.exec(code), o = num(at(D, r, det.out)), inn = num(at(D, r, det.inn));
        if (!m) { codes.push({ ref: where(D, r, det.code), msg: "코드가 없어요" }); return; }
        if (m[1] === "지" && !(o > 0)) codes.push({ ref: where(D, r, det.code), msg: code + "인데 출금액이 없어요" });
        if (m[1] === "수" && o > 0) codes.push({ ref: where(D, r, det.code), msg: code + "인데 출금액이 있어요" });
        if (m[1] === "수" && !(inn > 0) && !(o > 0)) codes.push({ ref: where(D, r, det.code), msg: "입금·출금이 모두 0원이에요" });
        if (S && !mokCodes[m[1]][m[2]]) codes.push({ ref: where(D, r, det.code), msg: code + " — 관항목 표에 없는 코드예요 (" + (m[1] === "수" ? "수입" : "지출") + "에 ‘" + m[2] + "’ 목이 없음)" });
      });
      add(sec2, "4-3", "순번·코드가 관항목과 맞음", seq.length || codes.length ? "bad" : "ok", seq.length || codes.length ? (codes.length ? "코드 문제 " + codes.length + "개" : "") + (seq.length ? (codes.length ? " · " : "") + "순번 문제 " + seq.length + "개" : "") : "모든 줄의 코드가 관항목 표에 있어요", codes.concat(seq));
      // 5. 입출금 총액 SUM
      const sums = [];
      [det.inn, det.out].forEach((c) => {
        if (!det.total) { sums.push({ ref: D.name, msg: "합계 줄을 못 찾았어요" }); return; }
        const x = at(D, det.total, c), m = /^SUM\(\$?[A-Z]+\$?(\d+):\$?[A-Z]+\$?(\d+)\)$/.exec(fx(x));
        if (!m) sums.push({ ref: where(D, det.total, c), msg: x && x.f ? "=" + x.f : "SUM 함수가 아니에요" });
        else if (Number(m[1]) > first || Number(m[2]) < last) sums.push({ ref: where(D, det.total, c), msg: "범위 " + m[1] + "~" + m[2] + "행 (거래는 " + first + "~" + last + "행)" });
      });
      add(sec2, "5", "입금·출금 총액이 SUM 함수 (범위 맞음)", sums.length ? "bad" : "ok", sums.length ? "확인 필요 " + sums.length + "칸" : "SUM 범위가 전체 거래를 덮어요", sums);
      // 6. 누적 잔액
      const bal = [];
      let run = null;
      det.rows.forEach((r, i) => {
        const x = at(D, r, det.bal), f = fx(x).replace(/\$/g, "");
        const P = colStr(det.bal) + (r - 1), I = colStr(det.inn) + r, O = colStr(det.out) + r;
        const okF = f && f.indexOf(P) >= 0 && f.indexOf(I) >= 0 && f.indexOf(O) >= 0 && /^[A-Z0-9+\-()]+$/.test(f);
        const exp = (i === 0 ? num(at(D, r - 1, det.bal)) : run) + num(at(D, r, det.inn)) - num(at(D, r, det.out));
        if (!okF) bal.push({ ref: where(D, r, det.bal), msg: x && x.f ? "=" + x.f + " (=" + P + "+" + I + "-" + O + " 이어야 해요)" : "함수가 아니에요" });
        else if (Math.round(num(x)) !== Math.round(exp)) bal.push({ ref: where(D, r, det.bal), msg: "값 " + won(num(x)) + " / 계산 " + won(exp) });
        run = num(x);
      });
      add(sec2, "6", "누적 잔액 = 앞 잔액 + 입금 − 출금", bal.length ? "bad" : "ok", bal.length ? bal.length + "칸 확인 필요" : "모든 줄이 맞아요 (마지막 잔액 " + won(run || 0) + ")", bal);
      // 7. 회계 · 빈칸
      const acct = [];
      det.rows.concat(det.total ? [det.total] : []).forEach((r) => [det.inn, det.out, det.bal].forEach((c) => {
        const x = at(D, r, c);
        if (!x || x.v == null || x.v === "") acct.push({ ref: where(D, r, c), msg: "빈 칸 (0원이면 0을 넣어 ‘₩ -’로 보이게)" });
        else if (!isAcct(x.s)) acct.push({ ref: where(D, r, c), msg: "표시 형식: " + (x.s.fmt || "일반") });
      }));
      add(sec2, "7", "금액 칸 ‘회계’ 형식 · 빈칸 없음", acct.length ? "bad" : "ok", acct.length ? acct.length + "칸 확인 필요" : "모두 회계 형식이고 빈칸이 없어요", acct);
      const bd = missingBorders(D, det.head, det.total || last, 1, Math.max(det.note, det.proof, det.bal));
      add(sec2, "8", "셀 테두리 빠진 곳", bd.length ? "warn" : "ok", bd.length ? bd.length + "칸에서 테두리가 안 보여요 — 엑셀에서 한 번 더 확인해 주세요" : "빠진 테두리가 없어요", bd);

      /* ===== 3. 증빙자료 ===== */
      const sec3 = "3. 증빙자료";
      add(sec3, "1", "통장내역 기간이 전체 기간", "manual", "세부내역 기간: " + dateStr((at(D, first, det.date) || {}).v) + " ~ " + dateStr((at(D, last, det.date) || {}).v) + " — 통장 내역이 이 기간을 다 덮는지 확인해 주세요");
      add(sec3, "2", "통장 내역 형식", "manual", "은행 거래내역서 형식인지 확인해 주세요");
      const proof = [], nums = {};
      det.rows.forEach((r) => {
        const p = txt(at(D, r, det.proof)), o = num(at(D, r, det.out));
        if (!p) proof.push({ ref: where(D, r, det.proof), msg: "증빙자료 칸이 비었어요" });
        else if (o > 0 && /^통장/.test(p) && !/이월/.test(txt(at(D, r, det.desc)))) proof.push({ ref: where(D, r, det.proof), msg: "출금 " + won(o) + "인데 증빙이 ‘통장내역’뿐이에요 — 영수증 등이 필요한지 확인" });
        (p.match(/증빙자료\s*(\d+)/g) || []).forEach((m) => (nums[Number(m.replace(/\D/g, ""))] = 1));
      });
      const ns = Object.keys(nums).map(Number).sort((a, b) => a - b);
      const gaps = [];
      for (let k = 1; ns.length && k <= ns[ns.length - 1]; k++) if (!nums[k]) gaps.push(k);
      if (gaps.length) proof.push({ ref: D.name, msg: "증빙자료 번호가 빠졌어요: " + gaps.join(", ") + "번" });
      add(sec3, "3", "세부내역마다 증빙자료가 빠짐없이 있음", proof.length ? "warn" : "manual", (proof.length ? "확인할 곳 " + proof.length + "개 · " : "") + "증빙자료 " + (ns.length ? "1~" + ns[ns.length - 1] + "번" : "번호 없음") + " — 각 증빙의 금액이 세부내역과 같은지 확인해 주세요", proof);
      add(sec3, "4", "증빙자료가 설명과 같은 목적으로 쓴 금액", "manual", "증빙과 세부내역 설명을 하나씩 대조해 주세요");
    }

    /* ===== 4. 예산안 관항목 및 요약 ===== */
    const sec4 = "4. 예산안 관항목 및 요약";
    if (!B) add(sec4, "-", "시트 찾기", "skip", "예산안 시트가 없어요. (결산만 점검)");
    else {
      const bl = parseSummary(B), inc = bl.find((b) => b.kind === "수"), exp = bl.find((b) => b.kind === "지");
      if (!inc || !exp || !inc.total || !exp.total) add(sec4, "-", "표 찾기", "bad", "‘수입액’·‘지출액’ 머리글과 ‘합계’ 줄을 찾지 못했어요.");
      else {
        const gi = num(at(B, inc.total, inc.amt)), ge = num(at(B, exp.total, exp.amt));
        add(sec4, "1", "예산안 수입액 총액 = 지출액 총액", Math.round(gi) === Math.round(ge) ? "ok" : "bad", "수입 " + won(gi) + " / 지출 " + won(ge) + (Math.round(gi) === Math.round(ge) ? "" : " → " + won(Math.abs(gi - ge)) + " 차이") + " (전년도 총합은 달라도 돼요)");
        const zero = [];
        bl.forEach((b) => b.rows.forEach((r) => { if (Math.round(num(at(B, r, b.amt))) === 0 && num(at(B, r, b.base)) > 0) zero.push({ ref: where(B, r, b.amt), msg: txt(at(B, r, b.mok + 1)) + " — 올해 0원 / 전년도 " + won(num(at(B, r, b.base))) + (txt(at(B, r, b.note)) ? " · 근거: " + txt(at(B, r, b.note)) : "") }); }));
        add(sec4, "2", "전년도엔 있었는데 올해 0원인 칸 (선례 확인)", zero.length ? "warn" : "ok", zero.length ? zero.length + "칸 — 선례에 맞는지 확인해 주세요" : "해당 칸이 없어요", zero);
        const fn = [];
        bl.forEach((b) => {
          [b.amt, b.base].forEach((c) => { if (!c) return; const x = at(B, b.total, c); if (!/^SUM\(/.test(fx(x))) fn.push({ ref: where(B, b.total, c), msg: "합계가 SUM 함수가 아니에요" }); });
          if (b.ratio) b.rows.forEach((r) => { const x = at(B, r, b.ratio); if (x && !x.f && txt(x) !== "-") fn.push({ ref: where(B, r, b.ratio), msg: "비율이 함수가 아니에요" }); });
          if (b.cmp) b.rows.forEach((r) => { const x = at(B, r, b.cmp); if (x && !x.f && txt(x) !== "-") fn.push({ ref: where(B, r, b.cmp), msg: "전년도 대비 비율이 함수가 아니에요" }); });
        });
        add(sec4, "3", "총액·비율·전년도 대비 비율이 함수", fn.length ? "bad" : "ok", fn.length ? fn.length + "칸 확인 필요" : "합계는 SUM, 비율은 함수예요 (전년도 금액은 지난 결산에서 옮긴 값인지 확인)", fn);
        const acct = [];
        bl.forEach((b) => b.rows.concat([b.total]).forEach((r) => [b.amt, b.base].forEach((c) => { if (!c) return; const x = at(B, r, c); if (!x || !isAcct(x.s)) acct.push({ ref: where(B, r, c), msg: x ? "표시 형식: " + (x.s.fmt || "일반") : "빈 칸" }); })));
        add(sec4, "4", "예산안·전년도 금액 ‘회계’ 형식", acct.length ? "bad" : "ok", acct.length ? acct.length + "칸이 회계 형식이 아니에요" : "모두 회계 형식이에요", acct);
        const blank = [];
        bl.forEach((b) => b.rows.concat([b.total]).forEach((r) => [b.ratio, b.cmp].forEach((c) => { if (!c) return; const x = at(B, r, c); if (!x || x.v == null || x.v === "") blank.push({ ref: where(B, r, c), msg: "빈 칸" }); else if (x.err || /^#/.test(txt(x))) blank.push({ ref: where(B, r, c), msg: txt(x) + " 오류 → ‘-’로" }); })));
        add(sec4, "5", "비율·전년도 대비 비율 빈칸 없음", blank.length ? "bad" : "ok", blank.length ? blank.length + "칸 확인 필요" : "빈칸·오류가 없어요", blank);
        const align = [], bd = [];
        bl.forEach((b) => b.rows.forEach((r) => [b.gwan, b.gwan + 1, b.hang, b.hang + 1, b.mok, b.mok + 1, b.note].forEach((c) => {
          if (!c) return; const m = mergeOf(B, r, c); if (m && (m.r1 !== r || m.c1 !== c)) return;
          const x = at(B, r, c); if (!x || x.v == null || x.v === "") return;
          if (!/^center/.test(x.s.h || "")) align.push({ ref: where(B, r, c), msg: "가운데 정렬이 아니에요" });
        })));
        bl.forEach((b) => bd.push.apply(bd, missingBorders(B, b.head, b.total, 1, Math.max(b.note, b.cmp, b.amt))));
        if (align.length || bd.length) add(sec4, "+", "정렬·테두리 (결산과 같은 기준)", "warn", (align.length ? "가운데 정렬 아님 " + align.length + "칸" : "") + (bd.length ? (align.length ? " · " : "") + "테두리 안 보임 " + bd.length + "칸" : ""), align.concat(bd));
      }
    }
    return { file: wb.name, found: found, items: items };
  }

  window.AUDIT = { read: read, run: run };
})();
