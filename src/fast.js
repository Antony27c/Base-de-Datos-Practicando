(function () {
  'use strict';
  const U = window.UI, { $, $$, esc, icon, h, btn, sleep, highlight, reduced } = U;
  const EXBY = Object.fromEntries(DATA.EX.map(e => [e.id, e]));
  const STEP_COL = ['var(--sky)', 'var(--violet)', 'var(--cyan)', 'var(--amber)'];

  // ------------------------------------------------------------ Mapa del examen
  const MAP = [['R1', 'INSERT', 'paso7'], ['R2', 'INSERT', 'paso7'], ['R3', 'UPDATE', 'paso7'], ['R4', 'UPDATE', 'paso7'], ['R5', 'WHERE', 'paso2'],
    ['R6', 'DISTINCT', 'paso2'], ['R7', 'SELF JOIN', 'paso4'], ['R8', 'GROUP BY', 'paso3'], ['R9', 'COUNT + WHERE', 'paso3'], ['R10', 'El que más', 'paso5']];
  function buildMap() {
    const root = $('#examMap');
    if (!root) return;
    const draw = () => {
      root.innerHTML = MAP.map(([id, tag, step]) => {
        const ok = U.P.solved.has(id), n = step.replace('paso', '');
        return `<div class="em-t${ok ? ' ok' : ''}"><div class="em-h"><span class="em-id">${id}</span><span class="em-tag">${tag}</span>${ok ? `<span class="em-ok">${icon('check')}</span>` : ''}</div><p>${esc(EXBY[id].t)}</p><div class="em-l"><a href="#${step}">${icon('book')} Se aprende en el paso ${n}</a><a href="#ex-${id}">${icon('target')} Resolverla</a></div></div>`;
      }).join('');
    };
    draw();
    setInterval(draw, 3000);
  }

  // ------------------------------------------------------------ Progreso de la ruta
  function routeProgress() {
    const steps = $$('main section[id^="paso"]');
    const upd = () => {
      const done = steps.filter(s => $(`.nav-a[href="#${s.id}"]`)?.classList.contains('done')).length;
      $$('.route-n').forEach(e => e.textContent = `${done} / ${steps.length}`);
      $$('.route-bar i').forEach(e => e.style.width = (done / steps.length * 100) + '%');
    };
    upd(); setInterval(upd, 1500);
  }

  // ------------------------------------------------------------ Decodificador
  function decoder(host) {
    const id = host.dataset.d, D = GLOSS.DECODE[id];
    const ex = EXBY[id];
    let c = esc(D.c);
    D.m.forEach(([frag, s], i) => { c = c.replace(esc(frag), `<mark class="dm" data-s="${s}" data-i="${i}" style="--sc:${STEP_COL[s]}">${esc(frag)}</mark>`); });
    host.classList.add('dec');
    host.innerHTML = `<div class="dec-head"><span class="dec-tag">${icon('target')} Consigna ${id.startsWith('R') ? 'del examen modelo' : 'de práctica'} · ${id}</span><b>Del enunciado a la consulta, paso a paso</b></div>
      <blockquote class="dec-c">${c}</blockquote>
      <div class="dec-grid"><ol class="dec-qs">${D.qs.map((q, i) => `<li data-i="${i}" style="--sc:${STEP_COL[i]}"><span class="n">${i + 1}</span><div><b>${q}</b><p class="a"></p></div></li>`).join('')}</ol>
      <div class="dec-sql"><div class="dec-sqlbar"><span class="dots"><i></i><i></i><i></i></span><span>La consulta se va armando</span></div><div class="dec-lines"><div class="dec-empty">Tocá <b>Siguiente paso</b> y respondé cada pregunta mirando la consigna.</div></div></div></div>
      <div class="btns dec-btns"></div><div class="dec-out"></div>`;
    const qs = $$('.dec-qs li', host), lines = $('.dec-lines', host), out = $('.dec-out', host), bar = $('.dec-btns', host);
    let k = 0, busy = false, rows = [];
    const typeLine = async (text, s) => {
      const el = h(`<div class="dl" style="--sc:${STEP_COL[s]}"></div>`);
      lines.appendChild(el); rows.push(el);
      if (reduced) { el.innerHTML = highlight(text); return; }
      for (let i = 1; i <= text.length; i += 2) { el.textContent = text.slice(0, i); await sleep(14); }
      el.innerHTML = highlight(text);
    };
    const step = async () => {
      if (busy || k >= D.st.length) return;
      busy = true;
      const [ans, sql] = D.st[k];
      const empty = $('.dec-empty', host); if (empty) empty.remove();
      qs.forEach((li, i) => li.classList.toggle('on', i === k));
      qs[k].classList.add('done');
      $$('.dm', host).forEach(m => m.classList.toggle('on', +m.dataset.s === k));
      $$('.dm', host).forEach(m => { if (+m.dataset.s <= k) m.classList.add('seen'); });
      const a = $('.a', qs[k]);
      a.innerHTML = esc(ans) + (sql ? '' : ' <span class="nada">no agrega nada</span>');
      if (Array.isArray(sql)) for (const l of sql) await typeLine(l, k);
      else if (sql && typeof sql === 'object') { const el = rows[sql.set[0]]; el.innerHTML = highlight(sql.set[1]); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      else if (sql) await typeLine(sql, k);
      k++; busy = false;
      if (k === D.st.length) finish();
      sync();
    };
    const finish = () => {
      $$('.dm', host).forEach(m => m.classList.remove('on'));
      const sql = rows.map(r => r.textContent).join('\n') + (rows.length && !/;\s*$/.test(rows[rows.length - 1].textContent) ? ';' : '');
      out.innerHTML = '';
      out.appendChild(h(`<div class="dec-done">${icon('check')}<span><b>Listo.</b> Las 4 preguntas armaron la consulta. Ejecutala para ver el resultado.</span></div>`));
      out.appendChild(U.codeCard(sql, { title: 'Consulta final' }));
      if (D.tip) out.appendChild(h(`<div class="co co-tip"><div class="cw">${icon('bulb')}</div><div class="ct"><b>Tip</b><p>${D.tip}</p></div></div>`));
      if (D.g) out.appendChild(h(`<div class="gcite" data-g="${D.g.join(',')}"></div>`));
      window.GLOSUI && GLOSUI.wireRefs(out);
    };
    const reset = () => { if (busy) return; k = 0; rows = []; lines.innerHTML = '<div class="dec-empty">Tocá <b>Siguiente paso</b> y respondé cada pregunta mirando la consigna.</div>'; out.innerHTML = ''; qs.forEach(li => { li.classList.remove('on', 'done'); $('.a', li).innerHTML = ''; }); $$('.dm', host).forEach(m => m.classList.remove('on', 'seen')); sync(); };
    const all = async () => { if (busy) return; if (k >= D.st.length) reset(); while (k < D.st.length) { await step(); await sleep(reduced ? 0 : 650); } };
    const bNext = btn('btn pri sm', icon('play', 'ic fill') + 'Siguiente paso', step);
    const bAll = btn('btn sm', icon('zap') + 'Reproducir todo', all);
    const bRe = btn('btn sm', icon('reset') + 'Reiniciar', reset);
    bar.append(bNext, bAll, bRe, btn('btn sm', icon('db') + 'Ver diagrama', () => window.openDiagram && window.openDiagram()));
    if (ex) bar.append(h(`<a class="btn sm" href="#ex-${id}" style="margin-left:auto">${icon('target')} Resolverla vos</a>`));
    const sync = () => { bNext.disabled = k >= D.st.length; bNext.innerHTML = icon('play', 'ic fill') + (k ? `Paso ${Math.min(k + 1, 4)} de 4` : 'Empezar: paso 1 de 4'); };
    sync();
  }

  // ------------------------------------------------------------ Demo INSERT / UPDATE / DELETE
  function demoDml() {
    const el = $('#demoDml');
    if (!el) return;
    const BASE = [['OR-114', 'Evonimus Pulchellus', 'Viveros EL OASIS', 5], ['OR-100', 'Mimosa Injerto CLASICA', 'Viveros EL OASIS', 12], ['FR-11', 'Limonero 30/40', 'NaranjasValencianas.com', 100], ['FR-9', 'Limonero calibre 8/10', 'NaranjasValencianas.com', 29], ['AR-001', 'Ajedrea', 'Murcia Seasons', 1]];
    const ST = [
      { n: 'UPDATE con WHERE', sql: "UPDATE producto SET precio_venta = 75\nWHERE codigo_producto = 'OR-114';", t: 'u', w: r => r[0] === 'OR-114', set: () => 75, chk: "SELECT codigo_producto, precio_venta FROM producto WHERE codigo_producto = 'OR-114'", txt: 'Recuperatorio, consigna 3. El WHERE elige una sola fila (la PK) y solo esa cambia.' },
      { n: 'UPDATE con cálculo', sql: "UPDATE producto SET precio_venta = precio_venta - 200\nWHERE proveedor = 'NaranjasValencianas.com';", t: 'u', w: r => r[2] === 'NaranjasValencianas.com', set: r => r[3] - 200, chk: "SELECT codigo_producto, precio_venta FROM producto WHERE proveedor = 'NaranjasValencianas.com'", txt: 'Recuperatorio, consigna 4. Cada fila que pasa el WHERE calcula su precio nuevo a partir del suyo.' },
      { n: 'UPDATE sin WHERE', sql: 'UPDATE producto SET precio_venta = 75;', t: 'u', w: () => true, set: () => 75, bad: true, chk: 'SELECT codigo_producto, precio_venta FROM producto LIMIT 10', txt: 'Sin WHERE no hay filtro: cambian TODAS las filas. En la base real, los 276 productos.' },
      { n: 'INSERT', sql: "INSERT INTO producto (codigo_producto, nombre, gama, proveedor, cantidad_en_stock, precio_venta)\nVALUES ('OR-999', 'Rosal trepador', 'Ornamentales', 'Viveros EL OASIS', 10, 12);", t: 'i', row: ['OR-999', 'Rosal trepador', 'Viveros EL OASIS', 12], chk: "SELECT codigo_producto, nombre, precio_venta FROM producto WHERE codigo_producto = 'OR-999'", txt: 'Agrega una fila nueva al final. La PK (OR-999) no puede existir ya.' },
      { n: 'DELETE', sql: "DELETE FROM producto WHERE codigo_producto = 'OR-100';", t: 'd', w: r => r[0] === 'OR-100', chk: "SELECT COUNT(*) AS productos FROM producto", txt: 'Borra solo las filas que pasan el WHERE. OR-100 nunca se pidió; si tuviera pedidos, la FK no dejaría borrarlo.' }
    ];
    let cur = 0, token = 0;
    el.innerHTML = `<div class="chips"></div><div class="sqlline" style="white-space:pre"></div><table class="dtable"><thead><tr><th>codigo_producto</th><th>nombre</th><th>proveedor</th><th>precio_venta</th><th></th></tr></thead><tbody></tbody></table><p class="note">Datos simplificados de la tabla producto.</p><div class="btns"></div><div class="sum"></div><div class="res" style="border-radius:12px"></div>`;
    const chips = $('.chips', el), line = $('.sqlline', el), tb = $('tbody', el), sum = $('.sum', el), res = $('.res', el);
    const rowHTML = r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td class="n pc">${r[3]}</td><td></td></tr>`;
    const draw = () => {
      token++;
      chips.innerHTML = '';
      ST.forEach((s, i) => chips.appendChild(btn('chip' + (i === cur ? ' on' : ''), s.n, () => { cur = i; draw(); })));
      line.innerHTML = highlight(ST[cur].sql);
      tb.innerHTML = BASE.map(rowHTML).join('');
      sum.innerHTML = ''; res.innerHTML = '';
    };
    const go = async () => {
      draw(); const my = token, s = ST[cur], trs = $$('tr', tb);
      let n = 0;
      if (s.t === 'i') {
        const tr = h(`<table><tbody>${rowHTML(s.row)}</tbody></table>`).querySelector('tr');
        tr.classList.add('ins'); tb.appendChild(tr); n = 1;
        tr.lastElementChild.innerHTML = '<span class="mark y">+</span>';
      } else {
        for (let i = 0; i < BASE.length; i++) {
          if (my !== token) return;
          trs[i].classList.add('scan'); await sleep(reduced ? 0 : 300);
          const ok = s.w(BASE[i]); n += ok;
          trs[i].classList.remove('scan');
          trs[i].classList.add(ok ? 'hit' : 'skip');
          trs[i].lastElementChild.innerHTML = `<span class="mark ${ok ? 'y' : 'n'}">${ok ? '✓' : '–'}</span>`;
          await sleep(reduced ? 0 : 100);
        }
        await sleep(reduced ? 0 : 350);
        if (my !== token) return;
        BASE.forEach((r, i) => {
          if (!s.w(r)) return;
          if (s.t === 'u') { const td = trs[i].querySelector('.pc'); td.innerHTML = `<s>${r[3]}</s> → <b>${s.set(r)}</b>`; td.classList.add('chg'); }
          else trs[i].classList.add('del');
        });
      }
      sum.innerHTML = `<div class="summary ${s.bad ? 'bad' : ''}">${s.bad ? icon('alert') + ' ' : ''}<b>${n}</b> fila(s) afectada(s). ${s.txt}</div>`;
    };
    el.querySelector('.btns').append(
      btn('btn pri sm', icon('play', 'ic fill') + 'Ejecutar animado', go),
      btn('btn sm', icon('db') + 'Probar en la base real', () => U.whenReady(() => { const d = Engine.fresh(); const r1 = Engine.run(d, ST[cur].sql); const r = r1.error ? r1 : Engine.run(d, ST[cur].chk); if (!r1.error) r.note = `Se modificaron <b>${r1.affected}</b> fila(s). Así quedó (base de prueba, no se guarda):`; U.renderRun(res, r); d.close(); })),
      btn('btn sm', icon('reset') + 'Reiniciar', draw)
    );
    draw();
  }

  // ------------------------------------------------------------ Examen modelo (paso 9)
  function examList() {
    $$('.exam-list[data-ids]').forEach(box => box.dataset.ids.split(',').forEach(id => box.appendChild(U.exCard(EXBY[id]))));
  }

  // ------------------------------------------------------------ Checklist
  function checklist() {
    $$('.check-list').forEach(ul => {
      const st = U.store.get('check', {});
      $$('input', ul).forEach((c, i) => { c.checked = !!st[i]; c.onchange = () => { st[i] = c.checked; U.store.set('check', st); }; });
    });
  }

  buildMap(); routeProgress(); examList(); demoDml(); checklist();
  $$('.decoder[data-d]').forEach(decoder);
  if (location.hash.startsWith('#ex-')) setTimeout(() => dispatchEvent(new HashChangeEvent('hashchange')), 50);
})();
