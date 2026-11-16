(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = Engine.esc;
  const icon = (id, cls = 'ic') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtN = n => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  function btn(cls, html, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = html; b.onclick = fn; return b; }
  function flip(el, mutate, dur = 550) {
    const a = el.getBoundingClientRect(); mutate(); const b = el.getBoundingClientRect();
    if (reduced) return;
    el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  // ---------------------------------------------------------------- Progreso
  const store = {
    get(k, d) { try { const v = localStorage.getItem('gsql.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('gsql.' + k, JSON.stringify(v)); } catch { } }
  };
  const P = {
    solved: new Set(store.get('solved', [])), peeked: new Set(store.get('peeked', [])), quiz: store.get('quiz', {}),
    qx: new Set(store.get('qx', [])), game: new Set(store.get('game', [])), known: new Set(store.get('known', [])),
    seen: new Set(store.get('seen', [])), xp: store.get('xp', 0), drafts: store.get('drafts', {}), best: store.get('best', null), hist: store.get('hist', [])
  };
  function save() {
    store.set('solved', [...P.solved]); store.set('peeked', [...P.peeked]); store.set('quiz', P.quiz); store.set('qx', [...P.qx]);
    store.set('game', [...P.game]); store.set('known', [...P.known]); store.set('seen', [...P.seen]); store.set('xp', P.xp); store.set('best', P.best); store.set('hist', P.hist);
  }
  let draftT;
  const saveDraft = (id, v) => { P.drafts[id] = v; clearTimeout(draftT); draftT = setTimeout(() => store.set('drafts', P.drafts), 400); };

  const LEVELS = [[0, 'Recién llegado'], [40, 'Aprendiz del SELECT'], [120, 'Domador del WHERE'], [250, 'Maestro del GROUP BY'], [420, 'Ninja del JOIN'], [650, 'Gurú de las subconsultas'], [950, 'Listo para aprobar'], [1300, 'Leyenda del SQL']];
  const level = xp => { let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++; return i; };
  function updateTop() {
    const li = level(P.xp), lo = LEVELS[li][0], next = LEVELS[li + 1];
    $('#lvlName').textContent = LEVELS[li][1];
    $('#lvlXp').textContent = `${P.xp} XP` + (next ? ` · faltan ${next[0] - P.xp}` : '');
    $('#lvlBadge').style.setProperty('--p', (next ? Math.min(100, (P.xp - lo) / (next[0] - lo) * 100) : 100) + '%');
    const total = DATA.EX.length, done = DATA.EX.filter(e => P.solved.has(e.id)).length;
    $('#progTxt').textContent = `${done} / ${total}`;
    $('#progBar').style.width = (done / total * 100) + '%';
    if ($('#stDone')) { $('#stDone').textContent = done; $('#stEx').textContent = total; }
  }
  function addXP(n, why) {
    const before = level(P.xp); P.xp += n; save(); updateTop(); toast(`+${n} XP · ${why}`);
    if (level(P.xp) > before) setTimeout(() => { toast(`¡Nuevo nivel: ${LEVELS[level(P.xp)][1]}!`, 'trophy'); confetti(180); }, 700);
  }

  // ---------------------------------------------------------------- Toasts y confetti
  function toast(msg, ic = 'star') {
    const t = h(`<div class="toast"><span class="ti">${icon(ic)}</span><span>${esc(msg)}</span></div>`);
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
  }
  const cv = $('#confetti'), cx = cv.getContext('2d');
  let parts = [], raf = null;
  function confetti(n = 90) {
    if (reduced) return;
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f97316'];
    for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 260, y: innerHeight * .38, vx: (Math.random() - .5) * 15, vy: -Math.random() * 14 - 4, s: Math.random() * 7 + 5, c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - .5) * .3, t: 0 });
    if (!raf) tick();
  }
  function tick() {
    cx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.vy += .36; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.t++;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore();
    }
    parts = parts.filter(p => p.y < cv.height + 40 && p.t < 260);
    raf = parts.length ? requestAnimationFrame(tick) : (cx.clearRect(0, 0, cv.width, cv.height), null);
  }

  // ---------------------------------------------------------------- Resaltado de SQL
  const KW = 'SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|BETWEEN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|DISTINCT|AS|ASC|DESC|INNER|LEFT|RIGHT|OUTER|NATURAL|JOIN|ON|INSERT|INTO|VALUES|UPDATE|SET|DELETE|EXISTS|ALL|ANY|SOME|INTERVAL|DAY|MONTH|YEAR|TOP|CASE|WHEN|THEN|ELSE|END|UNION|USE|CREATE|TABLE|DROP|ALTER|PRIMARY|KEY|FOREIGN|REFERENCES';
  const FN = 'COUNT|SUM|AVG|MAX|MIN|YEAR|MONTH|DAY|CURDATE|NOW|DATEDIFF|DATE_FORMAT|ADDDATE|DATE_ADD|DATE_SUB|SUBDATE|TIMESTAMPDIFF|DATE|CONCAT|ROUND|UPPER|LOWER|LENGTH|IFNULL|COALESCE|GETDATE|SUBSTRING|TRIM';
  const HRE = new RegExp(`(--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|('(?:[^']|'')*'?)|\\b(${FN})\\b(?=\\s*\\()|\\b(${KW})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|(<>|>=|<=|!=|[=<>])`, 'gi');
  function highlight(code) {
    let out = '', last = 0, m;
    HRE.lastIndex = 0;
    while ((m = HRE.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'fn' : m[4] ? 'kw' : m[5] ? 'num' : 'op';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
      if (!m[0].length) HRE.lastIndex++;
    }
    return out + esc(code.slice(last));
  }

  // ---------------------------------------------------------------- Motor
  let DB = null, TP7 = null, ready = false;
  const waiters = [], readyHooks = [];
  const onReady = fn => ready ? fn() : readyHooks.push(fn);
  const whenReady = fn => ready ? fn() : (waiters.push(fn), toast('El motor SQL todavía está cargando...', 'clock'));
  const runMain = sql => Engine.run(DB, sql);

  // ---------------------------------------------------------------- Resultados
  function cell(v) {
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    if (typeof v === 'number') return `<td class="n">${Number.isInteger(v) ? v : +v.toFixed(2)}</td>`;
    return `<td title="${esc(v)}">${esc(v)}</td>`;
  }
  function tableHTML(r, max = 200) {
    if (!r) return '';
    const rows = r.values.slice(0, max);
    return `<div class="rt-wrap"><table class="rt"><thead><tr>${r.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell).join('')}</tr>`).join('')}${r.values.length ? '' : `<tr><td colspan="${r.columns.length}" class="null">(0 filas)</td></tr>`}</tbody></table></div>`;
  }
  const warnHTML = ws => (ws || []).map(w => `<div class="msg-warn">${icon('alert')}<div>${w}</div></div>`).join('');
  function renderRun(el, out) {
    let html = warnHTML(out.warnings);
    if (out.error) html += `<div class="msg-err">${icon('x')}<div><b class="t">Error</b><br>${out.error}</div></div>`;
    else if (out.result) {
      if (out.note) html += `<div class="msg-ok">${icon('check')}<div>${out.note}</div></div>`;
      html += tableHTML(out.result);
      html += `<div class="meta"><span class="pill">${out.result.values.length} fila(s)</span>${out.result.values.length > 200 ? '<span>mostrando las primeras 200</span>' : ''}${out.ms != null ? `<span>${out.ms.toFixed(1)} ms</span>` : ''}</div>`;
    } else html += `<div class="msg-ok">${icon('check')}<div>Listo. Filas afectadas: <b>${out.affected}</b></div></div>`;
    el.innerHTML = html;
  }

  // ---------------------------------------------------------------- Editor con resaltado
  function makeEditor(value, opts = {}) {
    const el = h(`<div class="ed"><pre aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${esc(opts.placeholder || 'Escribí tu consulta acá...')}"></textarea></div>`);
    const pre = el.firstElementChild, ta = el.lastElementChild;
    const sync = () => {
      pre.innerHTML = highlight(ta.value) + '\n';
      ta.style.height = 'auto';
      ta.style.height = Math.max(opts.min || 96, ta.scrollHeight) + 'px';
    };
    ta.value = value || '';
    ta.addEventListener('input', () => { sync(); opts.onChange && opts.onChange(ta.value); });
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); opts.onRun && opts.onRun(); }
      else if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); sync(); }
    });
    el.ed = { get: () => ta.value, set: v => { ta.value = v; sync(); opts.onChange && opts.onChange(v); }, focus: () => ta.focus(), refresh: sync };
    requestAnimationFrame(sync);
    return el;
  }

  // ---------------------------------------------------------------- Tarjetas de código
  function codeCard(code, o = {}) {
    const kind = o.kind || '';
    const title = o.title || (kind === 'bad' ? 'Mal' : kind === 'good' ? 'Bien' : 'SQL');
    const card = h(`<div class="code ${kind}"><div class="code-bar"><span class="dots"><i></i><i></i><i></i></span><span class="code-title">${title}</span><span class="sp"></span></div><div class="code-body"></div><div class="res"></div></div>`);
    const bar = card.querySelector('.code-bar'), body = card.querySelector('.code-body'), res = card.querySelector('.res');
    const pre = h('<pre class="hl"></pre>'); pre.innerHTML = highlight(code); body.appendChild(pre);
    let ed = null;
    const get = () => ed ? ed.ed.get() : code;
    const runner = o.runner || runMain;
    if (!o.norun) {
      const run = btn('b-run', icon('play', 'ic fill') + 'Ejecutar', () => whenReady(() => renderRun(res, runner(get()))));
      const edit = btn('b-g', icon('edit') + 'Editar', () => { ed = makeEditor(code, { onRun: () => run.click() }); body.replaceChildren(ed); ed.ed.refresh(); ed.ed.focus(); edit.remove(); });
      bar.append(run, edit);
    }
    const cp = btn('b-g', icon('copy') + '<span>Copiar</span>', () => { navigator.clipboard && navigator.clipboard.writeText(get()); cp.lastChild.textContent = '¡Copiado!'; setTimeout(() => cp.lastChild.textContent = 'Copiar', 1500); });
    bar.append(cp);
    if (!o.norun && !o.noLab) bar.append(btn('b-g', icon('flask') + 'Lab', () => toLab(get())));
    return card;
  }
  function processCode(root = document) {
    $$('pre.sql', root).forEach(pre => {
      const code = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
      const kind = pre.classList.contains('bad') ? 'bad' : pre.classList.contains('good') ? 'good' : '';
      pre.replaceWith(codeCard(code, { kind, norun: pre.classList.contains('norun') }));
    });
  }

  // ---------------------------------------------------------------- Ejercicios
  const EXBY = Object.fromEntries(DATA.EX.map(e => [e.id, e]));
  const CATS = DATA.CATS;
  function exRunner(ex) {
    return sql => {
      const d = Engine.fresh(ex.db || 'oficial');
      try {
        if (ex.setup) d.exec(Engine.translate(ex.setup));
        let r = Engine.run(d, sql);
        if (!r.error && !r.result && ex.verify) {
          const v = Engine.run(d, ex.verify);
          v.warnings = r.warnings; v.note = `Tu cambio afectó <b>${r.affected}</b> fila(s). Así quedó la tabla:`; r = v;
        }
        return r;
      } finally { d.close(); }
    };
  }
  function feedbackHTML(r) {
    let cmp = '';
    if (!r.ok && r.exp && r.exp.columns)
      cmp = `<details style="margin-top:8px"><summary class="note" style="cursor:pointer">Comparar tu resultado con el esperado</summary><div class="cmp"><div><h6>Tu resultado</h6>${r.user ? tableHTML(r.user, 60) : '<span class="note">(tu consulta dio error)</span>'}</div><div><h6>Esperado</h6>${tableHTML(r.exp, 60)}</div></div></details>`;
    return `<div class="fb ${r.ok ? 'ok' : 'bad'}"><div class="fi">${icon(r.ok ? 'check' : 'x')}</div><div style="flex:1;min-width:0"><b class="t">${r.title}</b><div>${r.msg}</div>${warnHTML(r.warnings)}${cmp}</div></div>`;
  }
  function setStatus(card, ex) {
    const ok = P.solved.has(ex.id);
    card.classList.toggle('ok', ok);
    card.querySelector('.exc-st').innerHTML = ok ? `${icon('check')} Resuelto` : 'Pendiente';
  }
  function exColor(ex) { return ex.cat === 'mini' ? 'var(--c)' : `var(--${CATS[ex.cat].color})`; }

  function exCard(ex, o = {}) {
    const card = h(`<div class="exc" id="ex-${ex.id}" data-id="${ex.id}"><div class="exc-head"><span class="exc-id" style="--xc:${exColor(ex)}">${ex.cat === 'mini' ? 'Mini' : ex.id}</span><div class="exc-t">${esc(ex.t)}</div><span class="exc-st"></span>${o.open ? '' : icon('chev', 'ic exc-chev')}</div><div class="exc-body"></div></div>`);
    setStatus(card, ex);
    let built = false;
    const build = () => {
      if (built) return; built = true;
      const body = card.querySelector('.exc-body');
      const box = h(`<div class="exc-ed"><div class="code-bar" style="background:var(--code-bar)"><span class="dots"><i></i><i></i><i></i></span><span class="code-title">Tu respuesta</span><span class="hint">Ctrl + Enter = corregir</span><span class="sp"></span></div></div>`);
      const bar = box.firstElementChild;
      const ed = makeEditor(P.drafts[ex.id] || '', { onRun: () => check(), onChange: v => saveDraft(ex.id, v), placeholder: '-- ' + ex.t + '\nSELECT ...' });
      box.appendChild(ed);
      const res = h('<div class="res"></div>');
      box.appendChild(res);
      const fb = h('<div></div>'), extra = h('<div></div>');
      const check = () => whenReady(() => {
        const r = Engine.check(ex, ed.ed.get());
        fb.innerHTML = feedbackHTML(r);
        if (r.ok && !P.solved.has(ex.id)) {
          P.solved.add(ex.id); save();
          addXP(P.peeked.has(ex.id) ? 3 : 10, `${ex.cat === 'mini' ? 'mini desafío' : ex.id} resuelto`);
          confetti(80); setStatus(card, ex); refreshCats(); refreshRoad(); refreshNav();
        }
      });
      bar.append(
        btn('b-run', icon('check') + 'Corregir', check),
        btn('b-g', icon('play', 'ic fill') + 'Ejecutar', () => whenReady(() => renderRun(res, exRunner(ex)(ed.ed.get())))),
        btn('b-g', icon('bulb') + 'Pista', () => {
          extra.innerHTML = `<div class="hintbox"><b>Pista:</b> ${ex.hint ? esc(ex.hint) : 'Usá el método de 4 pasos: ¿qué muestro? ¿de qué tablas? ¿qué filas? ¿agrupo/ordeno/corto?'}${ex.verify ? `<br><span class="note">Se corrige revisando cómo queda la tabla con: <code>${esc(ex.verify)}</code></span>` : ''}</div>`;
        }),
        btn('b-g', icon('db') + 'Diagrama', () => window.openDiagram && window.openDiagram()),
        btn('b-g', icon('eye') + 'Solución', () => {
          if (!P.solved.has(ex.id)) { P.peeked.add(ex.id); save(); }
          const sb = h('<div class="solbox"><b>Solución</b></div>');
          sb.appendChild(codeCard(ex.sol, { title: 'Solución', runner: exRunner(ex), noLab: true }));
          (ex.alt || []).forEach(a => sb.appendChild(codeCard(a, { title: 'Otra forma', runner: exRunner(ex), noLab: true })));
          if (ex.explain) sb.appendChild(h(`<p class="note" style="font-size:14px">${ex.explain}</p>`));
          if (!P.solved.has(ex.id)) sb.appendChild(h(`<p class="note">Copiala, entendela y probá corregirla: si la viste antes de resolverla, ganás 3 XP en vez de 10.</p>`));
          extra.replaceChildren(sb);
        })
      );
      body.append(box, fb, extra);
      requestAnimationFrame(() => ed.ed.refresh());
    };
    if (o.open) { card.classList.add('open'); build(); }
    else card.querySelector('.exc-head').onclick = () => { const op = card.classList.toggle('open'); if (op) build(); };
    return card;
  }

  // Ejercicios: lista completa
  const ORDER = ['recu', 'tp7a', 'tp7m', 'tp7e', 'tp7r', 'tp7s', 'dml', 'extra'];
  let catFilter = 'all';
  function buildExercises() {
    const list = $('#exList');
    for (const k of ORDER) {
      const c = CATS[k];
      const g = h(`<div class="cat" data-cat="${k}" style="--c:var(--${c.color});--c2:var(--${c.color})"><div class="cat-h"><h3>${c.name}</h3><div class="cp"><span class="cpt"></span><div class="bar"><i></i></div></div></div><p class="cd">${c.desc}</p></div>`);
      DATA.EX.filter(e => e.cat === k).forEach(e => g.appendChild(exCard(e)));
      list.appendChild(g);
    }
    $('#exSearch').oninput = filterEx;
    $('#exPend').onchange = filterEx;
    refreshCats();
  }
  function refreshCats() {
    const box = $('#exCats');
    if (!box) return;
    const cnt = k => { const xs = DATA.EX.filter(e => k === 'all' ? e.cat !== 'mini' : e.cat === k); return [xs.filter(e => P.solved.has(e.id)).length, xs.length]; };
    box.innerHTML = '';
    for (const k of ['all', ...ORDER]) {
      const [d, t] = cnt(k);
      const b = btn('chip' + (catFilter === k ? ' on' : ''), `${k === 'all' ? 'Todos' : CATS[k].name} <span class="cnt">${d}/${t}</span>`, () => { catFilter = k; refreshCats(); filterEx(); });
      if (k !== 'all') b.style.cssText = `--c:var(--${CATS[k].color});--c2:var(--${CATS[k].color})`;
      box.appendChild(b);
    }
    $$('#exList .cat').forEach(g => {
      const [d, t] = cnt(g.dataset.cat);
      g.querySelector('.cpt').textContent = `${d}/${t}`;
      g.querySelector('.bar i').style.width = (d / t * 100) + '%';
    });
  }
  function filterEx() {
    const q = $('#exSearch').value.trim().toLowerCase(), pend = $('#exPend').checked;
    $$('#exList .cat').forEach(g => {
      let any = false;
      $$('.exc', g).forEach(c => {
        const ex = EXBY[c.dataset.id];
        const show = (catFilter === 'all' || ex.cat === catFilter) && (!q || (ex.t + ' ' + ex.id).toLowerCase().includes(q)) && (!pend || !P.solved.has(ex.id));
        c.style.display = show ? '' : 'none'; any = any || show;
      });
      g.style.display = any ? '' : 'none';
    });
  }
  function buildMinis() {
    $$('.mini[data-ex]').forEach(m => {
      const ex = EXBY[m.dataset.ex];
      const w = h(`<div class="mini-wrap"><div class="mini-label">${icon('zap')} ${esc(m.dataset.label || 'Mini desafío · se corrige solo')}</div></div>`);
      w.appendChild(exCard(ex, { open: true }));
      m.replaceWith(w);
    });
  }

  // ---------------------------------------------------------------- Quizzes
  const QUIZ_SECS = Object.keys(DATA.QUIZ);
  const quizDone = k => { const s = P.quiz[k] || {}, qs = DATA.QUIZ[k]; return qs && qs.every((_, i) => s[i] && s[i].ok); };
  function renderQuiz(el, key) {
    const qs = DATA.QUIZ[key];
    let state = P.quiz[key] || {};
    el.innerHTML = `<div class="quiz-h"><span class="qi">${icon('target')}</span>Ponete a prueba<span class="qs"></span></div>`;
    const boxes = qs.map((q, qi) => {
      const box = h(`<div class="qq"><p>${qi + 1}. ${q.q}</p><div class="qopts"></div></div>`);
      q.o.forEach((o, oi) => box.lastElementChild.appendChild(btn('qopt', `<span class="l">${'ABCD'[oi]}</span><span>${o}</span>`, () => answer(qi, oi))));
      el.appendChild(box); return box;
    });
    const foot = h('<div class="btns"></div>');
    foot.appendChild(btn('btn sm', icon('reset') + 'Reintentar el quiz', () => { P.quiz[key] = {}; save(); renderQuiz(el, key); refreshNav(); }));
    el.appendChild(foot);
    function show(qi, oi, anim) {
      const q = qs[qi], box = boxes[qi];
      $$('.qopt', box).forEach((b, i) => { b.disabled = true; if (i === q.a) b.classList.add('right'); else if (i === oi) b.classList.add('wrong'); if (!anim) b.style.animation = 'none'; });
      box.appendChild(h(`<div class="qexp"><b>${oi === q.a ? '¡Bien!' : 'Casi.'}</b> ${q.e}</div>`));
    }
    function answer(qi, oi) {
      if (state[qi]) return;
      const ok = oi === qs[qi].a;
      state[qi] = { pick: oi, ok }; P.quiz[key] = state; save();
      show(qi, oi, true);
      if (ok && !P.qx.has(key + qi)) { P.qx.add(key + qi); addXP(5, 'respuesta correcta'); }
      summary(true);
    }
    function summary(live) {
      const n = Object.keys(state).length, ok = Object.values(state).filter(s => s.ok).length;
      el.querySelector('.qs').textContent = `${ok} de ${qs.length} correctas`;
      if (live && n === qs.length) {
        if (ok === qs.length) { toast('¡Quiz perfecto! Lección completa', 'trophy'); confetti(120); }
        else toast(`Quiz terminado: ${ok}/${qs.length}. Reintentalo para completar la lección`, 'target');
        refreshNav(); refreshRoad();
      }
    }
    qs.forEach((_, qi) => state[qi] && show(qi, state[qi].pick, false));
    summary(false);
  }

  // ---------------------------------------------------------------- Navegación y ruta
  const ROAD = [
    ['base', 'db', 'indigo', 'La base de datos', 'Tablas, PK, FK y el diagrama'],
    ['select', 'table', 'sky', 'SELECT y FROM', 'Elegir columnas y calcular'],
    ['where', 'filter', 'cyan', 'WHERE', 'Filtrar filas con condiciones'],
    ['orden', 'sort', 'lime', 'DISTINCT, ORDER, LIMIT', 'Sin repetidos, ordenado, top N'],
    ['agrup', 'layers', 'amber', 'GROUP BY y HAVING', 'Contar y sumar por grupos'],
    ['join', 'link', 'violet', 'JOIN', 'Unir tablas: INNER, LEFT, RIGHT'],
    ['sub', 'nest', 'emerald', 'Subconsultas', 'IN, ALL, EXISTS, correlacionadas'],
    ['mas', 'trophy', 'pink', '"El que más"', 'El patrón que siempre sale'],
    ['fechas', 'cal', 'sky', 'Fechas', 'YEAR, DATEDIFF, ADDDATE...'],
    ['dml', 'edit', 'orange', 'INSERT, UPDATE, DELETE', 'Cambiar los datos'],
    ['errores', 'bug', 'red', 'Errores típicos', 'Los de tu parcial y tus archivos'],
    ['flash', 'cards', 'violet', 'Flashcards', 'Repaso express'],
    ['juego', 'puzzle', 'amber', 'Armá la consulta', 'Juego de piezas'],
    ['ejercicios', 'target', 'emerald', '99 ejercicios', 'Temas del modelo de examen'],
    ['simulacro', 'clock', 'pink', 'Simulacro', 'Examen con tiempo y nota']
  ];
  function secDone(k) {
    const el = document.getElementById(k);
    if (el && el.dataset.need) return el.dataset.need.split(',').every(id => P.solved.has(id));
    if (el && 'seen' in el.dataset) return P.seen.has(k);
    if (DATA.QUIZ[k]) return quizDone(k);
    if (k === 'flash') return P.known.size >= Math.ceil(DATA.FLASH.length * .75);
    if (k === 'juego') return P.game.size >= DATA.GAME.length;
    if (k === 'ejercicios') return P.solved.size >= DATA.EX.length / 2;
    if (k === 'simulacro') return P.best != null && P.best >= 60;
    if (k === 'base' || k === 'errores' || k === 'traductor' || k === 'lab' || k === 'inicio') return P.seen.has(k);
    return false;
  }
  function buildRoad() {
    $('#road').innerHTML = ROAD.map(([k, ic, c, t, d], i) => `<a href="#${k}" data-k="${k}" style="--rc:var(--${c})"><span class="ri">${icon(ic)}</span><span><b>${i}. ${t}</b><small>${d}</small></span><span class="rs"></span></a>`).join('');
    refreshRoad();
  }
  function refreshRoad() { $$('#road a').forEach(a => a.classList.toggle('done', secDone(a.dataset.k))); }
  function refreshNav() {
    $$('.nav-a[href^="#"]').forEach(a => {
      const k = a.getAttribute('href').slice(1);
      a.classList.toggle('seen', P.seen.has(k));
      a.classList.toggle('done', secDone(k));
    });
  }
  function observeSections() {
    const links = Object.fromEntries($$('.nav-a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting) {
        const k = e.target.id; if (!k) continue;
        $$('.nav-a.active').forEach(a => a.classList.remove('active'));
        links[k] && links[k].classList.add('active');
        if (!P.seen.has(k)) { P.seen.add(k); save(); refreshNav(); refreshRoad(); }
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('main [id]').forEach(s => links[s.id] && io.observe(s));
  }

  // ---------------------------------------------------------------- Hero
  function floaters() {
    const words = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'HAVING', 'COUNT(*)', 'ORDER BY', 'LIMIT 1', 'IS NULL', 'EXISTS', 'IN (...)', 'UPDATE', 'INSERT', 'DISTINCT', 'LEFT JOIN', 'SUM()', 'AVG()'];
    $('#floaters').innerHTML = words.map((w, i) => `<span style="left:${(i * 37) % 95}%;top:${(i * 53) % 90}%;font-size:${14 + (i * 7) % 22}px;--r:${(i % 5 - 2) * 6}deg;animation-delay:-${i * 0.8}s">${w}</span>`).join('');
  }

  // ---------------------------------------------------------------- Diagrama ER
  const ER_T = {
    oficina: { pos: [1, 1], cols: ['codigo_oficina', 'ciudad', 'pais', 'region', 'codigo_postal', 'telefono', 'linea_direccion1', 'linea_direccion2'], pk: ['codigo_oficina'], fk: [] },
    empleado: { pos: [2, 1], cols: ['codigo_empleado', 'codigo_oficina', 'codigo_jefe', 'nombre', 'apellido1', 'apellido2', 'extension', 'email', 'puesto'], pk: ['codigo_empleado'], fk: ['codigo_oficina', 'codigo_jefe'] },
    cliente: { pos: [3, 1], cols: ['codigo_cliente', 'codigo_empleado_rep_ventas', 'nombre_cliente', 'nombre_contacto', 'apellido_contacto', 'telefono', 'fax', 'linea_direccion1', 'linea_direccion2', 'ciudad', 'region', 'pais', 'codigo_postal', 'limite_credito'], pk: ['codigo_cliente'], fk: ['codigo_empleado_rep_ventas'] },
    pago: { pos: [4, 1], cols: ['codigo_cliente', 'id_transaccion', 'forma_pago', 'fecha_pago', 'total'], pk: ['codigo_cliente', 'id_transaccion'], fk: ['codigo_cliente'] },
    gama_producto: { pos: [1, 2], cols: ['gama', 'descripcion_texto', 'descripcion_html', 'imagen'], pk: ['gama'], fk: [] },
    producto: { pos: [2, 2], cols: ['codigo_producto', 'gama', 'nombre', 'dimensiones', 'proveedor', 'descripcion', 'cantidad_en_stock', 'precio_venta', 'precio_proveedor'], pk: ['codigo_producto'], fk: ['gama'] },
    detalle_pedido: { pos: [3, 2], cols: ['codigo_pedido', 'codigo_producto', 'cantidad', 'precio_unidad', 'numero_linea'], pk: ['codigo_pedido', 'codigo_producto'], fk: ['codigo_pedido', 'codigo_producto'] },
    pedido: { pos: [4, 2], cols: ['codigo_pedido', 'codigo_cliente', 'fecha_pedido', 'fecha_esperada', 'fecha_entrega', 'estado', 'comentarios'], pk: ['codigo_pedido'], fk: ['codigo_cliente'] }
  };
  const ER_R = [['empleado', 'oficina', 'codigo_oficina'], ['empleado', 'empleado', 'codigo_jefe'], ['cliente', 'empleado', 'rep_ventas'], ['pago', 'cliente', 'codigo_cliente'], ['pedido', 'cliente', 'codigo_cliente'], ['detalle_pedido', 'pedido', 'codigo_pedido'], ['detalle_pedido', 'producto', 'codigo_producto'], ['producto', 'gama_producto', 'gama']];
  function buildER() {
    const er = $('#er');
    er.innerHTML = '<svg class="rels"></svg>';
    for (const [t, d] of Object.entries(ER_T)) {
      const shown = d.cols.slice(0, 7), more = d.cols.length - shown.length;
      const li = c => `<li>${d.pk.includes(c) ? `<svg class="ic pk"><use href="#i-key"/></svg>` : d.fk.includes(c) ? `<svg class="ic fk"><use href="#i-link"/></svg>` : '<svg class="ic" style="opacity:0"></svg>'}${c}</li>`;
      const card = h(`<div class="er-card" data-t="${t}" style="grid-column:${d.pos[0]};grid-row:${d.pos[1]}"><h4>${t}<span class="cnt">…</span></h4><ul>${shown.map(li).join('')}${more ? `<li class="more">+ ${more} columnas más</li>` : ''}</ul></div>`);
      card.onmouseenter = () => focusER(t);
      card.onmouseleave = () => focusER(null);
      card.onclick = () => previewTable(t, card);
      er.appendChild(card);
    }
    drawER();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawER, 120); });
    document.fonts && document.fonts.ready.then(drawER);
  }
  function drawER() {
    const er = $('#er'), svg = er.querySelector('svg'), base = er.getBoundingClientRect();
    const R = t => { const r = er.querySelector(`[data-t="${t}"]`).getBoundingClientRect(); return { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, cx: (r.left + r.right) / 2 - base.left, cy: (r.top + r.bottom) / 2 - base.top, w: r.width }; };
    let out = '';
    ER_R.forEach(([a, b, lab], i) => {
      const A = R(a), B = R(b);
      let d, lx, ly;
      if (a === b) {
        const x1 = A.l + A.w * .3, x2 = A.l + A.w * .7;
        d = `M${x1},${A.t} C${x1},${A.t - 46} ${x2},${A.t - 46} ${x2},${A.t}`; lx = A.cx; ly = A.t - 38;
      } else {
        const dx = B.cx - A.cx, dy = B.cy - A.cy;
        let p1, p2, c1, c2;
        if (Math.abs(dx) > Math.abs(dy) * .8) {
          p1 = [dx > 0 ? A.r : A.l, A.cy]; p2 = [dx > 0 ? B.l : B.r, B.cy];
          const k = (p2[0] - p1[0]) * .5; c1 = [p1[0] + k, p1[1]]; c2 = [p2[0] - k, p2[1]];
        } else {
          p1 = [A.cx, dy > 0 ? A.b : A.t]; p2 = [B.cx, dy > 0 ? B.t : B.b];
          const k = (p2[1] - p1[1]) * .5; c1 = [p1[0], p1[1] + k]; c2 = [p2[0], p2[1] - k];
        }
        d = `M${p1} C${c1} ${c2} ${p2}`;
        lx = (p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8; ly = (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8 - 6;
        out += `<circle cx="${p2[0]}" cy="${p2[1]}" r="4" data-r="${i}"/>`;
      }
      out += `<path d="${d}" data-a="${a}" data-b="${b}" data-r="${i}"/><text x="${lx}" y="${ly}" text-anchor="middle" data-r="${i}" style="paint-order:stroke;stroke:var(--panel2);stroke-width:5px">${lab}</text>`;
    });
    svg.innerHTML = out;
  }
  function focusER(t) {
    const er = $('#er');
    er.classList.toggle('focus', !!t);
    const hot = new Set([t]);
    $$('path', er).forEach(p => { const on = t && (p.dataset.a === t || p.dataset.b === t); p.classList.toggle('hot', !!on); if (on) { hot.add(p.dataset.a); hot.add(p.dataset.b); } $$(`text[data-r="${p.dataset.r}"]`, er).forEach(x => x.classList.toggle('hot', !!on)); });
    $$('.er-card', er).forEach(c => c.classList.toggle('hot', hot.has(c.dataset.t)));
  }
  function previewTable(t, card) {
    whenReady(() => {
      $$('.er-card.sel').forEach(c => c.classList.remove('sel')); card.classList.add('sel');
      const n = DB.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
      const out = Engine.run(DB, `SELECT * FROM ${t} LIMIT 8`);
      const box = $('#erPreview');
      box.innerHTML = `<div class="res" style="border-radius:14px;margin-top:14px;border:1px solid var(--line)"><div class="demo-h" style="margin-bottom:8px"><b style="font-family:var(--mono)">${t}</b><span class="note">${n} filas · mostrando 8</span><span class="top-sp"></span></div>${tableHTML(out.result)}</div>`;
      box.querySelector('.demo-h').appendChild(btn('btn sm', icon('flask') + 'Ver todo en el laboratorio', () => toLab(`SELECT * FROM ${t};`, true)));
    });
  }

  // ---------------------------------------------------------------- Demo: orden de ejecución
  function demoOrden() {
    const el = $('#demoOrden');
    const C = [['SELECT', 'qué columnas'], ['FROM', 'de qué tabla'], ['WHERE', 'qué filas'], ['GROUP BY', 'cómo agrupar'], ['HAVING', 'qué grupos'], ['ORDER BY', 'cómo ordenar'], ['LIMIT', 'cuántas']];
    const EXEC = [1, 2, 3, 4, 0, 5, 6];
    const DESC = { FROM: 'Abre la tabla y hace los JOIN.', WHERE: 'Descarta filas, una por una.', 'GROUP BY': 'Arma las pilas (grupos).', HAVING: 'Descarta pilas enteras.', SELECT: 'Calcula las columnas y los alias.', 'ORDER BY': 'Ordena (acá ya existen los alias).', LIMIT: 'Corta el resultado.' };
    el.innerHTML = '<div class="eo"></div><div class="btns"></div><div class="eo-steps"></div>';
    const row = el.firstElementChild, steps = el.lastElementChild;
    const chips = C.map(([k, d]) => h(`<div class="eo-chip"><span class="n"></span>${k}<small>${d}</small></div>`));
    chips.forEach(c => row.appendChild(c));
    let mode = 'write';
    const label = () => chips.forEach((c, i) => c.firstElementChild.textContent = mode === 'write' ? i + 1 : EXEC.indexOf(i) + 1);
    label();
    const b = btn('btn pri sm', icon('play', 'ic fill') + 'Ver el orden en que lo ejecuta MySQL', async () => {
      mode = mode === 'write' ? 'exec' : 'write';
      const order = mode === 'write' ? [0, 1, 2, 3, 4, 5, 6] : EXEC;
      const first = chips.map(c => c.getBoundingClientRect());
      order.forEach(i => row.appendChild(chips[i]));
      chips.forEach((c, i) => { const a = first[i], z = c.getBoundingClientRect(); if (!reduced) c.animate([{ transform: `translate(${a.left - z.left}px,${a.top - z.top}px)` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
      label();
      b.innerHTML = mode === 'write' ? icon('play', 'ic fill') + 'Ver el orden en que lo ejecuta MySQL' : icon('reset') + 'Volver al orden en que se escribe';
      steps.innerHTML = '';
      if (mode === 'exec') for (const [n, i] of EXEC.entries()) { steps.appendChild(h(`<div style="animation-delay:${n * 90}ms"><i>${n + 1}</i><span><b>${C[i][0]}</b> · ${DESC[C[i][0]]}</span></div>`)); }
    });
    el.children[1].appendChild(b);
  }

  // ---------------------------------------------------------------- Demo: WHERE
  function demoWhere() {
    const el = $('#demoWhere');
    const ROWS = [['GoldFish Garden', 'San Francisco', 'USA', 3000], ['Lasas S.A.', 'Fuenlabrada', 'Spain', 154310], ['Beragua', 'Madrid', 'Spain', 20000], ['france telecom', 'Paris', 'France', 10000], ['Tendo Garden', 'Miami', 'USA', 600000], ['Naturagua', 'Madrid', 'Spain', 32000], ['Tutifruti S.A', 'Sydney', 'Australia', 10000]];
    const CONDS = [["pais = 'Spain'", r => r[2] === 'Spain'], ['limite_credito > 30000', r => r[3] > 30000], ["ciudad IN ('Madrid', 'Paris')", r => ['Madrid', 'Paris'].includes(r[1])], ["pais = 'Spain' AND limite_credito > 30000", r => r[2] === 'Spain' && r[3] > 30000], ["pais = 'USA' OR ciudad = 'Madrid'", r => r[2] === 'USA' || r[1] === 'Madrid'], ["nombre_cliente LIKE 'T%'", r => /^t/i.test(r[0])], ['limite_credito BETWEEN 10000 AND 40000', r => r[3] >= 10000 && r[3] <= 40000]];
    let cur = 0, token = 0;
    el.innerHTML = `<div class="chips"></div><div class="sqlline"></div><table class="dtable"><thead><tr><th>nombre_cliente</th><th>ciudad</th><th>pais</th><th>limite_credito</th><th></th></tr></thead><tbody></tbody></table><div class="btns"></div><div class="sum"></div><div class="res" style="border-radius:12px;margin-top:8px"></div>`;
    const chips = el.querySelector('.chips'), line = el.querySelector('.sqlline'), tb = el.querySelector('tbody'), sum = el.querySelector('.sum'), res = el.querySelector('.res');
    const draw = () => {
      chips.innerHTML = '';
      CONDS.forEach(([c], i) => chips.appendChild(btn('chip mono' + (i === cur ? ' on' : ''), esc(c), () => { cur = i; draw(); })));
      line.innerHTML = `${highlight('SELECT nombre_cliente, ciudad, pais, limite_credito FROM cliente WHERE ')}<span class="hot">${highlight(CONDS[cur][0])}</span>`;
      tb.innerHTML = ROWS.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td class="n">${fmtN(r[3])}</td><td></td></tr>`).join('');
      sum.innerHTML = ''; res.innerHTML = ''; token++;
    };
    const go = async () => {
      draw(); const my = token; const trs = $$('tr', tb); let n = 0;
      for (let i = 0; i < ROWS.length; i++) {
        if (my !== token) return;
        trs[i].classList.add('scan'); await sleep(reduced ? 0 : 330);
        const ok = CONDS[cur][1](ROWS[i]); n += ok;
        trs[i].classList.remove('scan'); trs[i].classList.add(ok ? 'pass' : 'fail');
        trs[i].lastElementChild.innerHTML = `<span class="mark ${ok ? 'y' : 'n'}">${ok ? '✓' : '✗'}</span>`;
        await sleep(reduced ? 0 : 120);
      }
      sum.innerHTML = `<div class="summary">Quedaron <b>${n}</b> de ${ROWS.length} filas. La base hace exactamente esto, fila por fila, con todos los clientes.</div>`;
    };
    el.querySelector('.btns').append(
      btn('btn pri sm', icon('play', 'ic fill') + 'Filtrar fila por fila', go),
      btn('btn sm', icon('db') + 'Probar en la base real (36 clientes)', () => whenReady(() => renderRun(res, runMain(`SELECT nombre_cliente, ciudad, pais, limite_credito FROM cliente WHERE ${CONDS[cur][0]};`)))),
      btn('btn sm', icon('reset') + 'Reiniciar', draw)
    );
    draw();
  }

  // ---------------------------------------------------------------- Demo: GROUP BY
  const PCOL = { Spain: 'var(--amber)', USA: 'var(--sky)', France: 'var(--pink)', Australia: 'var(--emerald)', 'United Kingdom': 'var(--violet)' };
  function demoGroup() {
    const el = $('#demoGroup');
    const ROWS = [['GoldFish Garden', 'USA', 3000], ['Lasas S.A.', 'Spain', 154310], ['Tendo Garden', 'USA', 600000], ['Beragua', 'Spain', 20000], ['france telecom', 'France', 10000], ['Naturagua', 'Spain', 32000], ['Musée du Louvre', 'France', 30000], ['Gardening Associates', 'USA', 6000]];
    const AGG = [['COUNT(*)', xs => xs.length], ['SUM(limite_credito)', xs => xs.reduce((a, r) => a + r[2], 0)], ['MAX(limite_credito)', xs => Math.max(...xs.map(r => r[2]))], ['AVG(limite_credito)', xs => Math.round(xs.reduce((a, r) => a + r[2], 0) / xs.length)]];
    let ag = 0, having = false, token = 0;
    el.innerHTML = `<div class="chips"></div><div class="sqlline"></div><div class="dg-pool"></div><div class="dg-buckets"></div><div class="btns"></div><div class="sum"></div>`;
    const chips = el.querySelector('.chips'), line = el.querySelector('.sqlline'), pool = el.querySelector('.dg-pool'), bk = el.querySelector('.dg-buckets'), sum = el.querySelector('.sum');
    const draw = () => {
      token++;
      chips.innerHTML = '';
      AGG.forEach(([a], i) => chips.appendChild(btn('chip mono' + (i === ag ? ' on' : ''), a, () => { ag = i; draw(); })));
      chips.appendChild(btn('chip mono' + (having ? ' on' : ''), (having ? '✓ ' : '+ ') + 'HAVING COUNT(*) >= 3', () => { having = !having; draw(); }));
      line.innerHTML = highlight(`SELECT pais, ${AGG[ag][0]} FROM cliente GROUP BY pais${having ? ' HAVING COUNT(*) >= 3' : ''}`);
      pool.innerHTML = ROWS.map((r, i) => `<span class="dg-item" data-i="${i}"><span class="pt" style="--pc:${PCOL[r[1]]}">${r[1]}</span>${esc(r[0])}<span class="lc">${fmtN(r[2])}</span></span>`).join('');
      bk.innerHTML = ''; sum.innerHTML = '';
    };
    const go = async () => {
      draw(); const my = token;
      const groups = [...new Set(ROWS.map(r => r[1]))];
      const B = {};
      groups.forEach(g => { B[g] = h(`<div class="dg-b" style="--pc:${PCOL[g]}"><h5><span class="pt" style="--pc:${PCOL[g]}">${g}</span><span class="agg"></span></h5><div class="items"></div></div>`); bk.appendChild(B[g]); });
      for (const it of $$('.dg-item', pool)) {
        if (my !== token) return;
        flip(it, () => B[ROWS[it.dataset.i][1]].querySelector('.items').appendChild(it), 600);
        await sleep(reduced ? 0 : 230);
      }
      await sleep(reduced ? 0 : 500);
      const result = [];
      for (const g of groups) {
        if (my !== token) return;
        const xs = ROWS.filter(r => r[1] === g), v = AGG[ag][1](xs);
        B[g].querySelector('.agg').textContent = `${AGG[ag][0].split('(')[0]} = ${fmtN(v)}`;
        B[g].classList.add('show');
        if (having && xs.length < 3) B[g].classList.add('out'); else result.push([g, v]);
        await sleep(reduced ? 0 : 280);
      }
      sum.innerHTML = `<div class="summary">Resultado: ${result.length} fila(s), una por grupo${having ? ' que pasó el HAVING' : ''}.</div>` + tableHTML({ columns: ['pais', AGG[ag][0]], values: result });
    };
    el.querySelector('.btns').append(btn('btn pri sm', icon('layers') + 'Agrupar', go), btn('btn sm', icon('reset') + 'Reiniciar', draw));
    draw();
  }

  // ---------------------------------------------------------------- Demo: JOIN
  function vennSVG(mode, id) {
    const L = '<circle cx="14" cy="11" r="8.5"/>', Rr = '<circle cx="24" cy="11" r="8.5"/>';
    const fill = mode === 'INNER' ? `<defs><clipPath id="${id}"><circle cx="14" cy="11" r="8.5"/></clipPath></defs><circle class="f" cx="24" cy="11" r="8.5" clip-path="url(#${id})"/>`
      : mode === 'LEFT' ? '<circle class="f" cx="14" cy="11" r="8.5"/>' : mode === 'RIGHT' ? '<circle class="f" cx="24" cy="11" r="8.5"/>'
        : `<defs><mask id="${id}"><rect width="40" height="22" fill="#fff"/><circle cx="24" cy="11" r="8.5" fill="#000"/></mask></defs><circle class="f" cx="14" cy="11" r="8.5" mask="url(#${id})"/>`;
    return `<svg class="venn" viewBox="0 0 38 22">${fill}${L}${Rr}</svg>`;
  }
  function demoJoin() {
    const el = $('#demoJoin');
    const L = [[1, 'GoldFish Garden'], [3, 'Gardening Associates'], [6, 'Lasas S.A.'], [7, 'Beragua']];
    const R = [[1, 2000], [1, 2000], [3, 5000], [7, 2390], [99, 1500]];
    const MODES = {
      INNER: { sql: 'SELECT c.nombre_cliente, p.total\nFROM cliente c INNER JOIN pago p ON c.codigo_cliente = p.codigo_cliente', txt: 'Solo quedan las filas que tienen pareja en las dos tablas. Lasas (sin pagos) y el pago 99 (sin cliente) desaparecen.' },
      LEFT: { sql: 'SELECT c.nombre_cliente, p.total\nFROM cliente c LEFT JOIN pago p ON c.codigo_cliente = p.codigo_cliente', txt: 'Quedan TODOS los clientes (la tabla de la izquierda). Lasas no tiene pago: aparece con NULL.' },
      RIGHT: { sql: 'SELECT c.nombre_cliente, p.total\nFROM cliente c RIGHT JOIN pago p ON c.codigo_cliente = p.codigo_cliente', txt: 'Quedan TODOS los pagos (la tabla de la derecha). El pago 99 no tiene cliente: nombre NULL.' },
      NULL: { sql: 'SELECT c.nombre_cliente\nFROM cliente c LEFT JOIN pago p ON c.codigo_cliente = p.codigo_cliente\nWHERE p.codigo_cliente IS NULL', txt: 'LEFT JOIN y después me quedo solo con los que quedaron con NULL: los clientes que no tienen ningún pago.' }
    };
    let mode = 'INNER', token = 0;
    el.innerHTML = `<div class="chips"></div><div class="sqlline" style="white-space:pre"></div>
      <div class="dj"><table class="dj-t"><caption>cliente c</caption><tbody>${L.map((r, i) => `<tr data-l="${i}"><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table><div></div>
      <table class="dj-t"><caption>pago p</caption><tbody>${R.map((r, i) => `<tr data-r="${i}"><td>${r[0]}</td><td class="n">${fmtN(r[1])}</td></tr>`).join('')}</tbody></table><svg class="lines"></svg></div>
      <p class="note">Datos simplificados. El pago del cliente 99 es inventado: en la base real la FK no lo permitiría, pero sirve para ver el RIGHT JOIN.</p><div class="sum"></div>`;
    const chips = el.querySelector('.chips'), line = el.querySelector('.sqlline'), dj = el.querySelector('.dj'), svg = dj.querySelector('svg'), sum = el.querySelector('.sum');
    const pairs = []; L.forEach((l, i) => R.forEach((r, j) => l[0] === r[0] && pairs.push([i, j])));
    const lines = () => {
      const b = dj.getBoundingClientRect();
      svg.innerHTML = pairs.map(([i, j], n) => {
        const a = dj.querySelector(`[data-l="${i}"]`).getBoundingClientRect(), z = dj.querySelector(`[data-r="${j}"]`).getBoundingClientRect();
        const x1 = a.right - b.left, y1 = a.top + a.height / 2 - b.top, x2 = z.left - b.left, y2 = z.top + z.height / 2 - b.top, k = (x2 - x1) / 2;
        return `<path d="M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}" style="animation-delay:${n * 120}ms"/>`;
      }).join('');
    };
    const render = async () => {
      const my = ++token;
      chips.innerHTML = '';
      [['INNER', 'INNER JOIN'], ['LEFT', 'LEFT JOIN'], ['RIGHT', 'RIGHT JOIN'], ['NULL', 'LEFT + IS NULL']].forEach(([k, t]) => chips.appendChild(btn('chip' + (k === mode ? ' on' : ''), vennSVG(k, 'vj' + k + my) + t, () => { mode = k; render(); })));
      line.innerHTML = highlight(MODES[mode].sql);
      const lm = new Set(pairs.map(p => p[0])), rm = new Set(pairs.map(p => p[1]));
      $$('tr[data-l]', dj).forEach(tr => { const i = +tr.dataset.l, m = lm.has(i); tr.className = mode === 'NULL' ? (m ? 'gone' : 'lonely') : m ? '' : mode === 'LEFT' ? 'lonely' : 'gone'; });
      $$('tr[data-r]', dj).forEach(tr => { const j = +tr.dataset.r, m = rm.has(j); tr.className = mode === 'NULL' ? 'gone' : m ? '' : mode === 'RIGHT' ? 'lonely' : 'gone'; });
      lines();
      let rows;
      if (mode === 'INNER') rows = pairs.map(([i, j]) => [L[i][1], R[j][1]]);
      else if (mode === 'LEFT') rows = L.flatMap((l, i) => { const ps = pairs.filter(p => p[0] === i); return ps.length ? ps.map(([, j]) => [l[1], R[j][1]]) : [[l[1], null]]; });
      else if (mode === 'RIGHT') rows = R.map((r, j) => { const p = pairs.find(p => p[1] === j); return [p ? L[p[0]][1] : null, r[1]]; });
      else rows = L.filter((_, i) => !lm.has(i)).map(l => [l[1]]);
      const cols = mode === 'NULL' ? ['nombre_cliente'] : ['nombre_cliente', 'total'];
      await sleep(reduced ? 0 : 500);
      if (my !== token) return;
      sum.innerHTML = `<div class="summary">${MODES[mode].txt}</div><div class="rt-wrap" style="margin-top:10px"><table class="rt"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r, n) => `<tr class="appear">${r.map(v => v === null ? `<td class="nl" style="animation-delay:${n * 90}ms">NULL</td>` : `<td style="animation-delay:${n * 90}ms">${esc(typeof v === 'number' ? fmtN(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    render();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(lines, 150); });
  }

  // ---------------------------------------------------------------- Demo: Subconsulta
  function demoSub() {
    const el = $('#demoSub');
    el.innerHTML = `<div class="ds">
      <div class="ds-box" data-b="in"><span class="lab">Paso 1 · subconsulta (adentro)</span><div class="ds-q">${highlight('SELECT codigo_cliente FROM pago')}</div><div class="ds-chips"></div></div>
      <div class="ds-box" data-b="out"><span class="lab">Paso 2 y 3 · consulta principal (afuera)</span><div class="ds-q">${highlight('SELECT nombre_cliente FROM cliente WHERE codigo_cliente IN (')} <span class="ds-slot"></span> )</div><div class="ds-res"></div></div>
    </div><div class="btns"></div><div class="sum"></div>`;
    const bi = el.querySelector('[data-b=in]'), bo = el.querySelector('[data-b=out]'), chips = bi.querySelector('.ds-chips'), slot = bo.querySelector('.ds-slot'), res = bo.querySelector('.ds-res'), sum = el.querySelector('.sum');
    let step = 0, vals = [];
    const bs = el.querySelector('.btns');
    const b1 = btn('btn pri sm', '1 · Ejecutar la de adentro', () => whenReady(async () => {
      if (step !== 0) return; step = 1;
      bi.classList.add('on');
      vals = DB.exec('SELECT codigo_cliente FROM pago')[0].values.map(r => r[0]);
      for (const [i, v] of vals.entries()) { const c = h(`<span class="vchip" style="animation-delay:${i * 35}ms">${v}</span>`); chips.appendChild(c); }
      sum.innerHTML = `<div class="summary">La subconsulta devolvió <b>${vals.length}</b> valores (con repetidos: un cliente con 3 pagos aparece 3 veces). A IN no le molestan los repetidos.</div>`;
      upd();
    }));
    const b2 = btn('btn pri sm', '2 · Pasar la lista al IN', async () => {
      if (step !== 1) return; step = 2;
      bi.classList.remove('on'); bo.classList.add('on');
      const cs = $$('.vchip', chips);
      for (const c of cs) { c.style.animation = 'none'; flip(c, () => slot.appendChild(c), 650); await sleep(reduced ? 0 : 25); }
      sum.innerHTML = '<div class="summary">Ahora la consulta de afuera es como si dijera <code>WHERE codigo_cliente IN (1, 1, 3, 3, 3, 4, ...)</code>.</div>';
      upd();
    });
    const b3 = btn('btn pri sm', '3 · Ejecutar la de afuera', () => {
      if (step !== 2) return; step = 3;
      const names = DB.exec(`SELECT nombre_cliente FROM cliente WHERE codigo_cliente IN (${vals.join(',')})`)[0].values.map(r => r[0]);
      res.innerHTML = names.map((n, i) => `<span style="animation-delay:${i * 50}ms">${esc(n)}</span>`).join('');
      sum.innerHTML = `<div class="summary">Resultado: <b>${names.length}</b> clientes (cada uno una sola vez, porque se recorre la tabla cliente).</div>`;
      upd();
    });
    const b4 = btn('btn sm', icon('reset') + 'Reiniciar', () => { step = 0; chips.innerHTML = ''; slot.innerHTML = ''; res.innerHTML = ''; sum.innerHTML = ''; bi.classList.remove('on'); bo.classList.remove('on'); upd(); });
    const upd = () => { b1.disabled = step !== 0; b2.disabled = step !== 1; b3.disabled = step !== 2; };
    bs.append(b1, b2, b3, b4); upd();
  }

  // ---------------------------------------------------------------- Flashcards
  function buildFlash() {
    const grid = $('#fcGrid');
    let order = DATA.FLASH.map((_, i) => i), only = false;
    const COLORS = [['var(--indigo)', 'var(--violet)'], ['var(--cyan)', 'var(--sky)'], ['var(--pink)', 'var(--violet)'], ['var(--amber)', 'var(--orange)'], ['var(--emerald)', 'var(--cyan)'], ['var(--violet)', 'var(--pink)']];
    const draw = () => {
      grid.innerHTML = '';
      order.filter(i => !only || !P.known.has(i)).forEach(i => {
        const f = DATA.FLASH[i], [a, b] = COLORS[i % COLORS.length];
        const c = h(`<div class="fc${P.known.has(i) ? ' known' : ''}"><div class="fc-in"><div class="fc-f" style="--fa:${a};--fb:${b}">${esc(f.f)}<small>tocá para dar vuelta</small></div><div class="fc-b"><div>${f.b}</div><div class="fcb"></div></div></div></div>`);
        c.onclick = () => c.classList.toggle('flip');
        const fcb = c.querySelector('.fcb');
        fcb.append(btn('y', 'La sé', e => { e.stopPropagation(); P.known.add(i); save(); c.classList.add('known'); c.classList.remove('flip'); count(); refreshNav(); refreshRoad(); }), btn('', 'Repasar', e => { e.stopPropagation(); P.known.delete(i); save(); c.classList.remove('known', 'flip'); count(); }));
        grid.appendChild(c);
      });
      count();
    };
    const count = () => $('#fcCount').textContent = `${P.known.size} / ${DATA.FLASH.length} sabidas`;
    $('#fcShuffle').onclick = () => { order = shuffle(order); draw(); };
    $('#fcOnly').onclick = e => { only = !only; e.currentTarget.classList.toggle('pri', only); draw(); };
    draw();
  }

  // ---------------------------------------------------------------- Juego
  function buildGame() {
    let lv = Math.min(DATA.GAME.length - 1, [...Array(DATA.GAME.length).keys()].find(i => !P.game.has(i)) ?? 0);
    const levels = $('#gmLevels'), board = $('#gmBoard');
    const drawLevels = () => { levels.innerHTML = ''; DATA.GAME.forEach((_, i) => levels.appendChild(btn('gm-lv' + (i === lv ? ' on' : '') + (P.game.has(i) ? ' won' : ''), i + 1, () => { lv = i; drawLevels(); drawBoard(); }))); };
    const drawBoard = () => {
      const g = DATA.GAME[lv];
      const pieces = shuffle([...g.p.map(p => ({ p })), ...g.d.map(d => ({ p: d.p, why: d.why }))]);
      const placed = [];
      board.innerHTML = `<div class="gm-task">${icon('target')}<span>Nivel ${lv + 1}: ${esc(g.t)}</span></div>
        <div class="gm-board"><div class="gm-col"><h5>Tu consulta</h5><div class="gm-zone"></div></div><div class="gm-col"><h5>Piezas${g.d.length ? ` · ${g.d.length} es trampa` : ''}</h5><div class="gm-pool"></div></div></div>
        <div class="btns"></div><div class="sum"></div><div class="res" style="border-radius:12px"></div>`;
      const zone = board.querySelector('.gm-zone'), pool = board.querySelector('.gm-pool'), sum = board.querySelector('.sum'), res = board.querySelector('.res');
      const draw = () => {
        zone.innerHTML = ''; pool.innerHTML = '';
        zone.classList.remove('ok', 'err');
        placed.forEach((pc, k) => zone.appendChild(btn('gm-p', `<i>${k + 1}</i>${highlight(pc.p)}`, () => { placed.splice(k, 1); pieces.push(pc); draw(); })));
        pieces.forEach((pc, k) => pool.appendChild(btn('gm-p', highlight(pc.p), () => { pieces.splice(k, 1); placed.push(pc); draw(); })));
      };
      board.querySelector('.btns').append(
        btn('btn pri sm', icon('check') + 'Comprobar', () => {
          const bad = placed.find(x => x.why);
          let msg = null, idx = -1;
          if (bad) { msg = `<b>"${esc(bad.p)}"</b> es trampa: ${esc(bad.why)}`; idx = placed.indexOf(bad); }
          else if (placed.length < g.p.length) msg = `Faltan piezas: la consulta tiene ${g.p.length} y pusiste ${placed.length}.`;
          else { idx = placed.findIndex((x, k) => x.p !== g.p[k]); if (idx >= 0) msg = `La pieza ${idx + 1} no va ahí. Recordá el orden: SELECT → FROM → JOIN → ON → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT (y en un UPDATE: UPDATE → SET → WHERE).`; }
          if (msg) {
            zone.classList.remove('err'); void zone.offsetWidth; zone.classList.add('err');
            if (idx >= 0) zone.children[idx] && zone.children[idx].classList.add('badp');
            sum.innerHTML = `<div class="msg-err">${icon('x')}<div>${msg}</div></div>`;
            return;
          }
          zone.classList.add('ok');
          sum.innerHTML = `<div class="msg-ok">${icon('check')}<div><b>¡Perfecto!</b> Así queda y esto devuelve:</div></div>`;
          whenReady(() => { const d = Engine.fresh(); renderRun(res, Engine.run(d, g.p.join('\n') + ';')); d.close(); });
          if (!P.game.has(lv)) { P.game.add(lv); save(); addXP(15, `nivel ${lv + 1} del juego`); confetti(110); drawLevels(); refreshNav(); refreshRoad(); }
          if (lv < DATA.GAME.length - 1) board.querySelector('.btns').appendChild(btn('btn ok sm', 'Siguiente nivel →', () => { lv++; drawLevels(); drawBoard(); }));
        }),
        btn('btn sm', icon('reset') + 'Empezar de nuevo', drawBoard)
      );
      draw();
    };
    drawLevels(); drawBoard();
  }

  // ---------------------------------------------------------------- Simulacro
  function buildSim() {
    const root = $('#sim');
    let cfg = { n: 10, min: 60 }, timer = null;
    const config = () => {
      clearInterval(timer);
      root.innerHTML = `<div class="sim-cfg">
        <div class="tile"><b>Cantidad de consignas</b><div class="chips" data-k="n"></div></div>
        <div class="tile"><b>Tiempo</b><div class="chips" data-k="min"></div></div>
        <div class="tile"><b>Tu mejor nota</b><div style="font-size:30px;font-weight:900">${P.best == null ? '—' : P.best + '/100'}</div></div></div>
        <div class="co co-info"><div class="cw">${icon('info')}</div><div class="ct"><b>Reglas</b><p>Podés <b>Ejecutar</b> para probar (como en Workbench), pero no hay corrección hasta que entregás. Cada consigna vale lo mismo. Las de INSERT/UPDATE se corrigen mirando cómo queda la tabla.</p></div></div>
        <div class="btns"></div>`;
      const opt = (k, vals, lab) => { const box = root.querySelector(`[data-k=${k}]`); box.innerHTML = ''; vals.forEach(v => box.appendChild(btn('chip' + (cfg[k] === v ? ' on' : ''), lab(v), () => { cfg[k] = v; config(); }))); };
      opt('n', [5, 10], v => `${v} consignas`);
      opt('min', [20, 40, 60, 0], v => v ? `${v} min` : 'Sin límite');
      root.querySelector('.btns').appendChild(btn('btn pri', icon('play', 'ic fill') + 'Empezar el simulacro', start));
    };
    const start = () => {
      const qs = shuffle(DATA.SIMU_POOL).slice(0, cfg.n).map(id => EXBY[id]);
      const eds = [];
      root.innerHTML = `<div class="sim-bar"><div class="timer">${icon('clock')}<span>--:--</span></div><span class="note" id="simCount"></span><span class="top-sp"></span></div><div class="simq"></div>`;
      const bar = root.firstElementChild, list = root.querySelector('.simq');
      qs.forEach((ex, i) => {
        const card = h(`<div class="exc open sim-q"><div class="exc-head"><span class="exc-id" style="--xc:var(--pink)">${i + 1}</span><div class="exc-t">${esc(ex.t)}</div><span class="note">${(100 / qs.length).toFixed(0)} pts</span></div><div class="exc-body"></div></div>`);
        const box = h(`<div class="exc-ed"><div class="code-bar"><span class="dots"><i></i><i></i><i></i></span><span class="code-title">Consigna ${i + 1}</span><span class="sp"></span></div></div>`);
        const res = h('<div class="res"></div>');
        const ed = makeEditor('', { onRun: () => run(), onChange: count, placeholder: `-- Consigna ${i + 1}` });
        const run = () => whenReady(() => renderRun(res, exRunner(ex)(ed.ed.get())));
        box.firstElementChild.append(btn('b-run', icon('play', 'ic fill') + 'Ejecutar', run), btn('b-g', icon('db') + 'Diagrama', () => window.openDiagram && window.openDiagram()));
        box.append(ed, res);
        card.querySelector('.exc-body').appendChild(box);
        list.appendChild(card); eds.push(ed);
      });
      function count() { const n = eds.filter(e => Engine.stripComments(e.ed.get()).trim()).length; $('#simCount').textContent = `${n} de ${qs.length} respondidas`; }
      count();
      bar.append(btn('btn ok', icon('check') + 'Entregar', () => finish(qs, eds)), btn('btn sm', 'Abandonar', () => { if (confirm('¿Abandonar el simulacro? Se pierden las respuestas.')) config(); }));
      const end = cfg.min ? Date.now() + cfg.min * 60000 : 0;
      const tm = bar.querySelector('.timer');
      const t0 = Date.now();
      const tickT = () => {
        if (end) {
          const left = Math.max(0, end - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
          tm.lastElementChild.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          tm.classList.toggle('low', left < 5 * 60000);
          if (!left) { toast('¡Se terminó el tiempo!', 'clock'); finish(qs, eds); }
        } else { const e = Date.now() - t0; tm.lastElementChild.textContent = `${String(Math.floor(e / 60000)).padStart(2, '0')}:${String(Math.floor(e / 1000) % 60).padStart(2, '0')}`; }
      };
      tickT(); timer = setInterval(tickT, 1000);
      root.scrollIntoView({ behavior: 'smooth' });
    };
    const finish = (qs, eds) => whenReady(() => {
      clearInterval(timer);
      const rs = qs.map((ex, i) => Engine.check(ex, eds[i].ed.get()));
      const ok = rs.filter(r => r.ok).length, score = Math.round(ok / qs.length * 100), pass = score >= 60;
      const first = P.best == null || score > P.best;
      if (first) P.best = score;
      save();
      root.innerHTML = `<div class="score"><div class="ring" style="--v:${score};--rc:${pass ? 'var(--emerald)' : 'var(--red)'}"><b>${score}<small>/100</small></b></div>
        <div><div class="verdict" style="color:${pass ? 'var(--emerald)' : 'var(--red)'}">${pass ? '¡Aprobado!' : 'Todavía no'}</div><p>${ok} de ${qs.length} consignas correctas. ${pass ? 'Seguí practicando las que fallaste.' : 'Se aprueba con 60. Repasá las lecciones de las consignas que fallaste y volvé a intentar.'}</p><p class="note">Mejor nota: ${P.best}/100</p><div class="btns"></div></div></div><div class="simr"></div>`;
      root.querySelector('.score .btns').append(btn('btn pri', icon('reset') + 'Otro simulacro', config));
      const list = root.querySelector('.simr');
      qs.forEach((ex, i) => {
        const card = h(`<div class="exc open ${rs[i].ok ? 'ok' : ''}"><div class="exc-head"><span class="exc-id" style="--xc:${rs[i].ok ? 'var(--emerald)' : 'var(--red)'}">${i + 1}</span><div class="exc-t">${esc(ex.t)}</div><span class="exc-st">${rs[i].ok ? icon('check') + ' Bien' : icon('x') + ' Mal'}</span></div><div class="exc-body"></div></div>`);
        const body = card.querySelector('.exc-body');
        const mine = eds[i].ed.get().trim();
        body.appendChild(codeCard(mine || '-- (sin responder)', { title: 'Tu respuesta', runner: exRunner(ex), noLab: true }));
        body.appendChild(h(feedbackHTML(rs[i])));
        const d = h('<details style="margin-top:10px"><summary class="note" style="cursor:pointer">Ver solución</summary></details>');
        d.appendChild(codeCard(ex.sol, { title: 'Solución', runner: exRunner(ex), noLab: true }));
        body.appendChild(d);
        list.appendChild(card);
      });
      const xp = ok * 5 + (pass ? 30 : 0);
      if (xp) addXP(xp, `simulacro ${score}/100`);
      if (pass) confetti(220);
      refreshNav(); refreshRoad();
      root.scrollIntoView({ behavior: 'smooth' });
    });
    config();
  }

  // ---------------------------------------------------------------- Laboratorio
  let labKind = 'oficial', labEd = null, labRes = null;
  const labDB = () => labKind === 'tp7' ? TP7 : DB;
  function buildLab() {
    const box = $('#labBox');
    box.innerHTML = `<div class="code-bar"><span class="dots"><i></i><i></i><i></i></span><span class="code-title">Laboratorio</span><span class="hint" style="font-size:12px;color:#7c89b8">Ctrl + Enter = ejecutar</span><span class="sp"></span></div>`;
    const bar = box.firstElementChild;
    labEd = makeEditor(store.get('lab', '-- Escribí tu consulta y apretá Ctrl + Enter\nSELECT * FROM cliente;'), { onRun: runLab, onChange: v => store.set('lab', v), min: 170 });
    labRes = h('<div class="res"></div>');
    box.append(labEd, labRes);
    bar.append(btn('b-run', icon('play', 'ic fill') + 'Ejecutar', runLab), btn('b-g', icon('x') + 'Limpiar', () => { labEd.ed.set(''); labRes.innerHTML = ''; labEd.ed.focus(); }));
    $$('#labDb button').forEach(b => b.onclick = () => { labKind = b.dataset.k; $$('#labDb button').forEach(x => x.classList.toggle('on', x === b)); tables(); labRes.innerHTML = `<div class="msg-ok">${icon('db')}<div>Ahora estás usando la base <b>${labKind === 'tp7' ? 'alternativa (tablas en plural)' : 'oficial (tablas en singular)'}</b>.</div></div>`; });
    $('#labReset').onclick = () => whenReady(() => { DB.close(); DB = Engine.fresh('oficial'); TP7.close(); TP7 = Engine.fresh('tp7'); labRes.innerHTML = `<div class="msg-ok">${icon('reset')}<div>Las dos bases volvieron a los datos originales.</div></div>`; toast('Base reiniciada', 'reset'); });
    tables(); hist();
  }
  function tables() {
    const box = $('#labTables');
    const ts = labKind === 'tp7' ? ['clientes', 'empleados', 'oficinas', 'pagos', 'pedidos', 'detalle_pedidos', 'productos', 'gama_productos'] : ['cliente', 'empleado', 'oficina', 'pago', 'pedido', 'detalle_pedido', 'producto', 'gama_producto'];
    box.innerHTML = '';
    ts.forEach(t => box.appendChild(btn('chip mono', icon('table') + t, () => { labEd.ed.set(`SELECT * FROM ${t};`); runLab(); })));
  }
  function runLab() {
    whenReady(() => {
      const sql = labEd.ed.get();
      renderRun(labRes, Engine.run(labDB(), sql));
      const s = sql.trim();
      if (s) { P.hist = [s, ...P.hist.filter(x => x !== s)].slice(0, 12); save(); hist(); }
    });
  }
  function hist() {
    const box = $('#labHist');
    box.innerHTML = P.hist.length ? '<span class="note">Historial:</span>' : '';
    P.hist.forEach(s => box.appendChild(btn('', esc(s.replace(/\s+/g, ' ').slice(0, 80)), () => labEd.ed.set(s))));
  }
  function toLab(sql, run) {
    if (!labEd) { store.set('lab', sql); location.href = 'glosario.html#lab'; return; }
    if (labKind !== 'oficial') $('#labDb [data-k=oficial]').click();
    labEd.ed.set(sql);
    $('#lab').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { labEd.ed.focus(); if (run) runLab(); }, 450);
  }

  function openHash() {
    const m = location.hash.match(/^#ex-(.+)$/);
    if (!m) return;
    const card = document.getElementById('ex-' + m[1]);
    if (!card) return;
    if (card.style.display === 'none') { catFilter = 'all'; if ($('#exSearch')) { $('#exSearch').value = ''; $('#exPend').checked = false; refreshCats(); filterEx(); } }
    if (!card.classList.contains('open')) card.querySelector('.exc-head').click();
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  // ---------------------------------------------------------------- Tema y menú
  function chrome() {
    const tb = $('#themeBtn');
    const setIcon = () => tb.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
    tb.onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('gsql.theme', t); } catch { } setIcon(); };
    setIcon();
    $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
    $$('.nav-a').forEach(a => a.addEventListener('click', () => $('#side').classList.remove('open')));
  }

  // ---------------------------------------------------------------- Arranque
  function boot() {
    chrome(); updateTop();
    const has = s => !!$(s);
    if (has('#floaters')) floaters();
    processCode();
    buildMinis();
    $$('.quiz[data-quiz]').forEach(q => renderQuiz(q, q.dataset.quiz));
    [['#road', buildRoad], ['#er', buildER], ['#demoOrden', demoOrden], ['#demoWhere', demoWhere], ['#demoGroup', demoGroup], ['#demoJoin', demoJoin], ['#demoSub', demoSub],
     ['#fcGrid', buildFlash], ['#gmLevels', buildGame], ['#exList', buildExercises], ['#sim', buildSim], ['#labBox', buildLab]].forEach(([s, f]) => has(s) && f());
    refreshNav(); observeSections();
    openHash(); addEventListener('hashchange', openHash);
    const st = $('#engineStatus') || document.createElement('span');
    if (!window.initSqlJs) { st.className = 'engine-bad'; st.textContent = 'No se pudo cargar el motor SQL. Revisá tu conexión a internet y recargá la página.'; return; }
    initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` }).then(S => {
      Engine.init(S, { oficial: $('#seed-oficial').textContent, tp7: $('#seed-tp7').textContent });
      DB = Engine.fresh('oficial'); TP7 = Engine.fresh('tp7');
      ready = true;
      readyHooks.splice(0).forEach(f => f());
      st.className = 'engine-ok'; st.innerHTML = `${icon('check')} Motor SQL listo: ya podés ejecutar todo.`;
      $$('.er-card').forEach(c => c.querySelector('.cnt').textContent = DB.exec(`SELECT COUNT(*) FROM ${c.dataset.t}`)[0].values[0][0] + ' filas');
      waiters.splice(0).forEach(f => f());
    }).catch(e => { st.className = 'engine-bad'; st.textContent = 'No se pudo cargar el motor SQL: ' + e.message; });
  }
  window.UI = { $, $$, esc, icon, h, btn, sleep, flip, reduced, fmtN, shuffle, highlight, codeCard, makeEditor, renderRun, tableHTML, exCard, whenReady, onReady,
    runMain: sql => Engine.run(DB, sql), db: () => DB, toast, confetti, addXP, store, P, save, refreshNav, toLab };
  boot();
})();
