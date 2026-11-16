(function (G) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function parseD(v) {
    if (v == null) return null;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))) : null;
  }
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const isoT = d => `${iso(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const now = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds())); };

  function addInterval(v, x, sign) {
    const d = parseD(v);
    if (!d || x == null) return null;
    let n, u = 'DAY';
    if (typeof x === 'number') n = x;
    else {
      const m = String(x).trim().match(/^(-?\d+)\s*(DAY|MONTH|YEAR)?/i);
      if (!m) return null;
      n = +m[1]; u = (m[2] || 'DAY').toUpperCase();
    }
    n *= sign;
    if (u === 'DAY') d.setUTCDate(d.getUTCDate() + n);
    else if (u === 'MONTH') d.setUTCMonth(d.getUTCMonth() + n);
    else d.setUTCFullYear(d.getUTCFullYear() + n);
    return /\d:\d/.test(String(v)) ? isoT(d) : iso(d);
  }

  function dateFormat(v, f) {
    const d = parseD(v);
    if (!d || f == null) return null;
    return String(f).replace(/%([a-zA-Z%])/g, (m, c) => ({
      Y: d.getUTCFullYear(), y: pad(d.getUTCFullYear() % 100), m: pad(d.getUTCMonth() + 1), c: d.getUTCMonth() + 1,
      d: pad(d.getUTCDate()), e: d.getUTCDate(), M: MONTHS[d.getUTCMonth()], b: MONTHS[d.getUTCMonth()].slice(0, 3),
      W: DAYS[d.getUTCDay()], a: DAYS[d.getUTCDay()].slice(0, 3), H: pad(d.getUTCHours()), i: pad(d.getUTCMinutes()),
      s: pad(d.getUTCSeconds()), S: pad(d.getUTCSeconds()), '%': '%'
    })[c] ?? c);
  }

  function register(db) {
    const f = (name, fn) => db.create_function(name, fn);
    f('YEAR', v => { const d = parseD(v); return d ? d.getUTCFullYear() : null; });
    f('MONTH', v => { const d = parseD(v); return d ? d.getUTCMonth() + 1 : null; });
    f('DAY', v => { const d = parseD(v); return d ? d.getUTCDate() : null; });
    f('DAYOFMONTH', v => { const d = parseD(v); return d ? d.getUTCDate() : null; });
    f('CURDATE', () => iso(now()));
    f('NOW', () => isoT(now()));
    f('DATEDIFF', (a, b) => {
      const x = parseD(a), y = parseD(b);
      if (!x || !y) return null;
      return Math.round((Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) - Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate())) / 864e5);
    });
    f('ADDDATE', (v, x) => addInterval(v, x, 1));
    f('DATE_ADD', (v, x) => addInterval(v, x, 1));
    f('SUBDATE', (v, x) => addInterval(v, x, -1));
    f('DATE_SUB', (v, x) => addInterval(v, x, -1));
    f('DATE_FORMAT', dateFormat);
    f('TIMESTAMPDIFF', (u, a, b) => {
      const x = parseD(a), y = parseD(b);
      if (!x || !y) return null;
      u = String(u).toUpperCase();
      if (u === 'DAY') return Math.floor((y - x) / 864e5);
      let months = (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth());
      if (y.getUTCDate() < x.getUTCDate()) months--;
      return u === 'MONTH' ? months : Math.trunc(months / 12);
    });
  }

  // --- Preparación de los scripts de la base ---------------------------------------------------
  function prepOficial(s) {
    return s.replace(/^\s*(DROP DATABASE|CREATE DATABASE|USE)\b.*$/gim, '')
      .replace(/VARCHAR\((\d+)\)/gi, 'VARCHAR($1) COLLATE NOCASE')
      .replace(/\\r\\n|\\n|\\r/g, ' ')
      .replace(/\\"/g, '"');
  }
  function prepTp7(s) {
    return s.replace(/^\s*(DROP DATABASE|CREATE DATABASE|USE)\b.*$/gim, '')
      .replace(/ALTER TABLE[\s\S]*?;/gi, '')
      .replace(/SELECT table_name[\s\S]*?;/gi, '')
      .replace(/\)\s*ENGINE\s*=\s*InnoDB/gi, ')')
      .replace(/(\w+)\s+INT\s+NOT NULL AUTO_INCREMENT/gi, '$1 INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/,\s*PRIMARY KEY \((id_pago|id_detalle_pedido)\)/gi, '')
      .replace(/VARCHAR\((\d+)\)/gi, 'VARCHAR($1) COLLATE NOCASE');
  }

  let SQL = null;
  const bytes = {};
  const schemaCache = {};

  function init(S, rawSeeds) {
    SQL = S;
    const prep = { oficial: prepOficial, tp7: prepTp7 };
    for (const k of Object.keys(rawSeeds)) {
      const db = new SQL.Database();
      db.exec(prep[k](rawSeeds[k]));
      bytes[k] = db.export();
      db.close();
    }
  }

  function fresh(kind = 'oficial') {
    const db = new SQL.Database(bytes[kind]);
    register(db);
    db.run('PRAGMA foreign_keys = ON;');
    db.kind = kind;
    return db;
  }

  function schema(db) {
    const k = db.kind || 'oficial';
    if (schemaCache[k]) return schemaCache[k];
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map(r => r[0]);
    const cols = {};
    for (const t of tables) cols[t] = db.exec(`PRAGMA table_info(${t})`)[0].values.map(r => r[1]);
    return (schemaCache[k] = { tables, cols });
  }

  // --- Traducción MySQL -> SQLite ----------------------------------------------------------------
  const CASTS = { YEAR: 'NUMERIC', MONTH: 'NUMERIC', DAY: 'NUMERIC', DAYOFMONTH: 'NUMERIC', DATEDIFF: 'NUMERIC', TIMESTAMPDIFF: 'NUMERIC', DATE_FORMAT: 'TEXT' };

  function wrapFns(src) {
    let out = '', i = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === "'" || ch === '"' || ch === '`') {
        let j = i + 1;
        while (j < n && src[j] !== ch) j++;
        out += src.slice(i, j + 1); i = j + 1; continue;
      }
      if (ch === '-' && src[i + 1] === '-') {
        let j = src.indexOf('\n', i); if (j < 0) j = n;
        out += src.slice(i, j); i = j; continue;
      }
      if (/[A-Za-z_]/.test(ch) && (i === 0 || !/[\w.]/.test(src[i - 1]))) {
        let j = i;
        while (j < n && /\w/.test(src[j])) j++;
        const word = src.slice(i, j);
        let k = j;
        while (k < n && /\s/.test(src[k])) k++;
        const type = CASTS[word.toUpperCase()];
        if (type && src[k] === '(') {
          let depth = 0, p = k;
          for (; p < n; p++) {
            const c = src[p];
            if (c === "'" || c === '"') { p++; while (p < n && src[p] !== c) p++; continue; }
            if (c === '(') depth++;
            else if (c === ')' && --depth === 0) break;
          }
          out += `CAST(${word}(${wrapFns(src.slice(k + 1, p))}) AS ${type})`;
          i = p + 1; continue;
        }
        out += word; i = j; continue;
      }
      out += ch; i++;
    }
    return out;
  }

  function translate(sql) {
    if (/\bGETDATE\s*\(/i.test(stripComments(sql))) throw new Error('GETDATE_SQLSERVER');
    let s = sql.replace(/^\s*USE\s+\w+\s*;/gim, '');
    s = s.replace(/INTERVAL\s+(-?\d+)\s+(DAY|MONTH|YEAR)S?\b/gi, (m, n, u) => `'${n} ${u.toUpperCase()}'`);
    s = s.replace(/TIMESTAMPDIFF\s*\(\s*(DAY|MONTH|YEAR)\s*,/gi, (m, u) => `TIMESTAMPDIFF('${u.toUpperCase()}',`);
    s = s.replace(/(>=|<=|>|<)\s*(ALL|ANY|SOME)\s*\(\s*SELECT\s+(?!DISTINCT\b)([\w.]+)\s+FROM\b/gi, (m, op, q, col) => {
      const agg = (op[0] === '>') === (q.toUpperCase() === 'ALL') ? 'MAX' : 'MIN';
      return `${op} (SELECT ${agg}(${col}) FROM`;
    });
    s = s.replace(/=\s*(ANY|SOME)\s*\(/gi, 'IN (');
    s = s.replace(/(<>|!=)\s*ALL\s*\(/gi, 'NOT IN (');
    return wrapFns(s);
  }

  const stripComments = sql => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // --- Avisos didácticos (cosas que en MySQL fallan o están mal aunque el simulador las acepte) ---
  function topLevel(sql) {
    // Devuelve el texto con paréntesis y strings "aplanados" para buscar cláusulas de primer nivel
    let out = '', depth = 0, q = null;
    for (const c of sql) {
      if (q) { out += ' '; if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; out += ' '; continue; }
      if (c === '(') { depth++; out += ' '; continue; }
      if (c === ')') { depth--; out += ' '; continue; }
      out += depth ? ' ' : c;
    }
    return out;
  }

  function lint(sql) {
    const w = [];
    const s = stripComments(sql);
    if (/(=|<>|!=)\s*NULL\b/i.test(s)) w.push('Comparaste con <code>= NULL</code>. Eso nunca da verdadero: se escribe <code>IS NULL</code> o <code>IS NOT NULL</code>.');
    if (/'\d{1,2}\/\d{1,2}\/\d{4}'/.test(s)) w.push('Escribiste una fecha como <code>dd/mm/aaaa</code>. En MySQL las fechas van <code>\'aaaa-mm-dd\'</code>.');
    if (/\bSELECT\s+TOP\b/i.test(s)) w.push('<code>TOP</code> es de SQL Server. En MySQL se usa <code>LIMIT</code> al final.');
    for (const stmt of s.split(';')) {
      const t = topLevel(stmt);
      if (/^\s*(UPDATE|DELETE)\b/i.test(t) && !/\bWHERE\b/i.test(t)) w.push('Tu <code>UPDATE</code>/<code>DELETE</code> no tiene <code>WHERE</code>: afectó a <b>todas</b> las filas de la tabla.');
      const m = t.match(/^\s*SELECT\b([\s\S]*?)\bFROM\b/i);
      if (m && !/\bGROUP\s+BY\b/i.test(t)) {
        const start = stmt.search(/\bSELECT\b/i) + 6;
        const list = stmt.slice(start, start + m[1].length);
        const items = splitTop(list);
        const hasAgg = items.some(x => /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(x));
        const bare = items.filter(x => !/\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(x) && !/^\s*(DISTINCT\s+)?('[^']*'|\d+(\.\d+)?)\s*(AS\s+\w+)?\s*$/i.test(x));
        if (hasAgg && bare.length) w.push(`Mezclaste una función de agregación con la columna <code>${esc(bare[0].trim())}</code> sin <code>GROUP BY</code>. MySQL 8 da error ("nonaggregated column"). Agregá <code>GROUP BY</code> o sacá esa columna.`);
      }
    }
    return w;
  }

  function splitTop(str) {
    const parts = []; let depth = 0, q = null, cur = '';
    for (const c of str) {
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
  }

  // --- Mensajes de error en castellano ------------------------------------------------------------
  function lev(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function closest(word, list) {
    let best = null, bd = 99;
    for (const x of list) { const v = lev(word, x); if (v < bd) { bd = v; best = x; } }
    return bd <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
  }

  const COL_HINTS = {
    oficial: {
      apellido: 'En la base oficial los apellidos están en <code>apellido1</code> y <code>apellido2</code>.',
      gama_producto: 'En la base oficial la columna de <code>producto</code> se llama <code>gama</code>.',
      id_pago: 'En la base oficial <code>pago</code> no tiene <code>id_pago</code>: su clave es <code>(codigo_cliente, id_transaccion)</code>.',
      direccion: 'En la base oficial la dirección está en <code>linea_direccion1</code> y <code>linea_direccion2</code>.'
    },
    tp7: {
      apellido1: 'En la base alternativa el apellido está en una sola columna: <code>apellido</code>.',
      gama: 'En la base alternativa la columna de <code>productos</code> se llama <code>gama_producto</code>.'
    }
  };

  function friendly(msg, db) {
    const sc = db ? schema(db) : { tables: [], cols: {} };
    const kind = (db && db.kind) || 'oficial';
    const allCols = [...new Set(Object.values(sc.cols).flat())];
    let m;
    const orig = `<div class="err-orig">Mensaje del motor: ${esc(msg)}</div>`;
    if (/GETDATE_SQLSERVER/.test(msg)) return '<code>GETDATE()</code> es de SQL Server. En MySQL la fecha de hoy es <code>CURDATE()</code> y la fecha con hora <code>NOW()</code>.';
    if ((m = msg.match(/no such table: (?:main\.)?(\w+)/i))) {
      const t = m[1];
      let tip = '';
      if (sc.tables.includes(t.replace(/s$/i, ''))) tip = ` ¿Quisiste decir <code>${t.replace(/s$/i, '')}</code>? En esta base las tablas van en <b>singular</b>.`;
      else if (sc.tables.includes(t + 's')) tip = ` ¿Quisiste decir <code>${t}s</code>? En esta base las tablas van en <b>plural</b>.`;
      else { const c = closest(t, sc.tables); if (c) tip = ` ¿Quisiste decir <code>${c}</code>?`; }
      return `No existe la tabla <b>${esc(t)}</b>.${tip} Tablas disponibles: ${sc.tables.map(x => `<code>${x}</code>`).join(' ')}` + orig;
    }
    if ((m = msg.match(/no such column: ([\w.]+)/i))) {
      const full = m[1], name = full.split('.').pop();
      const hint = (COL_HINTS[kind] || {})[name.toLowerCase()];
      const owners = sc.tables.filter(t => sc.cols[t].some(x => x.toLowerCase() === name.toLowerCase()));
      const c = owners.length ? null : closest(name, allCols);
      let tip = hint ? ' ' + hint
        : owners.length ? ` Esa columna existe, pero en la tabla ${owners.map(t => `<code>${t}</code>`).join(' / ')}. ¿La agregaste al <code>FROM</code> o hiciste el <code>JOIN</code>?`
        : c ? ` ¿Quisiste decir <code>${c}</code>?` : '';
      if (full.includes('.')) tip += ` Revisá también que el alias <code>${esc(full.split('.')[0])}</code> esté definido en el FROM/JOIN y sea de la tabla correcta.`;
      else if (/^[A-Za-zÁÉÍÓÚáéíóúñÑ ]+$/.test(name) && !c && !hint) tip += ' Si era un texto, faltan las comillas simples: <code>\'' + esc(name) + '\'</code>.';
      return `No existe la columna <b>${esc(full)}</b>.${tip}` + orig;
    }
    if ((m = msg.match(/ambiguous column name: ([\w.]+)/i)))
      return `Columna ambigua: <b>${esc(m[1])}</b> está en más de una de las tablas que uniste. Poné el alias adelante, por ejemplo <code>c.${esc(m[1])}</code>.` + orig;
    if ((m = msg.match(/near "(.+?)": syntax error/i))) {
      const tok = m[1];
      let tip = 'Revisá comas, comillas, paréntesis y el orden de las cláusulas (SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT).';
      if (/^(FROM|WHERE|GROUP|ORDER|HAVING|LIMIT)$/i.test(tok)) tip = `Hay algo mal justo antes de <code>${tok}</code>: ¿una coma de más al final de la lista de columnas? ¿una cláusula fuera de orden?`;
      if (/^AS$/i.test(tok)) tip = 'Antes de <code>AS</code> no va coma: es <code>CONCAT(...) AS nombre</code>, no <code>CONCAT(...), AS nombre</code>.';
      if (/^,$/.test(tok)) tip = 'Sobra o falta algo alrededor de una coma.';
      if (/^(SELECT|INSERT|UPDATE|DELETE)$/i.test(tok)) tip = `Aparece un <code>${tok}</code> donde no se esperaba: ¿falta el <code>;</code> al final de la sentencia anterior?`;
      return `Error de sintaxis cerca de <b>${esc(tok)}</b>. ${tip}` + orig;
    }
    if (/incomplete input/i.test(msg)) return 'La consulta quedó incompleta: ¿falta cerrar una comilla <code>\'</code> o un paréntesis <code>)</code>?' + orig;
    if ((m = msg.match(/UNIQUE constraint failed: ([\w.]+)/i)) || /PRIMARY KEY/i.test(msg))
      return `Ya existe una fila con esa <b>clave primaria</b>${m ? ` (<code>${esc(m[1])}</code>)` : ''}. Usá otro código: buscá el último con <code>SELECT MAX(...)</code>.` + orig;
    if (/FOREIGN KEY constraint failed/i.test(msg))
      return 'Falla de <b>clave foránea</b>: estás apuntando a un registro que no existe (por ejemplo un cliente, oficina o jefe que no está cargado), o querés borrar algo que otras tablas usan.' + orig;
    if ((m = msg.match(/NOT NULL constraint failed: ([\w.]+)/i)))
      return `La columna <b>${esc(m[1])}</b> es obligatoria (NOT NULL) y quedó vacía. Agregala a la lista de columnas del INSERT con un valor.` + orig;
    if (/misuse of aggregate/i.test(msg))
      return 'Usaste <code>COUNT</code>/<code>SUM</code>/<code>AVG</code>... dentro del <code>WHERE</code>. WHERE se evalúa fila por fila, antes de agrupar. Para filtrar por un conteo usá <b>HAVING</b> después del GROUP BY.' + orig;
    if (/GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate/i.test(msg))
      return '<code>HAVING</code> filtra grupos: necesita un <code>GROUP BY</code> antes.' + orig;
    if ((m = msg.match(/no such function: (\w+)/i)))
      return `La función <b>${esc(m[1])}</b> no existe (o no está disponible en el simulador).` + orig;
    if (/(\d+) values for (\d+) columns|has (\d+) columns but (\d+) values/i.test(msg))
      return 'La cantidad de <b>valores</b> no coincide con la cantidad de <b>columnas</b> del INSERT. Contalas de nuevo.' + orig;
    if (/sub-select returns (\d+) columns/i.test(msg))
      return 'La subconsulta devuelve <b>varias columnas</b>. Dentro de <code>IN (...)</code> o de una comparación con <code>=</code>, tiene que devolver <b>una sola</b>.' + orig;
    if (/row value misused/i.test(msg)) return 'Hay paréntesis con varias columnas donde se esperaba un solo valor.' + orig;
    return esc(msg);
  }

  // --- Ejecución -----------------------------------------------------------------------------------
  function execLast(db, sql) {
    let last = null, affected = 0;
    for (const stmt of db.iterateStatements(translate(sql))) {
      const cols = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) rows.push(stmt.get());
      if (cols.length) last = { columns: cols, values: rows };
      else affected += db.getRowsModified();
    }
    return last || { columns: [], values: [], none: true, affected };
  }

  function run(db, sql) {
    const clock = typeof performance !== 'undefined' ? performance : Date;
    const t0 = clock.now();
    const warnings = lint(sql);
    try {
      const r = execLast(db, sql);
      return { result: r.none ? null : r, affected: r.affected || 0, warnings, ms: clock.now() - t0 };
    } catch (e) {
      return { error: friendly(String(e.message || e), db), raw: String(e.message || e), warnings };
    }
  }

  // --- Autocorrector -------------------------------------------------------------------------------
  const norm = v => v === null || v === undefined ? '∅' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v).trim().toLowerCase();
  const rowKey = r => r.map(norm).join('\u0001');

  function subsetOf(user, exp) {
    const map = [];
    for (let j = 0; j < exp.columns.length; j++) {
      const set = new Set(exp.values.map(r => norm(r[j])));
      const k = user.columns.findIndex((_, i) => !map.includes(i) && user.values.every(r => set.has(norm(r[i]))));
      if (k < 0) return false;
      map.push(k);
    }
    const rows = new Set(exp.values.map(r => r.map(norm).join('\u0001')));
    return user.values.every(r => rows.has(map.map(k => norm(r[k])).join('\u0001')));
  }

  function compare(user, exp, ordered, tieOk) {
    const U = user.values, X = exp.values;
    if (!user.columns.length) return { ok: false, title: 'No hay resultado', msg: 'Tu consulta no devolvió ninguna tabla. ¿Escribiste un SELECT?' };
    if (tieOk && U.length >= 1 && U.length < X.length && subsetOf(user, exp))
      return { ok: true, title: '¡Correcto!', msg: `Bien. Ojo: hay <b>${X.length}</b> filas empatadas en el valor máximo/mínimo. Con <code>LIMIT</code> mostrás solo ${U.length}; con la subconsulta <code>= (SELECT MAX(...))</code> aparecen todas. Las dos formas se aceptan.` };
    if (U.length !== X.length) {
      const uniq = new Set(U.map(rowKey)).size;
      let msg;
      if (U.length > X.length) {
        msg = `Tu consulta devolvió <b>${U.length}</b> filas y se esperaban <b>${X.length}</b>.`;
        if (uniq === X.length && uniq < U.length) msg += ' Tenés <b>filas repetidas</b>: probá con <code>DISTINCT</code>.';
        else if (X.length === 1) msg += ' Se espera <b>un solo resultado</b>: ¿te falta una función como <code>COUNT</code>/<code>SUM</code>, un <code>LIMIT 1</code> o una subconsulta con <code>MAX</code>/<code>MIN</code>?';
        else msg += ' Sobran filas: ¿falta alguna condición en el <code>WHERE</code>? ¿usaste el tipo de JOIN correcto?';
      } else {
        msg = `Tu consulta devolvió <b>${U.length}</b> filas y se esperaban <b>${X.length}</b>.`;
        const xu = new Set(X.map(rowKey)).size;
        if (xu === U.length && xu < X.length) msg += ' El resultado esperado tiene filas que se repiten (por ejemplo, dos clientes con el mismo nombre). ¿Usaste <code>DISTINCT</code> donde no hacía falta?';
        else if (U.length === 0) msg += ' No devolvió nada: revisá cómo están escritos los textos del <code>WHERE</code> (por ejemplo <code>\'Spain\'</code> vs <code>\'España\'</code>) y las condiciones.';
        else msg += ' Faltan filas: ¿un filtro demasiado estricto? ¿<code>INNER JOIN</code> donde iba <code>LEFT JOIN</code>? ¿un <code>LIMIT</code> de más?';
      }
      return { ok: false, title: 'La cantidad de filas no coincide', msg };
    }
    if (X.length === 0) return { ok: true, title: '¡Correcto!', msg: 'El resultado esperado está vacío y el tuyo también.' };
    const sig = (vals, j) => vals.map(r => norm(r[j])).sort().join('\u0001');
    const us = user.columns.map((_, k) => sig(U, k));
    const used = new Set(), map = [];
    for (let j = 0; j < exp.columns.length; j++) {
      const s = sig(X, j);
      const k = us.findIndex((v, i) => v === s && !used.has(i));
      if (k < 0) {
        const sample = [...new Set(X.map(r => r[j]))].slice(0, 4).map(v => `<code>${esc(v === null ? 'NULL' : v)}</code>`).join(', ');
        return { ok: false, title: 'Falta una columna o tiene otros valores', msg: `Se esperaba una columna <b>${esc(exp.columns[j])}</b> con valores como ${sample}... y en tu resultado no aparece (o sus valores son distintos). Revisá qué columnas pide la consigna y los filtros.` };
      }
      used.add(k); map.push(k);
    }
    const proj = U.map(r => map.map(k => norm(r[k])).join('\u0001'));
    const expRows = X.map(r => r.map(norm).join('\u0001'));
    if (proj.slice().sort().join('\n') !== expRows.slice().sort().join('\n'))
      return { ok: false, title: 'Los datos no coinciden', msg: 'Las columnas están, pero las filas no combinan igual que en el resultado esperado. Revisá las condiciones del <code>JOIN ... ON</code> y del <code>WHERE</code>.' };
    if (ordered) {
      const j = exp.columns.findIndex(c => c.toLowerCase() === ordered.toLowerCase());
      if (j >= 0) {
        const a = U.map(r => norm(r[map[j]])).join('\u0001'), b = X.map(r => norm(r[j])).join('\u0001');
        if (a !== b) return { ok: false, title: 'Bien los datos, mal el orden', msg: `Los datos son correctos pero el orden no. Revisá el <code>ORDER BY</code> (¿por <b>${esc(ordered)}</b>? ¿<code>ASC</code> o <code>DESC</code>?).` };
      }
    }
    const extra = user.columns.length - exp.columns.length;
    return { ok: true, title: '¡Correcto!', msg: extra > 0 ? `El resultado es correcto. Mostrás ${extra} columna(s) más de las necesarias: no está mal, pero en el examen mostrá lo que pide la consigna.` : 'Tu consulta devuelve exactamente lo esperado.' };
  }

  function check(ex, userSQL) {
    const clean = stripComments(userSQL).trim();
    if (!clean) return { ok: false, title: 'Vacío', msg: 'Todavía no escribiste ninguna consulta.' };
    const A = fresh(ex.db || 'oficial'), B = fresh(ex.db || 'oficial');
    try {
      if (ex.setup) { A.exec(translate(ex.setup)); B.exec(translate(ex.setup)); }
      let exp;
      try { exp = execLast(B, ex.sol); if (ex.verify) exp = execLast(B, ex.verify); }
      catch (e) { return { ok: false, title: 'Error interno', msg: esc(e.message) }; }
      let user;
      try { user = execLast(A, userSQL); if (ex.verify) user = execLast(A, ex.verify); }
      catch (e) { return { ok: false, title: 'Tu consulta tiene un error', msg: friendly(String(e.message || e), A), user: null, exp }; }
      const r = compare(user, exp, ex.ordered, ex.tieOk);
      if (r.ok) {
        for (const q of ex.requires || []) if (!new RegExp(q.re, 'i').test(clean)) return { ok: false, title: 'Resultado bien, método no', msg: `El resultado es correcto, pero la consigna pide: <b>${q.msg}</b>.`, user, exp };
        for (const q of ex.forbids || []) if (new RegExp(q.re, 'i').test(clean)) return { ok: false, title: 'Resultado bien, método no', msg: `El resultado es correcto, pero la consigna dice: <b>${q.msg}</b>.`, user, exp };
      }
      if (ex.verify && !r.ok) r.msg += `<div class="err-orig">Para comprobar tus cambios se ejecutó: <code>${esc(ex.verify)}</code></div>`;
      return Object.assign(r, { user, exp, warnings: lint(userSQL) });
    } finally { A.close(); B.close(); }
  }

  G.Engine = { init, fresh, translate, run, lint, friendly, check, compare, schema, esc, stripComments };
})(typeof window !== 'undefined' ? window : globalThis);
