# Génère public/toilette.png (icône de la consolation) à partir d'un dessin noir sur fond blanc.
# Usage : python3 scripts/generer-icone-toilette.py SOURCE.png [ETIREMENT_HORIZONTAL]
#   - intérieur rempli en crème et liseré clair : visible en mode clair comme en mode sombre forcé
#   - ETIREMENT_HORIZONTAL : 1.15 = 15 % plus large (valeur utilisée)
# Requiert Pillow (pip install pillow).
import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, ImageChops
SOURCE = sys.argv[1]
ETIREMENT = float(sys.argv[2]) if len(sys.argv) > 2 else 1.15
SORTIE = Path(__file__).resolve().parent.parent / 'public' / 'toilette.png'
src=Image.open(SOURCE).convert('L')
W0,H0=src.size; pad=8
s=Image.new('L',(W0+2*pad,H0+2*pad),255); s.paste(src,(pad,pad))
# étirement horizontal appliqué à la source, avant les traitements (trait d'épaisseur constante)
s=s.resize((round(s.size[0]*ETIREMENT),s.size[1]),Image.LANCZOS); W,H=s.size
trait=s.point(lambda l: int(max(0,min(255,(255-l)*1.6))))
binaire=trait.point(lambda v: 255 if v>60 else 0)
ext=binaire.convert('RGB'); ImageDraw.floodfill(ext,(0,0),(255,0,0),thresh=10)
pe=ext.load(); pb=binaire.load()
interieur=Image.new('L',(W,H),0); pi=interieur.load()
for y in range(H):
    for x in range(W):
        if pe[x,y]!=(255,0,0) and pb[x,y]==0: pi[x,y]=255
interieur=interieur.filter(ImageFilter.MaxFilter(3))
trait=trait.filter(ImageFilter.MaxFilter(3))
silhouette=ImageChops.lighter(trait,interieur)
halo=silhouette.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(1))
img=Image.new('RGBA',(W,H),(0,0,0,0))
img.paste((255,253,248,255),(0,0),ImageChops.lighter(halo,interieur))
img=Image.composite(Image.new('RGBA',(W,H),(43,29,18,255)),img,trait)
img.putalpha(ImageChops.lighter(halo,silhouette))
img=img.crop(img.getbbox())
Hh=96; img=img.resize((round(img.size[0]*Hh/img.size[1]),Hh),Image.LANCZOS)
img.save(SORTIE, optimize=True)
print(f'{SORTIE} : {img.size[0]}x{img.size[1]}')
