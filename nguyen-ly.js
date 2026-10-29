/* Chế độ "Nguyên lý": mạch tối giản + dòng điện chạy + dạng sóng theo góc pha ωt cho từng bài.
   Dùng: NguyenLy.mount(boxEl, { getAlpha, setAlpha }); NguyenLy.show(exId); NguyenLy.has(exId). */
(() => {
  const PI = Math.PI, TAU = 2 * PI, D = 180 / PI;
  const md = x => ((x % TAU) + TAU) % TAU;
  const frac = x => x - Math.floor(x);
  const fmtDeg = r => Math.round(r * D) + '°';

  /* ---------- vẽ linh kiện (trục dọc: dòng thuận đi từ (0,-20) xuống (0,20)) ---------- */
  const SHAPE = {
    diode: '<path d="M0,-20V-8M0,8V20"/><path class="b" d="M-9,-8H9L0,8Z"/><path d="M-9,8H9"/>',
    scr: '<path d="M0,-20V-8M0,8V20"/><path class="b" d="M-9,-8H9L0,8Z"/><path d="M-9,8H9M4,7L14,16"/>',
    triac: '<path d="M0,-20V-8M0,8V20"/><path class="b" d="M-12,-8H0L-6,8Z"/><path class="b" d="M0,8H12L6,-8Z"/><path d="M-12,-8H12M-12,8H12M-6,8L-14,16"/>',
    sw: '<path d="M0,-20V-10M0,10V20M-9,0H-17"/><rect class="b" x="-9" y="-10" width="18" height="20" rx="3"/><path d="M-4,-5V5M-4,0H4M4,-5V5"/>',
    lamp: '<path d="M0,-20V-11M0,11V20"/><circle class="glow" r="11"/><circle r="11"/><path d="M-7.8,-7.8L7.8,7.8M7.8,-7.8L-7.8,7.8"/>',
    res: '<path d="M0,-20V-12M0,12V20"/><rect x="-5" y="-12" width="10" height="24"/>',
    ind: '<path d="M0,-20V-15M0,15V20M0,-15a5,5 0 0,1 0,10a5,5 0 0,1 0,10a5,5 0 0,1 0,10"/>',
    ac: '<path d="M0,-20V-14M0,14V20"/><circle r="14"/><path d="M-8,0q4,-9 8,0t8,0"/>',
    dc: '<path d="M0,-20V-4M0,4V20M-12,-4H12M-6,4H6"/><text x="15" y="-6" class="pm">+</text>',
    cap: '<path d="M0,-20V-4M0,4V20M-11,-4H11M-11,4H11"/>',
  };
  const GATE = { scr: [14, 16], triac: [-14, 16], sw: [-17, 0] };
  const rotP = ([x, y], r) => { const c = Math.cos(r * PI / 180), s = Math.sin(r * PI / 180); return [x * c - y * s, x * s + y * c]; };
  function devSvg([type, id, x, y, rot = 0, label = '', lx, ly]) {
    let s = `<g class="dev" id="nl-d-${id}" transform="translate(${x},${y}) rotate(${rot})">${SHAPE[type]}</g>`;
    if (GATE[type]) { const [gx, gy] = rotP(GATE[type], rot); s += `<circle class="gate" id="nl-g-${id}" cx="${x + gx}" cy="${y + gy}" r="4"/>`; }
    if (label) {
      const vert = Math.abs(rot % 180) < 1;
      s += `<text class="lb" x="${lx ?? (vert ? x + 17 : x)}" y="${ly ?? (vert ? y + 4 : y - 15)}" text-anchor="${lx == null && vert ? 'start' : 'middle'}">${label}</text>`;
    }
    return s;
  }
  const pts = p => p.map(q => q.join(',')).join(' ');

  /* ---------- các mạch ---------- */
  const T = {};
  const BASE3 = [['dc', 'V', 60, 130, 0, '12V'], ['lamp', 'L', 340, 130, 0, 'Đ1']];
  const LOOP = { w1: [[60, 110], [60, 60], [180, 60]], w2: [[220, 60], [340, 60], [340, 110]], w3: [[340, 150], [340, 200], [60, 200], [60, 150]] };
  const LOOP_ON = [['w1', 1], ['w2', 1], ['w3', 1]];

  // 7.1 diode với nguồn DC
  T.dcDiode = fwd => ({
    vb: [400, 240], dc: true,
    devs: [...BASE3, ['diode', 'D', 200, 60, fwd ? -90 : 90, 'Diode', 200, 42]],
    wires: LOOP,
    extra: `<text class="lb" x="${fwd ? 172 : 228}" y="80" text-anchor="middle">A</text><text class="lb" x="${fwd ? 228 : 172}" y="80" text-anchor="middle">K</text>`,
    intro: 'Diode chỉ cho dòng đi từ Anốt (A) sang Katốt (K). Phân cực thuận (A dương hơn K) → dẫn, sụt áp ≈ 0,7 V; phân cực ngược → khóa, chỉ có dòng rò rất nhỏ.',
    state: () => fwd
      ? { on: ['D', 'L'], paths: LOOP_ON, glow: { L: 1 }, text: 'Phân cực THUẬN: A nối cực +, K nối về tải → diode dẫn, sụt áp ≈ 0,7 V; dòng chạy +12V → diode → đèn → GND, đèn sáng.' }
      : { on: [], paths: [], glow: { L: 0 }, text: 'Phân cực NGƯỢC: K nối cực + → tiếp giáp P-N bị phân cực ngược, diode khóa. Gần như toàn bộ 12 V đặt lên diode, đèn tắt.' },
  });

  // 7.1.2 / 8.1.1 / 8.1.2: khóa điện tử với nguồn DC, kích bằng xung
  T.dcSwitch = kind => {
    const latch = kind === 'scr' || kind === 'triac';
    const name = { bjt: 'Transistor', mos: 'MOSFET', igbt: 'IGBT', scr: 'SCR', triac: 'Triac' }[kind];
    const gname = { bjt: 'B', mos: 'G', igbt: 'G', scr: 'G', triac: 'G' }[kind];
    const shape = latch ? kind : 'sw';
    const N = 4, u = th => th / TAU * N;
    const pulse = th => latch ? (frac(u(th)) >= 0.3 && frac(u(th)) < 0.4) : frac(u(th)) < 0.5;
    const on = th => latch ? u(th) >= 0.3 : pulse(th);
    const TXT = {
      bjt: ['Không có xung ở cực B → không có dòng IB → transistor khóa (hở C–E), đèn tắt.', 'Có xung dương ở cực B → dòng IB làm transistor bão hòa (C–E như công tắc đóng) → đèn sáng. Hết xung là tắt ngay.'],
      mos: ['Áp G–S = 0 (dưới ngưỡng) → chưa có kênh dẫn, MOSFET khóa, đèn tắt.', 'Áp G–S vượt ngưỡng (~4 V) → hình thành kênh dẫn D–S → MOSFET dẫn, đèn sáng. Điều khiển bằng ÁP nên gần như không tốn dòng cực G.'],
      igbt: ['Áp G–E = 0 → IGBT khóa, đèn tắt.', 'Áp G–E vượt ngưỡng → IGBT dẫn C–E (cực G như MOSFET, đường lực như transistor) → đèn sáng; hết xung là tắt.'],
      scr: ['Vừa cấp nguồn, chưa có xung: SCR phân cực thuận nhưng KHÓA (chưa được mở), đèn tắt.', 'Đã có xung vào G → SCR dẫn và TỰ GIỮ: các xung sau không còn tác dụng, đèn sáng liên tục. Muốn tắt phải ngắt nguồn (hoặc giảm dòng dưới dòng duy trì) – nguồn DC không tự về 0 nên SCR không tự tắt.'],
      triac: ['Vừa cấp nguồn, chưa có xung: Triac khóa, đèn tắt.', 'Đã có xung vào G → Triac dẫn và TỰ GIỮ như SCR; với nguồn DC nó không tự tắt, đèn sáng liên tục.'],
    }[kind];
    return {
      vb: [400, 240], xlabel: 'thời gian →', noDeg: true,
      devs: [BASE3[0], ['lamp', 'L', 200, 60, -90, 'Đ1'], [shape, 'Q', 340, 130, 0, name]],
      wires: LOOP,
      extra: `<text class="lb pz" x="${shape === 'sw' ? 300 : latch && kind === 'triac' ? 300 : 360}" y="${shape === 'sw' ? 118 : 172}" text-anchor="middle">xung ${gname}</text>`,
      intro: latch ? `${name} là linh kiện có nhớ: chỉ cần MỘT xung ở cực G để mở, sau đó tự giữ dẫn chừng nào dòng còn lớn hơn dòng duy trì.`
        : `${name} là khóa điều khiển hoàn toàn: dẫn khi CÓ tín hiệu kích, tắt ngay khi MẤT tín hiệu. Mạch 555 + đa hài tạo chùm xung, qua biến áp cách ly đưa tới cực ${gname}.`,
      state: th => { const o = on(th); return { on: o ? ['Q', 'L'] : [], pulse: pulse(th) ? ['Q'] : [], paths: o ? LOOP_ON : [], glow: { L: o ? 1 : 0 }, text: TXT[o ? 1 : 0] }; },
      curves: [{ name: 'xung ' + gname, color: '#ff5bd1', f: th => pulse(th) ? 1 : 0, base: -0.55, h: 0.4 }, { name: 'u tải', color: '#ffd23f', w: 2.5, f: th => on(th) ? 1 : 0 }],
      cond: on, ymin: -0.65, ymax: 1.15,
    };
  };

  // xoay chiều 1 pha – 1 linh kiện nối tiếp tải (diode / SCR / Triac R / Triac RL)
  const PHI = PI / 4;
  function triacRLbeta(a) {
    if (a <= PHI) return null; // dẫn liên tục
    const k = Math.sin(a - PHI), g = b => Math.sin(b - PHI) - k * Math.exp(-(b - a) / Math.tan(PHI));
    let lo = PI, hi = PI + a; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; } return lo;
  }
  T.ac1 = (kind, rl = false) => {
    const devType = { half: 'diode', scr: 'scr', triac: 'triac' }[kind];
    const name = { half: 'Diode', scr: 'SCR', triac: 'Triac' }[kind];
    const ld = rl ? [['lamp', 'L', 340, 100, 0, 'R (đèn)'], ['ind', 'LL', 340, 165, 0, 'L']] : [['lamp', 'L', 340, 130, 0, 'R (đèn)']];
    const wires = rl ? { w1: LOOP.w1, w2: [[220, 60], [340, 60], [340, 80]], wm: [[340, 120], [340, 145]], w3: [[340, 185], [340, 200], [60, 200], [60, 150]] } : LOOP;
    const wn = Object.keys(wires);
    // trạng thái dẫn: +1 / -1 / 0
    const cond = (th, a) => {
      const s = Math.sin(th);
      if (kind === 'half') return s > 0 ? 1 : 0;
      if (kind === 'scr') return th >= a && th <= PI ? 1 : 0;
      if (!rl) return th >= a && th <= PI ? 1 : th >= PI + a ? -1 : 0;
      const b = triacRLbeta(a);
      if (b === null) return md(th - PHI) < PI ? 1 : -1;
      if (th >= a && th < b) return 1; if (th >= PI + a || th < b - PI) return -1; return 0;
    };
    const iRL = (th, a) => {
      const c = cond(th, a); if (!c) return 0;
      const b = triacRLbeta(a); if (b === null) return Math.sin(th - PHI);
      const t0 = c > 0 ? a : PI + a, x = md(th - t0);
      return c * (Math.sin(x + a - PHI) - Math.sin(a - PHI) * Math.exp(-x / Math.tan(PHI)));
    };
    const pulses = (th, a) => kind === 'half' ? [] : (md(th - a) < 0.3 || (kind === 'triac' && md(th - PI - a) < 0.3)) ? ['Q'] : [];
    const uL = (th, a) => cond(th, a) ? Math.sin(th) : 0;
    return {
      vb: [400, 240], ctl: kind !== 'half',
      devs: [['ac', 'V', 60, 130, 0, '~U'], [devType, 'Q', 200, 60, -90, name, 200, 40], ...ld],
      wires,
      intro: {
        half: 'Diode chỉ dẫn khi anốt dương hơn katốt → chỉ nửa chu kỳ dương đi qua tải. Ud = 0,45·U.',
        scr: 'SCR chỉ dẫn khi vừa phân cực thuận VỪA có xung ở G. Dời thời điểm xung (góc α) thì dời thời điểm bắt đầu dẫn → điều chỉnh được điện áp ra. SCR tự tắt khi dòng về 0 (cuối nửa chu kỳ dương).',
        triac: rl ? 'Triac = 2 SCR song song ngược, kích được cả 2 chiều. Tải RL: cuộn cảm L làm dòng chậm pha φ ≈ 45° so với áp, nên dòng còn chạy sau khi điện áp đổi dấu → Triac tắt muộn tại góc β > π.'
          : 'Triac = 2 SCR song song ngược, kích được cả 2 chiều → dẫn ở cả hai nửa chu kỳ từ góc α. Tải nhận phần sin bị "cắt" đối xứng → điều áp xoay chiều. U_tải = U·√(1 − α/π + sin2α/2π).',
      }[kind],
      state: (th, a) => {
        const c = cond(th, a), s = Math.sin(th), pos = s >= 0;
        const paths = c ? wn.map(w => [w, c]) : [];
        let text;
        if (kind === 'half') text = pos ? 'Nửa chu kỳ DƯƠNG: anốt dương hơn katốt → diode dẫn, u_tải = u_nguồn.' : 'Nửa chu kỳ ÂM: diode phân cực ngược → khóa, tải không có điện; toàn bộ áp nguồn đặt lên diode.';
        else if (kind === 'scr') text = th < a ? `Nửa chu kỳ dương, CHƯA tới góc α = ${fmtDeg(a)}: SCR phân cực thuận nhưng chưa có xung → khóa, u_tải = 0.`
          : c ? `Tại ωt = α đã có xung G → SCR dẫn, u_tải = u_nguồn cho tới cuối nửa chu kỳ dương.`
            : 'Nửa chu kỳ âm: SCR phân cực ngược, đã tự tắt khi dòng về 0 tại ωt = 180°. Tải không có điện.';
        else if (!rl) text = c ? `Triac dẫn (${c > 0 ? 'chiều thuận T2→T1, nửa dương' : 'chiều ngược T1→T2, nửa âm'}) kể từ xung tại ${fmtDeg(c > 0 ? a : PI + a)} → u_tải = u_nguồn.`
          : `Chưa tới thời điểm xung (${pos ? 'α' : '180° + α'}) → Triac khóa, u_tải = 0. Triac tắt tự nhiên khi dòng qua 0.`;
        else {
          const b = triacRLbeta(a);
          text = b === null ? `α = ${fmtDeg(a)} < φ = 45°: dòng chưa kịp về 0 đã có xung tiếp → Triac dẫn liên tục, tải nhận đủ hình sin.`
            : c && ((c > 0 && th > PI) || (c < 0 && th < PI && th < b - PI)) ? `Điện áp đã đổi dấu nhưng cuộn cảm L còn giữ dòng → Triac VẪN dẫn tới góc tắt β ≈ ${fmtDeg(b)}${c < 0 ? ' (+180°)' : ''}; u_tải có đoạn âm.`
              : c ? `Triac dẫn ${c > 0 ? 'chiều thuận' : 'chiều ngược'} từ xung tại ${fmtDeg(c > 0 ? a : PI + a)}; dòng tăng chậm vì L.` : `Dòng đã về 0 (sau β ≈ ${fmtDeg(b)}) → Triac khóa, chờ xung kế tiếp.`;
        }
        return { on: c ? ['Q', 'L', 'LL'] : [], pulse: pulses(th, a), paths, glow: { L: Math.abs(rl ? iRL(th, a) : uL(th, a)) }, text };
      },
      curves: [
        { name: 'u nguồn', color: '#9fb3d4', f: th => Math.sin(th) },
        { name: 'u tải', color: '#ffd23f', w: 2.5, f: uL },
        ...(rl ? [{ name: 'i tải', color: '#4cc2ff', dash: [5, 3], f: iRL }] : []),
        ...(kind === 'half' ? [] : [{ name: 'xung G', color: '#ff5bd1', f: (th, a) => pulses(th, a).length ? 1 : 0, base: -1.05, h: 0.3 }]),
      ],
      cond: (th, a) => cond(th, a) !== 0,
    };
  };

  // cầu 1 pha: diode / bán phần (SCR trên + diode dưới) / toàn phần (4 SCR); tải R hoặc RL
  T.bridge = (kind, rl = false) => {
    const lab = { diode: ['D1', 'D3', 'D4', 'D2'], semi: ['SCR1', 'SCR2', 'D1', 'D2'], full: ['SCR1', 'SCR2', 'SCR3', 'SCR4'] }[kind];
    const ty = { diode: ['diode', 'diode', 'diode', 'diode'], semi: ['scr', 'scr', 'diode', 'diode'], full: ['scr', 'scr', 'scr', 'scr'] }[kind];
    const ld = rl ? [['lamp', 'L', 360, 100, 0, 'R'], ['ind', 'LL', 360, 165, 0, 'L']] : [['lamp', 'L', 360, 130, 0, 'R (đèn)']];
    const wires = {
      wX: [[50, 110], [50, 95], [110, 95], [110, 130], [170, 130]], wY: [[50, 150], [50, 235], [300, 235], [300, 130], [260, 130]],
      wXT: [[170, 130], [170, 100]], wXB: [[170, 160], [170, 130]], wYT: [[260, 130], [260, 100]], wYB: [[260, 160], [260, 130]],
      wP1: [[170, 60], [260, 60]], wP2: [[260, 60], [360, 60], [360, rl ? 80 : 110]],
      ...(rl ? { wm: [[360, 120], [360, 145]] } : {}),
      wN0: [[360, rl ? 185 : 150], [360, 200], [260, 200]], wN1: [[260, 200], [170, 200]],
    };
    const LD = rl ? [['wm', 1]] : [];
    const P = [['wX', 1], ['wXT', 1], ['wP1', 1], ['wP2', 1], ...LD, ['wN0', 1], ['wYB', 1], ['wY', -1]];
    const N = [['wY', 1], ['wYT', 1], ['wP2', 1], ...LD, ['wN0', 1], ['wN1', 1], ['wXB', 1], ['wX', -1]];
    const FW1 = [['wP1', 1], ['wP2', 1], ...LD, ['wN0', 1], ['wN1', 1], ['wXB', 1], ['wXT', 1]];
    const FW2 = [['wP2', 1], ...LD, ['wN0', 1], ['wYB', 1], ['wYT', 1]];
    // trả về [mã, các linh kiện dẫn]
    const st = (th, a) => {
      const pos = th < PI;
      if (kind === 'diode') return pos ? ['P', ['TL', 'BR']] : ['N', ['TR', 'BL']];
      if (kind === 'semi') {
        if (!rl) return th >= a && pos ? ['P', ['TL', 'BR']] : th >= PI + a ? ['N', ['TR', 'BL']] : ['0', []];
        return th >= a && pos ? ['P', ['TL', 'BR']] : !pos && th < PI + a ? ['FW1', ['TL', 'BL']] : th >= PI + a ? ['N', ['TR', 'BL']] : ['FW2', ['TR', 'BR']];
      }
      if (!rl || a >= PI / 2) return th >= a && pos ? ['P', ['TL', 'BR']] : th >= PI + a ? ['N', ['TR', 'BL']] : ['0', []];
      return th >= a && th < PI + a ? ['P', ['TL', 'BR']] : ['N', ['TR', 'BL']];
    };
    const ud = (th, a) => { const [m] = st(th, a), s = Math.sin(th); return m === 'P' ? s : m === 'N' ? -s : 0; };
    const iavg = a => kind === 'full' && a < PI / 2 ? 2 / PI * Math.cos(a) : (1 + Math.cos(a)) / PI;
    const pulses = (th, a) => kind === 'diode' ? [] : [...(md(th - a) < 0.3 ? (kind === 'full' ? ['TL', 'BR'] : ['TL']) : []), ...(md(th - PI - a) < 0.3 ? (kind === 'full' ? ['TR', 'BL'] : ['TR']) : [])];
    const TXT = {
      P: () => `Nửa chu kỳ DƯƠNG (X dương hơn Y)${kind === 'diode' ? '' : ', sau xung tại α'}: dòng X → ${lab[0]} → +Ud → tải → −Ud → ${lab[3]} → Y.`,
      N: () => `Nửa chu kỳ ÂM (Y dương hơn X)${kind === 'diode' ? '' : ', sau xung tại 180° + α'}: dòng Y → ${lab[1]} → +Ud → tải → −Ud → ${lab[2]} → X. Dòng qua tải VẪN cùng chiều → điện áp một chiều.`,
      FW1: () => `Áp nguồn đã đổi dấu nhưng L giữ dòng: dòng thả trôi qua ${lab[0]} và ${lab[2]} (cùng nhánh X), không qua nguồn → Ud ≈ 0 (không âm).`,
      FW2: () => `Thả trôi qua ${lab[1]} và ${lab[3]} (cùng nhánh Y), chờ xung SCR1 → Ud ≈ 0.`,
      0: (th, a) => `Chưa tới thời điểm xung (${th < PI ? 'α = ' + fmtDeg(a) : '180° + α'}): các SCR khóa, tải không có điện.`,
    };
    return {
      vb: [400, 250], ctl: kind !== 'diode',
      devs: [['ac', 'V', 50, 130, 0, '~U', 36, 172], [ty[0], 'TL', 170, 80, 180, lab[0], 145, 84], [ty[1], 'TR', 260, 80, 180, lab[1]], [ty[2], 'BL', 170, 180, 180, lab[2], 145, 184], [ty[3], 'BR', 260, 180, 180, lab[3]], ...ld],
      wires,
      extra: '<text class="lb" x="110" y="88" text-anchor="middle">X</text><text class="lb" x="300" y="248" text-anchor="middle">Y</text><text class="lb pz" x="372" y="56">+Ud</text><text class="lb pz" x="372" y="214">−Ud</text>'
        + '<circle class="nd" cx="170" cy="130" r="3"/><circle class="nd" cx="260" cy="130" r="3"/><circle class="nd" cx="260" cy="60" r="3"/><circle class="nd" cx="260" cy="200" r="3"/>',
      intro: {
        diode: 'Cầu 4 diode: mỗi nửa chu kỳ có 2 diode chéo nhau dẫn, nên dòng qua tải luôn cùng một chiều. Ud = 0,9·U.',
        semi: rl ? 'Cầu bán phần: 2 SCR nhóm trên (điều khiển) + 2 diode nhóm dưới. Với tải RL, sau khi áp đổi dấu dòng tải "thả trôi" qua SCR và diode cùng nhánh → Ud không âm. Ud = 0,45·U·(1 + cosα).'
          : 'Cầu bán phần: 2 SCR nhóm trên mở theo góc α, 2 diode nhóm dưới tự dẫn. Mỗi nửa chu kỳ: 1 SCR + 1 diode chéo. Ud = 0,45·U·(1 + cosα).',
        full: rl ? 'Cầu toàn phần 4 SCR, tải RL (L lớn): dòng liên tục, cặp SCR1–SCR4 dẫn từ α tới 180° + α (kể cả khi áp đã âm) → Ud có đoạn âm. Ud = 0,9·U·cosα.'
          : 'Cầu toàn phần 4 SCR: cặp chéo SCR1–SCR4 mở ở nửa dương (xung TF-A), SCR2–SCR3 ở nửa âm (xung TF-B). Tải R: Ud = 0,45·U·(1 + cosα).',
      }[kind],
      state: (th, a) => {
        const [m, on] = st(th, a);
        const paths = { P, N, FW1, FW2 }[m] || [];
        return { on: [...on, ...(paths.length ? ['L', 'LL'] : [])], pulse: pulses(th, a), paths, glow: { L: rl ? (paths.length ? Math.min(1, iavg(a) * 1.6) : 0) : Math.abs(ud(th, a)) }, text: TXT[m](th, a) };
      },
      curves: [
        { name: 'u nguồn', color: '#8a94a6', f: th => Math.sin(th) },
        { name: 'Ud', color: '#ffd23f', w: 2.5, f: ud },
        ...(rl ? [{ name: 'i tải', color: '#4cc2ff', dash: [5, 3], f: (th, a) => iavg(a) * 1.4 }] : []),
        ...(kind === 'diode' ? [] : [{ name: 'xung', color: '#ff5bd1', f: (th, a) => pulses(th, a).length ? 1 : 0, base: -1.05, h: 0.3 }]),
      ],
      cond: (th, a) => st(th, a)[0] !== '0',
    };
  };

  // 3 pha hình tia (diode)
  const ph = (th, k) => Math.sin(th - k * TAU / 3);
  const PHN = ['A', 'B', 'C'], PHC = ['#ff7b7b', '#7bd88f', '#7bb0ff'];
  T.star3 = () => {
    const Y = [60, 130, 200], wires = {};
    Y.forEach((y, k) => { wires['a' + k] = [[80, y], [150, y]]; wires['c' + k] = [[190, y], [250, y], [250, 130]]; wires['n' + k] = [[340, 190], [340, 240], [20, 240], [20, y], [40, y]]; });
    wires.bus = [[250, 130], [340, 130], [340, 150]];
    const top = th => [0, 1, 2].reduce((b, k) => ph(th, k) > ph(th, b) ? k : b, 0);
    return {
      vb: [400, 250],
      devs: [...Y.flatMap((y, k) => [['ac', 'V' + k, 60, y, -90, 'Pha ' + PHN[k], 60, y - 18], ['diode', 'D' + k, 170, y, -90, 'D' + (2 * k + 1), 170, y - 15]]), ['lamp', 'L', 340, 170, 0, 'Đèn']],
      wires, extra: '<text class="lb" x="12" y="236">N</text>',
      intro: 'Chỉnh lưu hình tia 3 pha: các katốt nối chung nên chỉ diode nối với pha đang có điện áp DƯƠNG NHẤT được dẫn; mỗi diode dẫn 120°. Ud = 1,17·U_pha.',
      state: th => { const k = top(th); return { on: ['D' + k, 'L'], paths: [['a' + k, 1], ['c' + k, 1], ['bus', 1], ['n' + k, 1]], glow: { L: ph(th, k) }, text: `Pha ${PHN[k]} đang dương nhất → D${2 * k + 1} dẫn, hai diode còn lại bị phân cực ngược (katốt chung cao hơn anốt của chúng). Dòng: pha ${PHN[k]} → D${2 * k + 1} → tải → dây trung tính N.` }; },
      curves: [0, 1, 2].map(k => ({ name: 'u' + PHN[k], color: PHC[k], w: 1, f: th => ph(th, k) })).concat([{ name: 'Ud', color: '#ffd23f', w: 3, f: th => ph(th, top(th)) }]),
      cond: () => true, ymin: -1.1, ymax: 1.1,
    };
  };

  // cầu 3 pha: diode (7.3.2) hoặc 6 SCR (8.3)
  T.bridge3 = ctl => {
    const X = [220, 290, 360];
    const topL = ctl ? ['SCR1', 'SCR3', 'SCR5'] : ['D1', 'D3', 'D5'], botL = ctl ? ['SCR4', 'SCR6', 'SCR2'] : ['D4', 'D6', 'D2'];
    const ty = ctl ? 'scr' : 'diode';
    const wires = {
      ph0: [[150, 130], [220, 130]], ph1: [[150, 222], [275, 222], [275, 130], [290, 130]], ph2: [[150, 242], [345, 242], [345, 130], [360, 130]],
      wP0: [[220, 60], [290, 60]], wP1: [[290, 60], [360, 60]], wP2: [[360, 60], [440, 60], [440, 110]],
      wN0: [[440, 150], [440, 200], [360, 200]], wN1: [[360, 200], [290, 200]], wN2: [[290, 200], [220, 200]],
    };
    X.forEach((x, k) => { wires['up' + k] = [[x, 130], [x, 100]]; wires['dn' + k] = [[x, 160], [x, 130]]; });
    const pick = (th, a) => {
      if (!ctl) return [[0, 1, 2].reduce((b, k) => ph(th, k) > ph(th, b) ? k : b, 0), [0, 1, 2].reduce((b, k) => ph(th, k) < ph(th, b) ? k : b, 0)];
      const tk = [0, 1, 2].find(k => md(th - PI / 6 - a - k * TAU / 3) < TAU / 3), bj = [0, 1, 2].find(j => md(th - 7 * PI / 6 - a - j * TAU / 3) < TAU / 3);
      return ph(th, tk) - ph(th, bj) > 0 ? [tk, bj] : [null, null];
    };
    const ud = (th, a) => { const [k, j] = pick(th, a); return k === null ? 0 : ph(th, k) - ph(th, j); };
    const pulses = (th, a) => !ctl ? [] : [0, 1, 2].flatMap(k => [...(md(th - PI / 6 - a - k * TAU / 3) < 0.25 ? ['T' + k] : []), ...(md(th - 7 * PI / 6 - a - k * TAU / 3) < 0.25 ? ['B' + k] : [])]);
    return {
      vb: [480, 255], ctl,
      devs: [...X.flatMap((x, k) => [[ty, 'T' + k, x, 80, 180, topL[k], x + 16, 84], [ty, 'B' + k, x, 180, 180, botL[k], x + 16, 184]]), ['lamp', 'L', 440, 130, 0, 'Tải']],
      wires,
      extra: PHN.map((n, k) => `<circle class="nd" cx="150" cy="${[130, 222, 242][k]}" r="4"/><text class="lb" x="140" y="${[134, 226, 246][k]}" text-anchor="end" fill="${PHC[k]}">Pha ${n}</text>`).join('')
        + '<text class="lb pz" x="452" y="56">+Ud</text><text class="lb pz" x="452" y="214">−Ud</text>',
      intro: ctl ? 'Cầu 3 pha 6 SCR: luôn có 1 SCR nhóm trên (katốt chung, +Ud) và 1 SCR nhóm dưới (anốt chung, −Ud) cùng dẫn. Mỗi 60° chuyển một SCR theo thứ tự 1→2→3→4→5→6; dời các xung đi góc α (tính từ điểm chuyển mạch tự nhiên 30°) để giảm Ud. Ud = 1,35·U_dây·cosα (α ≤ 60°).'
        : 'Cầu 3 pha diode: nhóm trên dẫn ở pha DƯƠNG NHẤT, nhóm dưới dẫn ở pha ÂM NHẤT → Ud = u_dây lớn nhất tại mỗi thời điểm (6 xung/chu kỳ). Ud = 1,35·U_dây.',
      state: (th, a) => {
        const [k, j] = pick(th, a);
        if (k === null) return { on: [], pulse: pulses(th, a), paths: [], glow: { L: 0 }, text: `α = ${fmtDeg(a)} > 60°: điện áp dây của cặp đang được kích đã về 0 → SCR tắt, chờ xung kế tiếp (dòng gián đoạn).` };
        const paths = [['ph' + k, 1], ['up' + k, 1], ...['wP0', 'wP1', 'wP2'].slice(k).map(w => [w, 1]), ...['wN0', 'wN1', 'wN2'].slice(0, 3 - j).map(w => [w, 1]), ['dn' + j, 1], ['ph' + j, -1]];
        return { on: ['T' + k, 'B' + j, 'L'], pulse: pulses(th, a), paths, glow: { L: ud(th, a) / 1.73 },
          text: `${topL[k]} (pha ${PHN[k]}${ctl ? '' : ' – dương nhất'}) và ${botL[j]} (pha ${PHN[j]}${ctl ? '' : ' – âm nhất'}) đang dẫn → Ud = u${PHN[k]}${PHN[j]}. Dòng: pha ${PHN[k]} → ${topL[k]} → tải → ${botL[j]} → pha ${PHN[j]}.` };
      },
      curves: [0, 1, 2].map(k => ({ name: 'u' + PHN[k], color: PHC[k], w: 1, f: th => ph(th, k) })).concat([{ name: 'Ud', color: '#ffd23f', w: 3, f: ud }],
        ctl ? [{ name: 'xung', color: '#ff5bd1', f: (th, a) => pulses(th, a).length ? 1 : 0, base: -1.85, h: 0.35 }] : []),
      cond: (th, a) => pick(th, a)[0] !== null, ymin: -1.9, ymax: 1.9,
    };
  };

  // 9.3.3a nghịch lưu đẩy kéo (biến áp có điểm giữa)
  T.pushpull = () => {
    const coil = (x, y1, y2, sw) => { let d = `M${x},${y1}`; for (let y = y1; y < y2; y += 10) d += `a5,5 0 0,${sw} 0,10`; return `<path class="cl" d="${d}"/>`; };
    const wires = {
      wPlus: [[50, 120], [50, 40], [240, 40], [240, 130], [260, 130]], cT: [[260, 130], [260, 80]], cB: [[260, 130], [260, 180]],
      wD1: [[260, 80], [260, 65], [130, 65], [130, 90]], wD2: [[260, 180], [260, 205], [190, 205], [190, 190]],
      wG1: [[130, 130], [130, 232], [50, 232], [50, 160]], wG2: [[190, 150], [160, 150], [160, 232], [50, 232], [50, 160]],
      s1: [[290, 80], [290, 60], [380, 60], [380, 110]], s2: [[380, 150], [380, 200], [290, 200], [290, 180]], sc: [[290, 180], [290, 80]],
    };
    const q1 = th => th < PI;
    return {
      vb: [410, 245], xlabel: 'một chu kỳ ra (50 Hz) →',
      devs: [['dc', 'V', 50, 140, 0, '12V'], ['sw', 'Q1', 130, 110, 0, 'Q1'], ['sw', 'Q2', 190, 170, 180, 'Q2', 210, 150], ['lamp', 'L', 380, 130, 0, 'Đèn']],
      wires,
      extra: coil(260, 80, 180, 1) + coil(290, 80, 180, 0) + '<path class="cl" d="M273,78V182M277,78V182"/><text class="lb" x="246" y="148" text-anchor="end">CT</text><text class="lb pz" x="104" y="128" text-anchor="end">OUT1</text><text class="lb pz" x="230" y="166">OUT2</text>',
      intro: 'Nghịch lưu đẩy kéo: CD4047 tạo 2 xung vuông NGƯỢC PHA (Q, Q̄) mở luân phiên Q1, Q2. +12V vào điểm giữa (CT) cuộn sơ cấp; mỗi MOSFET cho dòng chạy qua một nửa cuộn theo chiều ngược nhau → từ thông đổi chiều → cuộn thứ cấp ra điện áp xoay chiều (sóng vuông) đã tăng áp.',
      state: th => q1(th)
        ? { on: ['Q1', 'L'], pulse: ['Q1'], paths: [['wPlus', 1], ['cT', 1], ['wD1', 1], ['wG1', 1], ['sc', 1], ['s1', 1], ['s2', 1]], glow: { L: 1 }, text: 'OUT1 mức cao → Q1 dẫn (Q2 khóa): dòng +12V → CT → nửa TRÊN cuộn sơ cấp → Q1 → GND. Từ thông theo chiều thứ nhất → thứ cấp ra nửa chu kỳ DƯƠNG.' }
        : { on: ['Q2', 'L'], pulse: ['Q2'], paths: [['wPlus', 1], ['cB', 1], ['wD2', 1], ['wG2', 1], ['sc', -1], ['s1', -1], ['s2', -1]], glow: { L: 1 }, text: 'OUT2 mức cao → Q2 dẫn (Q1 khóa): dòng +12V → CT → nửa DƯỚI cuộn sơ cấp → Q2 → GND, ngược chiều lúc trước → thứ cấp ra nửa chu kỳ ÂM.' },
      curves: [{ name: 'OUT1', color: '#ff5bd1', f: th => q1(th) ? 1 : 0, base: 1.05, h: 0.25 }, { name: 'OUT2', color: '#c792ea', f: th => q1(th) ? 0 : 1, base: -1.17, h: 0.25 }, { name: 'u ra', color: '#ffd23f', w: 2.5, f: th => q1(th) ? 0.85 : -0.85 }],
      cond: () => true, ymin: -1.2, ymax: 1.4,
    };
  };

  // 9.3.3b nghịch lưu cầu H, điều chế PWM sin
  T.hbridge = () => {
    const wires = {
      wP: [[60, 110], [60, 40], [150, 40], [150, 60]], wP2: [[150, 40], [330, 40], [330, 60]],
      aL: [[150, 100], [150, 130]], aL2: [[150, 130], [150, 160]], aR: [[330, 100], [330, 130]], aR2: [[330, 130], [330, 160]],
      lo1: [[150, 130], [190, 130]], lo2: [[230, 130], [255, 130]], lo3: [[295, 130], [330, 130]],
      wB1: [[150, 200], [150, 230]], wN1: [[150, 230], [60, 230], [60, 150]], wN2: [[330, 200], [330, 230], [150, 230]],
    };
    const NP = 8, pwm = th => frac(th / PI * NP) < Math.abs(Math.sin(th)) * 0.92;
    const LOAD = d => [['lo1', d], ['lo2', d], ['lo3', d]];
    return {
      vb: [400, 245],
      devs: [['dc', 'V', 60, 130, 0, 'DC ~310V'], ['sw', 'V1', 150, 80, 0, 'V1', 112, 84], ['sw', 'V3', 150, 180, 0, 'V3', 112, 184], ['sw', 'V2', 330, 80, 0, 'V2'], ['sw', 'V4', 330, 180, 0, 'V4'],
        ['ind', 'LF', 210, 130, -90, 'L1 (lọc)'], ['lamp', 'L', 275, 130, -90, 'Đèn']],
      wires, extra: '<circle class="nd" cx="150" cy="130" r="3"/><circle class="nd" cx="330" cy="130" r="3"/><text class="lb" x="150" y="150" text-anchor="end" dx="-6">A</text><text class="lb" x="342" y="150">B</text>',
      intro: 'Nghịch lưu sin (EG8010): 12V được tăng lên DC cao áp, rồi cầu H gồm 4 MOSFET đóng ngắt theo PWM sin: độ rộng xung tỉ lệ với sin(ωt). Nửa dương V1+V4 đóng ngắt, nửa âm V2+V3; cuộn L1 (và tụ C1) lọc bỏ tần số đóng cắt → điện áp ra gần hình sin 220VAC/50Hz.',
      state: th => {
        const pos = th < PI, hi = pwm(th);
        if (pos) return hi
          ? { on: ['V1', 'V4', 'L', 'LF'], pulse: ['V1', 'V4'], paths: [['wP', 1], ['aL', 1], ...LOAD(1), ['aR2', 1], ['wN2', 1], ['wN1', 1]], glow: { L: Math.sin(th) }, text: 'Nửa DƯƠNG, xung PWM mức cao: V1 và V4 đóng → u_AB = +Ud, dòng nguồn → V1 → L1 → tải → V4 → về nguồn.' }
          : { on: ['V4', 'V3', 'L', 'LF'], pulse: ['V4'], paths: [...LOAD(1), ['aR2', 1], ['wN2', 1], ['wB1', -1], ['aL2', -1]], glow: { L: Math.sin(th) }, text: 'Nửa DƯƠNG, khoảng nghỉ của PWM: V1 ngắt, L1 giữ dòng chạy vòng qua V4 và diode ngược của V3 (thả trôi) → u_AB = 0. Độ rộng xung lớn ở đỉnh sin, nhỏ ở hai đầu.' };
        return hi
          ? { on: ['V2', 'V3', 'L', 'LF'], pulse: ['V2', 'V3'], paths: [['wP', 1], ['wP2', 1], ['aR', 1], ...LOAD(-1), ['aL2', 1], ['wB1', 1], ['wN1', 1]], glow: { L: -Math.sin(th) }, text: 'Nửa ÂM, xung PWM mức cao: V2 và V3 đóng → u_AB = −Ud, dòng qua tải đổi chiều (B → A).' }
          : { on: ['V3', 'V4', 'L', 'LF'], pulse: ['V3'], paths: [...LOAD(-1), ['aL2', 1], ['wB1', 1], ['wN2', -1], ['aR2', -1]], glow: { L: -Math.sin(th) }, text: 'Nửa ÂM, khoảng nghỉ PWM: V2 ngắt, dòng thả trôi qua V3 và diode ngược của V4 → u_AB = 0.' };
      },
      curves: [{ name: 'u_AB (PWM)', color: '#ff5bd1', w: 1, f: th => pwm(th) ? (th < PI ? 1 : -1) : 0 }, { name: 'u ra (sau lọc)', color: '#ffd23f', w: 2.5, f: th => 0.9 * Math.sin(th) }],
      cond: () => true, ymin: -1.15, ymax: 1.15,
    };
  };

  // 9.3.1 bộ biến đổi DC-DC (PE-802): tham số là độ rộng xung D thay cho α; trục ngang = 2 chu kỳ PWM
  const qOn = (th, p) => frac(th / PI) < p.D;
  const tri = (th, p) => { const x = frac(th / PI); return x < p.D ? -1 + 2 * x / p.D : 1 - 2 * (x - p.D) / (1 - p.D); };
  const DCX = { noDeg: true, duty: true, xlabel: '2 chu kỳ xung PWM →' };
  const gateC = { name: 'xung G (Q1)', color: '#ff5bd1', f: (th, p) => qOn(th, p) ? 1 : 0, base: 1.12, h: 0.22 };
  T.dcdc = kind => {
    const bk = kind === 'buck', bo = kind === 'boost';
    const Dm = p => Math.min(p.D, 0.85);
    const u0 = p => bk ? p.D : bo ? 1 / (1 - Dm(p)) : -Dm(p) / (1 - Dm(p)); // theo đơn vị Uin
    const lbl = (x, y, t, a = 'middle') => `<text class="lb" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;
    const nd = (x, y) => `<circle class="nd" cx="${x}" cy="${y}" r="3"/>`;
    const RC = [['cap', 'C', 300, 130, 0, 'C'], ['res', 'R', 370, 130, 0, 'R tải']];
    const tpl = {
      buck: {
        devs: [['dc', 'V', 50, 130, 0, 'Uin'], ['sw', 'Q', 130, 50, -90, 'Q1', 130, 34], ['diode', 'D', 190, 130, 180, 'D1'], ['ind', 'LL', 230, 50, -90, 'L1', 230, 34], ...RC],
        wires: { wIn: [[50, 110], [50, 50], [110, 50]], wA1: [[150, 50], [190, 50]], wA2: [[190, 50], [210, 50]], dUp: [[190, 110], [190, 50]], wO1: [[250, 50], [300, 50]], cT: [[300, 50], [300, 110]],
          wO2: [[300, 50], [370, 50], [370, 110]], rB: [[370, 150], [370, 210], [300, 210]], cB: [[300, 150], [300, 210]], g1: [[300, 210], [190, 210]], dB: [[190, 210], [190, 150]], g2: [[190, 210], [50, 210], [50, 150]] },
        extra: nd(190, 50) + nd(300, 50) + nd(300, 210) + nd(190, 210) + lbl(390, 60, '+U0', 'start') + lbl(390, 205, '−U0', 'start'),
        intro: 'Bộ hạ áp (Buck, Hình 9.3): Q1 đóng ngắt với tần số cố định, tỉ lệ thời gian đóng D = ton/T. Khi Q1 đóng, nguồn cấp qua L1 ra tải và L1 tích năng lượng; khi Q1 ngắt, L1 giữ dòng chạy vòng qua diode D1 (thả trôi). Tụ C lọc phẳng → U0 = D·Uin, luôn nhỏ hơn Uin.',
        on: { on: ['Q', 'LL', 'R'], paths: [['wIn', 1], ['wA1', 1], ['wA2', 1], ['wO1', 1], ['wO2', 1], ['rB', 1], ['g1', 1], ['g2', 1]], text: 'Q1 ĐÓNG (trong khoảng D·T): dòng Uin → Q1 → L1 → tải → về nguồn. D1 bị phân cực ngược nên khóa. Dòng qua L1 tăng dần, L1 tích năng lượng.' },
        off: { on: ['D', 'LL', 'R'], paths: [['dB', 1], ['dUp', 1], ['wA2', 1], ['wO1', 1], ['wO2', 1], ['rB', 1], ['g1', 1]], text: 'Q1 NGẮT: nguồn bị cắt, nhưng L1 không cho dòng đổi đột ngột → nó tự đảo cực, đẩy dòng chạy vòng tải → D1 → L1 (thả trôi). Dòng L1 giảm dần. Trung bình U0 = D·Uin.' },
      },
      boost: {
        devs: [['dc', 'V', 50, 130, 0, 'Uin'], ['ind', 'LL', 110, 50, -90, 'L1', 110, 34], ['sw', 'Q', 170, 130, 0, 'Q1', 186, 134], ['diode', 'D', 210, 50, -90, 'D1', 210, 34], ...RC],
        wires: { wIn: [[50, 110], [50, 50], [90, 50]], wL: [[130, 50], [170, 50]], wD: [[170, 50], [190, 50]], qT: [[170, 50], [170, 110]], qB: [[170, 150], [170, 210]], wO1: [[230, 50], [300, 50]], cT: [[300, 50], [300, 110]],
          wO2: [[300, 50], [370, 50], [370, 110]], rB: [[370, 150], [370, 210], [300, 210]], cB: [[300, 150], [300, 210]], g1: [[300, 210], [170, 210]], g2: [[170, 210], [50, 210], [50, 150]] },
        extra: nd(170, 50) + nd(300, 50) + nd(300, 210) + nd(170, 210) + lbl(390, 60, '+U0', 'start') + lbl(390, 205, '−U0', 'start'),
        intro: 'Bộ tăng áp (Boost, Hình 9.4): khi Q1 đóng, L1 được nối thẳng vào nguồn và tích năng lượng (tải do tụ C nuôi); khi Q1 ngắt, sức điện động của L1 CỘNG với Uin đẩy dòng qua D1 nạp tụ và cấp tải → U0 = Uin/(1 − D) > Uin.',
        on: { on: ['Q', 'LL', 'R'], paths: [['wIn', 1], ['wL', 1], ['qT', 1], ['qB', 1], ['g2', 1], ['cT', -1], ['wO2', 1], ['rB', 1], ['cB', -1]], text: 'Q1 ĐÓNG: dòng Uin → L1 → Q1 → về nguồn, dòng L1 tăng, L1 tích năng lượng. D1 khóa (anốt ≈ 0 V, katốt = U0) nên tụ C tự xả nuôi tải.' },
        off: { on: ['D', 'LL', 'R'], paths: [['wIn', 1], ['wL', 1], ['wD', 1], ['wO1', 1], ['cT', 1], ['wO2', 1], ['rB', 1], ['cB', 1], ['g1', 1], ['g2', 1]], text: 'Q1 NGẮT: L1 đảo cực, điện áp của nó cộng nối tiếp với Uin → D1 dẫn, nạp tụ C và cấp tải. Vì vậy U0 = Uin/(1 − D) lớn hơn Uin; D càng lớn U0 càng cao.' },
      },
      bb: {
        devs: [['dc', 'V', 50, 130, 0, 'Uin'], ['sw', 'Q', 130, 50, -90, 'Q1', 130, 34], ['ind', 'LL', 190, 130, 0, 'L1', 172, 134], ['diode', 'D', 250, 50, 90, 'D1', 250, 34], ...RC],
        wires: { wIn: [[50, 110], [50, 50], [110, 50]], wA1: [[150, 50], [190, 50]], lT: [[190, 50], [190, 110]], lB: [[190, 150], [190, 210]], g2: [[190, 210], [50, 210], [50, 150]], wDA: [[230, 50], [190, 50]],
          wO1: [[300, 50], [270, 50]], cT: [[300, 110], [300, 50]], wO2: [[370, 110], [370, 50], [300, 50]], g1: [[190, 210], [300, 210]], rB: [[300, 210], [370, 210], [370, 150]], cB: [[300, 210], [300, 150]] },
        extra: nd(190, 50) + nd(300, 50) + nd(300, 210) + nd(190, 210) + lbl(390, 60, '−U0', 'start') + lbl(390, 205, '+U0', 'start'),
        intro: 'Bộ hỗn hợp (Buck-Boost, Hình 9.5): khi Q1 đóng, L1 tích năng lượng từ nguồn; khi Q1 ngắt, L1 xả qua D1 ra tải với cực tính NGƯỢC (đầu trên tải âm). U0 = Uin·D/(1 − D): D < 50 % → hạ áp, D > 50 % → tăng áp.',
        on: { on: ['Q', 'LL', 'R'], paths: [['wIn', 1], ['wA1', 1], ['lT', 1], ['lB', 1], ['g2', 1], ['cB', -1], ['cT', -1], ['wO2', 1], ['rB', 1]], text: 'Q1 ĐÓNG: dòng Uin → Q1 → L1 → về nguồn, L1 tích năng lượng. D1 khóa, tải chỉ được tụ C nuôi (dòng tải giữ nguyên chiều).' },
        off: { on: ['D', 'LL', 'R'], paths: [['lT', 1], ['lB', 1], ['g1', 1], ['rB', 1], ['cB', 1], ['cT', 1], ['wO2', 1], ['wO1', 1], ['wDA', 1]], text: 'Q1 NGẮT: L1 giữ dòng chạy xuống, nó đẩy dòng vòng GND → tải (từ dưới lên) → D1 → L1. Đầu trên tải bị kéo xuống ÂM: U0 = −Uin·D/(1 − D), đảo cực so với lối vào.' },
      },
    }[kind];
    const uA = (th, p) => bk ? (qOn(th, p) ? 1 : 0) : bo ? (qOn(th, p) ? 0 : u0(p)) : (qOn(th, p) ? 1 : u0(p));
    return {
      vb: [410, 240], ...DCX, devs: tpl.devs, wires: tpl.wires, extra: tpl.extra, intro: tpl.intro,
      state: (th, p) => { const o = qOn(th, p), s = o ? tpl.on : tpl.off; return { ...s, pulse: o ? ['Q'] : [], glow: {}, text: s.text + ` (D = ${Math.round(p.D * 100)} % → U0 ≈ ${(u0(p) * 12).toFixed(1).replace('-', '−')} V với Uin = 12 V)` }; },
      curves: [gateC, { name: bk ? 'u diode D1' : bo ? 'u_DS Q1' : 'u nút L1', color: '#c792ea', w: 1, f: uA },
        { name: 'i_L1 (dạng)', color: '#5ad1ff', f: tri, base: bo ? 0.35 : 0.5, h: 0.1 }, { name: 'U0', color: '#ffd23f', w: 2.5, f: (th, p) => u0(p) }],
      cond: qOn, ymin: p => Math.min(-0.25, u0(p) - 0.25), ymax: p => Math.max(1.4, u0(p) + 0.35),
    };
  };
  T.chop4 = () => {
    const wires = {
      wP: [[60, 110], [60, 40], [150, 40], [150, 60]], wP2: [[150, 40], [330, 40], [330, 60]],
      aL: [[150, 100], [150, 130]], aL2: [[150, 130], [150, 160]], aR: [[330, 100], [330, 130]], aR2: [[330, 130], [330, 160]],
      lo1: [[150, 130], [220, 130]], lo2: [[260, 130], [330, 130]],
      wB1: [[150, 200], [150, 230]], wN1: [[150, 230], [60, 230], [60, 150]], wN2: [[330, 200], [330, 230], [150, 230]],
    };
    return {
      vb: [400, 245], ...DCX, q4: true,
      devs: [['dc', 'V', 60, 130, 0, 'Uin'], ['sw', 'Q1', 150, 80, 0, 'Q1', 112, 84], ['sw', 'Q4', 150, 180, 0, 'Q4', 112, 184], ['sw', 'Q3', 330, 80, 0, 'Q3'], ['sw', 'Q2', 330, 180, 0, 'Q2'], ['res', 'R', 240, 130, -90, 'R tải']],
      wires, extra: '<circle class="nd" cx="150" cy="130" r="3"/><circle class="nd" cx="330" cy="130" r="3"/><text class="lb" x="150" y="150" text-anchor="end" dx="-6">+</text><text class="lb" x="342" y="150">−</text>',
      intro: 'Bộ băm 4 khóa (cầu H): công tắc chọn cặp khóa chéo nhau được kích. Q1-Q2 ON → dòng qua tải từ “+” sang “−”, VL = +D·Uin; Q3-Q4 ON → dòng đảo chiều, VL = −D·Uin. Đổi D để chỉnh độ lớn, đổi cặp khóa để đảo chiều – dùng điều khiển động cơ DC quay 2 chiều.',
      state: (th, p) => {
        const o = qOn(th, p), pr = p.q4 ? ['Q3', 'Q4'] : ['Q1', 'Q2'];
        if (!o) return { on: [], pulse: [], paths: [], text: `Khoảng nghỉ của xung: ${pr.join(' và ')} ngắt → tải trở không có dòng, VL = 0. Trung bình VL = ${p.q4 ? '−' : '+'}D·Uin ≈ ${p.q4 ? '−' : '+'}${(p.D * 12).toFixed(1)} V.` };
        return p.q4
          ? { on: ['Q3', 'Q4', 'R'], pulse: pr, paths: [['wP', 1], ['wP2', 1], ['aR', 1], ['lo2', -1], ['lo1', -1], ['aL2', 1], ['wB1', 1], ['wN1', 1]], text: 'Q3-Q4 ON, xung mức cao: Q3 và Q4 đóng → dòng Uin → Q3 → tải (từ “−” sang “+”) → Q4 → về nguồn: VL = −Uin, đảo chiều so với Q1-Q2.' }
          : { on: ['Q1', 'Q2', 'R'], pulse: pr, paths: [['wP', 1], ['aL', 1], ['lo1', 1], ['lo2', 1], ['aR2', 1], ['wN2', 1], ['wN1', 1]], text: 'Q1-Q2 ON, xung mức cao: Q1 và Q2 đóng → dòng Uin → Q1 → tải (từ “+” sang “−”) → Q2 → về nguồn: VL = +Uin.' };
      },
      curves: [{ ...gateC, name: 'xung G' }, { name: 'u tải VL', color: '#c792ea', w: 1.5, f: (th, p) => qOn(th, p) ? (p.q4 ? -1 : 1) : 0 }, { name: 'VL trung bình', color: '#ffd23f', w: 2.5, f: (th, p) => (p.q4 ? -1 : 1) * p.D }],
      cond: qOn, ymin: -1.25, ymax: 1.4,
    };
  };

  const MAP = {
    '7.1a': () => T.dcDiode(true), '7.1b': () => T.dcDiode(false),
    '7.2-bjt': () => T.dcSwitch('bjt'), '7.2-mos': () => T.dcSwitch('mos'), '7.2-igbt': () => T.dcSwitch('igbt'),
    '8.1.1': () => T.dcSwitch('scr'), '8.1.2': () => T.dcSwitch('triac'),
    '7.2.1': () => T.ac1('half'), '7.2.2': () => T.bridge('diode'), '7.3.1': () => T.star3(), '7.3.2': () => T.bridge3(false),
    '8.1.3': () => T.ac1('scr'), '8.1.3b': () => T.ac1('triac'), '9.2r': () => T.ac1('triac'), '9.2': () => T.ac1('triac', true),
    '8.2.1': () => T.bridge('semi'), '8.2.2': () => T.bridge('semi', true), '8.2.3': () => T.bridge('full'), '8.2.4': () => T.bridge('full', true),
    '8.3': () => T.bridge3(true), '9.3a': () => T.pushpull(), '9.3b': () => T.hbridge(),
    '9.1a': () => T.dcdc('buck'), '9.1b': () => T.dcdc('boost'), '9.1c': () => T.dcdc('bb'), '9.1d': () => T.chop4(),
  };

  /* ---------- giao diện ---------- */
  const CSS = `
#nlRoot{display:flex;flex-direction:column;height:100%;gap:8px;min-height:0}
#nlSvgWrap,#nlWave{background-color:#0c2a55;background-image:linear-gradient(#ffffff0d 1px,transparent 1px),linear-gradient(90deg,#ffffff0d 1px,transparent 1px);background-size:16px 16px;border-radius:8px}
#nlSvgWrap{flex:1.25;min-height:120px;overflow:hidden}
#nlSvg{width:100%;height:100%;display:block}
#nlSvg .w{fill:none;stroke:#7f9fcf;stroke-width:2;stroke-linejoin:round}
#nlSvg .fl{fill:none;stroke:#ffd23f;stroke-width:3.2;stroke-dasharray:3 9;stroke-linecap:round;stroke-linejoin:round;animation:nlflow .55s linear infinite;display:none;filter:drop-shadow(0 0 3px #ffb300)}
@keyframes nlflow{to{stroke-dashoffset:-12}}
#nlSvg .dev path,#nlSvg .dev circle,#nlSvg .dev rect{fill:none;stroke:#cfdcf2;stroke-width:2;stroke-linejoin:round;transition:stroke .2s}
#nlSvg .dev .b{fill:#0c2a55}
#nlSvg .dev .glow{stroke:none;fill:#ffd23f;opacity:0}
#nlSvg .dev.on path,#nlSvg .dev.on circle:not(.glow),#nlSvg .dev.on rect{stroke:#ffffff}
#nlSvg .dev.on .b{fill:#2f6fe0}
#nlSvg .dev.on{filter:drop-shadow(0 0 4px #9cc2ffaa)}
#nlSvg .cl{fill:none;stroke:#cfdcf2;stroke-width:2}
#nlSvg .gate{fill:#0c2a55;stroke:#cfdcf2;stroke-width:1.5}
#nlSvg .gate.p{fill:#ff5bd1;stroke:#ff5bd1;filter:drop-shadow(0 0 5px #ff5bd1)}
#nlSvg .nd{fill:#cfdcf2}
#nlSvg text{font:12px "Be Vietnam Pro","Segoe UI",Arial,sans-serif;fill:#e3ecfa}
#nlSvg text.pz{fill:#a5bde3;font-size:11px}
#nlSvg text.pm{font-weight:700;fill:#ff9a9a}
#nlWave{flex:.9;min-height:90px;width:100%;display:block}
#nlCtl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px "JetBrains Mono",monospace;color:var(--muted)}
#nlCtl input[type=range]{flex:1;min-width:110px}
#nlCtl b{color:var(--accent);min-width:38px;display:inline-block}
#nlText{background:#e8f0fd;border-left:3px solid var(--accent);padding:8px 12px;border-radius:6px;color:var(--text);font-size:13px;min-height:40px}
#nlIntro{font-size:12.5px;color:var(--muted)}
#nlIntro summary{cursor:pointer;color:var(--accent);font-weight:600}
`;
  let box, opt, tpl = null, el = {}, theta = 0, playing = true, speed = 6, lastKey = '', lastT = 0, raf = 0, curId = null;

  function mount(root, o) {
    box = root; opt = o;
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    root.innerHTML = `
      <div class="hd"><b id="nlTitle">Nguyên lý</b>
        <button class="btn" id="nlPlay" title="Chạy / dừng (phím P)"></button>
        <select id="nlSpeed" title="Tốc độ"><option value="14">Rất chậm</option><option value="6" selected>Chậm</option><option value="2.5">Nhanh</option></select>
        <button class="btn" id="nlX" title="Đóng (Esc)"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div id="nlRoot">
        <div id="nlSvgWrap"><svg id="nlSvg"></svg></div>
        <canvas id="nlWave"></canvas>
        <div id="nlCtl"><span id="nlThL">ωt</span><input type="range" id="nlTh" min="0" max="360" step="1"><b id="nlThV"></b>
          <span id="nlAL">α</span><input type="range" id="nlA" min="0" max="180" step="1"><b id="nlAV"></b>
          <button class="btn" id="nlQ" title="Chọn cặp khóa được kích">Q1-Q2 ON</button></div>
        <div id="nlText"></div>
        <details id="nlIntro" open><summary>Nguyên lý chung</summary><div id="nlIntroT"></div></details>
      </div>`;
    ['nlSvg', 'nlWave', 'nlTh', 'nlThV', 'nlThL', 'nlA', 'nlAV', 'nlAL', 'nlText', 'nlIntroT', 'nlPlay', 'nlSpeed', 'nlTitle', 'nlCtl', 'nlQ'].forEach(k => el[k] = root.querySelector('#' + k));
    el.nlPlay.onclick = () => setPlay(!playing);
    el.nlSpeed.onchange = () => speed = +el.nlSpeed.value;
    el.nlTh.oninput = () => { setPlay(false); theta = +el.nlTh.value / D; };
    el.nlA.oninput = () => tpl?.duty ? opt.setDuty(+el.nlA.value) : opt.setAlpha(+el.nlA.value);
    el.nlQ.onclick = () => opt.setQ4(opt.getQ4() ? 0 : 1);
    root.querySelector('#nlX').onclick = () => hide();
    new ResizeObserver(() => { lastKey = ''; }).observe(el.nlWave);
    setPlay(playing);
  }
  function setPlay(p) { playing = p; el.nlPlay.innerHTML = `<svg class="ic"><use href="#i-${p ? 'pause' : 'play'}"/></svg>`; }
  const has = id => !!MAP[id];
  function show(id) {
    if (!MAP[id]) { hide(); return; }
    box.classList.add('show');
    if (id === curId && tpl) return;
    curId = id; tpl = MAP[id](); lastKey = '';
    const [w, h] = tpl.vb;
    let s = `<g>${Object.entries(tpl.wires).map(([k, p]) => `<polyline class="w" points="${pts(p)}"/>`).join('')}</g>`;
    s += tpl.extra || '';
    s += tpl.devs.map(devSvg).join('');
    s += `<g>${Object.entries(tpl.wires).map(([k, p]) => `<polyline class="fl" id="nl-f-${k}" points="${pts(p)}"/><polyline class="fl" id="nl-r-${k}" points="${pts([...p].reverse())}"/>`).join('')}</g>`;
    el.nlSvg.setAttribute('viewBox', `-6 0 ${w + 12} ${h}`); el.nlSvg.innerHTML = s;
    el.nlIntroT.textContent = tpl.intro || '';
    el.nlWave.style.display = tpl.dc ? 'none' : '';
    el.nlCtl.style.display = tpl.dc ? 'none' : '';
    [el.nlA, el.nlAV, el.nlAL].forEach(e => e.style.display = tpl.ctl || tpl.duty ? '' : 'none');
    el.nlQ.style.display = tpl.q4 ? '' : 'none';
    el.nlAL.textContent = tpl.duty ? 'D' : 'α';
    el.nlA.min = tpl.duty ? 5 : 0; el.nlA.max = tpl.duty ? 90 : 180;
    el.nlThL.textContent = tpl.noDeg ? 'thời gian' : 'ωt';
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function hide() { box?.classList.remove('show'); cancelAnimationFrame(raf); raf = 0; }
  const visible = () => box?.classList.contains('show');

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (!tpl) return;
    if (playing && !tpl.dc) theta = md(theta + dt * TAU / speed);
    // tham số điều khiển: α (rad) cho chỉnh lưu/điều áp, {D, q4} cho bộ DC-DC
    const a = tpl.duty ? { D: opt.getDuty() / 100, q4: opt.getQ4() } : opt.getAlpha() / D;
    el.nlTh.value = Math.round(theta * D); el.nlThV.textContent = tpl.noDeg ? Math.round(theta / TAU * 100) + '%' : Math.round(theta * D) + '°';
    const av = tpl.duty ? Math.round(a.D * 100) : Math.round(a * D);
    if ((tpl.ctl || tpl.duty) && document.activeElement !== el.nlA) el.nlA.value = av;
    el.nlAV.textContent = av + (tpl.duty ? ' %' : '°');
    if (tpl.q4) el.nlQ.textContent = a.q4 ? 'Q3-Q4 ON' : 'Q1-Q2 ON';
    const s = tpl.state(theta, a);
    const key = JSON.stringify([s.on, s.pulse, s.paths, s.text]);
    if (key !== lastKey) {
      el.nlSvg.querySelectorAll('.dev').forEach(g => g.classList.toggle('on', s.on.includes(g.id.slice(5))));
      el.nlSvg.querySelectorAll('.gate').forEach(g => g.classList.toggle('p', (s.pulse || []).includes(g.id.slice(5))));
      el.nlSvg.querySelectorAll('.fl').forEach(p => p.style.display = 'none');
      for (const [w, d] of s.paths) { const p = el.nlSvg.querySelector(`#nl-${d > 0 ? 'f' : 'r'}-${w}`); if (p) p.style.display = 'inline'; }
      el.nlText.textContent = s.text;
    }
    for (const [id, v] of Object.entries(s.glow || {})) { const g = el.nlSvg.querySelector(`#nl-d-${id} .glow`); if (g) g.style.opacity = (0.85 * Math.min(1, Math.abs(v))).toFixed(2); }
    if (!tpl.dc) drawWave(a);
    lastKey = key;
  }

  function drawWave(a) {
    const c = el.nlWave, dpr = Math.min(devicePixelRatio || 1, 2), W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = 8, R = W - 8, top = 18, bot = H - 16, ev = v => typeof v === 'function' ? v(a) : v, ymin = ev(tpl.ymin ?? -1.15), ymax = ev(tpl.ymax ?? 1.15);
    const X = th => L + (R - L) * th / TAU, Yv = v => bot - (bot - top) * (v - ymin) / (ymax - ymin);
    const NS = 360;
    // vùng dẫn
    if (tpl.cond) { g.fillStyle = '#3ccf7a1c'; let s0 = null; for (let i = 0; i <= NS; i++) { const th = i / NS * TAU, on = i < NS && tpl.cond(th, a); if (on && s0 === null) s0 = th; if (!on && s0 !== null) { g.fillRect(X(s0), top, X(th) - X(s0), bot - top); s0 = null; } } }
    // lưới
    g.strokeStyle = '#ffffff26'; g.lineWidth = 1; g.beginPath();
    for (let k = 0; k <= 4; k++) { const x = X(k * PI / 2); g.moveTo(x, top); g.lineTo(x, bot); }
    g.moveTo(L, Yv(0)); g.lineTo(R, Yv(0)); g.stroke();
    g.fillStyle = '#a5bde3'; g.font = '10px Segoe UI, Arial';
    if (tpl.noDeg) g.fillText(tpl.xlabel || 'thời gian →', R - 70, H - 4);
    else ['0', '90°', '180°', '270°', '360°'].forEach((t, k) => g.fillText(t, Math.min(R - 22, X(k * PI / 2) + 2), H - 4));
    if (tpl.ctl) { g.strokeStyle = '#ff5bd155'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(a), top); g.lineTo(X(a), bot); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff9be6'; g.fillText('α', X(a) + 3, top + 9); }
    if (tpl.duty) { g.strokeStyle = '#ff5bd155'; g.setLineDash([3, 3]); g.beginPath(); for (const k of [0, 1]) { g.moveTo(X((k + a.D) * PI), top); g.lineTo(X((k + a.D) * PI), bot); } g.stroke(); g.setLineDash([]); g.fillStyle = '#ff9be6'; g.fillText('D·T', X(a.D * PI) + 3, bot - 4); }
    // đường cong
    let lx = L + 2;
    for (const cv of tpl.curves || []) {
      g.strokeStyle = cv.color; g.lineWidth = cv.w || 1.5; g.setLineDash(cv.dash || []); g.beginPath();
      for (let i = 0; i <= NS; i++) { const th = i / NS * TAU, v = cv.f(th, a), y = Yv(cv.base !== undefined ? cv.base + v * (cv.h ?? 0.3) : v), x = X(th); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.setLineDash([]);
      g.fillStyle = cv.color; g.font = '11px Segoe UI, Arial'; g.fillText(cv.name, lx, 12); lx += g.measureText(cv.name).width + 12;
    }
    // con trỏ
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(theta), top - 4); g.lineTo(X(theta), bot); g.stroke();
  }

  window.NguyenLy = { mount, show, hide, has, visible, togglePlay: () => setPlay(!playing) };
})();
