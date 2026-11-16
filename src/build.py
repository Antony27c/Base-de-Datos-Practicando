import pathlib, re
base = pathlib.Path(__file__).parent
read = lambda n: (base / n).read_text(encoding='utf-8')
seed_of, seed_tp7 = read('seed_oficial.sql'), read('seed_tp7.sql')
for s in (seed_of, seed_tp7):
    assert '</script' not in s.lower()
glos_tpl = read('template.html')
sprite = re.search(r'<svg width="0" height="0"[\s\S]*?</svg>\n', glos_tpl).group(0)
common = {'/*__CSS__*/': read('style.css') + '\n' + read('style2.css'), '/*__ENGINE__*/': read('engine.js'), '/*__DATA__*/': read('data.js'),
          '/*__GLOSSDATA__*/': read('gloss.js'), '/*__APP__*/': read('app.js'), '/*__GLOSUI__*/': read('glos.js'),
          '__SEED_OFICIAL__': seed_of, '__SEED_TP7__': seed_tp7}
out_dir = base.parent
for tpl, name, extra in [(glos_tpl, 'glosario.html', {}), (read('template_fast.html'), 'index.html', {'<!--__SPRITE__-->': sprite, '/*__FAST__*/': read('fast.js')})]:
    html = tpl
    for k, v in {**common, **extra}.items():
        assert html.count(k) == 1, (name, k)
        html = html.replace(k, v)
    (out_dir / name).write_text(html, encoding='utf-8')
    print('ok', name, len(html) // 1024, 'KB')
