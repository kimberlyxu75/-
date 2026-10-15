"""Synchronize static artifacts and create the upload package."""
from pathlib import Path
import shutil
import zipfile
root = Path(__file__).resolve().parent.parent
assets = ['index.html','styles.css','mobile-overrides.css','app.js','security.js','sw.js','manifest.webmanifest','icon.svg','LICENSE']
(root / 'dist').mkdir(exist_ok=True)
# Exclude previously generated cloud assets from this local-only release.
for name in ['cloud-config.js','cloud-sync.js','cloud-ui.js','vendor/cloudbase.js','vendor/cloudbase.js.LEGAL.txt']:
    (root / 'dist' / name).unlink(missing_ok=True)
for name in assets:
    (root / 'dist' / name).parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(root / name, root / 'dist' / name)
with zipfile.ZipFile(root / 'personal-wallet-pwa.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in assets:
        archive.write(root / 'dist' / name, name)
print('Static files synchronized; personal-wallet-pwa.zip rebuilt.')

with zipfile.ZipFile(root / 'wallet-demo-portfolio.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in assets + ['README-FIRST.txt']:
        archive.write(root / name, name)
print('Demo package refreshed to the same version.')
