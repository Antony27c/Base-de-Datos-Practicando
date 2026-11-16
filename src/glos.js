(function () {
  'use strict';
  const U = window.UI, { $, $$, esc, icon, h, btn } = U;
  const PAGE = document.body.dataset.page;
  const FILE = { fast: 'index.html', glos: 'glosario.html' };
  const url = (page, hash) => (page === PAGE ? '' : FILE[page]) + '#' + hash;
  const G = GLOSS.GLOSS, BY = Object.fromEntries(G.map(g => [g.id, g]));
  const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const norm = s => strip(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ------------------------------------------------------------ Índice del buscador
  const IDX = [];
  G.forEach(g => IDX.push({ type: 'Glosario', t: g.t, d: strip(g.d), k: g.k + ' ' + g.s, url: url('glos', 'g-' + g.id), ic: 'book' }));
  GLOSS.FAST.forEach(([id, t, k]) => IDX.push({ type: 'Ruta rápida', t, d: '', k, url: url('fast', id), ic: 'zap' }));
  GLOSS.LESSONS.forEach(([id, t, k]) => IDX.push({ type: 'Guía completa', t, d: '', k, url: url('glos', id), ic: 'layers' }));
  DATA.EX.filter(e => e.cat !== 'mini').forEach(e => IDX.push({ type: 'Ejercicio', t: `${e.id} · ${e.t}`, d: e.sol, k: '', url: url('glos', 'ex-' + e.id), ic: 'target' }));
  IDX.forEach(x => { x.nt = norm(x.t); x.nk = norm(x.k); x.nall = norm(x.t + ' ' + x.d + ' ' + x.k); });
  const BONUS = { 'Glosario': 2.5, 'Ruta rápida': 2, 'Guía completa': 1, 'Ejercicio': 0 };
  function search(q) {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const out = [];
    for (const x of IDX) {
      let s = 0, ok = true;
      for (const t of toks) {
        if (x.nt.includes(t)) s += x.nt.startsWith(t) ? 6 : 4;
        else if (x.nk.includes(t)) s += 3;
        else if (x.nall.includes(t)) s += 1;
        else { ok = false; break; }
      }
      if (ok) out.push({ x, s: s + BONUS[x.type] });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, 14).map(r => r.x);
  }
  const mark = (text, q) => {
    let s = esc(text);
    for (const t of norm(q).split(/\s+/).filter(w => w.length > 1)) {
      const n = norm(text), i = n.indexOf(t);
      if (i >= 0) { const raw = text.slice(i, i + t.length); s = s.replace(esc(raw), `<mark>${esc(raw)}</mark>`); }
    }
    return s;
  };

  function mountSearch(host, big) {
    if (!host) return;
    host.innerHTML = `<div class="sr ${big ? 'big' : ''}"><div class="sr-box">${icon('search')}<input type="search" placeholder="${big ? 'Buscá un tema, una función o una consigna: GROUP BY, jefe, NULL, 2008...' : 'Buscar...'}" autocomplete="off" spellcheck="false">${big ? '' : '<kbd>Ctrl K</kbd>'}</div><div class="sr-pop" hidden></div></div>`;
    const inp = host.querySelector('input'), pop = host.querySelector('.sr-pop');
    let res = [], sel = 0;
    const go = x => { pop.hidden = true; inp.blur(); location.href = x.url; if (x.url.startsWith('#')) flashTarget(x.url.slice(1)); };
    const draw = () => {
      const q = inp.value;
      res = search(q); sel = 0;
      if (!q.trim()) { pop.hidden = true; return; }
      pop.hidden = false;
      if (!res.length) { pop.innerHTML = `<div class="sr-empty">Nada para "<b>${esc(q)}</b>". Probá con otra palabra (ej: <i>contar</i>, <i>jefe</i>, <i>repetidos</i>).</div>`; return; }
      pop.innerHTML = res.map((x, i) => `<a class="sr-it${i === sel ? ' on' : ''}" href="${x.url}" data-i="${i}"><span class="sr-ic">${icon(x.ic)}</span><span class="sr-tx"><b>${mark(x.t, q)}</b>${x.d ? `<small>${esc(x.d.slice(0, 110))}${x.d.length > 110 ? '…' : ''}</small>` : ''}</span><span class="sr-ty">${x.type}</span></a>`).join('')
        + `<div class="sr-foot">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</div>`;
      $$('.sr-it', pop).forEach(a => a.onclick = e => { e.preventDefault(); go(res[+a.dataset.i]); });
    };
    const move = d => { if (!res.length) return; sel = (sel + d + res.length) % res.length; $$('.sr-it', pop).forEach((a, i) => a.classList.toggle('on', i === sel)); $$('.sr-it', pop)[sel].scrollIntoView({ block: 'nearest' }); };
    inp.addEventListener('input', draw);
    inp.addEventListener('focus', draw);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && res[sel]) { e.preventDefault(); go(res[sel]); }
      else if (e.key === 'Escape') { pop.hidden = true; inp.blur(); }
    });
    document.addEventListener('click', e => { if (!host.contains(e.target)) pop.hidden = true; });
    return inp;
  }
  function flashTarget(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // ------------------------------------------------------------ Citas al glosario
  const tip = h('<div id="gtip" hidden></div>');
  document.body.appendChild(tip);
  let tipT;
  function showTip(a, g) {
    clearTimeout(tipT);
    tip.innerHTML = `<div class="gt-h">${icon('book')}<b>${esc(g.t)}</b><span>${g.cat}</span></div><p>${g.d}</p><code>${esc(g.s)}</code><small>Clic para abrir en el glosario</small>`;
    tip.hidden = false;
    const r = a.getBoundingClientRect(), w = Math.min(340, innerWidth - 20);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2)) + 'px';
    const below = r.bottom + 10, th = tip.offsetHeight;
    tip.style.top = (below + th > innerHeight - 10 ? r.top - th - 10 : below) + 'px';
  }
  const hideTip = () => { tipT = setTimeout(() => tip.hidden = true, 80); };
  function wireRefs(root = document) {
    $$('a.gref[data-g]', root).forEach(a => {
      const g = BY[a.dataset.g];
      if (!g) { console.warn('glosario: falta', a.dataset.g); return; }
      a.href = url('glos', 'g-' + g.id);
      a.innerHTML = icon('book') + (a.textContent.trim() ? a.innerHTML : esc(g.t));
      a.addEventListener('mouseenter', () => showTip(a, g));
      a.addEventListener('mouseleave', hideTip);
      a.addEventListener('focus', () => showTip(a, g));
      a.addEventListener('blur', hideTip);
      if (PAGE === 'glos') a.addEventListener('click', () => setTimeout(() => flashTarget('g-' + g.id), 30));
    });
    $$('.gcite[data-g]', root).forEach(box => {
      const ids = box.dataset.g.split(',').map(s => s.trim());
      box.innerHTML = `<div class="gc-title">${icon('book')} Del glosario <span>(pasá el mouse o hacé clic para ver más)</span></div><div class="gc-list">${ids.map(id => { const g = BY[id]; return g ? `<a class="gc-it" href="${url('glos', 'g-' + id)}"><b>${esc(g.t)}</b><span>${strip(g.d).slice(0, 95)}${strip(g.d).length > 95 ? '…' : ''}</span></a>` : ''; }).join('')}</div>`;
    });
  }

  // ------------------------------------------------------------ Glosario A–Z (solo en glosario.html)
  function buildAZ() {
    const root = $('#glosAZ');
    if (!root) return;
    const cats = [...new Set(G.map(g => g.cat))];
    const key = g => norm(g.t).replace(/^[^a-z0-9]+/, '');
    const sorted = G.slice().sort((a, b) => key(a).localeCompare(key(b)));
    let cat = 'Todas';
    root.innerHTML = `<div class="chips gaz-cats"></div><div class="gaz-letters"></div><div class="gaz-grid"></div>`;
    const chips = root.querySelector('.gaz-cats'), letters = root.querySelector('.gaz-letters'), grid = root.querySelector('.gaz-grid');
    sorted.forEach(g => {
      const c = h(`<article class="gcard" id="g-${g.id}" data-cat="${g.cat}" data-l="${key(g)[0].toUpperCase()}"><div class="gc-h"><h4>${esc(g.t)}</h4><span class="gc-cat c-${norm(g.cat)}">${g.cat}</span></div><p>${g.d}</p><div class="gc-syn">${icon('edit')}<code>${esc(g.s)}</code></div><div class="gc-ex"></div><div class="gc-links"><a href="#${g.see}">${icon('layers')} Lección completa</a><a href="index.html#${g.fast}">${icon('zap')} En la ruta rápida</a></div></article>`);
      if (g.ex) c.querySelector('.gc-ex').appendChild(U.codeCard(g.ex, { title: 'Ejemplo' }));
      grid.appendChild(c);
    });
    const draw = () => {
      chips.innerHTML = '';
      ['Todas', ...cats].forEach(k => chips.appendChild(btn('chip' + (k === cat ? ' on' : ''), `${k} <span class="cnt">${k === 'Todas' ? G.length : G.filter(g => g.cat === k).length}</span>`, () => { cat = k; draw(); })));
      $$('.gcard', grid).forEach(c => c.style.display = cat === 'Todas' || c.dataset.cat === cat ? '' : 'none');
      const ls = [...new Set($$('.gcard', grid).filter(c => c.style.display !== 'none').map(c => c.dataset.l))];
      letters.innerHTML = '';
      ls.forEach(l => letters.appendChild(btn('gaz-l', l, () => { const c = $$('.gcard', grid).find(x => x.dataset.l === l && x.style.display !== 'none'); c && c.scrollIntoView({ behavior: 'smooth', block: 'start' }); })));
    };
    draw();
    const fromHash = () => { const m = location.hash.match(/^#g-(.+)$/); if (m && document.getElementById('g-' + m[1])) { if (cat !== 'Todas') { cat = 'Todas'; draw(); } setTimeout(() => { document.getElementById('g-' + m[1]).scrollIntoView({ block: 'start' }); flashTarget('g-' + m[1]); }, 80); } };
    addEventListener('hashchange', fromHash);
    fromHash();
  }

  // ------------------------------------------------------------ Panel del diagrama (como el del modelo de examen)
  function buildDiagram() {
    const panel = h(`<aside id="diag" aria-label="Diagrama de la base" aria-hidden="true">
      <div class="dg-h">${icon('db')}<b>Diagrama <span class="dg-full">JARDINERÍA</span></b><span class="sp"></span>
        <button type="button" class="iconbtn sm" data-z="-1" title="Alejar">−</button>
        <button type="button" class="iconbtn sm fit" data-z="0" title="Ajustar al ancho">↔</button>
        <button type="button" class="iconbtn sm" data-z="1" title="Acercar">+</button>
        <button type="button" class="iconbtn sm" data-x title="Cerrar (Esc)">${icon('x')}</button></div>
      <div class="dg-scroll"><img src="diagrama_jardineria.png" alt="Diagrama entidad-relación de la base JARDINERÍA" draggable="false"></div>
      <div class="dg-leg"><span><i class="k"></i> llave amarilla = PK</span><span><i class="f"></i> rombo rojo = FK</span><span>Las líneas unen cada FK con la PK a la que apunta.</span></div>
      <div class="dg-tabs"></div></aside>`);
    document.body.appendChild(panel);
    const fab = h(`<button type="button" id="diagFab" data-diagram title="Ver el diagrama de la base">${icon('db')}<span>Diagrama</span></button>`);
    document.body.appendChild(fab);
    const sc = panel.querySelector('.dg-scroll'), img = sc.querySelector('img');
    let z = 1;
    const setZ = v => { z = Math.max(1, Math.min(3, v)); img.style.width = (z * 100) + '%'; };
    panel.querySelectorAll('[data-z]').forEach(b => b.onclick = () => setZ(+b.dataset.z === 0 ? 1 : z + (+b.dataset.z) * 0.5));
    img.ondblclick = () => setZ(z > 1 ? 1 : 2);
    sc.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZ(z + (e.deltaY < 0 ? .25 : -.25)); } }, { passive: false });
    let drag = null;
    sc.addEventListener('pointerdown', e => { if (z > 1 && e.pointerType === 'mouse') { drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; sc.classList.add('grab'); } });
    addEventListener('pointermove', e => { if (drag) { sc.scrollLeft = drag.l - (e.clientX - drag.x); sc.scrollTop = drag.t - (e.clientY - drag.y); } });
    addEventListener('pointerup', () => { drag = null; sc.classList.remove('grab'); });
    // chips de tablas con sus columnas, por si la imagen se ve chica
    const TABLES = { oficina: 'codigo_oficina · ciudad · pais · region · codigo_postal · telefono · linea_direccion1 · linea_direccion2', empleado: 'codigo_empleado · nombre · apellido1 · apellido2 · extension · email · codigo_oficina (FK) · codigo_jefe (FK) · puesto', cliente: 'codigo_cliente · nombre_cliente · nombre_contacto · apellido_contacto · telefono · fax · linea_direccion1 · linea_direccion2 · ciudad · region · pais · codigo_postal · codigo_empleado_rep_ventas (FK) · limite_credito', pago: 'codigo_cliente (FK) · forma_pago · id_transaccion · fecha_pago · total', pedido: 'codigo_pedido · fecha_pedido · fecha_esperada · fecha_entrega · estado · comentarios · codigo_cliente (FK)', detalle_pedido: 'codigo_pedido (FK) · codigo_producto (FK) · cantidad · precio_unidad · numero_linea', producto: 'codigo_producto · nombre · gama (FK) · dimensiones · proveedor · descripcion · cantidad_en_stock · precio_venta · precio_proveedor', gama_producto: 'gama · descripcion_texto · descripcion_html · imagen' };
    const tabs = panel.querySelector('.dg-tabs');
    tabs.innerHTML = '<div class="dg-tt">Columnas por tabla (texto)</div>' + Object.entries(TABLES).map(([t, c]) => `<details><summary>${t}</summary><p>${c.split(' · ').map(x => `<code>${x}</code>`).join(' ')}</p></details>`).join('');
    let first = true;
    const open = () => { if (first) { first = false; setZ(innerWidth < 760 ? 2 : 1); } panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); document.body.classList.add('diag-on'); fab.classList.add('on'); };
    const close = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); document.body.classList.remove('diag-on'); fab.classList.remove('on'); };
    const toggle = () => panel.classList.contains('open') ? close() : open();
    panel.querySelector('[data-x]').onclick = close;
    document.addEventListener('click', e => { const t = e.target.closest('[data-diagram]'); if (t) { e.preventDefault(); t === fab ? toggle() : open(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) close(); if (e.key === 'Enter' && e.target.matches && e.target.matches('figure[data-diagram]')) open(); });
    window.openDiagram = open;
  }

  buildDiagram();
  buildAZ();
  wireRefs();
  const top = mountSearch($('#searchTop'));
  mountSearch($('#searchHero'), true);
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); top && top.focus(); } });
  window.GLOSUI = { wireRefs, search, flashTarget };
})();
