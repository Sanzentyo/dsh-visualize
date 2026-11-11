/**
 * dsh-visualize — browser half.
 *
 * Registers a `tool.call.toolview` entry for the `visualize` tool. The Tool
 * layer renders a registered view in place of the generic result row, so the
 * visualization appears exactly where the call sits in the conversation —
 * on desktop and on the phone layout alike, because both render the same
 * `conversation.chat.node` seat.
 *
 * The fragment runs in an iframe with `sandbox="allow-scripts"` and no
 * `allow-same-origin`, so it cannot reach the host document, its cookies, or
 * its storage. Every colour it uses is a `--dsw-alias-*` value copied in from
 * the host, plus a series palette this plugin owns, so a visualization follows
 * the light/dark switch without knowing it exists.
 */
window.__ModuleLoader__.load({
  id: 'dsh-visualize',
  factory(require) {
    const React = require('react')

    /**
     * Safari on iOS では JS から haptic を直接起こせない(navigator.vibrate
     * 非対応)。Safari 17.4 の switch 入力はトグル時に haptic を鳴らすので、
     * 長押しの成立時にその trusted click を起こす。
     * tijn.dev/projects/ios-haptics と同じ方式のインライン実装。
     */
    let hapticSwitch = null
    function hapticTrigger(element) {
      if (element === null || element === undefined || typeof window === 'undefined') return
      if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return
      if (element.querySelector(':scope > [data-haptic-trigger]') !== null) return
      const labelEl = document.createElement('label')
      labelEl.setAttribute('data-haptic-trigger', '')
      labelEl.setAttribute('aria-hidden', 'true')
      Object.assign(labelEl.style, {
        position: 'absolute', inset: '0', pointerEvents: 'none', touchAction: 'manipulation',
      })
      labelEl.style.setProperty('-webkit-tap-highlight-color', 'transparent')
      // スイッチは指の下に置かない: WebKit はその touchstart を handled にし、
      // スクロールを止める。1x1 で隠し、trusted click だけを起こす。
      hapticSwitch = document.createElement('input')
      hapticSwitch.type = 'checkbox'
      hapticSwitch.setAttribute('switch', '')
      Object.assign(hapticSwitch.style, {
        position: 'absolute', width: '1px', height: '1px', margin: '0', visibility: 'hidden',
      })
      hapticSwitch.addEventListener('click', event => event.stopPropagation())
      labelEl.append(hapticSwitch)
      if (getComputedStyle(element).position === 'static') element.style.position = 'relative'
      element.insertAdjacentElement('beforeend', labelEl)
    }
    /** 長押しの成立: スイッチの trusted click で Safari の haptic を鳴らす。 */
    function hapticPulse() {
      // Android は素の Vibration API で鳴らす(iOS は無視される)。
      if (typeof navigator.vibrate === 'function' && !/iP(hone|ad|od)/.test(navigator.userAgent)) {
        navigator.vibrate(10)
        return
      }
      if (hapticSwitch === null) return
      hapticSwitch.click()
    }
    const h = React.createElement

    /**
     * The frame's stylesheet and script runtime, vendored from the Harness.
     *
     * These are the exact strings the markdown fence injects, so a fragment
     * behaves the same whether a fence or this tool card drew it. They are
     * generated into this file rather than required from
     * `@deepseek-ai/dsh-client-ui-primitives`: the tool card must work whatever
     * web bundle the browser has loaded, and a bundle that predates the export
     * used to make the runtime `undefined` — the static HTML rendered and every
     * JS-drawn chart silently disappeared.
     *
     * Regenerate with `node scripts/sync-runtime.mjs` after editing
     * `packages/client/ui-primitives/src/markdown/visualize-runtime.ts`.
     */
    // <generated:frame-runtime>
    // Vendored from deepseek-harness@7db36e7445 (D:\git\deepseek-harness\packages\client\ui-primitives\src\markdown\visualize-runtime.ts).
    // Regenerate with `node scripts/sync-runtime.mjs` — do not edit by hand.
    const FRAME_CSS = `
html, body { margin: 0; background: transparent; }
body {
  color: var(--vz-text);
  font-family: var(--vz-font, system-ui, sans-serif);
  font-size: var(--vz-font-size, 14px);
  line-height: 1.625;
  /* No outer padding and no default margins, so the visual reads as part of
     the message rather than a box inside it. A fragment adds spacing itself
     with .viz-stack or calc(var(--vz-font-size) * N). */
  padding: 0;
  margin: 0;
  -webkit-text-size-adjust: 100%;
  font-variant-numeric: tabular-nums;
}
h1, h2, h3, h4, p { margin: 0; font-weight: 500; letter-spacing: -.005em; }
h1 { font-size: 1.35em; line-height: 1.33; }
h2 { font-size: 1.15em; line-height: 1.4; }
h3, h4 { font-size: 1em; line-height: 1.5; }
/* One gap between blocks, applied once. */
.viz-stack > * + * { margin-top: calc(var(--vz-font-size, 14px) * 1); }
.viz-stack > h1 + *, .viz-stack > h2 + *, .viz-stack > h3 + * { margin-top: calc(var(--vz-font-size, 14px) * .5); }
a { color: var(--vz-accent); text-decoration: none; }
/* SVG の文字も本文のフォントを継承させる(--vz-font の上書きが効く)。 */
svg text { font-family: var(--vz-font, system-ui, sans-serif); }
a:hover { text-decoration: underline; }
code, pre { font-family: var(--vz-font-code, ui-monospace, monospace); }
svg { display: block; max-width: 100%; height: auto; }
/* Marks move to their new values when a chart is updated. The class arrives one
   frame after the first paint, so nothing animates on appearance, and a reader
   who asked for less motion gets a direct swap. */
svg.vz-animate rect, svg.vz-animate circle, svg.vz-animate path.vz-mark {
  transition: x .18s ease, y .18s ease, width .18s ease, height .18s ease,
              cx .18s ease, cy .18s ease, opacity .18s ease;
}
@media (prefers-reduced-motion: reduce) {
  svg.vz-animate rect, svg.vz-animate circle, svg.vz-animate path.vz-mark {
    transition: none;
  }
}

/* ── surfaces ─────────────────────────────────────────────────────────── */
/* Inner blocks are .panel, deliberately not .card: the tool argument
 * card:true names the OUTER frame (border + background + body padding),
 * and one word for both made a melted visualization with block-like inner
 * panels impossible to express or document. */
.panel {
  background: var(--vz-surface);
  border-radius: 10px;
  padding: 12px 14px;
}
.viz-stat { display: block; }
.viz-stat-value { font-size: 1.5em; font-weight: 500; line-height: 1.2; }
.viz-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.viz-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.viz-badge {
  display: inline-block; padding: 1px 8px; border-radius: 999px;
  background: var(--vz-surface); color: var(--vz-dim); font-size: .85em;
}
hr { border: 0; border-top: 1px solid var(--vz-border); margin: 12px 0; }

/* ── controls ─────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 5px 12px; min-height: 28px; border-radius: 7px;
  border: 1px solid var(--vz-border); background: transparent;
  color: var(--vz-text); font: inherit; font-size: .92em; cursor: pointer;
  transition: background .12s, border-color .12s;
}
.btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-accent); }
.btn:disabled { opacity: .5; cursor: default; }
.btn-primary { background: var(--vz-accent); border-color: var(--vz-accent); color: var(--vz-accent-contrast, #fff); }
.btn-primary:hover:not(:disabled) { opacity: .88; background: var(--vz-accent); }
.btn-ghost { border-color: transparent; }
.btn-block { width: 100%; }
.form-label { display: block; font-size: .85em; color: var(--vz-dim); margin-bottom: 3px; }
.form-control, .form-select {
  width: 100%; padding: 5px 9px; min-height: 28px; border-radius: 7px;
  border: 1px solid var(--vz-border); background: var(--vz-surface);
  color: var(--vz-text); font: inherit; font-size: .92em;
}
.form-range { width: 100%; accent-color: var(--vz-accent); }
.form-check { display: flex; align-items: center; gap: 6px; font-size: .92em; cursor: pointer; }
.form-check-input { accent-color: var(--vz-accent); }

/* ── tabs ─────────────────────────────────────────────────────────────── */
.nav-pills { display: flex; gap: 4px; flex-wrap: wrap; }
.nav-link {
  padding: 4px 12px; border-radius: 7px; border: 1px solid transparent;
  background: transparent; color: var(--vz-dim); font: inherit; font-size: .9em; cursor: pointer;
}
.nav-link:hover { background: var(--dsw-alias-interactive-bg-hover-accent); }
.nav-link.active { background: var(--vz-surface); color: var(--vz-text); border-color: var(--vz-border); }

/* ── tables ───────────────────────────────────────────────────────────── */
.table { border-collapse: collapse; width: 100%; font-size: .92em; }
.table th, .table td { padding: 4px 10px; border-bottom: 1px solid var(--vz-border); text-align: right; }
.table th { color: var(--vz-dim); font-weight: 500; }
.table th:first-child, .table td:first-child { text-align: left; }
.table tr:last-child td { border-bottom: 0; }
.table-sm th, .table-sm td { padding: 2px 8px; }
.table-responsive { overflow-x: auto; }

/* ── text ─────────────────────────────────────────────────────────────── */
.muted, .text-muted { color: var(--vz-dim); }
.text-small { font-size: .86em; }
.text-destructive { color: var(--dsw-alias-state-error-primary); }
.text-end { text-align: right; }
.text-center { text-align: center; }
.text-nowrap { white-space: nowrap; }
.tabular-nums { font-variant-numeric: tabular-nums; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ── tooltip (the runtime creates these) ──────────────────────────────── */
.vz-tooltip {
  position: fixed; z-index: 2147483647; max-width: 260px;
  padding: 5px 9px; border-radius: 7px; pointer-events: none;
  background: var(--vz-surface); color: var(--vz-text);
  border: 1px solid var(--vz-border); font-size: .86em; line-height: 1.4;
  box-shadow: 0 4px 14px rgb(0 0 0 / .18);
}

/* ── frame menu (the runtime creates these) ───────────────────────────── */
/* メニューの色は内容の上書き(--vz-*)から独立している。読者が本文の色を
   変えてもメニューは読めるままにするため、専用トークン --vzm-* を持つ。
   既定値は下の :root でテーマの値から一度だけ写す。 */
:root {
  --vzm-surface: var(--vz-surface);
  --vzm-text: var(--vz-text);
  --vzm-dim: var(--vz-dim);
  --vzm-border: var(--vz-border);
  --vzm-accent: var(--vz-accent);
}

/* 常在しない。操作で出す: ホバーのある環境はボタン自身(右上の 30px 程度)の
   hover で出る。タッチは長押し(500ms)。閉じたら 1 秒だけ見せて消す。
   色はテーマのトークン(var(--vz-*))を継承する — 上書きは .vz-content だけに
   効くので、メニューはホストのパレットに追従しつつ誤設定から隔離される。
   パネルはボタンから折り畳みアニメーション(scale + opacity)で展開する。 */
.vz-menu-btn {
  position: absolute; z-index: 2147483647;
  width: 30px; height: 30px;
  border-radius: 7px; border: 1px solid var(--vzm-border);
  background: var(--vzm-surface); color: var(--vzm-dim);
  cursor: pointer; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity .18s ease, border-color .16s ease;
}
/* vz-menu-closing は閉じた直後の 1 秒: タップが hover 状態を残す環境でも
   1 秒かけて確実にフェードアウトする(hover より優先)。 */
.vz-menu-btn:hover:not(.vz-menu-closing), .vz-menu-btn.vz-menu-open { opacity: 1; }
/* 開いている間はパネルと一体化: 境界を消して同じ面に見せる。 */
.vz-menu-btn.vz-menu-open { border-color: transparent; }
.vz-menu-btn.vz-menu-closing { opacity: 0; pointer-events: none; transition: opacity 1s ease; }
.vz-menu-btn.vz-menu-open { opacity: 1; pointer-events: auto; }
.vz-menu-btn.vz-menu-touch { display: none; }
.vz-menu-btn.vz-menu-touch.vz-menu-open { display: inline-flex; }
.vz-menu-btn.vz-menu-top-right { top: 4px; right: 4px; }
.vz-menu-btn.vz-menu-top-left { top: 4px; left: 4px; }
.vz-menu-btn.vz-menu-bottom-right { bottom: 4px; right: 4px; }
.vz-menu-btn.vz-menu-bottom-left { bottom: 4px; left: 4px; }
.vz-menu-panel {
  position: absolute; z-index: 2147483646;
  /* 幅は領域に収め、高さは領域の 70% で頭打ちにして中でスクロールさせる。
     領域が低いときにパネルがはみ出して切れるのを防ぐ。 */
  min-width: 220px; max-width: min(300px, calc(100% - 8px));
  max-height: min(70vh, calc(100% - 8px)); overflow-y: auto; overscroll-behavior: contain;
  /* border-box でないと max-height が padding を含まず、領域より高くなる。 */
  box-sizing: border-box;
  /* 上端はボタンと揃える: ハンバーガーがパネルの右上コーナーに内蔵され、
     一体のヘッダー行になる。内容はボタンの行(30px)の下から始める。 */
  padding: 4px 12px 10px 12px;
  border-radius: 10px;
  background: var(--vzm-surface); color: var(--vzm-text);
  border: 1px solid var(--vzm-border);
  box-shadow: 0 8px 24px rgb(0 0 0 / .25);
  font-size: 13px;
  /* ボタンから折り畳みアニメーションで展開する。 */
  transform: scale(.94); opacity: 0; pointer-events: none;
  transition: transform .16s ease, opacity .16s ease;
}
.vz-menu-panel.vz-menu-open {
  transform: scale(1); opacity: 1; pointer-events: auto;
}
/* 下側の位置では下端起点で上へ展開する(ボタンの行は下端に来る)。 */
.vz-menu-panel.vz-menu-bottom-right, .vz-menu-panel.vz-menu-bottom-left {
  padding: 10px 12px 4px 12px;
}
/* 位置は四隅。パネルはボタンと同じ上端に置き、ハンバーガーを右上に内蔵する。
   内容はボタンの行(30px)を避けるため、内容側の先頭に余白を置く。
   下側の位置では下端起点で上へ展開する。 */
.vz-menu-panel.vz-menu-top-right { top: 4px; right: 4px; transform-origin: top right; }
.vz-menu-panel.vz-menu-top-left { top: 4px; left: 4px; transform-origin: top left; }
.vz-menu-panel.vz-menu-bottom-right { top: auto; bottom: 4px; right: 4px; transform-origin: bottom right; }
.vz-menu-panel.vz-menu-bottom-left { top: auto; bottom: 4px; left: 4px; transform-origin: bottom left; }
/* 内容の器: 先頭にボタンの行ぶん(30px)の余白を確保する。 */
.vz-menu-content { padding-top: 30px; }
.vz-menu-content-bottom { padding-top: 0; padding-bottom: 30px; }
.vz-menu-h {
  padding: 8px 0 4px; margin: 0;
  border-top: 1px solid var(--vzm-border);
  color: var(--vzm-text); font-size: .88em; font-weight: 600; letter-spacing: .02em;
}
.vz-menu-h:first-of-type { border-top: 0; }
.vz-menu-body { padding: 0 0 6px 0; }
.vz-menu-panel > .vz-menu-h:first-child, .vz-menu-content > .vz-menu-h:first-child { margin-top: 0; }
.vz-menu-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; flex-wrap: wrap; }
.vz-menu-label { flex: 1 1 auto; color: var(--vzm-dim); font-size: .92em; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.vz-menu-check { display: flex; align-items: center; gap: 6px; font-size: .92em; cursor: pointer; }
.vz-menu-panel .btn { min-height: 36px; padding: 4px 10px; font-size: .9em; }
/* COPY ⇄ DL のスイッチ: ネイティブ checkbox をスイッチ風に描く。 */
.vz-switch {
  appearance: none; -webkit-appearance: none;
  flex: 0 0 auto; width: 38px; height: 22px; margin: 0;
  border-radius: 999px; border: 1px solid var(--vzm-border);
  background: var(--vzm-border); position: relative; cursor: pointer;
  transition: background .16s ease;
}
.vz-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--vzm-surface); transition: transform .16s ease;
}
.vz-switch:checked { background: var(--vzm-accent); border-color: var(--vzm-accent); }
.vz-switch:checked::after { transform: translateX(16px); }
/* 長押しの間だけ本文の選択・コールアウトを抑止する(指を離すと解除)。 */
body.vz-longpress, body.vz-longpress * {
  -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none;
}`
    const FRAME_RUNTIME = `
(function () {
  var tip = null;
  function hide() { if (tip !== null) { tip.remove(); tip = null; } }
  function show(target) {
    var text = target.getAttribute('data-tooltip');
    if (!text) return;
    hide();
    tip = document.createElement('div');
    tip.className = 'vz-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    var r = target.getBoundingClientRect();
    var t = tip.getBoundingClientRect();
    var place = target.getAttribute('data-tooltip-placement') || 'top';
    var x = r.left + r.width / 2 - t.width / 2;
    var y = place === 'bottom' ? r.bottom + 6 : place === 'left' ? r.top + r.height / 2 - t.height / 2 : place === 'right' ? r.top + r.height / 2 - t.height / 2 : r.top - t.height - 6;
    if (place === 'left') x = r.left - t.width - 6;
    if (place === 'right') x = r.right + 6;
    tip.style.left = Math.max(4, Math.min(x, innerWidth - t.width - 4)) + 'px';
    tip.style.top = Math.max(4, Math.min(y, innerHeight - t.height - 4)) + 'px';
  }
  document.addEventListener('pointerover', function (e) {
    var t = e.target.closest && e.target.closest('[data-tooltip]');
    if (t) show(t);
  });
  document.addEventListener('pointerout', function (e) {
    var t = e.target.closest && e.target.closest('[data-tooltip]');
    if (t) hide();
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest && e.target.closest('[data-tooltip]');
    if (t) show(t);
  });
  document.addEventListener('focusout', hide);
  addEventListener('scroll', hide, true);

  function activate(list, tab) {
    var panels = [];
    list.querySelectorAll('[role="tab"]').forEach(function (b) {
      var on = b === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      var id = b.getAttribute('aria-controls');
      if (id) { var p = document.getElementById(id); if (p) { p.hidden = !on; panels.push(p); } }
    });
  }
  // Delegated, because this script runs before the fragment is parsed: a
  // querySelectorAll here would find nothing and the tabs would stay dead.
  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab || tab.disabled) return;
    var list = tab.closest('[role="tablist"]');
    if (list) activate(list, tab);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var tab = document.activeElement;
    if (!tab || tab.getAttribute('role') !== 'tab') return;
    var list = tab.closest('[role="tablist"]');
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(tab);
    if (i < 0) return;
    e.preventDefault();
    var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    activate(list, next);
  });

  // ── fit-to-width ──
  // 既定はスクロールなし。内容がフレームより横に広いとき、全体が見えるように
  // 縮小(zoom)する。window.__dshVizScroll が 'x' | 'y' | 'both' のときはその軸の
  // スクロールを許して縮小しない(横長の表や縦長のログなど、意図的な長さの明示指定)。
  // data-viz-zoom は読者の拡大率(メニューのスライダー)で、フィット縮小に乗算される。
  function fit() {
    var root = document.documentElement;
    var scroll = window.__dshVizScroll || 'none';
    var userZoom = Number(root.getAttribute('data-viz-zoom')) || 1;
    if (scroll === 'x' || scroll === 'both') root.style.overflowX = 'auto';
    if (scroll === 'y' || scroll === 'both') root.style.overflowY = 'auto';
    if (scroll !== 'none') { wrapper().style.zoom = String(userZoom); return; }
    root.style.overflow = 'hidden';
    var zoom = 1;
    for (var pass = 0; pass < 3; pass++) {
      var wide = root.scrollWidth;
      var avail = root.clientWidth;
      if (wide <= avail + 1) break;
      zoom = zoom * (avail / wide);
      if (zoom < 0.05) zoom = 0.05;
      wrapper().style.zoom = String(zoom * userZoom);
    }
    if (zoom === 1 && userZoom !== 1) wrapper().style.zoom = String(userZoom);
  }
  // 内容とメニューを分離する: 断片の全子要素を .vz-content に集め、メニューの
  // UI(ボタン/パネル)は body 直下に残す。拡大率・色の上書きは .vz-content だけに
  // 効き、誤設定でもメニューは壊れない(リセットで戻せる)。
  function wrapper() {
    var found = document.querySelector('.vz-content');
    if (found === null) {
      found = document.createElement('div');
      found.className = 'vz-content';
      document.body.appendChild(found);
    }
    return found;
  }
  document.addEventListener('DOMContentLoaded', function () {
    var body = document.body;
    var menuBtn = document.querySelector('.vz-menu-btn');
    var menuPanel = document.querySelector('.vz-menu-panel');
    var kids = Array.prototype.slice.call(body.children);
    var target = wrapper();
    kids.forEach(function (kid) {
      // メニュー UI は内容の外に残す(内容を隠しても操作できる)。
      if (kid === menuBtn || kid === menuPanel) return;
      target.appendChild(kid);
    });
  });
  // The fragment's scripts run during parse, so the content exists by
  // DOMContentLoaded; fonts and images may still shift the layout, so the
  // load and a delayed pass re-measure.
  /** fit の後に全チャートへ再計測を促す(描画幅のずれを直す)。 */
  function refitCharts() {
    var charts = (window.viz && window.viz._charts) || [];
    charts.forEach(function (c) {
      if (c && typeof c.update === 'function' && c.config !== undefined) c.update(c.config);
    });
  }
  document.addEventListener('DOMContentLoaded', function () { fit(); refitCharts(); });
  addEventListener('load', function () { fit(); refitCharts(); });
  setTimeout(function () { fit(); refitCharts(); }, 150);

  // ── frame menu ──
  // 既定 ON: 折りたたまれたハンバーガーが領域内の右上に出る(absolute — 領域の中)。
  // html 要素の data-viz-controls="off" で消え、data-viz-controls-position で
  // 四隅へ移動できる。メニュー: 表示切替(グラフ/表)、コピー(CSV/TSV/Markdown)、
  // ダウンロード、拡大率、色、スクロール。選択は viz.state で保持され、再描画で復元。
  // 出現: ホバー環境はボタン自身の hover、タッチは長押し(500ms)。閉じたら
  // ボタンを 1 秒だけ見せて消す。パネルはボタンから折り畳みアニメーションで展開。
  (function menu() {
    var root = document.documentElement;
    if (root.getAttribute('data-viz-controls') === 'off') return;
    // 親ページがメニューを持つ場合(サンドボックスでは trusted な操作が
    // 作れず haptic が鳴らない)、フレーム側のメニューは作らない。
    // ただし畳みカードと選択モードはフレーム内の操作なので残す。
    if (window.__dshVizMenuHosted === true) { installHostedCommands(); return; }
    var pos = root.getAttribute('data-viz-controls-position') || 'top-right';
    var coarse = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { /* no matchMedia */ }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vz-menu-btn vz-menu-' + pos + (coarse ? ' vz-menu-touch' : '');
    btn.setAttribute('aria-label', '表示メニュー');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">'
      + '<path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'vz-menu-panel vz-menu-' + pos;
    // パネルの内容だけを build() が差し替える(閉じるボタンは廃止: ハンバーガーがトグル)。
    var content = document.createElement('div');
    // 先頭の余白はボタンの行(30px)を確保する。下側の位置では下端へ回す。
    content.className = pos === 'bottom-right' || pos === 'bottom-left'
      ? 'vz-menu-content-bottom'
      : 'vz-menu-content';
    panel.appendChild(content);

    // 区画見出し(開閉なし)。パネルは縦にスクロールできる。
    function section(title) {
      var h = document.createElement('div');
      h.className = 'vz-menu-h';
      h.textContent = title;
      content.appendChild(h);
      currentBody = content;
    }
    function row() {
      var r = document.createElement('div');
      r.className = 'vz-menu-row';
      (currentBody || content).appendChild(r);
      return r;
    }
    function button(label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    }
    function charts() { return (window.viz && window.viz._charts) || []; }

    // ── 表示切替: グラフ / 表 ──
    var tableMode = false;
    function renderCharts() {
      charts().forEach(function (c) {
        if (tableMode) renderTable(c);
        else { c.host.textContent = ''; c.update(c.config); }
      });
    }
    function renderTable(c) {
      var config = c.config || {};
      var cols = config.columns || [];
      var rows = config.rows || [];
      var host = c.host;
      host.textContent = '';
      var table = document.createElement('table');
      table.className = 'table table-sm';
      var thead = document.createElement('thead');
      var trh = document.createElement('tr');
      cols.forEach(function (name) {
        var th = document.createElement('th');
        th.textContent = String(name);
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        cols.forEach(function (_, i) {
          var td = document.createElement('td');
          td.textContent = String(r[i]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      host.appendChild(table);
    }
    function tabular(config, sep) {
      var cols = config.columns || [];
      var rows = config.rows || [];
      var cell = function (v) {
        var s = String(v);
        return sep === ',' && s.indexOf(',') >= 0 ? '"' + s + '"' : s;
      };
      // この関数群はテンプレートリテラルの中にいる。改行のエスケープは
      // テンプレート評価で実改行に化け、生成コードのシングルクォート文字列を
      // 壊す(実測: バンドル内で join が改行入りの文字列になり SyntaxError)。
      // 二重エスケープする。
      return [cols.map(cell).join(sep)].concat(rows.map(function (r) {
        return cols.map(function (_, i) { return cell(r[i]); }).join(sep);
      })).join('\\n');
    }
    function toMarkdown(config) {
      var cols = config.columns || [];
      var rows = config.rows || [];
      var head = '| ' + cols.join(' | ') + ' |';
      var rule = '|' + cols.map(function () { return ' --- '; }).join('|') + '|';
      var body = rows.map(function (r) {
        return '| ' + cols.map(function (_, i) { return String(r[i]); }).join(' | ') + ' |';
      }).join('\\n');
      return head + '\\n' + rule + '\\n' + body;
    }

    // ── 状態の保持と復元 ──
    var saved = (window.viz && window.viz.restore) ? (window.viz.restore() || {}) : {};
    var edits = saved.edits || {};

    function report() {
      if (!window.viz || !window.viz.state) return;
      window.viz.state({
        tableMode: tableMode,
        zoom: Number(root.getAttribute('data-viz-zoom')) || 1,
        colors: {
          text: root.style.getPropertyValue('--vz-text') || undefined,
          surface: root.style.getPropertyValue('--vz-surface') || undefined,
          accent: root.style.getPropertyValue('--vz-accent') || undefined,
        },
        scroll: window.__dshVizScroll || 'none',
        edits: edits,
      });
    }

    function closeMenu() {
      // ハンバーガー/外側クリックで閉じる。パネルは折り畳みアニメーションで
      // 閉じ、ボタンは 1 秒かけてフェードアウトする(vz-menu-closing)。
      engaged = false;
      panel.classList.remove('vz-menu-open');
      btn.classList.remove('vz-menu-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.add('vz-menu-closing');
      setTimeout(function () { btn.classList.remove('vz-menu-closing'); }, 1000);
      if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
    }
    function build() {
      content.textContent = '';
      if (charts().length > 0) {
        var viewBody = section('表示');
        var viewRow = row();
        var chartBtn = button(tableMode ? 'グラフ' : 'グラフ ✓', function () {
          tableMode = false;
          renderCharts();
          build();
          report();
        });
        var tableBtn = button(tableMode ? '表 ✓' : '表', function () {
          tableMode = true;
          renderCharts();
          build();
          report();
        });
        viewRow.appendChild(chartBtn);
        viewRow.appendChild(tableBtn);

        if (!tableMode) {
          var exportBody = section('コピー / ダウンロード');
          // 形式のプルダウン + COPY/DL トグル + 実行ボタン 1 つ。
          var FORMATS = [
            ['chart-png', 'グラフ(透過 PNG)'],
            ['frame-png', '画像(PNG 背景付き)'],
            ['frame-jpeg', '画像(JPEG 背景付き)'],
            ['text', 'text'],
            ['html', 'html'],
            ['md', 'md'],
            ['table', '表(TSV)'],
          ];
          var fmtRow = row();
          var fmt = document.createElement('select');
          fmt.className = 'form-select';
          fmt.style.flex = '1';
          FORMATS.forEach(function (f) {
            var opt = document.createElement('option');
            opt.value = f[0];
            opt.textContent = f[1];
            fmt.appendChild(opt);
          });
          fmtRow.appendChild(fmt);
          // グラフ形式のときだけ、対象グラフを選ばせる。
          var targetRow = row();
          var targetSel = document.createElement('select');
          targetSel.className = 'form-select';
          targetSel.style.flex = '1';
          targetRow.appendChild(targetSel);
          function syncTarget() {
            var chartFmt = fmt.value === 'chart-png';
            targetRow.style.display = chartFmt && charts().length > 1 ? 'flex' : 'none';
            if (!chartFmt) return;
            targetSel.textContent = '';
            charts().forEach(function (c, ci) {
              var opt = document.createElement('option');
              opt.value = String(ci);
              opt.textContent = (c.config && c.config.title) || 'グラフ ' + (ci + 1);
              targetSel.appendChild(opt);
            });
          }
          fmt.addEventListener('change', syncTarget);
          syncTarget();
          // COPY ⇄ DL のスイッチ(ネイティブの checkbox をスイッチ風に見せる)。
          var modeRow = row();
          var modeLabel = document.createElement('span');
          modeLabel.className = 'vz-menu-label';
          modeLabel.textContent = 'COPY';
          var modeSwitch = document.createElement('input');
          modeSwitch.type = 'checkbox';
          modeSwitch.className = 'vz-switch';
          modeSwitch.setAttribute('role', 'switch');
          modeSwitch.setAttribute('aria-label', 'COPY と DL の切り替え');
          modeSwitch.addEventListener('change', function () {
            modeLabel.textContent = modeSwitch.checked ? 'DL' : 'COPY';
          });
          modeRow.appendChild(modeLabel);
          modeRow.appendChild(modeSwitch);
          // SVG を canvas に描いて dataURL を作る(背景付きは背景を塗る)。
          function svgToDataUrl(svg, mime, background) {
            var xml = new XMLSerializer().serializeToString(svg);
            var img = new Image();
            return new Promise(function (resolve) {
              img.onload = function () {
                var canvas = document.createElement('canvas');
                var box = svg.getBoundingClientRect();
                canvas.width = Math.max(1, Math.round(box.width));
                canvas.height = Math.max(1, Math.round(box.height));
                var ctx = canvas.getContext('2d');
                if (background !== undefined) {
                  ctx.fillStyle = background;
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL(mime));
              };
              img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
            });
          }
          function slugOf(config) {
            return ((config && config.title) || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          }
          function frameMarkdown() {
            var out = [document.body.innerText];
            charts().forEach(function (c, ci) {
              if (includeInput.checked !== true) return;
              out.push('', '## ' + ((c.config && c.config.title) || 'グラフ ' + (ci + 1)), '', toMarkdown(c.config), '');
            });
            return out.join('\\n');
          }
          function run() {
            var format = fmt.value;
            var mime = 'text/plain';
            var name = 'visualization';
            var done;
            if (format === 'chart-png') {
              var c = charts()[Number(targetSel.value) || 0];
              if (c === undefined) return;
              name = slugOf(c.config) + '.png';
              mime = 'image/png';
              done = svgToDataUrl(c.host.querySelector('svg'), mime, undefined).then(function (url) {
                return { url: url };
              });
            } else if (format === 'frame-png' || format === 'frame-jpeg') {
              var svg = document.querySelector('svg');
              if (svg === null) return;
              mime = format === 'frame-png' ? 'image/png' : 'image/jpeg';
              name = format === 'frame-png' ? 'visualization.png' : 'visualization.jpg';
              var bg = getComputedStyle(document.body).backgroundColor;
              done = svgToDataUrl(svg, mime, bg).then(function (url) { return { url: url }; });
            } else if (format === 'html') {
              mime = 'text/html';
              name = 'visualization.html';
              done = Promise.resolve({ text: '<!doctype html>' + document.documentElement.outerHTML });
            } else if (format === 'md') {
              mime = 'text/markdown';
              name = 'visualization.md';
              done = Promise.resolve({ text: frameMarkdown() });
            } else if (format === 'table') {
              mime = 'text/tab-separated-values';
              name = 'visualization.tsv';
              var first = charts()[Number(targetSel.value) || 0];
              done = Promise.resolve({ text: tabular(first ? first.config : { columns: [], rows: [] }, '\\t') });
            } else {
              name = 'visualization.txt';
              done = Promise.resolve({ text: document.body.innerText });
            }
            done.then(function (out) {
              if (modeSwitch.checked !== true) {
                // コピー: 画像は base64 の羅列ではなく image/png として
                // クリップボードへ置く(親が ClipboardItem で書く)。
                if (out.url !== undefined) {
                  parent.postMessage({ dshVizCopyImage: out.url }, '*');
                } else {
                  parent.postMessage({ dshVizCopy: out.text }, '*');
                }
              } else {
                var url = out.url !== undefined
                  ? out.url
                  : 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(out.text);
                parent.postMessage({ dshVizDownload: { name: name, url: url } }, '*');
              }
            });
          }
          // md にグラフの表を含めるかのチェックボックス。
          var includeRow = row();
          var includeCharts = document.createElement('label');
          includeCharts.className = 'vz-menu-check';
          var includeInput = document.createElement('input');
          includeInput.type = 'checkbox';
          includeInput.checked = true;
          includeCharts.appendChild(includeInput);
          includeCharts.appendChild(document.createTextNode('md にグラフを含む'));
          includeRow.appendChild(includeCharts);
          var goRow = row();
          goRow.appendChild(button('実行', run));
        }
      }

      var zoomBody = section('拡大率');
      var zoomRow = row();
      var zoom = document.createElement('input');
      zoom.type = 'range';
      zoom.min = '50';
      zoom.max = '200';
      zoom.step = '5';
      zoom.value = String(Math.round((Number(root.getAttribute('data-viz-zoom')) || 1) * 100));
      zoom.style.flex = '1';
      var zoomLabel = document.createElement('span');
      zoomLabel.className = 'vz-menu-label';
      zoomLabel.textContent = zoom.value + '%';
      zoom.addEventListener('input', function () {
        root.setAttribute('data-viz-zoom', String(Number(zoom.value) / 100));
        zoomLabel.textContent = zoom.value + '%';
        if (typeof fit === 'function') fit();
        // ズーム後は計測幅が変わるので描き直す(古い幅のままだと棒が崩れる)。
        charts().forEach(function (c) { c.update(c.config, true); });
      });
      zoomRow.appendChild(zoom);
      zoomRow.appendChild(zoomLabel);

      // 文字: フォントファミリ・サイズ・対象の役割。
      var textBody = section('文字');
      var fontState = { family: '', size: 0, role: 'title' };
      var roleRow = row();
      var roleLabel = document.createElement('span');
      roleLabel.className = 'vz-menu-label';
      roleLabel.textContent = '対象';
      var roleSelect = document.createElement('select');
      roleSelect.className = 'form-select';
      roleSelect.style.flex = '1';
      [['title', 'タイトル'], ['label', '軸ラベル'], ['tick', '目盛り'], ['all', 'すべて']].forEach(function (pair) {
        var option = document.createElement('option');
        option.value = pair[0];
        option.textContent = pair[1];
        if (fontState.role === pair[0]) option.selected = true;
        roleSelect.appendChild(option);
      });
      roleSelect.addEventListener('change', function () { fontState.role = roleSelect.value; });
      roleRow.appendChild(roleLabel);
      roleRow.appendChild(roleSelect);

      var fontRow = row();
      var fontLabel = document.createElement('span');
      fontLabel.className = 'vz-menu-label';
      fontLabel.textContent = 'フォント';
      var fontSelect = document.createElement('select');
      fontSelect.className = 'form-select';
      fontSelect.style.flex = '1';
      [['', '既定'], ['system-ui, sans-serif', 'システム'], ['"Hiragino Kaku Gothic ProN", sans-serif', 'ヒラギノ'],
        ['ui-monospace, monospace', '等幅'], ['serif', 'セリフ']].forEach(function (pair) {
        var option = document.createElement('option');
        option.value = pair[0];
        option.textContent = pair[1];
        fontSelect.appendChild(option);
      });
      fontSelect.addEventListener('change', function () {
        fontState.family = fontSelect.value;
        applyFont();
      });
      fontRow.appendChild(fontLabel);
      fontRow.appendChild(fontSelect);

      var sizeRow = row();
      var sizeInput = document.createElement('input');
      sizeInput.type = 'range';
      sizeInput.min = '8';
      sizeInput.max = '28';
      sizeInput.step = '1';
      sizeInput.value = '12';
      sizeInput.style.flex = '1';
      var sizeValue = document.createElement('span');
      sizeValue.className = 'vz-menu-label';
      sizeValue.textContent = '12px';
      sizeInput.addEventListener('input', function () {
        fontState.size = Number(sizeInput.value);
        sizeValue.textContent = fontState.size + 'px';
        applyFont();
      });
      sizeRow.appendChild(sizeInput);
      sizeRow.appendChild(sizeValue);

      /** 文字の上書きを適用し、全チャートを再描画する。 */
      function applyFont() {
        if (fontState.family !== '') root.style.setProperty('--vz-font', fontState.family);
        if (fontState.size > 0) {
          var roles = fontState.role === 'all' ? ['title', 'label', 'tick'] : [fontState.role];
          if (fontState.role === 'all') root.style.setProperty('--vz-font-size', fontState.size + 'px');
          roles.forEach(function (role) {
            root.style.setProperty('--vz-font-' + role, fontState.size + 'px');
          });
        }
        charts().forEach(function (c) { c.update(c.config, true); });
        report();
      }

      var colorBody = section('色');
      // 要素別。既定は「対象なし」で何も出さない。選ぶとその項目の色入力が出る。
      var COLOR_TARGETS = [
        ['title', 'タイトル文字', '--vz-title'],
        ['axis', '軸ラベル', '--vz-axis'],
        ['tick', '目盛り', '--vz-tick'],
        ['legend', '凡例', '--vz-legend'],
        ['text', '本文', '--vz-text'],
        ['dim', '補助文字', '--vz-dim'],
        ['surface', '面', '--vz-surface'],
        ['accent', '強調', '--vz-accent'],
        ['border', '枠線', '--vz-border'],
      ];
      var colorTargetRow = row();
      var colorTargetLabel = document.createElement('span');
      colorTargetLabel.className = 'vz-menu-label';
      colorTargetLabel.textContent = '対象';
      var colorTarget = document.createElement('select');
      colorTarget.className = 'form-select';
      colorTarget.style.flex = '1';
      var noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = '対象なし';
      colorTarget.appendChild(noneOption);
      COLOR_TARGETS.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item[0];
        option.textContent = item[1];
        colorTarget.appendChild(option);
      });
      colorTargetRow.appendChild(colorTargetLabel);
      colorTargetRow.appendChild(colorTarget);

      // 選んだ項目の色入力。対象なしのときは行ごと隠す。
      var colorValueRow = row();
      colorValueRow.style.display = 'none';
      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = '#000000';
      colorValueRow.appendChild(colorInput);

      colorTarget.addEventListener('change', function () {
        var selected = COLOR_TARGETS.filter(function (item) { return item[0] === colorTarget.value; })[0];
        if (selected === undefined) {
          colorValueRow.style.display = 'none';
          return;
        }
        colorValueRow.style.display = '';
        colorInput.value = cssVarColor(selected[2]);
        colorInput.setAttribute('data-token', selected[2]);
      });
      colorInput.addEventListener('input', function () {
        var token = colorInput.getAttribute('data-token');
        if (token === null) return;
        root.style.setProperty(token, colorInput.value);
        charts().forEach(function (c) { c.update(c.config, true); });
        report();
      });

      /** 現在の実効色(未設定なら既定のトークン値)。 */
      function cssVarColor(token) {
        var value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
        if (value !== '' && /^#/.test(value)) return value;
        var fallback = token === '--vz-title' || token === '--vz-text' ? '#e8e8e8'
          : token === '--vz-tick' || token === '--vz-dim' || token === '--vz-axis' ? '#9a9a9a'
            : '#000000';
        return fallback;
      }

      var resetBody = section('リセット');
      var resetRow = row();
      resetRow.appendChild(button('デフォルトに戻す', function () {
        // 誤設定からの復帰: 拡大率・色・スクロール・表示モードを既定へ。
        root.removeAttribute('data-viz-zoom');
        root.style.removeProperty('--vz-text');
        root.style.removeProperty('--vz-dim');
        root.style.removeProperty('--vz-surface');
        root.style.removeProperty('--vz-accent');
        root.style.removeProperty('--vz-border');
        root.style.removeProperty('--vz-font');
        root.style.removeProperty('--vz-font-size');
        root.style.removeProperty('--vz-font-title');
        root.style.removeProperty('--vz-font-label');
        root.style.removeProperty('--vz-font-tick');
        window.__dshVizScroll = 'none';
        tableMode = false;
        if (typeof fit === 'function') fit();
        renderCharts();
        build();
        report();
      }));

      var scrollBody = section('スクロール');
      var scrollRow = row();
      var select = document.createElement('select');
      select.className = 'form-select';
      ['none', 'x', 'y', 'both'].forEach(function (mode) {
        var opt = document.createElement('option');
        opt.value = mode;
        opt.textContent = mode;
        if ((window.__dshVizScroll || 'none') === mode) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', function () {
        window.__dshVizScroll = select.value;
        if (typeof fit === 'function') fit();
        report();
      });
      scrollRow.appendChild(select);
    }

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // 領域内に置く: body を位置の基準にする。
    if (document.body.style.position !== 'absolute') document.body.style.position = 'relative';

    function isOpen() { return panel.classList.contains('vz-menu-open'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen()) { closeMenu(); return; }
      engaged = false;
      panel.classList.add('vz-menu-open');
      btn.setAttribute('aria-expanded', 'true');
      build();
      armHide();
    });
    document.addEventListener('click', function (e) {
      if (!isOpen()) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      closeMenu();
    });

    // ── タッチ: 長押しで出す ──
    // pointerdown の 500ms 保持でハンバーガーを出し、4 秒操作がなければ引っ込める。
    // ただしメニュー内で一度でも操作したら(スクロール含む)**外をクリックするまで
    // 開いたまま**にする。ダブルクリック編集(data-editable)とは分けるため、
    // タッチの出現は長押しのみ。
    var hideTimer = null;
    var engaged = false;
    function armHide() {
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (engaged) return;
        closeMenu();
      }, 4000);
    }
    function engage() {
      // メニュー内での操作: 自動で閉じるのをやめる。
      engaged = true;
      if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
    }
    panel.addEventListener('pointerdown', engage, { passive: true });
    panel.addEventListener('scroll', engage, { passive: true });
    panel.addEventListener('input', engage, { passive: true });
    panel.addEventListener('change', engage, { passive: true });
    // ── haptics(内製。外部 JS に依存しない) ──
    // Safari は switch 入力をトグルした瞬間にハプティクスを鳴らす。要求された
    // duration に応じて数回トグルし、navigator.vibrate を内部で用意する。
    // Android など本物の navigator.vibrate がある環境はそのまま使う。
    var hapticSwitch = null;
    function installHaptics() {
      if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return;
      if (document.querySelector('[data-haptic-trigger]') !== null) return;
      var label = document.createElement('label');
      label.setAttribute('data-haptic-trigger', '');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:absolute;inset:0;pointer-events:none;touch-action:manipulation';
      hapticSwitch = document.createElement('input');
      hapticSwitch.type = 'checkbox';
      hapticSwitch.setAttribute('switch', '');
      hapticSwitch.style.cssText = 'position:absolute;width:1px;height:1px;margin:0;visibility:hidden';
      hapticSwitch.addEventListener('click', function (e) { e.stopPropagation(); });
      label.appendChild(hapticSwitch);
      document.body.appendChild(label);
      if (typeof navigator.vibrate !== 'function') {
        navigator.vibrate = function (pattern) {
          var ms = typeof pattern === 'number' ? pattern : 40;
          var beats = Math.max(1, Math.min(6, Math.round(ms / 18)));
          for (var i = 0; i < beats; i++) {
            setTimeout(function () {
              if (hapticSwitch !== null) hapticSwitch.click();
            }, i * 22);
          }
          return true;
        };
      }
    }
    function hapticPulse(ms) {
      try { navigator.vibrate(ms === undefined ? 20 : ms); } catch (e) { /* no vibration */ }
    }
    function openMenu() {
      engaged = false;
      panel.classList.add('vz-menu-open');
      btn.classList.add('vz-menu-open');
      btn.setAttribute('aria-expanded', 'true');
      build();
      armHide();
    }
    // ── タッチ: 長押しでメニューを表示する ──
    // スワイプは扱わない(誤動作が多く、畳みや選択モードは撤回した)。
    if (coarse) {
      installHaptics();
      var HOLD_MS = 500;
      var holdTimer = null;
      var tracking = false;
      var suppress = function (on) { document.body.classList.toggle('vz-longpress', on); };
      function cancelHold() {
        tracking = false;
        suppress(false);
        if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
      }
      document.addEventListener('touchstart', function (e) {
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        var t = e.touches[0];
        if (t === undefined) return;
        tracking = true;
        suppress(true);
        if (holdTimer !== null) clearTimeout(holdTimer);
        holdTimer = setTimeout(function () {
          holdTimer = null;
          // 長押しの成立: メニューを開く(haptic も鳴らす)。
          openMenu();
          hapticPulse(20);
        }, HOLD_MS);
      }, { passive: true });
      // 指が大きく動いたら長押しを取り消す(スクロールと区別する)。
      document.addEventListener('touchmove', function (e) {
        if (!tracking) return;
        if (e.touches.length !== 1) { cancelHold(); return; }
        cancelHold();
      }, { passive: true });
      document.addEventListener('touchend', cancelHold, { passive: true });
      document.addEventListener('touchcancel', cancelHold, { passive: true });
    }
    // ── インライン編集(data-editable) ──
    // 原本は保持し、上書きは edits として state に保存、表示は上書き優先。
    // マウスは dblclick、タッチは **ダブルタップ**(300ms 以内の 2 回)で入る。
    // dblclick はタッチで発火しないため、touch 側で自前に判定する。
    var editTarget = null;
    var lastTapAt = 0;
    var lastTapTarget = null;

    function beginEdit(t) {
      if (editTarget !== null) return;
      editTarget = t;
      var key = t.getAttribute('data-editable') || '';
      var original = t.textContent;
      // 編集中は選択とソフトキーボードを許可する(長押し抑制を外す)。
      document.body.classList.remove('vz-longpress');
      t.setAttribute('data-editing', 'true');
      t.contentEditable = 'true';
      t.focus();
      // 全選択して、そのまま打ち替えられるようにする。
      try {
        var range = document.createRange();
        range.selectNodeContents(t);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) { /* selection unavailable */ }
      // ソフトキーボードで隠れないよう、画面の中央へ寄せる。
      t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // キーボード表示後のリサイズでもう一度寄せる(iOS はレイアウトが遅れる)。
      if (window.visualViewport !== undefined) {
        var once = function () {
          window.visualViewport.removeEventListener('resize', once);
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        };
        window.visualViewport.addEventListener('resize', once);
      }

      function finish(commit) {
        t.removeEventListener('blur', onBlur);
        t.removeEventListener('keydown', onKey);
        t.contentEditable = 'false';
        t.removeAttribute('data-editing');
        editTarget = null;
        if (commit === true) {
          var text = t.textContent.trim();
          if (text !== '') {
            edits[key] = text;
            report();
          } else {
            t.textContent = original;
          }
        } else {
          t.textContent = original;
        }
        // 確定/取り消し後はキーボードを閉じる。
        if (typeof t.blur === 'function') t.blur();
      }
      function onBlur() { finish(true); }
      function onKey(e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      }
      t.addEventListener('blur', onBlur);
      t.addEventListener('keydown', onKey);
    }

    // マウス: ダブルクリック。
    document.addEventListener('dblclick', function (e) {
      var t = e.target.closest && e.target.closest('[data-editable]');
      if (t === null) return;
      e.preventDefault();
      beginEdit(t);
    });

    // タッチ: ダブルタップ(同じ要素を 300ms 以内に 2 回)。
    document.addEventListener('touchend', function (e) {
      var t = e.target.closest && e.target.closest('[data-editable]');
      if (t === null) { lastTapTarget = null; return; }
      var now = Date.now();
      if (lastTapTarget === t && now - lastTapAt < 300) {
        e.preventDefault();
        beginEdit(t);
        lastTapTarget = null;
        lastTapAt = 0;
        return;
      }
      lastTapTarget = t;
      lastTapAt = now;
    }, { passive: false });

    // 復元: 保存済みの上書きを適用する。
    document.addEventListener('DOMContentLoaded', function () {
      Object.keys(edits).forEach(function (key) {
        var t = document.querySelector('[data-editable="' + key + '"]');
        if (t !== null) t.textContent = edits[key];
      });
    });
  })()

  /**
   * 親ページがメニューを持つときのフレーム側の受け口。
   * postMessage のコマンドを実行し、畳みカードと選択モードはフレーム内で扱う。
   */
  function installHostedCommands() {
    var charts = function () { return (window.viz && window.viz._charts) || []; };
    var content = function () { return document.querySelector('.vz-content'); };
    var tableMode = false;
    var edits = {};

    function renderTable(c) {
      var config = c.config || {};
      var cols = config.columns || [];
      var rows = config.rows || [];
      var host = c.host;
      host.textContent = '';
      var table = document.createElement('table');
      table.className = 'table table-sm';
      var head = document.createElement('thead');
      var headRow = document.createElement('tr');
      cols.forEach(function (name) {
        var th = document.createElement('th');
        th.textContent = String(name);
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = document.createElement('tbody');
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        cols.forEach(function (_, i) {
          var td = document.createElement('td');
          td.textContent = String(r[i]);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      table.appendChild(body);
      host.appendChild(table);
    }

    function applyView(table) {
      tableMode = table;
      charts().forEach(function (c) {
        if (table) { renderTable(c); return; }
        c.host.textContent = '';
        c.update(c.config);
      });
    }

    function adjustZoom(percent) {
      document.documentElement.setAttribute('data-viz-zoom', String(percent / 100));
      var target = content();
      if (target !== null) target.style.zoom = String(percent / 100);
      // ズーム後は計測幅が変わるので描き直す(古い幅のままだと棒が崩れる)。
      charts().forEach(function (c) { c.update(c.config, true); });
    }

    /**
     * 色の上書き。viz.chart は documentElement の computed style から --vz-* を
     * 読むので、ルートに設定する(メニューはフレームの外なので内容にしか効かない)。
     */
    function overrideColor(key, value) {
      document.documentElement.style.setProperty('--vz-' + key, value);
      charts().forEach(function (c) { c.update(c.config, true); });
    }

    /** 文字の上書き: フォントファミリと基本サイズ。 */
    /**
     * 文字の上書き。fonts.role は 'all' | 'title' | 'label' | 'tick'。
     * 'all' は本文(--vz-font-size)と全役割、それ以外はその役割だけ。
     */
    function overrideFont(fonts) {
      var root = document.documentElement;
      if (fonts.family !== undefined && fonts.family !== '') root.style.setProperty('--vz-font', fonts.family);
      var roles = fonts.role === 'all' || fonts.role === undefined
        ? ['title', 'label', 'tick']
        : [fonts.role];
      if (fonts.size !== undefined && fonts.size > 0) {
        if (fonts.role === 'all' || fonts.role === undefined) {
          root.style.setProperty('--vz-font-size', fonts.size + 'px');
        }
        roles.forEach(function (role) {
          root.style.setProperty('--vz-font-' + role, fonts.size + 'px');
        });
      }
      charts().forEach(function (c) { c.update(c.config, true); });
    }

    function resetAll() {
      var root = document.documentElement;
      root.removeAttribute('data-viz-zoom');
      root.style.removeProperty('--vz-text');
      root.style.removeProperty('--vz-dim');
      root.style.removeProperty('--vz-surface');
      root.style.removeProperty('--vz-accent');
      root.style.removeProperty('--vz-border');
      root.style.removeProperty('--vz-font');
      root.style.removeProperty('--vz-font-size');
      root.style.removeProperty('--vz-font-title');
      root.style.removeProperty('--vz-font-label');
      root.style.removeProperty('--vz-font-tick');
      var target = content();
      if (target !== null) target.style.zoom = '';
      window.__dshVizScroll = 'none';
      applyView(false);
    }

    function tabular(config, sep) {
      var cols = config.columns || [];
      var rows = config.rows || [];
      var cell = function (value) {
        var text = String(value);
        return sep === ',' && text.indexOf(',') >= 0 ? '"' + text + '"' : text;
      };
      return [cols.map(cell).join(sep)].concat(rows.map(function (r) {
        return cols.map(function (_, i) { return cell(r[i]); }).join(sep);
      })).join('\\n');
    }

    function toMarkdown(config) {
      var cols = config.columns || [];
      var rows = config.rows || [];
      var head = '| ' + cols.join(' | ') + ' |';
      var rule = '|' + cols.map(function () { return ' --- '; }).join('|') + '|';
      var body = rows.map(function (r) {
        return '| ' + cols.map(function (_, i) { return String(r[i]); }).join(' | ') + ' |';
      }).join('\\n');
      return head + '\\n' + rule + '\\n' + body;
    }

    /** SVG を canvas に描いて dataURL を作る(背景付きは背景を塗る)。 */
    function svgToDataUrl(svg, mime, background) {
      var xml = new XMLSerializer().serializeToString(svg);
      var img = new Image();
      return new Promise(function (resolve) {
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var box = svg.getBoundingClientRect();
          canvas.width = Math.max(1, Math.round(box.width));
          canvas.height = Math.max(1, Math.round(box.height));
          var ctx = canvas.getContext('2d');
          if (background !== undefined) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL(mime));
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      });
    }

    function runExport(command) {
      var format = command.format;
      var mime = 'text/plain';
      var name = 'visualization';
      var done;
      if (format === 'chart-png') {
        var chart = charts()[command.target || 0];
        if (chart === undefined) return;
        mime = 'image/png';
        name = ((chart.config && chart.config.title) || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
        done = svgToDataUrl(chart.host.querySelector('svg'), mime, undefined).then(function (url) { return { url: url }; });
      } else if (format === 'frame-png' || format === 'frame-jpeg') {
        var svg = document.querySelector('svg');
        if (svg === null) return;
        mime = format === 'frame-png' ? 'image/png' : 'image/jpeg';
        name = format === 'frame-png' ? 'visualization.png' : 'visualization.jpg';
        var background = getComputedStyle(document.body).backgroundColor;
        done = svgToDataUrl(svg, mime, background).then(function (url) { return { url: url }; });
      } else if (format === 'html') {
        mime = 'text/html';
        name = 'visualization.html';
        done = Promise.resolve({ text: '<!doctype html>\\n' + document.documentElement.outerHTML });
      } else if (format === 'md') {
        mime = 'text/markdown';
        name = 'visualization.md';
        var lines = [document.body.innerText];
        charts().forEach(function (c, index) {
          if (command.includeCharts !== true) return;
          lines.push('', '## ' + ((c.config && c.config.title) || 'グラフ ' + (index + 1)), '', toMarkdown(c.config), '');
        });
        done = Promise.resolve({ text: lines.join('\\n') });
      } else if (format === 'table') {
        mime = 'text/tab-separated-values';
        name = 'visualization.tsv';
        var first = charts()[command.target || 0];
        done = Promise.resolve({ text: tabular(first ? first.config : { columns: [], rows: [] }, '\\t') });
      } else {
        name = 'visualization.txt';
        done = Promise.resolve({ text: document.body.innerText });
      }
      done.then(function (out) {
        if (command.mode === 'copy') {
          parent.postMessage(out.url !== undefined
            ? { dshVizCopyImage: out.url }
            : { dshVizCopy: out.text }, '*');
          return;
        }
        parent.postMessage({
          dshVizDownload: {
            name: name,
            url: out.url !== undefined ? out.url
              : 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(out.text),
          },
        }, '*');
      });
    }

    // 長押し: 親へ告げる(親がハンバーガーを出し、haptic も鳴らす)。
    // スワイプや畳みは撤回した。
    var HOLD_MS = 500;
    var holdTimer = null;
    var tracking = false;
    var coarse = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e2) { /* no matchMedia */ }
    if (coarse) {
      function cancelHold() {
        tracking = false;
        document.body.classList.remove('vz-longpress');
        if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
      }
      document.addEventListener('touchstart', function (e3) {
        var t = e3.touches[0];
        if (t === undefined) return;
        tracking = true;
        document.body.classList.add('vz-longpress');
        if (holdTimer !== null) clearTimeout(holdTimer);
        holdTimer = setTimeout(function () {
          holdTimer = null;
          parent.postMessage({ dshVizHold: true }, '*');
        }, HOLD_MS);
      }, { passive: true });
      document.addEventListener('touchmove', function () {
        if (!tracking) return;
        cancelHold();
      }, { passive: true });
      document.addEventListener('touchend', cancelHold, { passive: true });
      document.addEventListener('touchcancel', cancelHold, { passive: true });
    }

    // 親からのコマンド。
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (data === null || typeof data !== 'object') return;
      if (data.vizCommand === undefined) return;
      var command = data.vizCommand;
      if (command.type === 'view') applyView(command.table === true);
      else if (command.type === 'zoom') adjustZoom(command.value);
      else if (command.type === 'color') overrideColor(command.key, command.value);
      else if (command.type === 'font') overrideFont(command.fonts || {});
      else if (command.type === 'reset') resetAll();
      else if (command.type === 'scroll') { window.__dshVizScroll = command.value; fit(); }
      else if (command.type === 'export') runExport(command);
    });

    // 親へグラフの一覧を知らせる(対象グラフのプルダウン用)。
    addEventListener('load', function () {
      parent.postMessage({
        dshVizMeta: charts().map(function (c, index) {
          return (c.config && c.config.title) || 'グラフ ' + (index + 1);
        }),
      }, '*');
    });
  }
})()`
    const FRAME_CHART = `
(function () {
  var SERIES = ['--viz-series-1', '--viz-series-2', '--viz-series-3', '--viz-series-4', '--viz-series-5', '--viz-series-6'];
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    return node;
  }
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function color(i) { return cssVar(SERIES[i % SERIES.length], 'currentColor'); }

  /**
   * 文字のサイズを CSS 変数経由にする。
   *
   * SVG の font-size を属性で直書きすると、ルートの --vz-font-size を
   * 上書きしても反映されない(実測)。属性の値から役割を判定し、役割ごとの
   * CSS 変数(var(--vz-font-<role>, <既定>px))を style に持たせる。
   * 役割: title(タイトル)/ label(軸ラベル)/ tick(目盛り)。
   */
  function finish(svg) {
    var texts = svg.querySelectorAll('text');
    Array.prototype.forEach.call(texts, function (node) {
      var size = Number(node.getAttribute('font-size'));
      var role = isFinite(size) && size >= 12 ? 'title' : isFinite(size) && size >= 11 ? 'label' : 'tick';
      if (isFinite(size) && size > 0) {
        node.removeAttribute('font-size');
        node.style.fontSize = 'var(--vz-font-' + role + ', ' + size + 'px)';
      }
      // 色も役割別の変数へ。属性で直書きのままだと要素別の上書きが効かない。
      var fill = node.getAttribute('fill');
      if (fill !== null && fill !== '' && fill !== 'none') {
        node.removeAttribute('fill');
        var token = role === 'title' ? '--vz-title' : role === 'label' ? '--vz-axis' : '--vz-tick';
        node.style.fill = 'var(' + token + ', ' + fill + ')';
      }
    });
    return svg;
  }

  // Named ramps for value-encoded fills. 'series' keeps the single series hue
  // and varies opacity, which is the quiet default; the rest follow the
  // perceptual maps matplotlib ships, so a reader already knows them.
  var RAMPS = {
    viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
    magma: [[0, 0, 4], [81, 18, 124], [183, 55, 121], [252, 137, 97], [252, 253, 191]],
    plasma: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]],
    inferno: [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]],
    blues: [[247, 251, 255], [198, 219, 239], [107, 174, 214], [33, 113, 181], [8, 48, 107]],
    reds: [[255, 245, 240], [252, 146, 114], [222, 45, 38], [165, 15, 21], [103, 0, 13]],
    greens: [[247, 252, 245], [199, 233, 192], [116, 196, 118], [35, 139, 69], [0, 68, 27]],
    coolwarm: [[59, 76, 192], [221, 221, 221], [180, 4, 38]],
  };

  /**
   * Interpolate one value through a named ramp.
   * @param {string} name ramp key.
   * @param {number} t position in [0, 1].
   * @returns {string} an rgb() colour.
   */
  function ramp(name, t) {
    var stops = RAMPS[name] || RAMPS.viridis;
    var x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(x));
    var f = x - i, a = stops[i], b = stops[i + 1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ' '
      + Math.round(a[1] + (b[1] - a[1]) * f) + ' '
      + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function nice(lo, hi, count) {
    if (lo === hi) { lo -= 1; hi += 1; }
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
    var ticks = [];
    for (var v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { ticks: ticks, lo: start, hi: end };
  }
  function fmt(value, format) {
    if (format === undefined) return String(value);
    var digits = format.maximumFractionDigits === undefined ? 2 : format.maximumFractionDigits;
    if (format.style === 'percent') return (value * 100).toFixed(digits) + '%';
    if (format.style === 'currency') {
      try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: format.currency || 'USD', maximumFractionDigits: digits }).format(value); }
      catch { return value.toFixed(digits); }
    }
    // 桁の大きい値は 1.2M のように丸める。軸ラベルが 4000000 で埋まるのを防ぐ。
    if (format.notation === 'compact') {
      try { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: digits }).format(value); }
      catch { return String(value); }
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
  }

  function draw(host, config) {
    host.textContent = '';
    var type = config.type || 'line';
    var columns = config.columns || [];
    var rows = config.rows || [];
    // x と y は列名で指定する。省略した場合は x = y に使われていない最初の列、
    // y = 残りの列全部。1 枚の表を渡すだけで描けるようにするため。
    var yNames = Array.isArray(config.y) ? config.y : config.y === undefined ? undefined : [config.y];
    var xName = config.x;
    if (xName === undefined) {
      var used = yNames || [];
      for (var ci = 0; ci < columns.length; ci++) {
        if (used.indexOf(columns[ci]) < 0) { xName = columns[ci]; break; }
      }
      if (xName === undefined) xName = columns[0];
    }
    var xi = columns.indexOf(xName);
    if (yNames === undefined) {
      yNames = columns.filter(function (c) { return c !== xName; });
    }
    var ys = yNames.map(function (n) { return columns.indexOf(n); });
    if (xi < 0 || ys.length === 0 || ys.some(function (i) { return i < 0; })) {
      throw new Error('viz.chart: x and y must name columns');
    }
    var W = Math.max(240, host.clientWidth || 640);
    var H = config.height || (type === 'sparkline' ? 48 : 240);
    // aspect は「高さ ÷ 幅」の比。描画時の実幅から高さを求める。SVG は
    // width:100% + viewBox なので、以後のリサイズでも比は保たれる。
    // height(px) の明示があるならそちらが優先。
    if (config.aspect !== undefined && config.height === undefined) {
      H = Math.max(120, Math.round(W * config.aspect));
    }
    // 描画時に測った幅よりコンテナが広いとき、SVG は maxWidth で止まって
    // 左に寄ってしまう。既定で中央に置き、align で左右を指定できるようにする。
    host.style.display = 'flex';
    host.style.justifyContent = config.align === 'left' ? 'flex-start'
      : config.align === 'right' ? 'flex-end' : 'center';
    var padL = type === 'sparkline' ? 2 : 52, padR = 12, padT = config.title ? 26 : 12, padB = type === 'sparkline' ? 2 : 34;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img' });
    // 幅を実測値で固定しない。固定すると初回計測が広い値だったときに
    // SVG が枠を超えてはみ出し、狭い画面で棒グラフが切れる(実測: 390px の
    // 枠で 980px を主張して画面外へ溢れた)。viewBox と width:100% で
    // 常に枠幅に縮尺される。
    svg.style.maxWidth = '100%';
    if (config.title) {
      var t = el('text', { x: 0, y: 14, 'font-size': 12, fill: cssVar('--vz-text', '#000') });
      t.textContent = config.title;
      svg.appendChild(t);
    }

    if (type === 'pie') {
      var total = rows.reduce(function (a, r) { return a + Math.abs(+r[ys[0]] || 0); }, 0) || 1;
      var cx = W / 2, cy = H / 2 + (config.title ? 8 : 0), rad = Math.min(W, H) / 2 - 16, ang = -Math.PI / 2;
      rows.forEach(function (r, i) {
        var frac = Math.abs(+r[ys[0]] || 0) / total, next = ang + frac * Math.PI * 2;
        var large = frac > 0.5 ? 1 : 0;
        var p = el('path', {
          d: 'M' + cx + ' ' + cy + ' L' + (cx + rad * Math.cos(ang)) + ' ' + (cy + rad * Math.sin(ang))
            + ' A' + rad + ' ' + rad + ' 0 ' + large + ' 1 ' + (cx + rad * Math.cos(next)) + ' ' + (cy + rad * Math.sin(next)) + ' Z',
          fill: color(i), stroke: cssVar('--vz-surface', 'transparent'), 'stroke-width': 1,
          'data-tooltip': String(r[xi]) + ': ' + fmt(+r[ys[0]], config.format),
        });
        svg.appendChild(p);
        ang = next;
      });
      host.appendChild(svg);
      return finish(svg);
    }

    if (type === 'ranking' || (type === 'bar' && config.horizontal === true)) {
      // Horizontal bars: the shape that reads best for a list of names, where a
      // vertical axis would tilt every label. Ranking sorts by value; a
      // horizontal bar keeps the caller's order.
      // sort: 'desc' (default for ranking) | 'asc' | 'none'. A horizontal bar
      // keeps the caller's order unless it asks otherwise.
      var order = config.sort === undefined
        ? (type === 'ranking' ? 'desc' : 'none')
        : String(config.sort);
      var sorted = rows.slice();
      if (order === 'desc' || order === 'asc') {
        var dir = order === 'desc' ? -1 : 1;
        sorted.sort(function (a, b) { return dir * ((+a[ys[0]] || 0) - (+b[ys[0]] || 0)); });
      }
      var maxV = Math.max.apply(null, sorted.map(function (r) { return Math.abs(+r[ys[0]] || 0); })) || 1;
      var rowH = Math.max(18, Math.min(34, (H - padT - padB) / Math.max(1, sorted.length)));
      var labelW = Math.min(140, Math.max(60, W * 0.28));
      var barX = labelW + 10, barW = W - barX - 46;
      sorted.forEach(function (r, i) {
        var v = +r[ys[0]] || 0;
        var y = padT + rowH * i;
        var name = el('text', { x: labelW, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': 11, fill: cssVar('--vz-text', '#000') });
        name.textContent = String(r[xi]);
        svg.appendChild(name);
        svg.appendChild(el('rect', {
          x: barX, y: y + 3, width: Math.max(1, (Math.abs(v) / maxV) * barW), height: rowH - 6, rx: 3,
          fill: color(0),
          'data-tooltip': String(r[xi]) + ': ' + fmt(v, config.format),
        }));
        var val = el('text', { x: W - 4, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': 11, fill: cssVar('--vz-dim', '#666') });
        val.textContent = fmt(v, config.format);
        svg.appendChild(val);
      });
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (padT + rowH * sorted.length + padB));
      host.appendChild(svg);
      return finish(svg);
    }

    if (type === 'waterfall') {
      // Each bar spans from the running total to the total after its delta, so
      // a reader sees where a number grew and where it shrank.
      var run = 0, spans = [];
      rows.forEach(function (r) {
        var d = +r[ys[0]] || 0;
        spans.push([run, run + d, d]);
        run += d;
      });
      var lo = Math.min(0, Math.min.apply(null, spans.map(function (s) { return Math.min(s[0], s[1]); })));
      var hi = Math.max(0, Math.max.apply(null, spans.map(function (s) { return Math.max(s[0], s[1]); })));
      var sc = nice(lo, hi, 4);
      var plotH2 = H - padT - padB, plotW2 = W - padL - padR;
      function wy(v) { return padT + plotH2 * (1 - (v - sc.lo) / (sc.hi - sc.lo)); }
      sc.ticks.forEach(function (v) {
        svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: wy(v), y2: wy(v), stroke: cssVar('--vz-border', '#ddd'), 'stroke-width': 1, opacity: v === 0 ? 1 : 0.5 }));
        var t = el('text', { x: padL - 6, y: wy(v) + 4, 'text-anchor': 'end', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        t.textContent = fmt(v, config.format);
        svg.appendChild(t);
      });
      var band2 = plotW2 / spans.length;
      spans.forEach(function (s, i) {
        var top = wy(Math.max(s[0], s[1])), bottom = wy(Math.min(s[0], s[1]));
        svg.appendChild(el('rect', {
          x: padL + band2 * i + band2 * 0.2, y: top, width: band2 * 0.6, height: Math.max(1, bottom - top), rx: 3,
          fill: s[2] >= 0 ? color(0) : cssVar('--dsw-alias-state-error-primary', '#c33'),
          'data-tooltip': String(rows[i][xi]) + ': ' + (s[2] >= 0 ? '+' : '') + fmt(s[2], config.format),
        }));
        var lb = el('text', { x: padL + band2 * i + band2 / 2, y: H - padB + 15, 'text-anchor': 'middle', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        lb.textContent = String(rows[i][xi]);
        svg.appendChild(lb);
      });
      host.appendChild(svg);
      return finish(svg);
    }

    if (type === 'sankey') {
      // columns: [source, target, value]; a two-column flow.
      // Nodes keep the order they first appear, and each side is stacked by
      // weight so the ribbons do not cross more than the data requires.
      var srcIdx = columns.indexOf(config.source === undefined ? config.x : config.source);
      var tgtIdx = columns.indexOf(config.target === undefined ? 'target' : config.target);
      var valIdx = ys[0];
      if (srcIdx < 0 || tgtIdx < 0) throw new Error('viz.chart: sankey needs source and target columns');
      var srcs = [], tgts = [], links = [];
      rows.forEach(function (r) {
        var s = String(r[srcIdx]), t = String(r[tgtIdx]), v = Math.abs(+r[valIdx]) || 0;
        if (srcs.indexOf(s) < 0) srcs.push(s);
        if (tgts.indexOf(t) < 0) tgts.push(t);
        links.push([s, t, v]);
      });
      var sumOf = function (list, pick) {
        var m = {};
        list.forEach(function (n) { m[n] = 0; });
        links.forEach(function (l) { m[pick(l)] += l[2]; });
        return m;
      };
      var outSum = sumOf(srcs, function (l) { return l[0]; });
      var inSum = sumOf(tgts, function (l) { return l[1]; });
      var total = links.reduce(function (a, l) { return a + l[2]; }, 0) || 1;
      var gap = 8, colW = 14, leftX = padL, rightX = W - padR - colW;
      var usable = H - padT - padB - gap * Math.max(srcs.length, tgts.length);
      function stack(names, sums) {
        var pos = {}, y = padT;
        names.forEach(function (n) {
          var h = Math.max(2, (sums[n] / total) * usable);
          pos[n] = { y: y, h: h, cursor: y };
          y += h + gap;
        });
        return pos;
      }
      var leftPos = stack(srcs, outSum), rightPos = stack(tgts, inSum);
      links.forEach(function (l) {
        var a = leftPos[l[0]], b = rightPos[l[1]];
        var h = Math.max(1, (l[2] / total) * usable);
        var y0 = a.cursor, y1 = b.cursor;
        a.cursor += h; b.cursor += h;
        var x0 = leftX + colW, x1 = rightX, mid = (x0 + x1) / 2;
        svg.appendChild(el('path', {
          d: 'M' + x0 + ' ' + y0 + ' C' + mid + ' ' + y0 + ' ' + mid + ' ' + y1 + ' ' + x1 + ' ' + y1
            + ' L' + x1 + ' ' + (y1 + h) + ' C' + mid + ' ' + (y1 + h) + ' ' + mid + ' ' + (y0 + h) + ' ' + x0 + ' ' + (y0 + h) + ' Z',
          fill: color(0), opacity: 0.28,
          'data-tooltip': l[0] + ' → ' + l[1] + ': ' + fmt(l[2], config.format),
        }));
      });
      srcs.forEach(function (n) {
        svg.appendChild(el('rect', { x: leftX, y: leftPos[n].y, width: colW, height: leftPos[n].h, rx: 2, fill: color(0), 'data-tooltip': n + ': ' + fmt(outSum[n], config.format) }));
        var t1 = el('text', { x: leftX - 6, y: leftPos[n].y + leftPos[n].h / 2 + 4, 'text-anchor': 'end', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        t1.textContent = n;
        svg.appendChild(t1);
      });
      tgts.forEach(function (n) {
        svg.appendChild(el('rect', { x: rightX, y: rightPos[n].y, width: colW, height: rightPos[n].h, rx: 2, fill: color(1), 'data-tooltip': n + ': ' + fmt(inSum[n], config.format) }));
        var t2 = el('text', { x: rightX + colW + 6, y: rightPos[n].y + rightPos[n].h / 2 + 4, 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        t2.textContent = n;
        svg.appendChild(t2);
      });
      host.appendChild(svg);
      return finish(svg);
    }

    if (type === 'heatmap') {
      // columns: [x, y, value]; a grid of cells whose fill carries the value.
      var xs = [], ysList = [], cell = [];
      rows.forEach(function (r) {
        var cx2 = String(r[xi]), cy2 = String(r[1]);
        if (xs.indexOf(cx2) < 0) xs.push(cx2);
        if (ysList.indexOf(cy2) < 0) ysList.push(cy2);
        cell.push([cx2, cy2, +r[ys[0]] || 0]);
      });
      // colormap: 'series' (default, one hue with opacity) or a named ramp.
      // 'diverging' maps the range around zero so sign is readable.
      var mapName = config.colormap === undefined ? 'series' : String(config.colormap);
      var vals = cell.map(function (c) { return c[2]; });
      var maxC = Math.max.apply(null, vals);
      var minC = Math.min.apply(null, vals);
      var span = (maxC - minC) || 1;
      var cw = (W - padL - padR) / Math.max(1, xs.length);
      var ch = Math.min(34, (H - padT - padB) / Math.max(1, ysList.length));
      cell.forEach(function (c) {
        var gx = xs.indexOf(c[0]), gy = ysList.indexOf(c[1]);
        var fill, opacity = 1;
        if (mapName === 'series') {
          fill = color(0);
          opacity = 0.12 + 0.88 * ((c[2] - minC) / span);
        } else if (mapName === 'diverging') {
          var reach = Math.max(Math.abs(minC), Math.abs(maxC)) || 1;
          fill = ramp('coolwarm', 0.5 + 0.5 * (c[2] / reach));
        } else {
          fill = ramp(mapName, (c[2] - minC) / span);
        }
        svg.appendChild(el('rect', {
          x: padL + cw * gx + 1, y: padT + ch * gy + 1, width: Math.max(1, cw - 2), height: Math.max(1, ch - 2), rx: 3,
          fill: fill, opacity: opacity,
          'data-tooltip': c[0] + ' / ' + c[1] + ': ' + fmt(c[2], config.format),
        }));
      });
      xs.forEach(function (v, i) {
        var t = el('text', { x: padL + cw * i + cw / 2, y: H - padB + 15, 'text-anchor': 'middle', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        t.textContent = v;
        svg.appendChild(t);
      });
      ysList.forEach(function (v, i) {
        var t = el('text', { x: padL - 6, y: padT + ch * i + ch / 2 + 4, 'text-anchor': 'end', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        t.textContent = v;
        svg.appendChild(t);
      });
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (padT + ch * ysList.length + padB));
      host.appendChild(svg);
      return finish(svg);
    }

    if (type === 'funnel') {
      // columns: [stage, value]; width follows the value, so a drop is visible.
      var fmax = Math.max.apply(null, rows.map(function (r) { return +r[ys[0]] || 0; })) || 1;
      var fh = Math.min(56, (H - padT - padB) / Math.max(1, rows.length));
      rows.forEach(function (r, i) {
        var v = +r[ys[0]] || 0;
        var w = (v / fmax) * (W - padL - padR);
        var y = padT + fh * i;
        svg.appendChild(el('rect', {
          x: padL + ((W - padL - padR) - w) / 2, y: y + 4, width: Math.max(1, w), height: fh - 8, rx: 4,
          fill: color(0), opacity: 0.85,
          'data-tooltip': String(r[xi]) + ': ' + fmt(v, config.format),
        }));
        var t = el('text', { x: W / 2, y: y + fh / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: cssVar('--vz-text', '#000') });
        t.textContent = String(r[xi]) + '  ' + fmt(v, config.format);
        svg.appendChild(t);
      });
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (padT + fh * rows.length + padB));
      host.appendChild(svg);
      return finish(svg);
    }

    if (type === 'box-plot') {
      // columns: [label, min, q1, median, q3, max]
      var idx = [1, 2, 3, 4, 5].map(function (k) { return columns.indexOf(config[k === 1 ? 'min' : k === 2 ? 'q1' : k === 3 ? 'median' : k === 4 ? 'q3' : 'max']); });
      if (idx.some(function (i) { return i < 0; })) {
        throw new Error('viz.chart: box-plot needs min, q1, median, q3 and max columns');
      }
      var all = [];
      rows.forEach(function (r) { idx.forEach(function (i) { all.push(+r[i] || 0); }); });
      var bc = nice(Math.min.apply(null, all), Math.max.apply(null, all), 4);
      var bh = H - padT - padB, bw2 = W - padL - padR;
      function by(v) { return padT + bh * (1 - (v - bc.lo) / (bc.hi - bc.lo)); }
      bc.ticks.forEach(function (v) {
        svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: by(v), y2: by(v), stroke: cssVar('--vz-border', '#ddd'), 'stroke-width': 1, opacity: 0.5 }));
        var t = el('text', { x: padL - 6, y: by(v) + 4, 'text-anchor': 'end', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        t.textContent = fmt(v, config.format);
        svg.appendChild(t);
      });
      var bb = bw2 / rows.length;
      rows.forEach(function (r, i) {
        var cx3 = padL + bb * i + bb / 2, half = Math.min(28, bb * 0.3);
        var mn = +r[idx[0]] || 0, q1 = +r[idx[1]] || 0, md = +r[idx[2]] || 0, q3 = +r[idx[3]] || 0, mx = +r[idx[4]] || 0;
        svg.appendChild(el('line', { x1: cx3, x2: cx3, y1: by(mx), y2: by(mn), stroke: cssVar('--vz-dim', '#666'), 'stroke-width': 1 }));
        svg.appendChild(el('rect', {
          x: cx3 - half, y: by(q3), width: half * 2, height: Math.max(1, by(q1) - by(q3)), rx: 3,
          fill: color(0), opacity: 0.35, stroke: color(0), 'stroke-width': 1,
          'data-tooltip': String(r[xi]) + ': ' + fmt(md, config.format),
        }));
        svg.appendChild(el('line', { x1: cx3 - half, x2: cx3 + half, y1: by(md), y2: by(md), stroke: color(0), 'stroke-width': 2 }));
        var lb2 = el('text', { x: cx3, y: H - padB + 15, 'text-anchor': 'middle', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        lb2.textContent = String(r[xi]);
        svg.appendChild(lb2);
      });
      host.appendChild(svg);
      return finish(svg);
    }

    // A hidden series keeps its slot in the scale, so the visible ones do not
    // re-fit and the reader compares shapes rather than axes.
    var hiddenSeries = config.hiddenSeries || [];
    function isHidden(yi) { return hiddenSeries.indexOf(columns[yi]) >= 0; }

    var values = [];
    rows.forEach(function (r) { ys.forEach(function (yi) { var v = +r[yi]; if (isFinite(v)) values.push(v); }); });
    if (values.length === 0) throw new Error('viz.chart: no numeric rows');
    var stacked = config.stacked === true && (type === 'bar' || type === 'area');
    var scale = stacked
      ? nice(0, rows.reduce(function (a, r) { return Math.max(a, ys.reduce(function (s, yi) { return s + (+r[yi] || 0); }, 0)); }, 0), 5)
      : nice(Math.min(0, Math.min.apply(null, values)), Math.max.apply(null, values), 5);

    var plotW = W - padL - padR, plotH = H - padT - padB;
    function sx(i) { return padL + (rows.length === 1 ? plotW / 2 : (plotW * i) / (rows.length - 1)); }
    function sy(v) { return padT + plotH * (1 - (v - scale.lo) / (scale.hi - scale.lo)); }
    function bandX(i) { return padL + (plotW * (i + 0.5)) / rows.length; }

    if (type !== 'sparkline') {
      scale.ticks.forEach(function (v) {
        var y = sy(v);
        svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: cssVar('--vz-border', '#ddd'), 'stroke-width': 1, opacity: v === 0 ? 1 : 0.5 }));
        var label = el('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        label.textContent = fmt(v, config.format);
        svg.appendChild(label);
      });
      // Thin the x labels to what fits: one per row overlaps into a smear once
      // the series has more than a few dozen points.
      var widest = 0;
      rows.forEach(function (r) { widest = Math.max(widest, String(r[xi]).length); });
      var perLabel = widest * 6 + 12;
      var maxLabels = Math.max(2, Math.floor(plotW / perLabel));
      var labelStep = Math.max(1, Math.ceil(rows.length / maxLabels));
      var lastDrawn = -1;
      rows.forEach(function (r, i) {
        var isLast = i === rows.length - 1;
        if (!isLast && i % labelStep !== 0) return;
        // The final label is only worth drawing when it keeps the same spacing
        // as the rest: forcing it always made the last two labels collide
        // (…1391 / 1403) whenever the step did not land on the end.
        if (isLast && lastDrawn >= 0 && i - lastDrawn < labelStep) return;
        lastDrawn = i;
        var x = type === 'bar' ? bandX(i) : sx(i);
        var label = el('text', { x: x, y: H - padB + 15, 'text-anchor': 'middle', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
        label.textContent = String(r[xi]);
        svg.appendChild(label);
      });
      if (config.yLabel) {
        // Rotated along the left edge: the top-left corner belongs to the title,
        // and a horizontal label there collided with it.
        var yl = el('text', {
          x: 0, y: 0, 'font-size': 10, fill: cssVar('--vz-dim', '#666'),
          'text-anchor': 'middle',
          transform: 'translate(11 ' + (padT + plotH / 2) + ') rotate(-90)',
        });
        yl.textContent = config.yLabel;
        svg.appendChild(yl);
      }
    }

    if (type === 'bar') {
      var band = plotW / rows.length, groupW = band * 0.62, each = groupW / ys.length;
      rows.forEach(function (r, i) {
        var acc = 0;
        ys.forEach(function (yi, si) {
          if (isHidden(yi)) return;
          var v = +r[yi] || 0;
          var x = padL + band * i + (band - groupW) / 2 + each * si;
          var y = stacked ? sy(acc + v) : sy(Math.max(0, v));
          var h = Math.abs(sy(v) - sy(0));
          if (stacked) { y = sy(acc + v); h = Math.abs(sy(acc + v) - sy(acc)); }
          svg.appendChild(el('rect', {
            x: x, y: y, width: Math.max(1, each - 1), height: Math.max(1, h), rx: 3,
            fill: color(si),
            'data-bar': i + '-' + si,
            'data-tooltip': String(r[xi]) + ': ' + fmt(v, config.format),
          }));
          acc += v;
        });
      });
    } else if (type === 'scatter') {
      rows.forEach(function (r, i) {
        ys.forEach(function (yi, si) {
          if (isHidden(yi)) return;
          var v = +r[yi];
          if (!isFinite(v)) return;
          svg.appendChild(el('circle', {
            cx: sx(i), cy: sy(v), r: 3.5, fill: color(si),
            'data-pt': i + '-' + si,
            'data-tooltip': String(r[xi]) + ': ' + fmt(v, config.format),
          }));
        });
      });
    } else {
      var acc2 = [];
      rows.forEach(function (_, i) { acc2.push(0); });
      ys.forEach(function (yi, si) {
        if (isHidden(yi)) return;
        var pts = [];
        rows.forEach(function (r, i) {
          var v = +r[yi];
          if (!isFinite(v)) return;
          var y = stacked ? sy(acc2[i] + v) : sy(v);
          pts.push([type === 'sparkline' ? padL + (plotW * i) / Math.max(1, rows.length - 1) : sx(i), y]);
        });
        if (pts.length === 0) return;
        var d = pts.map(function (p, k) { return (k === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
        if (type === 'area') {
          var base = sy(stacked ? 0 : scale.lo);
          svg.appendChild(el('path', {
            d: d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + base + ' L' + pts[0][0].toFixed(1) + ' ' + base + ' Z',
            fill: color(si), opacity: 0.18, 'pointer-events': 'none',
          }));
        }
        svg.appendChild(el('path', { d: d, fill: 'none', stroke: color(si), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-line': String(si) }));
        if (type !== 'sparkline') {
          rows.forEach(function (r, i) {
            var v = +r[yi];
            if (!isFinite(v)) return;
            var y = stacked ? sy(acc2[i] + v) : sy(v);
            svg.appendChild(el('circle', {
              cx: sx(i), cy: y, r: 2.5, fill: color(si),
              'data-pt': i + '-' + si,
              'data-tooltip': String(r[xi]) + ': ' + fmt(v, config.format),
            }));
          });
        }
        if (stacked) rows.forEach(function (r, i) { acc2[i] += (+r[yi] || 0); });
      });
    }

    (config.referenceLines || []).forEach(function (ref) {
      var y = sy(ref.value);
      svg.appendChild(el('line', {
        x1: padL, x2: W - padR, y1: y, y2: y,
        stroke: cssVar('--dsw-alias-state-warn-primary', '#c80'), 'stroke-width': 1, 'stroke-dasharray': '4 3',
        'pointer-events': 'none',
      }));
      var l = el('text', { x: W - padR, y: y - 4, 'text-anchor': 'end', 'font-size': 10, fill: cssVar('--vz-dim', '#666') });
      l.textContent = ref.label;
      svg.appendChild(l);
    });

    host.appendChild(svg);
    if (ys.length > 1) {
      var legend = document.createElement('div');
      legend.className = 'viz-row';
      legend.style.marginTop = '6px';
      var hidden = config.hiddenSeries || [];
      ys.forEach(function (yi, si) {
        var name = columns[yi];
        var off = hidden.indexOf(name) >= 0;
        // A legend entry is the series switch. Hiding one keeps the rest on the
        // same scale, so the reader compares shapes rather than re-fitting.
        var item = document.createElement(config.legendToggle === false ? 'span' : 'button');
        item.className = 'text-small muted';
        item.style.cssText = 'display:inline-flex;align-items:center;background:none;border:0;padding:2px 4px;font:inherit;cursor:pointer;'
          + (off ? 'opacity:.45;text-decoration:line-through' : '');
        if (config.legendToggle !== false) {
          item.type = 'button';
          item.setAttribute('aria-pressed', off ? 'false' : 'true');
          item.addEventListener('click', function () {
            var next = (config.hiddenSeries || []).slice();
            var at = next.indexOf(name);
            if (at >= 0) next.splice(at, 1); else next.push(name);
            config.hiddenSeries = next;
            if (config.onSeriesToggle) config.onSeriesToggle(name, at < 0);
            draw(host, config);
          });
        }
        var swatch = document.createElement('span');
        swatch.style.cssText = 'display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:' + color(si);
        item.appendChild(swatch);
        item.appendChild(document.createTextNode(name));
        legend.appendChild(item);
      });
      host.appendChild(legend);
    }
    return finish(svg);
  }

  /** True when the reader asked the platform for less motion. */
  function reducedMotion() {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.viz = window.viz || {};

  /**
   * Report the fragment's interaction state to the host.
   *
   * The frame has an opaque origin, so it cannot call the host itself. It posts
   * to the parent, which relays the snapshot to the Harness; a model can then
   * read it with the visualize_state tool. Keep it small and JSON-only.
   *
   * @param {object} snapshot what the reader chose.
   */
  /**
   * The Session being read, as the host resolved it.
   *
   * A fork has its own id, so a fragment that reports state or asks for a
   * follow-up must name this Session rather than the one in its file path.
   *
   * @returns {string} the Session id, or an empty string when unknown.
   */
  window.viz.session = function () {
    return window.__dshVizSession || '';
  };

  window.viz.state = function (snapshot) {
    try {
      parent.postMessage({
        dshVizState: window.__dshVizPath || '',
        dshVizSession: window.__dshVizSession || '',
        state: snapshot,
      }, '*');
    } catch (e) {
      // A host that is not listening is not an error for the fragment.
    }
  };

  /**
   * The interaction state the host restored for this visualization, or null.
   *
   * The frame cannot read it itself (opaque origin), so the parent page fetches
   * it before building the document and leaves it on the window. A fragment
   * calls this to start from what the reader last chose.
   *
   * @returns {object|null} the last snapshot.
   */
  window.viz.restore = function () {
    var value = window.__dshVizState;
    return value === undefined ? null : value;
  };

  /**
   * Ask the host to investigate something the reader selected.
   *
   * The frame cannot start a turn; it posts to the parent page, whose plugin
   * resolves the Session from this visualization's path and submits the prompt
   * as an ordinary message. The reader sees a new turn, not a hidden call.
   *
   * @param {object} request '{ prompt, title? }' — the prompt is what the model
   *   receives, so include the selected values and what to look into.
   */
  window.viz.followUp = function (request) {
    try {
      var prompt = request && typeof request.prompt === 'string' ? request.prompt : '';
      if (prompt === '') return;
      parent.postMessage({
        dshVizFollowUp: window.__dshVizPath || '',
        dshVizSession: window.__dshVizSession || '',
        prompt: prompt,
        title: request.title === undefined ? '' : String(request.title),
      }, '*');
    } catch (e) {
      // A host that is not listening is not an error for the fragment.
    }
  };

  /** 1 枚の描画失敗を、断片の残りを巻き込まずに見える形で出す。 */
  function drawError(host, error) {
    host.textContent = '';
    var note = document.createElement('div');
    note.style.cssText = 'padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.5;'
      + 'color:var(--dsw-alias-state-error-primary,#c0392b);'
      + 'border:1px solid var(--vz-border,transparent);background:var(--vz-surface,transparent)';
    note.textContent = 'viz.chart: ' + (error && error.message ? error.message : String(error));
    host.appendChild(note);
  }

  window.viz.chart = function (host, config) {
    var current = config;
    var svg;
    // The menu reads this registry: the table view, the copy and the export
    // all work from the last config each host was drawn with.
    var entry = { host: host, config: config };
    (window.viz._charts = window.viz._charts || []).push(entry);
    try {
      svg = draw(host, config);
    } catch (error) {
      // 1 枚の失敗で断片の残りのスクリプトを巻き込まない。
      drawError(host, error);
      return {
        update: function (next) { return window.viz.chart(host, next); },
      };
    }
    // One frame later, so the first paint is not animated.
    if (svg && !reducedMotion()) {
      requestAnimationFrame(function () { svg.classList.add('vz-animate'); });
    }
    function update(next, force) {
      // The animated swap is bar-only. Line/area/scatter redraw everything:
      // their title, reference lines and axis scale change with the data, and
      // a marks-only swap left those stale (measured: a threshold slider
      // moved the marks but the reference line and title never followed).
      // A keyed diff for paths and cells is not worth its weight here.
      var sameShape = force !== true && current.type === 'bar' && next.type === 'bar'
        && (current.rows || []).length === (next.rows || []).length
        && host.querySelector('svg') !== null;
      if (sameShape) {
        var before = host.querySelectorAll('[data-bar]');
        // 差分描画用の下見は、必ず実ホストと同じ幅で描く。切り離した div は
        // clientWidth が 0 で 640 の既定幅に落ち、別幅で計算した棒の座標を
        // 実 SVG へ写すと崩れる(実測)。幅を合わせて body に一時的に載せる。
        var probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;width:'
          + (host.clientWidth > 0 ? host.clientWidth : 640) + 'px';
        document.body.appendChild(probe);
        try {
          draw(probe, next);
        } catch (error) {
          probe.remove();
          drawError(host, error);
          current = next;
          entry.config = next;
          return;
        }
        var after = probe.querySelectorAll('[data-bar]');
        probe.remove();
        if (before.length === after.length) {
          var attrs = ['x', 'y', 'width', 'height', 'fill'];
          for (var i = 0; i < before.length; i++) {
            attrs.forEach(function (a) {
              var v = after[i].getAttribute(a);
              if (v !== null) before[i].setAttribute(a, v);
            });
            var tip = after[i].getAttribute('data-tooltip');
            if (tip !== null) before[i].setAttribute('data-tooltip', tip);
          }
          current = next;
          entry.config = next;
          return;
        }
      }
      try {
        draw(host, next);
      } catch (error) {
        drawError(host, error);
      }
      current = next;
      entry.config = next;
    }
    entry.update = update;
    // 幅が変わったら描き直す。パース中は host の実幅が確定しておらず、
    // 広い幅で geometry を組んだまま狭い枠に押し込まれると棒が潰れる(実測)。
    if (typeof ResizeObserver === 'function') {
      var lastWidth = host.clientWidth;
      var pending = null;
      var redrawing = false;
      var observer = new ResizeObserver(function () {
        // 自分の再描画が起こしたサイズ変化は無視する(無限再帰の実測あり)。
        if (redrawing) return;
        var width = host.clientWidth;
        if (width === 0 || Math.abs(width - lastWidth) < 8) return;
        lastWidth = width;
        if (pending !== null) clearTimeout(pending);
        pending = setTimeout(function () {
          pending = null;
          redrawing = true;
          try {
            draw(host, current);
          } catch (error) {
            drawError(host, error);
          }
          // 再描画で高さが変わった分の通知を 1 フレーム遅らせて逃がす。
          requestAnimationFrame(function () { redrawing = false; });
        }, 60);
      });
      observer.observe(host);
    }
    return {
      update: update,
    };
  };

  /**
   * Wire a control container to a chart.
   *
   * Every '[name]' input, select or textarea under 'container' contributes its
   * value; any 'input' or 'change' rebuilds the configuration from those values
   * and updates the chart in place. The first render uses the same path, so a
   * control's initial value and the chart can never disagree.
   *
   * @param {Element} container element holding the controls.
   * @param {function(object): object} build configuration from the values.
   * @param {object} chart the object 'viz.chart' returned.
   * @returns {function(): object} a reader for the current values.
   */
  /**
   * Render controls from a declaration, so the author decides which knobs exist
   * and in what order. Each entry becomes a labelled native control inside
   * '.viz-controls'; 'viz.bind' then reads them by name.
   *
   * @param {Element} container element to fill.
   * @param {Array<object>} specs '{ name, label, type, options?, min?, max?, step?, value? }'
   *   where type is 'select' | 'range' | 'checkbox' | 'number' | 'text'.
   * @returns {Element} the container.
   */
  window.viz.controls = function (container, specs) {
    container.textContent = '';
    container.classList.add('viz-controls');
    (specs || []).forEach(function (spec) {
      var wrap = document.createElement(spec.type === 'checkbox' ? 'label' : 'div');
      wrap.className = spec.type === 'checkbox' ? 'form-check' : '';
      var id = 'vzc-' + spec.name + '-' + Math.random().toString(36).slice(2, 7);
      if (spec.type !== 'checkbox' && spec.label) {
        var label = document.createElement('label');
        label.className = 'form-label';
        label.htmlFor = id;
        label.textContent = spec.label;
        wrap.appendChild(label);
      }
      var node;
      if (spec.type === 'select') {
        node = document.createElement('select');
        node.className = 'form-select';
        (spec.options || []).forEach(function (o) {
          var opt = document.createElement('option');
          var value = Array.isArray(o) ? o[0] : o;
          opt.value = value;
          opt.textContent = Array.isArray(o) ? o[1] : o;
          if (String(spec.value) === String(value)) opt.selected = true;
          node.appendChild(opt);
        });
      } else {
        node = document.createElement('input');
        node.className = spec.type === 'checkbox' ? 'form-check-input'
          : spec.type === 'range' ? 'form-range' : 'form-control';
        node.type = spec.type === undefined ? 'text' : spec.type;
        if (spec.min !== undefined) node.min = spec.min;
        if (spec.max !== undefined) node.max = spec.max;
        if (spec.step !== undefined) node.step = spec.step;
        if (spec.type === 'checkbox') node.checked = spec.value === true;
        else if (spec.value !== undefined) node.value = spec.value;
      }
      node.id = id;
      node.name = spec.name;
      if (spec.type === 'checkbox') {
        wrap.appendChild(node);
        wrap.appendChild(document.createTextNode(spec.label || spec.name));
      } else {
        wrap.appendChild(node);
      }
      container.appendChild(wrap);
    });
    return container;
  };

  window.viz.bind = function (container, build, chart) {
    function values() {
      var out = {};
      container.querySelectorAll('[name]').forEach(function (node) {
        out[node.name] = node.type === 'checkbox' ? node.checked
          : node.type === 'range' || node.type === 'number' ? Number(node.value)
            : node.value;
      });
      return out;
    }
    function apply() { chart.update(build(values())); }
    container.addEventListener('input', apply);
    container.addEventListener('change', apply);
    apply();
    return values;
  };
})()`
    const FRAME_CARD_CSS = `
body { padding: 14px 16px 16px; }`

    /** The script runtime in document order, ready to inline before a fragment. */
    const FRAME_SCRIPT = FRAME_RUNTIME + ';\n' + FRAME_CHART
    // </generated:frame-runtime>
    /**
     * フレームの外に置くメニューのスタイル(プラグイン側の持ち物)。
     * 色は Harness のトークン(--dsw-alias-*)を継承し、ダーク/ライトに追従する。
     */
    const FRAME_MENU_CSS = `
.vz-fm-btn {
  position: absolute; z-index: 30; top: 4px; right: 4px;
  width: 30px; height: 30px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary-dimmed);
  cursor: pointer; opacity: 0; transition: opacity .16s ease; font: inherit;
}
.vz-fm-frame:hover .vz-fm-btn, .vz-fm-btn[data-open="true"], .vz-fm-btn:focus-visible { opacity: 1; }
.vz-fm-haptic { position: absolute; inset: -8px; cursor: pointer; }
.vz-fm-switch { position: absolute; width: 1px; height: 1px; margin: 0; visibility: hidden; pointer-events: none; }
.vz-fm-panel {
  position: absolute; z-index: 31; top: 4px; right: 4px;
  width: 268px; max-width: calc(100% - 8px); max-height: min(72vh, calc(100% - 8px));
  box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain;
  padding: 40px 12px 10px; border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l1);
  box-shadow: 0 8px 24px rgb(0 0 0 / .22);
  font-size: 13px; line-height: 1.45;
  display: none; transform-origin: top right;
}
.vz-fm-panel[data-open="true"] { display: block; }
/* 折り畳み見出し: タップで開閉する。 */
.vz-fm-h {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 8px 2px; margin: 0;
  border: 0; border-top: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: .93em; font-weight: 600; text-align: left; cursor: pointer;
}
.vz-fm-h:first-of-type { border-top: 0; }
.vz-fm-h::after {
  content: ''; margin-left: auto; width: 0; height: 0;
  border-left: 4px solid transparent; border-right: 4px solid transparent;
  border-top: 5px solid currentColor; opacity: .7;
  transition: transform .16s ease;
}
.vz-fm-h[aria-expanded="true"]::after { transform: rotate(180deg); }
.vz-fm-body { padding: 2px 0 8px 10px; }
.vz-fm-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; flex-wrap: wrap; }
.vz-fm-row > select, .vz-fm-row > input[type="range"] { flex: 1 1 auto; min-width: 0; }
.vz-fm-row > input[type="range"] { accent-color: var(--dsw-alias-brand-primary); }
.vz-fm-label { flex: 0 0 auto; color: var(--dsw-alias-label-primary-dimmed); font-size: .9em; }
.vz-fm-s {
  min-height: 34px; padding: 4px 10px; border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: inherit; font: inherit; font-size: .9em; cursor: pointer;
}
.vz-fm-sw {
  appearance: none; -webkit-appearance: none; flex: 0 0 auto;
  width: 38px; height: 22px; margin: 0; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-border-l1); position: relative; cursor: pointer;
  transition: background .16s ease;
}
.vz-fm-sw::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1); transition: transform .16s ease;
}
.vz-fm-sw:checked { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.vz-fm-sw:checked::after { transform: translateX(16px); }
.vz-fm-check { display: flex; align-items: center; gap: 6px; font-size: .9em; cursor: pointer; }
`


    /**
     * Host tokens copied into every frame.
     *
     * These are the Harness's own design aliases (`--dsw-alias-*`), not a
     * generic design-system vocabulary: the client defines them on `:root` and
     * flips `data-ds-dark-theme` on `<body>` to switch palettes.
     */
    const HOST_TOKENS = [
      '--dsw-alias-label-primary',
      '--dsw-alias-label-primary-dimmed',
      '--dsw-alias-label-primary-inverted',
      '--dsw-alias-label-primary-foreground',
      '--dsw-alias-bg-base',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-layer-3',
      '--dsw-alias-bg-overlay',
      '--dsw-alias-border-l1',
      '--dsw-alias-border-l2',
      '--dsw-alias-border-l3',
      '--dsw-alias-border-l4',
      '--dsw-alias-brand-primary',
      '--dsw-alias-brand-text',
      '--dsw-alias-link',
      '--dsw-alias-state-error-primary',
      '--dsw-alias-state-success-primary',
      '--dsw-alias-state-warn-primary',
      '--dsw-alias-markdown-code-block',
      '--dsw-alias-markdown-inline-code',
      '--dsw-alias-interactive-bg-hover-accent',
      '--dsh-content-font-size',
      '--dsh-content-font-size-secondary',
      '--dsh-font-family-text',
      '--dsh-font-family-code',
    ]

    /**
     * Series colours. The Harness has no chart palette, so the plugin owns one
     * and switches it with the theme: the light set is tuned for a white
     * surface, the dark set for a near-black one. Both keep the same hue order,
     * so a series keeps its identity across a theme switch.
     */
    const SERIES_LIGHT = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']
    const SERIES_DARK = ['#60a5fa', '#fbbf24', '#34d399', '#a78bfa', '#f87171', '#22d3ee']

    /** Fallbacks used only when a host token is missing (a bare document). */
    const FALLBACK = {
      light: {
        text: '#1a1a1a',
        dim: '#6b6b6b',
        surface: '#ffffff',
        border: '#e3e3e3',
        accent: '#3b82f6',
      },
      dark: {
        text: '#e8e8e8',
        dim: '#9a9a9a',
        surface: '#1c1c1f',
        border: '#313136',
        accent: '#60a5fa',
      },
    }

    /**
     * The frame's stylesheet is `FRAME_CSS` — the same rules a markdown fence
     * injects: outer padding 0, `.viz-stack` spacing, the utility classes and
     * the tooltip styles. A fragment that relies on `.viz-stack` or
     * `viz.chart` therefore behaves identically on both surfaces.
     */

    /**
     * The readable text colour on a given background: dark text on a light
     * accent, white on a dark one. Background and text always ship as a
     * matched pair so the pair survives a palette switch.
     * @param colour - a `#rrggbb` or `rgb()/rgba()` colour.
     * @returns the text colour to put on `colour`.
     */
    function contrastOn(colour) {
      const hex = /^#([0-9a-f]{6})$/i.exec(colour)
      let r = 0
      let g = 0
      let b = 0
      if (hex !== null) {
        const n = parseInt(hex[1], 16)
        r = (n >> 16) & 255
        g = (n >> 8) & 255
        b = n & 255
      } else {
        const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(colour)
        if (m === null) return '#ffffff'
        r = Number(m[1])
        g = Number(m[2])
        b = Number(m[3])
      }
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      return luminance > 0.62 ? '#141414' : '#ffffff'
    }

    /** True when the Harness is showing its dark palette. */
    function hostIsDark() {
      if (typeof document === 'undefined') return false
      if (document.body !== null && document.body.hasAttribute('data-ds-dark-theme')) return true
      return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    }

    /**
     * Read the host's live theme values and build the frame's variable block.
     * @returns a `:root { … }` block, or '' outside a document.
     */
    function themeCss() {
      if (typeof document === 'undefined') return ''
      const style = getComputedStyle(document.documentElement)
      const bodyStyle = document.body === null ? style : getComputedStyle(document.body)
      const dark = hostIsDark()
      const fallback = dark ? FALLBACK.dark : FALLBACK.light

      const read = token => {
        const fromRoot = style.getPropertyValue(token).trim()
        return fromRoot !== '' ? fromRoot : bodyStyle.getPropertyValue(token).trim()
      }

      const pairs = []
      for (const token of HOST_TOKENS) {
        const value = read(token)
        if (value !== '') pairs.push(`${token}: ${value}`)
      }

      // Derived aliases the fragment and BASE_CSS both use, so a fragment never
      // has to know which `--dsw-alias-*` name means "body text".
      const text = read('--dsw-alias-label-primary') || fallback.text
      const dim = read('--dsw-alias-label-primary-dimmed') || fallback.dim
      const surface = read('--dsw-alias-bg-layer-1') || read('--dsw-alias-bg-base') || fallback.surface
      const border = read('--dsw-alias-border-l1') || fallback.border
      const accent = read('--dsw-alias-brand-primary') || read('--dsw-alias-link') || fallback.accent
      const fontSize = read('--dsh-content-font-size') || '14px'
      const fontFamily = read('--dsh-font-family-text')
      const fontCode = read('--dsh-font-family-code')
      const codeBg = read('--dsw-alias-markdown-code-block')

      pairs.push(`--vz-text: ${text}`)
      pairs.push(`--vz-dim: ${dim}`)
      pairs.push(`--vz-surface: ${surface}`)
      pairs.push(`--vz-border: ${border}`)
      pairs.push(`--vz-accent: ${accent}`)
      // The accent's readable text colour, computed from its luminance: a
      // light accent needs dark text, a dark one needs white. The old
      // `var(--vz-bg, #fff)` named a token that never existed and pinned
      // white text onto a light dark-mode accent.
      pairs.push(`--vz-accent-contrast: ${contrastOn(accent)}`)
      pairs.push(`--vz-font-size: ${fontSize}`)
      if (fontFamily !== '') pairs.push(`--vz-font: ${fontFamily}`)
      if (fontCode !== '') pairs.push(`--vz-font-code: ${fontCode}`)
      if (codeBg !== '') pairs.push(`--vz-code-bg: ${codeBg}`)

      const series = dark ? SERIES_DARK : SERIES_LIGHT
      series.forEach((colour, index) => pairs.push(`--viz-series-${index + 1}: ${colour}`))

      pairs.push(`color-scheme: ${dark ? 'dark' : 'light'}`)
      return `:root { ${pairs.join('; ')} }`
    }

    /** Watches the theme attribute and the palette so a switch re-renders. */
    function useThemeRevision() {
      const [revision, setRevision] = React.useState(0)
      React.useEffect(() => {
        if (typeof MutationObserver === 'undefined') return undefined
        const bump = () => setRevision(value => value + 1)
        const observer = new MutationObserver(bump)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
        if (document.body !== null) {
          observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class', 'style'] })
        }
        const media = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-color-scheme: dark)')
        if (media !== undefined && typeof media.addEventListener === 'function') media.addEventListener('change', bump)
        return () => {
          observer.disconnect()
          if (media !== undefined && typeof media.removeEventListener === 'function') media.removeEventListener('change', bump)
        }
      }, [])
      return revision
    }

    /**
     * Pull the tool's JSON answer out of a settled result.
     * @param block - the settled Tool result node.
     * @returns the parsed payload, or undefined when the result is not ours.
     */
    function payloadOf(block) {
      if (block === undefined || block === null) return undefined
      if (block.isError === true) return undefined
      const content = Array.isArray(block.content) ? block.content : []
      for (const part of content) {
        if (part === null || typeof part !== 'object' || part.type !== 'text') continue
        try {
          const value = JSON.parse(part.text)
          if (value !== null && typeof value === 'object' && typeof value.path === 'string') return value
        } catch {
          // Not our JSON; keep looking.
        }
      }
      return undefined
    }

    /** Build the `api/file` URL for an absolute path, honouring any base path. */
    function fileUrl(path) {
      const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI
      const url = new URL('api/file', base)
      url.searchParams.set('path', path)
      return url.toString()
    }

    /**
     * Report the frame's content height to the host, so the card hugs its
     * content instead of leaving a fixed-height gap.
     * @param nonce - correlation value the host listens for.
     * @returns an inline script for the frame.
     */
    function heightReporter(nonce) {
      return `<script>(function(){
  var NONCE = ${JSON.stringify(nonce)};
  function report() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height > 0) parent.postMessage({ dshVisualize: NONCE, height: height }, '*');
  }
  report();
  if (typeof ResizeObserver === 'function') new ResizeObserver(report).observe(document.documentElement);
  addEventListener('load', report);
  addEventListener('resize', report);
  setTimeout(report, 120);
})()</script>`
    }

    /** A chevron that points down when open and right when closed. */
    function Chevron({ open }) {
      return h('svg', {
        width: 12,
        height: 12,
        viewBox: '0 0 12 12',
        'aria-hidden': 'true',
        style: {
          flex: '0 0 auto',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform .15s ease',
        },
      }, h('path', {
        d: 'M2.5 4.5 L6 8 L9.5 4.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    /**
     * フレームの外にメニューを組み立てる(素の DOM。React は使わない)。
     *
     * サンドボックス iframe の中では trusted な操作が作れないため、iOS の
     * switch ハプティクスは親ページでしか鳴らない。ハンバーガー・パネル・
     * switch をここ(フレームの親)に置き、postMessage でフレームを操作する。
     *
     * @param outer - メニューを載せる要素(フレームのすぐ外側)。
     * @param send - フレームへコマンドを送る関数。
     * @returns メニューの API と破棄関数。
     */
    function mountFrameMenu(outer, send) {
      var state = { charts: [], zoom: 100, tableMode: false, collapsed: false }
      var ios = /iP(hone|ad|od)/.test(navigator.userAgent)
      var coarse = false
      try { coarse = matchMedia('(pointer: coarse)').matches } catch (e) { /* no matchMedia */ }

      /** ハプティクス: iOS は switch の trusted click、他は navigator.vibrate。 */
      function haptic(ms) {
        if (ios && switchEl !== null) {
          try { switchEl.click() } catch (e) { /* no haptic */ }
          return
        }
        try { navigator.vibrate(ms === undefined ? 14 : ms) } catch (e) { /* no vibration */ }
      }

      function el(tag, cls, text) {
        var node = document.createElement(tag)
        if (cls !== undefined) node.className = cls
        if (text !== undefined) node.textContent = text
        return node
      }

      // ハンバーガー(右上)。
      var btn = el('button', 'vz-fm-btn')
      btn.type = 'button'
      btn.setAttribute('aria-label', '表示メニュー')
      btn.setAttribute('aria-expanded', 'false')
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">'
        + '<path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>'

      // iOS: ボタンの上に label + hidden switch。指のタップが trusted なトグルになる。
      var switchEl = null
      if (ios) {
        var label = el('label', 'vz-fm-haptic')
        label.setAttribute('aria-hidden', 'true')
        switchEl = el('input', 'vz-fm-switch')
        switchEl.type = 'checkbox'
        switchEl.setAttribute('switch', '')
        switchEl.addEventListener('click', function (event) { event.stopPropagation() })
        label.appendChild(switchEl)
        btn.appendChild(label)
      }

      // パネル。中身は build() が組み立てる。
      var panel = el('div', 'vz-fm-panel')
      panel.setAttribute('data-open', 'false')

      outer.appendChild(btn)
      outer.appendChild(panel)

      var open = false
      function setOpen(next) {
        open = next
        panel.setAttribute('data-open', next ? 'true' : 'false')
        btn.setAttribute('data-open', next ? 'true' : 'false')
        btn.setAttribute('aria-expanded', next ? 'true' : 'false')
        if (next) build()
        if (next) haptic(14)
      }

      function row() { var r = el('div', 'vz-fm-row'); panel.appendChild(r); return r }
      function head(text) { panel.appendChild(el('div', 'vz-fm-h', text)) }
      function small(text, onClick) {
        var b = el('button', 'vz-fm-s', text)
        b.type = 'button'
        b.addEventListener('click', onClick)
        return b
      }

      var FORMATS = [
        ['chart-png', 'グラフ(透過 PNG)'],
        ['frame-png', '画像(PNG 背景付き)'],
        ['frame-jpeg', '画像(JPEG 背景付き)'],
        ['text', 'text'],
        ['html', 'html'],
        ['md', 'md'],
        ['table', '表(TSV)'],
      ]

      /** 折り畳みセクションの開閉状態(既定は閉)。 */
      var opened = {}
      /** 文字設定。 */
      var font = { family: '', size: 0, role: 'all' }

      /** 見出しをタップで開閉するセクションを作る。@returns 中身を入れる要素。 */
      function section(title, key) {
        var body = el('div', 'vz-fm-body')
        body.style.display = opened[key] === true ? 'block' : 'none'
        var header = el('button', 'vz-fm-h', title)
        header.type = 'button'
        header.setAttribute('aria-expanded', opened[key] === true ? 'true' : 'false')
        header.addEventListener('click', function () {
          opened[key] = opened[key] !== true
          body.style.display = opened[key] === true ? 'block' : 'none'
          header.setAttribute('aria-expanded', opened[key] === true ? 'true' : 'false')
          haptic(12)
        })
        panel.appendChild(header)
        panel.appendChild(body)
        return body
      }

      /** 使われている要素だけをプルダウンに並べる(色は内容側の CSS 変数)。 */
      var COLORS = [
        ['text', '本文の色'],
        ['dim', '補助文字の色'],
        ['surface', '面の色'],
        ['accent', '強調の色'],
        ['border', '枠線の色'],
      ]
      var FONTS = [
        ['', '既定(ハーネス)'],
        ['system-ui, sans-serif', 'システム'],
        ['-apple-system, BlinkMacSystemFont, sans-serif', 'Apple'],
        ['"Hiragino Kaku Gothic ProN", sans-serif', 'ヒラギノ'],
        ['ui-monospace, monospace', '等幅'],
        ['serif', 'セリフ'],
      ]

      function build() {
        panel.textContent = ''

        // 表示: グラフ / 表
        var viewBody = section('表示', 'view')
        var viewRow = el('div', 'vz-fm-row')
        viewRow.appendChild(small(state.tableMode ? 'グラフ' : 'グラフ ✓', function () {
          state.tableMode = false
          send({ type: 'view', table: false })
          build()
        }))
        viewRow.appendChild(small(state.tableMode ? '表 ✓' : '表', function () {
          state.tableMode = true
          send({ type: 'view', table: true })
          build()
        }))
        viewBody.appendChild(viewRow)

        // コピー / ダウンロード(公式プルダウン + COPY/DL + 実行)
        if (!state.tableMode) {
          var exportBody = section('コピー / ダウンロード', 'export')
          var formatRow = el('div', 'vz-fm-row')
          var format = el('select', 'vz-fm-select')
          FORMATS.forEach(function (pair) {
            var option = el('option', undefined, pair[1])
            option.value = pair[0]
            format.appendChild(option)
          })
          formatRow.appendChild(format)
          exportBody.appendChild(formatRow)

          var targetRow = el('div', 'vz-fm-row')
          var target = el('select', 'vz-fm-select')
          targetRow.appendChild(target)
          function syncTarget() {
            var isChart = format.value === 'chart-png'
            targetRow.style.display = isChart && state.charts.length > 1 ? 'flex' : 'none'
            if (!isChart) return
            target.textContent = ''
            state.charts.forEach(function (title, index) {
              var option = el('option', undefined, title)
              option.value = String(index)
              target.appendChild(option)
            })
          }
          format.addEventListener('change', syncTarget)
          syncTarget()
          exportBody.appendChild(targetRow)

          var modeRow = el('div', 'vz-fm-row')
          var modeLabel = el('span', 'vz-fm-label', 'COPY')
          var modeSwitch = el('input', 'vz-fm-sw')
          modeSwitch.type = 'checkbox'
          modeSwitch.setAttribute('role', 'switch')
          modeSwitch.setAttribute('aria-label', 'COPY と DL の切り替え')
          modeSwitch.addEventListener('change', function () {
            modeLabel.textContent = modeSwitch.checked ? 'DL' : 'COPY'
          })
          modeRow.appendChild(modeLabel)
          modeRow.appendChild(modeSwitch)
          exportBody.appendChild(modeRow)

          var includeRow = el('div', 'vz-fm-row')
          var include = el('input')
          include.type = 'checkbox'
          include.checked = true
          var includeLabel = el('label', 'vz-fm-check')
          includeLabel.appendChild(include)
          includeLabel.appendChild(document.createTextNode('md にグラフを含む'))
          includeRow.appendChild(includeLabel)
          exportBody.appendChild(includeRow)

          var goRow = el('div', 'vz-fm-row')
          goRow.appendChild(small('実行', function () {
            haptic(16)
            send({
              type: 'export',
              format: format.value,
              mode: modeSwitch.checked ? 'dl' : 'copy',
              target: Number(target.value) || 0,
              includeCharts: include.checked,
            })
          }))
          exportBody.appendChild(goRow)
        }

        // 拡大率
        var zoomBody = section('拡大率', 'zoom')
        var zoomRow = el('div', 'vz-fm-row')
        var zoom = el('input')
        zoom.type = 'range'
        zoom.min = '50'
        zoom.max = '200'
        zoom.step = '5'
        zoom.value = String(state.zoom)
        var zoomLabel = el('span', 'vz-fm-label', state.zoom + '%')
        zoom.addEventListener('input', function () {
          state.zoom = Number(zoom.value)
          zoomLabel.textContent = state.zoom + '%'
          send({ type: 'zoom', value: state.zoom })
        })
        zoomRow.appendChild(zoom)
        zoomRow.appendChild(zoomLabel)
        zoomBody.appendChild(zoomRow)

        // 文字: フォントとサイズ
        var textBody = section('文字', 'text')
        // どの役割の文字を変えるか(既定はすべて)。
        var roleRow = el('div', 'vz-fm-row')
        var roleLabel = el('span', 'vz-fm-label', '対象')
        var roleSelect = el('select', 'vz-fm-select')
        ;[['all', 'すべて'], ['title', 'タイトル'], ['label', '軸ラベル'], ['tick', '目盛り']].forEach(function (pair) {
          var option = el('option', undefined, pair[1])
          option.value = pair[0]
          if (font.role === pair[0]) option.selected = true
          roleSelect.appendChild(option)
        })
        roleSelect.addEventListener('change', function () {
          font.role = roleSelect.value
        })
        roleRow.appendChild(roleLabel)
        roleRow.appendChild(roleSelect)
        textBody.appendChild(roleRow)

        var fontRow = el('div', 'vz-fm-row')
        var fontLabel = el('span', 'vz-fm-label', 'フォント')
        var fontSelect = el('select', 'vz-fm-select')
        FONTS.forEach(function (pair) {
          var option = el('option', undefined, pair[1])
          option.value = pair[0]
          if (font.family === pair[0]) option.selected = true
          fontSelect.appendChild(option)
        })
        fontSelect.addEventListener('change', function () {
          font.family = fontSelect.value
          send({ type: 'font', fonts: { family: font.family, size: font.size, role: font.role } })
        })
        fontRow.appendChild(fontLabel)
        fontRow.appendChild(fontSelect)
        textBody.appendChild(fontRow)

        var sizeRow = el('div', 'vz-fm-row')
        var sizeLabel = el('span', 'vz-fm-label', '基本サイズ')
        var size = el('input')
        size.type = 'range'
        size.min = '10'
        size.max = '24'
        size.step = '1'
        size.value = String(font.size === 0 ? 14 : font.size)
        var sizeValue = el('span', 'vz-fm-label', size.value + 'px')
        size.addEventListener('input', function () {
          font.size = Number(size.value)
          sizeValue.textContent = font.size + 'px'
          send({ type: 'font', fonts: { family: font.family, size: font.size, role: font.role } })
        })
        sizeRow.appendChild(sizeLabel)
        sizeRow.appendChild(size)
        sizeRow.appendChild(sizeValue)
        textBody.appendChild(sizeRow)

        // 色: 使われている要素だけをプルダウンで選び、色を決める
        var colorBody = section('色', 'color')
        var colorRow = el('div', 'vz-fm-row')
        var colorTarget = el('select', 'vz-fm-select')
        COLORS.forEach(function (pair) {
          var option = el('option', undefined, pair[1])
          option.value = pair[0]
          colorTarget.appendChild(option)
        })
        var colorInput = el('input')
        colorInput.type = 'color'
        colorInput.value = '#000000'
        colorInput.addEventListener('input', function () {
          send({ type: 'color', key: colorTarget.value, value: colorInput.value })
        })
        colorRow.appendChild(colorTarget)
        colorRow.appendChild(colorInput)
        colorBody.appendChild(colorRow)

        // リセット
        var resetBody = section('リセット', 'reset')
        var resetRow = el('div', 'vz-fm-row')
        resetRow.appendChild(small('デフォルトに戻す', function () {
          state.tableMode = false
          state.zoom = 100
          font.family = ''
          font.size = 0
          font.role = 'all'
          send({ type: 'reset' })
          build()
        }))
        resetBody.appendChild(resetRow)

        // スクロール
        var scrollBody = section('スクロール', 'scroll')
        var scrollRow = el('div', 'vz-fm-row')
        var scroll = el('select', 'vz-fm-select')
        ;['none', 'x', 'y', 'both'].forEach(function (mode) {
          var option = el('option', undefined, mode)
          option.value = mode
          scroll.appendChild(option)
        })
        scroll.addEventListener('change', function () {
          send({ type: 'scroll', value: scroll.value })
        })
        scrollRow.appendChild(scroll)
        scrollBody.appendChild(scrollRow)
      }

      btn.addEventListener('click', function (event) {
        event.stopPropagation()
        setOpen(!open)
      })
      // 外側クリックで閉じる(パネル内の操作では閉じない)。
      document.addEventListener('pointerdown', function (event) {
        if (!open) return
        if (panel.contains(event.target) || btn.contains(event.target)) return
        setOpen(false)
      }, { passive: true })
      panel.addEventListener('pointerdown', function (event) { event.stopPropagation() }, { passive: true })

      // タッチ: フレームが長押しを検出したら dshVizHold で知らせてくる。
      // ここでは何もしない(受け口は VisualizeView の message ハンドラ)。

      return {
        setOpen: setOpen,
        setMeta: function (charts) {
          state.charts = charts
          if (open) build()
        },
        haptic: haptic,
        destroy: function () {
          if (btn.parentNode !== null) btn.parentNode.removeChild(btn)
          if (panel.parentNode !== null) panel.parentNode.removeChild(panel)
        },
      }
    }

    /**
     * One visualization: a disclosure header over a sandboxed frame.
     * @param props - the Tool view props supplied by the Tool layer.
     */
    function VisualizeView(props) {
      const { block, phase } = props
      const payload = React.useMemo(() => payloadOf(block), [block])
      const revision = useThemeRevision()
      const [html, setHtml] = React.useState(undefined)
      const [restored, setRestored] = React.useState(null)
      const [failure, setFailure] = React.useState(undefined)
      const [open, setOpen] = React.useState(true)
      const [hover, setHover] = React.useState(false)
      const [height, setHeight] = React.useState(undefined)
      const nonce = React.useMemo(() => Math.random().toString(36).slice(2), [])
      const frameRef = React.useRef(null)
      // フレームの外に置くメニュー(ハンバーガー・haptic)と、その載せ先。
      const menuApi = React.useRef(null)
      const outerRef = React.useRef(null)
      const payloadPath = payload === undefined ? '' : payload.path

      React.useEffect(() => {
        if (payload === undefined) return undefined
        let live = true
        setFailure(undefined)
        setHtml(undefined)
        setRestored(null)
        // The fragment's viz.restore() starts from what the reader last chose,
        // so fetch the stored snapshot the same way the markdown fence does.
        const stateUrl = new URL('api/visualize/state', document.baseURI)
        stateUrl.searchParams.set('session', sessionOf(payload.path) ?? '')
        stateUrl.searchParams.set('title', titleOf(payload.path) ?? '')
        const readState = fetch(stateUrl.toString())
          .then(response => (response.ok ? response.text() : 'null'))
          .then(text => { try { return JSON.parse(text) } catch { return null } })
          .catch(() => null)
        const readHtml = fetch(fileUrl(payload.path))
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.text()
          })
        Promise.all([readHtml, readState])
          .then(([text, state]) => {
            if (!live) return
            setRestored(state)
            setHtml(text)
          })
          .catch(error => { if (live) setFailure(String(error && error.message ? error.message : error)) })
        return () => { live = false }
      }, [payload === undefined ? '' : payload.path])

      React.useEffect(() => {
        if (typeof window === 'undefined') return undefined
        const onMessage = event => {
          const data = event.data
          if (data === null || typeof data !== 'object' || data.dshVisualize !== nonce) return
          if (frameRef.current !== null && event.source !== frameRef.current.contentWindow) return
          if (typeof data.height === 'number' && data.height > 0) {
            setHeight(Math.min(1200, Math.ceil(data.height)))
          }
          // フレームの長押し → 親メニューを開く(ハプティクスも鳴らす)。
          if (data.dshVizHold === true) {
            if (menuApi.current !== null) menuApi.current.setOpen(true)
            return
          }
          if (typeof data.dshVizHaptic === 'number') {
            if (menuApi.current !== null) menuApi.current.haptic(data.dshVizHaptic)
            return
          }
          if (Array.isArray(data.dshVizMeta)) {
            if (menuApi.current !== null) menuApi.current.setMeta(data.dshVizMeta)
            return
          }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [nonce])

      // メニューはフレームの外(この枠の中)に素の DOM で載せる。
      // サンドボックス iframe では trusted な操作が作れず、iOS の haptic が
      // 鳴らないため、ハンバーガーと switch は親ページ側に置く。
      React.useEffect(() => {
        if (phase !== 'result' || payload === undefined) return undefined
        const outer = outerRef.current
        if (outer === null) return undefined
        // メニューの CSS を親ドキュメントへ一度だけ注入する。
        const styleId = 'dsh-viz-frame-menu-css'
        if (document.getElementById(styleId) === null) {
          const style = document.createElement('style')
          style.id = styleId
          style.textContent = FRAME_MENU_CSS
          document.head.appendChild(style)
        }
        const api = mountFrameMenu(outer, command => {
          const frame = frameRef.current
          if (frame === null) return
          frame.contentWindow?.postMessage({ vizCommand: command }, '*')
        })
        menuApi.current = api
        return () => {
          menuApi.current = null
          api.destroy()
        }
      }, [phase, payloadPath, revision])

      if (phase !== 'result' || payload === undefined) {
        // Preparing / running, or a result we do not own: stay out of the way.
        return null
      }

      const wide = payload.mode === 'wide'
      const card = payload.card === true
      const scroll = typeof payload.scroll === 'string' ? payload.scroll : 'none'
      const widthPx = typeof payload.width === 'number' && payload.width > 0 ? payload.width : undefined
      // A missing runtime would leave `viz` undefined and every JS-drawn chart
      // blank while the static HTML still rendered — say so instead of showing
      // a half-empty card.
      const runtimeMissing = FRAME_SCRIPT.trim() === '' || FRAME_CSS.trim() === ''
      const source = html === undefined || runtimeMissing
        ? undefined
        : `<!doctype html><html><head><meta charset="utf-8">`
          + `<meta name="viewport" content="width=device-width, initial-scale=1">`
          + `<style>${themeCss()}</style><style>${FRAME_CSS}</style>`
          + (card ? `<style>${FRAME_CARD_CSS}</style>` : '')
          + '</head><body>'
          + `<script>window.__dshVizPath=${JSON.stringify(payload.path)}</script>`
          + `<script>window.__dshVizSession=${JSON.stringify(sessionOf(payload.path) ?? '')}</script>`
          + `<script>window.__dshVizState=${JSON.stringify(restored ?? null)}</script>`
          + `<script>window.__dshVizScroll=${JSON.stringify(scroll)}</script>`
          + `<script>window.__dshVizMenuHosted=true</script>`
          + `<script>${FRAME_SCRIPT}</script>`
          + html + heightReporter(nonce) + `</body></html>`

      // A full-width button, so the whole header is a hit target on a phone.
      const header = h('button', {
        key: 'head',
        type: 'button',
        'aria-expanded': open,
        onClick: () => setOpen(value => !value),
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '9px 12px',
          margin: 0,
          border: 0,
          cursor: 'pointer',
          background: hover ? 'var(--dsw-alias-interactive-bg-hover-accent)' : 'transparent',
          color: 'var(--dsw-alias-label-primary-dimmed)',
          font: 'inherit',
          fontSize: '12px',
          lineHeight: 1.4,
          textAlign: 'left',
          transition: 'background .12s ease',
        },
      }, [
        h(Chevron, { key: 'chev', open }),
        h('span', {
          key: 'title',
          style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, payload.title),
        h('a', {
          key: 'open',
          href: fileUrl(payload.path),
          target: '_blank',
          rel: 'noreferrer noopener',
          onClick: event => event.stopPropagation(),
          style: { flex: '0 0 auto', color: 'inherit', opacity: 0.8, textDecoration: 'none' },
        }, 'open'),
      ])

      const divider = card ? '1px solid var(--dsw-alias-border-l1)' : '0'
      let body
      if (failure !== undefined) {
        body = h('div', {
          key: 'failure',
          style: {
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--dsw-alias-state-error-primary)',
            borderTop: divider,
          },
        }, `visualization unavailable: ${failure}`)
      } else if (source === undefined) {
        body = h('div', {
          key: 'loading',
          style: {
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--dsw-alias-label-primary-dimmed)',
            borderTop: divider,
          },
        }, 'loading…')
      } else {
        body = h('iframe', {
          key: `frame-${revision}`,
          ref: frameRef,
          title: payload.title,
          srcDoc: source,
          sandbox: 'allow-scripts',
          style: {
            width: '100%',
            height: `${height === undefined ? (wide ? 420 : 360) : height}px`,
            border: '0',
            display: 'block',
            background: 'transparent',
            borderTop: divider,
            transition: 'height .12s ease',
          },
        })
      }

      if (!card) {
        // 既定は本文に溶け込む。枠も見出しも付けず、呼び出し位置に可視化だけを置く。
        // 幅は既定で本文カラムいっぱい(max 920px)。width 指定があるときはその幅に
        // 縮めて中央に置く。
        return h('div', {
          'data-dsh-visualize': payload.title,
          ref: outerRef,
          className: 'vz-fm-frame',
          style: {
            position: 'relative',
            margin: widthPx === undefined ? '10px 0' : '10px auto',
            maxWidth: widthPx === undefined ? '100%' : `${widthPx}px`,
            color: 'var(--dsw-alias-label-primary)',
          },
        }, body)
      }

      return h('div', {
        'data-dsh-visualize': payload.title,
        ref: outerRef,
        className: 'vz-fm-frame',
        style: {
          position: 'relative',
          // overflow を切るとメニューがはみ出して消えるので、この枠では切らない。
          margin: widthPx === undefined ? '10px 0' : '10px auto',
          maxWidth: widthPx === undefined ? '100%' : `${widthPx}px`,
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: '12px',
          background: 'var(--dsw-alias-bg-layer-1)',
          color: 'var(--dsw-alias-label-primary)',
        },
      }, [header, open ? body : null])
    }

    /**
     * The Session a visualization belongs to.
     *
     * The store is `<home>/visualize/<sessionId>/<title>.html`, so the path the
     * frame reports already names its Session. That is more reliable than
     * asking which tab is in front.
     * @param path - absolute visualization path.
     * @returns the Session id, or undefined when the path is not one of ours.
     */
    function sessionOf(path) {
      const parts = String(path).split(/[\\/]/)
      const at = parts.lastIndexOf('visualize')
      return at >= 0 && parts.length > at + 2 ? parts[at + 1] : undefined
    }

    /**
     * The visualization's title, which is its file name without the extension.
     * @param path - absolute visualization path.
     * @returns the title, or undefined when the path names no html file.
     */
    function titleOf(path) {
      const match = /([^\\/]+)\.html$/.exec(String(path))
      return match === null ? undefined : match[1]
    }

    /**
     * Write text to the clipboard.
     * @param text - the payload.
     * @returns a promise that settles when the write completes.
     */
    function copyToClipboard(text) {
      return navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('no clipboard'))
    }

    /**
     * Write an image to the clipboard as `image/png`.
     *
     * A data URL pasted as text gives the reader a wall of base64, which is
     * useless as an image — the point of Copy for an image format is a bitmap
     * on the clipboard. `ClipboardItem` takes the blob directly.
     * @param dataUrl - a `data:image/png;base64,…` URL.
     * @returns a promise that settles when the write completes.
     */
    async function copyImage(dataUrl) {
      if (typeof ClipboardItem === 'undefined' || navigator.clipboard?.write === undefined) {
        throw new Error('image clipboard unsupported')
      }
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    }

    /**
     * Relay what a visualization reports to the host.
     *
     * The frame cannot reach the host itself (opaque origin), so it posts to
     * this window. Only a message carrying a marker is forwarded, and the host
     * re-checks that the path belongs to its own store.
     * @param ctx - owning client context.
     */
    function relayState(ctx) {
      if (typeof window === 'undefined') return
      window.addEventListener('message', event => {
        const data = event.data
        if (data === null || typeof data !== 'object') return

        if (typeof data.dshVizState === 'string' && data.dshVizState !== '') {
          const session = typeof data.dshVizSession === 'string' ? data.dshVizSession : ''
          const title = titleOf(data.dshVizState)
          if (session === '' || title === undefined) return
          const url = new URL('api/visualize/state', document.baseURI)
          void fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session, title, state: data.state ?? null }),
          }).catch(() => {})
          return
        }

        // The frame cannot reach the clipboard or trigger a download (opaque
        // origin, no allow-downloads), so it posts and this window acts.
        if (typeof data.dshVizCopy === 'string' && data.dshVizCopy !== '') {
          void copyToClipboard(data.dshVizCopy).catch(() => {})
          return
        }
        if (data.dshVizCopyImage !== undefined && data.dshVizCopyImage !== null) {
          // 画像はテキストとしてではなく、クリップボードの image/png として置く。
          // dataURL をそのまま文字列コピーすると base64 の羅列になる(実測で指摘)。
          void copyImage(data.dshVizCopyImage).catch(() => {})
          return
        }
        if (data.dshVizDownload !== null && typeof data.dshVizDownload === 'object') {
          const dl = data.dshVizDownload
          if (typeof dl.name !== 'string' || typeof dl.url !== 'string') return
          const a = document.createElement('a')
          a.href = dl.url
          a.download = dl.name
          document.body.appendChild(a)
          a.click()
          a.remove()
          return
        }

        // A drill-down: the reader asked for the selected values to be
        // investigated, so start a turn in the visualization's own Session.
        if (typeof data.dshVizFollowUp === 'string' && data.dshVizFollowUp !== '') {
          const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : ''
          if (prompt === '') return
          ctx.inject(['sessions', 'conversation'], scope => {
            // The Session being read, which is the fork's own id when the
            // transcript came from a fork. Falling back to the path would send
            // the prompt to the Session that first drew the visualization.
            const id = typeof data.dshVizSession === 'string' && data.dshVizSession !== ''
              ? data.dshVizSession
              : sessionOf(data.dshVizFollowUp)
            if (id === undefined) return
            const session = scope.sessions.binding(id)?.session
            if (session === undefined) return
            void scope.conversation.sendSession(session, prompt, [], 'queue').catch(() => {})
          })
        }
      })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        relayState(ctx)
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'visualize',
        }, VisualizeView))
      },
    }
  },
})
