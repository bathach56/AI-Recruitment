"""Tạo bộ thử gán nhãn song ngữ, không tự điền nhãn hoặc dùng điểm AI."""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/bilingual_pilot_v1'

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if OUT.exists():
        raise SystemExit('Thư mục đã tồn tại; không ghi đè công việc gán nhãn.')
    vi_path = ROOT / 'tools/DemoScenario/scenario.json'
    vi = json.loads(vi_path.read_text(encoding='utf-8'))
    source = None
    for path in sorted((ROOT / 'webAI/App_Data/backups').glob('noi-dung-*/scenario-truoc-viet-hoa.json')):
        candidate = json.loads(path.read_text(encoding='utf-8'))
        if candidate['candidates'][0]['experience'].startswith('Total experience:'):
            source = path, candidate
            break
    if source is None:
        raise SystemExit('Chưa tìm thấy bản nguồn tiếng Anh để tạo bộ thử có truy nguồn.')
    OUT.mkdir(parents=True)
    pairs = []
    for language, scenario in [('vi', vi), ('en', source[1])]:
        folder = OUT / language
        folder.mkdir()
        for i, c in enumerate(scenario['candidates'], 1):
            # Bỏ tên, email và địa chỉ; chỉ dùng nội dung nghề nghiệp để đánh giá.
            text = '\n\n'.join(c[key] for key in ['role','summary','skills','experience','projects','education'])
            (folder / f'CV_{i:03}.txt').write_text(text + '\n', encoding='utf-8', newline='\n')
        for j, job in enumerate(scenario['jobs'], 1):
            text = '\n\n'.join(job[key] for key in ['title','description','requirements','skills','experience'])
            (folder / f'JD_{j:03}.txt').write_text(text + '\n', encoding='utf-8', newline='\n')
        for i in range(1,7):
            for j in range(1,4):
                pairs.append(dict(pair_id=f'CV_{i:03}__JD_{j:03}__{language}',cv_group=f'CV_{i:03}',jd_group=f'JD_{j:03}',language=language,cv_text_path=f'{language}/CV_{i:03}.txt',jd_text_path=f'{language}/JD_{j:03}.txt'))
    def write(name, fields, rows):
        with (OUT / name).open('w',encoding='utf-8-sig',newline='') as stream:
            writer=csv.DictWriter(stream,fieldnames=fields,lineterminator='\n');writer.writeheader();writer.writerows(rows)
    write('pairs.csv',list(pairs[0]),pairs)
    fields=['pair_id','reviewer_id','label','domain_evidence','skill_evidence','experience_evidence','notes']
    for name in ['reviewer_a.csv','reviewer_b.csv']:
        write(name,fields,[{'pair_id':p['pair_id']} for p in pairs])
    write('adjudication.csv',['pair_id','final_label','adjudicator_id','rationale','split'],[{'pair_id':p['pair_id']} for p in pairs])
    metadata={}
    for index,job in enumerate(vi['jobs'],1):
        match=re.match(r'\s*(\d+)',job['experience'])
        metadata[f'JD_{index:03}']={'required_skills':[s.strip() for s in job['skills'].split(',') if s.strip()],
            'nice_to_have_skills':[],'experience_years_required':int(match.group(1)) if match else None,
            'reviewed_by':'','note':'Yêu cầu từ JD giả lập, cần người đánh giá kiểm tra trước thực nghiệm.'}
    (OUT/'jd_metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    hashes={p.relative_to(OUT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*.txt')}
    hashes['pairs.csv']=hashlib.sha256((OUT/'pairs.csv').read_bytes()).hexdigest()
    manifest={'version':'bilingual_pilot_v1','intended_use':'pilot_only','synthetic':True,'pairs':len(pairs),'languages':['vi','en'],'source_sha256':{'vi':hashlib.sha256(vi_path.read_bytes()).hexdigest(),'en':hashlib.sha256(source[0].read_bytes()).hexdigest()},'text_hashes':hashes,'note':'36 cặp là 18 nội dung ở hai ngôn ngữ; không phải 36 mẫu độc lập hoặc bộ kiểm tra nghiên cứu. Chưa có nhãn.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Đã tạo 36 cặp thử song ngữ và ba phiếu trống. Không có nhãn hoặc số liệu mô hình được tạo.')

if __name__ == '__main__':
    main()
