import re
from pathlib import Path
out=Path('minitool-dist')
for name in ['styles.css','mobile-overrides.css']:
 s=Path(name).read_text()
 # Declaration-level baseline values; modern values remain optional enhancements.
 pattern=r'([\w-]+)\s*:\s*([^;{}]+);'
 def decl(m):
  prop,v=m.group(1),m.group(2).strip();prefix=''
  if prop=='gap': prefix='grid-gap: '+v+'; --mini-gap: '+v+'; '
  if prop=='inset':
   vals=v.split(); vals=(vals*4 if len(vals)==1 else [vals[0],vals[1],vals[0],vals[1]] if len(vals)==2 else [vals[0],vals[1],vals[2],vals[1]] if len(vals)==3 else vals)
   return '; '.join(p+': '+a for p,a in zip(['top','right','bottom','left'],vals))+';'
  if 'clamp(' in v:
   args=re.search(r'clamp\(([^)]+)\)',v).group(1).split(',')
   prefix+=prop+': '+args[0].strip()+'; '
  if re.search(r'(?<![\w-])min\(',v):
   # min() in this source only controls sizes: use fluid width plus upper bound.
   inner=v[4:-1] if v.startswith('min(') and v.endswith(')') else ''
   if inner:
    depth=0;parts=[];start=0
    for i,c in enumerate(inner):
     depth += (c=='(')-(c==')')
     if c==',' and depth==0:parts.append(inner[start:i].strip());start=i+1
    parts.append(inner[start:].strip())
    baseline=parts[0]
    if baseline=='100% - 20px':baseline='calc(100% - 20px)'
    prefix+=prop+': '+baseline+'; '
    if prop=='width' and len(parts)==2:prefix+='max-width: '+parts[1]+'; '
    if prop=='max-width' and len(parts)==2:prefix+='width: '+parts[1]+'; '
  if 'env(safe-area-inset-' in v:
   v=re.sub(r'env\((safe-area-inset-(?:top|bottom|left|right))(?:,\s*0px)?\)',r'var(--\1, 0px)',v)
  if prop=='aspect-ratio':prefix+='height: 240px; '
  if prop=='place-items':prefix+='align-items: '+v+'; justify-items: '+v+'; '
  return prefix+prop+': '+v+';'
 s=re.sub(pattern,decl,s)
 s=s.replace(':focus-visible',':focus')
 # The final mobile layer disables background blur; no dependency on this effect.
 s=re.sub(r'backdrop-filter:\s*blur\([^)]*\);','',s)
 out.joinpath(name).write_text(s)
out.joinpath('compat.css').write_text('''
html { touch-action: manipulation; }
body { -webkit-touch-callout: none; min-height: 100vh; min-height: var(--app-height, 100vh); }
* { min-width: 0; --mini-gap: 0px; }
input, textarea, button, select { font-family: inherit; }
textarea { width: 100%; max-width: 100%; box-sizing: border-box; }
button:focus, input:focus, select:focus, textarea:focus { outline: 2px solid #3e4cff; outline-offset: 2px; }
button:active { opacity: .75; }
.dialog-fallback { display: none; }
.dialog-fallback[open] { display: block; position: fixed; z-index: 1000; top: 10%; left: 5%; width: 90%; max-height: 80%; overflow-y: auto; background: #fff; box-shadow: 0 0 0 100vmax rgba(0,0,0,.4); }
dialog { max-height: 85vh; max-height: calc(var(--app-height, 100vh) - 30px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
.workspace, .day-dialog-list { -webkit-overflow-scrolling: touch; }
.page-controls { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; }
.page-controls button { padding: 8px; }
@supports (padding: env(safe-area-inset-top)) {
 :root { --safe-area-inset-top: env(safe-area-inset-top, 0px); --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px); }
}
@supports (aspect-ratio: 1) { .donut-chart { height: auto; } }
''')
