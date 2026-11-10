import math, sys
from PIL import Image, ImageDraw, ImageFont
S=2048; SS=2  # supersample
W=S*SS; cx=cy=W/2
RED=(255,30,0,255); WHITE=(255,255,255,255)
FONT="/usr/share/fonts/opentype/inter/Inter-Black.otf"
def badge(pct, out):
    img=Image.new("RGBA",(W,W),(0,0,0,0)); d=ImageDraw.Draw(img)
    n=26; ro=W*0.495; ri=W*0.425; pts=[]
    for i in range(2*n):
        a=math.pi*i/n - math.pi/2; r=ro if i%2==0 else ri
        pts.append((cx+r*math.cos(a), cy+r*math.sin(a)))
    d.polygon(pts, fill=RED)
    # text layer, then rotate
    t=Image.new("RGBA",(W,W),(0,0,0,0)); td=ImageDraw.Draw(t)
    f=ImageFont.truetype(FONT, int(W*0.27))
    lines=[f"{pct}%","OFF"]; boxes=[td.textbbox((0,0),s,font=f) for s in lines]
    gap=W*0.03; hs=[b[3]-b[1] for b in boxes]; total=sum(hs)+gap; y=cy-total/2
    for s,b,h in zip(lines,boxes,hs):
        w=b[2]-b[0]; td.text((cx-w/2-b[0], y-b[1]), s, font=f, fill=WHITE); y+=h+gap
    t=t.rotate(18, resample=Image.BICUBIC, center=(cx,cy))
    img.alpha_composite(t)
    img.resize((S,S), Image.LANCZOS).save(out)
for p in (50,70): badge(p, f"sale_{p}_off.png")
