import sys, glob
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1] + '/*.jpg'))
if len(sys.argv) > 3: files = [f for f in files if any(k in f for k in sys.argv[3].split(','))]
cols, w, h = 2, 960, 540
rows = (len(files) + cols - 1) // cols
im = Image.new('RGB', (cols * w, rows * h), (40, 40, 40))
d = ImageDraw.Draw(im)
for i, f in enumerate(files):
    x, y = (i % cols) * w, (i // cols) * h
    im.paste(Image.open(f).resize((w, h)), (x, y))
    d.text((x + 8, y + 8), f.split('/')[-1], fill=(255, 255, 0))
im.save(sys.argv[2], quality=88)
print(len(files), im.size)
