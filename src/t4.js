// los ejemplos del glosario y la consulta final de cada decodificador tienen que ejecutar
const fs=require('fs');require('./engine.js');require('./gloss.js');
require('sql.js')().then(S=>{
 Engine.init(S,{oficial:fs.readFileSync('seed_oficial.sql','utf8')}); let bad=0;
 for(const g of GLOSS.GLOSS) if(g.ex){const d=Engine.fresh();const r=Engine.run(d,g.ex);if(r.error){bad++;console.log('GLOSS',g.id,r.raw)}d.close();}
 for(const [k,dc] of Object.entries(GLOSS.DECODE)){ const lines=[]; for(const [,s] of dc.st){ if(!s) continue; if(Array.isArray(s)) lines.push(...s); else if(typeof s==='object') lines[s.set[0]]=s.set[1]; else lines.push(s);} const sql=lines.join('\n'); const d=Engine.fresh(); const r=Engine.run(d,sql); console.log(k, r.error?'ERROR '+r.raw:(r.result?r.result.values.length+' filas':'afectadas '+r.affected)); if(r.error)bad++; d.close(); }
 console.log('fallas',bad);});
