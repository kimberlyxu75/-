"""Build a reviewable public source candidate using an explicit allowlist."""
from pathlib import Path
import json, shutil, zipfile
root = Path(__file__).resolve().parent.parent
out = root / 'github-release'
files = ['README.md','README-FIRST.txt','DEPLOY.md','LICENSE','.gitignore','index.html','app.js','security.js','styles.css','mobile-overrides.css','sw.js','manifest.webmanifest','icon.svg','scripts/package.py','scripts/package-public.py','scripts/package-minitool.mjs','scripts/minitool-css.py','scripts/check-minitool.py','minitool-src/runtime.js','tests/security.test.cjs','tests/income.test.cjs','tests/minitool.test.cjs','tests/release.test.cjs','.github/workflows/checks.yml','.github/workflows/pages.yml']
# No deletion: refuse unknown leftovers instead of accidentally publishing them.
allowed = set(files + ['package.json','package-lock.json'])
if out.exists():
    unknown = [str(p.relative_to(out)) for p in out.rglob('*') if p.is_file() and str(p.relative_to(out)) not in allowed and p.relative_to(out).parts[0] not in {'node_modules','dist','minitool-dist','github-release'} and p.suffix != '.zip']
    if unknown: raise SystemExit('Unexpected files in candidate directory; review separately: ' + ', '.join(unknown))
for name in files:
    target = out / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / name, target)
pkg = {'name':'yi-laoshi-jizhang','version':'0.3.0-beta.1','private':True,'license':'MIT','scripts':{'test':'node --test tests/*.test.cjs','build:minitool':'node scripts/package-minitool.mjs','package':'python3 scripts/package.py','package:public':'python3 scripts/package-public.py'},'devDependencies':{'esbuild':'0.25.10'}}
(out / 'package.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')
# Retain only the build dependency and its optional platform packages in the lock.
lock = json.loads((root / 'package-lock.json').read_text())
lock['name'] = pkg['name']; lock['version'] = pkg['version']
lock['packages'] = {k:v for k,v in lock['packages'].items() if k == '' or k == 'node_modules/esbuild' or k.startswith('node_modules/@esbuild/')}
lock['packages'][''] = {'name':pkg['name'],'version':pkg['version'],'license':'MIT','devDependencies':pkg['devDependencies']}
(out / 'package-lock.json').write_text(json.dumps(lock,indent=2)+'\n')
# Check known forbidden local artifacts and common credential markers without printing matches.
markers = ['-----BEGIN PRIVATE KEY-----','-----BEGIN RSA PRIVATE KEY-----','/Users/','AKID','ghp_','github_pat_']
for name in allowed:
    p = out / name
    if p.is_file() and name != 'scripts/package-public.py' and any(marker in p.read_text() for marker in markers):
        raise SystemExit('Publication review needed for: '+str(p.relative_to(out)))
with zipfile.ZipFile(root / 'yi-laoshi-jizhang-github-beta.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in sorted(allowed): z.write(out / name, name)
print(f'Public source candidate: {len(allowed)} files. Allowlist and marker checks passed. No upload performed.')
