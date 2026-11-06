"""Combine real browser screenshots; requires Pillow (optional documentation tooling)."""
from pathlib import Path
from PIL import Image

frames = []
for file in sorted(Path('.tools/demo-frames').glob('*.png')):
    with Image.open(file) as image:
        resized = image.convert('RGB').resize((760, 612), Image.Resampling.LANCZOS)
        frames.append(resized.quantize(colors=128))
if not frames:
    raise SystemExit('Execute node scripts/capture-demo.mjs primeiro.')
frames[0].save('.github/demo.gif', save_all=True, append_images=frames[1:],
               duration=[1800, 1600, 1200, 1600, 1800, 2200], loop=0, optimize=True)
print('Demonstração GIF gerada com capturas reais.')
