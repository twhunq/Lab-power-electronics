/* Ô chọn tự vẽ thay cho danh sách xổ xuống mặc định của trình duyệt.
   Giữ nguyên <select> gốc (ẩn đi) để mã cũ vẫn đọc/ghi .value và nhận sự kiện change.
   Dùng: Dropdown.enhance(selectEl, rich) – rich = ô chọn bài (có tìm kiếm, nhóm, mã bài). */
(() => {
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = id => `<svg class="ic"><use href="#i-${id}"/></svg>`;
  const DONE = /^✓\s*/; // fillSelect() đánh dấu bài đã xong bằng "✓ "
  // "8.1.3 (B9) Điều khiển…" → ['8.1.3', '(B9) Điều khiển…']
  const split = t => { const m = /^(\d+(?:\.\d+)*[a-z]?)\s+(.*)$/.exec(t); return m ? [m[1], m[2]] : ['', t]; };
  const VAL = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const phone = () => matchMedia('(max-width:820px)').matches;
  let cur = null; // ô đang mở: { sel, pop, bd, items, shown, active, rich }

  function parse(sel) {
    const items = [];
    const add = (o, group) => {
      const raw = o.textContent, t = raw.replace(DONE, ''), [code, name] = split(t);
      items.push({ value: o.value, text: t, code, name, done: DONE.test(raw), group, disabled: o.disabled });
    };
    for (const ch of sel.children) {
      if (ch.tagName === 'OPTGROUP') for (const o of ch.children) add(o, ch.label);
      else add(ch, '');
    }
    return items;
  }

  function paint(sel) {
    const { trig, rich } = sel._dd, items = parse(sel), it = items.find(i => i.value === VAL.get.call(sel)) || items[0];
    if (!it) { trig.innerHTML = `<span class="dd-name dd-ph">Chọn…</span>${ic('chev')}`; return; }
    trig.title = it.text;
    trig.innerHTML = rich
      ? `<span class="dd-code">${esc(it.code || '·')}</span><span class="dd-name">${esc(it.name)}</span>${it.done ? `<span class="dd-done" title="Đã hoàn thành">${ic('check')}</span>` : ''}${ic('chev')}`
      : `<span class="dd-name">${esc(it.text)}</span>${ic('chev')}`;
  }

  function enhance(sel, rich = false) {
    if (sel._dd) return;
    const trig = document.createElement('button');
    trig.type = 'button'; trig.className = 'dd ' + (rich ? 'dd-rich' : 'dd-sm');
    trig.setAttribute('aria-haspopup', 'listbox'); trig.setAttribute('aria-expanded', 'false');
    trig.setAttribute('aria-label', sel.getAttribute('aria-label') || sel.title || '');
    if (sel.title) trig.dataset.tip = sel.title;
    sel.after(trig); sel.classList.add('dd-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel._dd = { trig, rich };
    const sync = () => paint(sel);
    // danh sách được dựng lại (fillSelect, openStart) hoặc gán .value bằng mã → vẽ lại nút
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true });
    Object.defineProperty(sel, 'value', { configurable: true, get() { return VAL.get.call(this); }, set(v) { VAL.set.call(this, v); sync(); } });
    sel.addEventListener('change', sync);
    trig.onclick = () => cur?.sel === sel ? close() : show(sel);
    trig.onkeydown = e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); show(sel); } };
    sync();
  }

  function show(sel) {
    close(true);
    const { trig, rich } = sel._dd, sheet = rich && phone();
    const pop = document.createElement('div');
    pop.className = 'dd-pop ' + (rich ? 'rich' : 'sm') + (sheet ? ' sheet' : '');
    pop.innerHTML = (rich ? `<div class="dd-search">${ic('search')}<input type="text" placeholder="Tìm theo số bài hoặc tên mạch…" aria-label="Tìm bài" autocomplete="off" spellcheck="false"><span class="dd-count"></span></div>` : '')
      + '<div class="dd-list" role="listbox" tabindex="-1"></div>';
    let bd = null;
    if (sheet) { bd = document.createElement('div'); bd.className = 'dd-backdrop'; document.body.append(bd); }
    document.body.append(pop);
    cur = { sel, pop, bd, rich, items: parse(sel), shown: [], active: -1 };
    const list = pop.querySelector('.dd-list'), inp = pop.querySelector('input');
    list.onclick = e => { const o = e.target.closest('.dd-opt'); if (o) choose(+o.dataset.k); };
    list.onmousemove = e => { const o = e.target.closest('.dd-opt'); if (o && +o.dataset.k !== cur.active) setActive(+o.dataset.k, false); };
    if (inp) inp.oninput = () => fill(inp.value);
    pop.addEventListener('keydown', onKey);
    fill('');
    if (!sheet) place();
    trig.classList.add('open'); trig.setAttribute('aria-expanded', 'true');
    // ép trình duyệt tính bố cục trạng thái đóng trước, rồi mới thêm "in" để có hiệu ứng mở
    // (không dùng requestAnimationFrame: vòng vẽ 3D có thể làm nó trễ, danh sách kẹt ở trạng thái ẩn)
    void pop.offsetWidth; pop.classList.add('in'); bd?.classList.add('in');
    (inp && !phone() ? inp : list).focus({ preventScroll: true });
    const so = list.querySelector('.sel'); if (so) list.scrollTop = so.offsetTop - (list.clientHeight - so.offsetHeight) / 2;
  }

  function fill(q) {
    const { pop, items, rich, sel } = cur, list = pop.querySelector('.dd-list'), nq = norm(q.trim());
    const shown = nq ? items.filter(i => norm(i.text + ' ' + i.group).includes(nq)) : items;
    const v = VAL.get.call(sel);
    let html = '', g = null;
    shown.forEach((it, k) => {
      if (rich && it.group !== g) {
        g = it.group;
        const all = items.filter(i => i.group === g), d = all.filter(i => i.done).length;
        html += `<div class="dd-group" role="presentation">${esc(g || 'Khác')}${d ? `<span>${d}/${all.length} xong</span>` : ''}</div>`;
      }
      const on = it.value === v;
      html += `<div class="dd-opt${on ? ' sel' : ''}${it.disabled ? ' dis' : ''}" role="option" aria-selected="${on}" id="dd-o-${k}" data-k="${k}">`
        + (rich
          ? `<span class="dd-code">${esc(it.code || '·')}</span><span class="dd-name">${esc(it.name)}</span>${it.done ? `<span class="dd-done" title="Đã hoàn thành">${ic('check')}</span>` : ''}`
          : `<span class="dd-name">${esc(it.text)}</span>${on ? ic('check') : ''}`)
        + '</div>';
    });
    if (!shown.length) html = `<div class="dd-empty">Không có bài nào khớp “${esc(q.trim())}”.<br>Thử tìm theo số bài, ví dụ <b>8.2</b> hoặc <b>buck</b>.</div>`;
    list.innerHTML = html; cur.shown = shown;
    const cnt = pop.querySelector('.dd-count'); if (cnt) cnt.textContent = `${shown.length} bài`;
    setActive(nq ? 0 : Math.max(0, shown.findIndex(i => i.value === v)), !!nq);
  }

  function setActive(k, scroll = true) {
    const list = cur.pop.querySelector('.dd-list');
    list.querySelector('.act')?.classList.remove('act');
    cur.active = Math.max(0, Math.min(k, cur.shown.length - 1));
    const o = list.querySelector(`[data-k="${cur.active}"]`);
    if (!o) return;
    o.classList.add('act'); list.setAttribute('aria-activedescendant', o.id);
    // tự cuộn trong danh sách (scrollIntoView có thể cuộn cả trang và làm ô chọn tự đóng)
    if (scroll) { const top = o.offsetTop, bot = top + o.offsetHeight, pad = 34; if (top - pad < list.scrollTop) list.scrollTop = top - pad; else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight + 4; }
  }

  function choose(k) {
    const it = cur?.shown[k]; if (!it || it.disabled) return;
    const sel = cur.sel, changed = VAL.get.call(sel) !== it.value;
    VAL.set.call(sel, it.value); close(); paint(sel); sel._dd.trig.focus({ preventScroll: true });
    if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onKey(e) {
    e.stopPropagation(); // không để phím tắt của phòng lab (Space = nguồn, C, H…) chạy khi đang chọn
    const n = cur.shown.length, page = 8;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((cur.active + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((cur.active - 1 + n) % n); }
    else if (e.key === 'PageDown') { e.preventDefault(); setActive(cur.active + page); }
    else if (e.key === 'PageUp') { e.preventDefault(); setActive(cur.active - page); }
    else if (e.key === 'Home' && e.target.tagName !== 'INPUT') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && e.target.tagName !== 'INPUT') { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(cur.active); }
    else if (e.key === 'Escape') { e.preventDefault(); const t = cur.sel._dd.trig; close(); t.focus(); }
    else if (e.key === 'Tab') close();
  }

  // đặt danh sách ngay dưới nút; thiếu chỗ thì mở lên trên
  function place() {
    const { pop, sel, rich } = cur, r = sel._dd.trig.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const w = rich ? Math.min(Math.max(r.width, 440), vw - 16) : Math.max(r.width, 110);
    const below = vh - r.bottom - 12, above = r.top - 12, up = below < 280 && above > below;
    pop.style.width = w + 'px';
    pop.style.left = Math.min(Math.max(8, r.left), vw - w - 8) + 'px';
    pop.style.maxHeight = Math.min(rich ? 480 : 320, up ? above : below) + 'px';
    pop.classList.toggle('up', up);
    if (up) { pop.style.top = 'auto'; pop.style.bottom = (vh - r.top + 6) + 'px'; }
    else { pop.style.top = (r.bottom + 6) + 'px'; pop.style.bottom = 'auto'; }
  }

  function close(now) {
    if (!cur) return;
    const { pop, bd, sel } = cur; cur = null;
    sel._dd.trig.classList.remove('open'); sel._dd.trig.setAttribute('aria-expanded', 'false');
    if (now) { pop.remove(); bd?.remove(); return; }
    pop.classList.remove('in'); bd?.classList.remove('in');
    setTimeout(() => { pop.remove(); bd?.remove(); }, 220);
  }

  addEventListener('pointerdown', e => { if (cur && !cur.pop.contains(e.target) && !cur.sel._dd.trig.contains(e.target)) close(); }, true);
  addEventListener('scroll', e => { if (cur && !cur.pop.contains(e.target)) close(); }, true);
  // bàn phím ảo trên điện thoại cũng làm đổi kích thước cửa sổ → không đóng ngăn kéo dạng sheet
  addEventListener('resize', () => { if (cur && !cur.pop.classList.contains('sheet')) close(true); });

  window.Dropdown = { enhance, close: () => close() };
})();
