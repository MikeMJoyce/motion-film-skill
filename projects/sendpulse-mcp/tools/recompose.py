# Put the cut layers back on the flat background at their source positions and compare with the slide.
import json, sys, re, numpy as np
from PIL import Image
CUT = json.loads(re.search(r'= (\{.*\});', open('film/cut.js').read(), re.S).group(1))
SETS = {1: ['logo_word','logo_pulse','h1_0','h1_1','h1_2','h1_3','h2_0','h2_1','h2_2','h3_0','h3_1','cat0','cat1','cat2','cat3','ratings'],
        4: ['orbit_glow','mcp_pill','ic_claude','ic_cursor','ic_arc','ic_openai','ic_copilot','ic_bot'],
        3: ['top_glow','pill_email','pill_chatbot','pill_automation','g3_left','g3_mid','g3_right'],
        2: ['top_glow','pill_popups','pill_landing','pill_crm','g4_left','g4_mid','g4_right']}
bgc = sys.argv[1] if len(sys.argv) > 1 else '#023347'
for s, names in SETS.items():
    im = Image.new('RGBA', (2000, 1125), bgc)
    for n in names:
        c = CUT[n]; im.alpha_composite(Image.open('assets/cut/' + n + '.png'), (c['x'], c['y']))
    src = Image.open(f'assets/src/scr_{s}.webp').convert('RGBA')
    d = np.abs(np.asarray(im).astype(int) - np.asarray(src).astype(int))[..., :3].max(2)
    print(s, 'mean diff', round(d.mean(), 2), 'p99', np.percentile(d, 99))
    Image.fromarray(np.clip(d * 4, 0, 255).astype(np.uint8)).resize((1000, 562)).save(f'review/x/diff_{s}.png')
    im.convert('RGB').resize((1000, 562)).save(f'review/x/re_{s}.png')
