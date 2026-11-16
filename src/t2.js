// Ejecuta todos los bloques <pre class="sql"> de la plantilla contra la base oficial (cada uno en una base nueva)
const fs = require('fs');
require('./engine.js'); require('./data.js');
const html = fs.readFileSync('template.html', 'utf8');
const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const blocks = [...html.matchAll(/<pre class="sql([^"]*)">([\s\S]*?)<\/pre>/g)].map(m => ({ cls: m[1].trim(), code: dec(m[2]).replace(/^\n/, '') }));
require('sql.js')().then(S => {
  Engine.init(S, { oficial: fs.readFileSync('seed_oficial.sql', 'utf8'), tp7: fs.readFileSync('seed_tp7.sql', 'utf8') });
  let bad = 0, n = 0;
  for (const b of blocks) {
    if (b.cls.includes('norun')) continue;
    n++;
    const d = Engine.fresh();
    const r = Engine.run(d, b.code);
    const isBad = b.cls.includes('bad');
    const desc = r.error ? 'ERROR ' + r.raw : r.result ? `${r.result.values.length} filas` : `afectadas ${r.affected}`;
    const warn = r.warnings.length ? ' | avisos: ' + r.warnings.length : '';
    if (r.error && !isBad) { bad++; console.log('FALLA', b.code.split('\n')[0].slice(0, 80), '=>', r.raw); }
    else if (isBad || process.argv[2]) console.log(isBad ? 'MAL ' : 'ok  ', b.code.replace(/\s+/g, ' ').slice(0, 70), '=>', desc + warn);
    if (!r.error && !isBad && r.result && r.result.values.length === 0) console.log('  (vacío)', b.code.replace(/\s+/g, ' ').slice(0, 80));
    d.close();
  }
  // Juego: cada nivel tiene que ejecutar
  DATA.GAME.forEach((g, i) => { const d = Engine.fresh(); const r = Engine.run(d, g.p.join('\n') + ';'); if (r.error) { bad++; console.log('FALLA juego', i + 1, r.raw); } d.close(); });
  console.log(`bloques: ${n}, fallas: ${bad}`);
});
