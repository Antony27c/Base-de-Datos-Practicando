const fs=require('fs');require('./engine.js');require('./data.js');
require('sql.js')().then(S=>{
 Engine.init(S,{oficial:fs.readFileSync('seed_oficial.sql','utf8'),tp7:fs.readFileSync('seed_tp7.sql','utf8')});
 let bad=0;
 for(const ex of DATA.EX){
   for(const s of [ex.sol,...(ex.alt||[])]){
     const r=Engine.check(ex,s);
     const n=r.exp?r.exp.values.length:'-';
     if(!r.ok){bad++;console.log('FAIL',ex.id,r.title,r.msg.replace(/<[^>]+>/g,''));}
     else if(process.argv[2]) console.log('ok',ex.id,'filas esperadas:',n, r.msg.slice(0,40));
   }
 }
 // negativos
 const t=(id,s)=>{const r=Engine.check(DATA.EX.find(e=>e.id===id),s);console.log('NEG',id,r.ok,r.title,'|',r.msg.replace(/<[^>]+>/g,'').slice(0,150));};
 t('R5',"SELECT nombre_cliente FROM cliente WHERE pais='España'");
 t('R5',"SELECT * FROM cliente WHERE pais='Spain'");
 t('R6',"SELECT forma_pago FROM pago");
 t('T10',"SELECT * FROM producto WHERE gama='Ornamentales' AND cantidad_en_stock>100 ORDER BY precio_venta");
 t('T6b',"SELECT DISTINCT codigo_cliente FROM pago WHERE YEAR(fecha_pago)=2008");
 t('R3',"UPDATE producto SET precio_venta = 75");
 t('R10',"SELECT nombre FROM producto ORDER BY cantidad_en_stock DESC LIMIT 1");
 t('T12',"SELECT c.nombre_cliente, e.nombre FROM cliente c JOIN empleado e ON c.codigo_empleado_rep_ventas=e.codigo_empleado JOIN pago p ON p.codigo_cliente=c.codigo_cliente");
 t('R8',"SELECT pais, COUNT(*) FROM cliente");
 t('T32',"SELECT c.nombre_cliente FROM cliente c JOIN pago p ON p.codigo_cliente=c.codigo_cliente GROUP BY c.codigo_cliente HAVING c.limite_credito>SUM(p.total)");
 console.log('fallas:',bad,'de',DATA.EX.length);
});
