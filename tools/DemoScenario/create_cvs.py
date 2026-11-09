"""Generate fictional, extractable CV PDFs for the local test scenario."""
import json
import sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding='utf-8')
OUT = ROOT / 'webAI/App_Data/scenario-cvs'
OUT.mkdir(parents=True, exist_ok=True)
for c in json.loads((Path(__file__).parent / 'scenario.json').read_text(encoding='utf-8'))['candidates']:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_font(fontname='Arial', fontfile='C:/Windows/Fonts/arial.ttf')
    y = 48
    def section(text, size=11, color=(.12,.16,.24), gap=12):
        global y
        rect = pymupdf.Rect(48,y,547,790)
        spare = page.insert_textbox(rect,text,fontname='Arial',fontsize=size,lineheight=1.4,color=color)
        if spare < 0:
            raise ValueError('CV exceeds one page: '+c['email'])
        y = rect.y1 - spare + gap
    section(c['name'],22,gap=5)
    section(c['role'],14,(.08,.27,.65),gap=8)
    section(c['email']+'  |  '+c['city'],10)
    section('HỒ SƠ GIẢ LẬP PHỤC VỤ KIỂM THỬ ĐỒ ÁN',9,(.4,.4,.4))
    for heading,key in [('PROFILE','summary'),('TECHNICAL SKILLS','skills'),('WORK EXPERIENCE','experience'),('SELECTED PROJECTS','projects'),('EDUCATION','education')]:
        section(heading,10,(.08,.27,.65),gap=3)
        value=c[key]
        if key=='experience':
            field,narrative=value.split('. ',1)
            section(field+'.',10,gap=3)
            value=narrative
        section(value,10,gap=12)
    page.insert_text((48,816),'Fictional test data | AI Recruitment local scenario v1',fontsize=8,color=(.4,.4,.4))
    path=OUT/(c['email'].split('@')[0]+'.pdf')
    doc.save(path)
    extracted=page.get_text().replace('\u00a0',' ')
    assert c['email'] in extracted and 'Total experience:' in extracted
    page.get_pixmap().save(path.with_suffix('.png'))
    doc.close()
print('Created and rendered 6 CV PDFs: '+str(OUT))
