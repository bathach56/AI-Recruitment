"""Kiểm tra nhãn, nguồn và rò rỉ dữ liệu trước huấn luyện; không tự suy ra nhãn."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

def read_csv(path):
    with Path(path).open(encoding='utf-8-sig',newline='') as stream:
        return list(csv.DictReader(stream))

def validate(dataset, split_policy='both', allow_pilot=False):
    root=Path(dataset).resolve(); manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    errors=[]
    if manifest.get('intended_use')!='research' and not allow_pilot:
        errors.append('Bộ dữ liệu chỉ dành cho chạy thử; cần dữ liệu nghiên cứu có nguồn/được duyệt. --allow-pilot không chứng minh chất lượng.')
    if manifest.get('intended_use')=='research' and any(not str(manifest.get(k,'')).strip() for k in ['source_notes','license','approved_by']):
        errors.append('Thiếu mô tả nguồn, quyền sử dụng hoặc người duyệt bộ dữ liệu nghiên cứu.')
    if split_policy not in ('both','cv'):
        raise ValueError('Chính sách chia tập không hợp lệ.')
    for relative,digest in manifest['text_hashes'].items():
        path=(root/relative).resolve()
        if not path.is_relative_to(root) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
            errors.append('Nguồn bị thiếu, vượt thư mục hoặc sai mã kiểm tra: '+relative)
    pairs=read_csv(root/'pairs.csv'); indexes=[]; keys=[p['pair_id'] for p in pairs]
    if len(set(keys))!=len(keys):errors.append('Mã cặp bị trùng.')
    for name in ['reviewer_a.csv','reviewer_b.csv','adjudication.csv']:
        rows=read_csv(root/name); index={r['pair_id']:r for r in rows}
        if len(index)!=len(rows) or set(index)!=set(keys):errors.append('Mã cặp trong phiếu không khớp: '+name)
        indexes.append(index)
    groups={}; texts={}; label_counts=Counter(); languages=Counter(); splits=Counter(); approved=[]
    for pair in pairs:
        key=pair['pair_id']; a,b,decision=(index.get(key,{}) for index in indexes)
        required=['reviewer_id','label','domain_evidence','skill_evidence','experience_evidence','notes']
        if any(not row.get(field,'').strip() for row in [a,b] for field in required):
            errors.append('Chưa có hai phiếu độc lập đủ bằng chứng: '+key);continue
        if a['label'] not in ('0','1','uncertain') or b['label'] not in ('0','1','uncertain') or a['reviewer_id'].strip().casefold()==b['reviewer_id'].strip().casefold():
            errors.append('Nhãn hoặc mã người đánh giá không hợp lệ: '+key);continue
        if decision.get('final_label') not in ('0','1') or not decision.get('adjudicator_id','').strip() or not decision.get('rationale','').strip():
            errors.append('Chưa có nhãn cuối cùng và lý do phân xử: '+key);continue
        split=decision.get('split'); language=pair.get('language')
        if split not in ('train','validation','test') or language not in ('vi','en'):
            errors.append('Thiếu tập hoặc ngôn ngữ hợp lệ: '+key);continue
        for group_type in (['cv_group','jd_group'] if split_policy=='both' else ['cv_group']):
            group=(group_type,pair[group_type]); old=groups.setdefault(group,split)
            if old!=split:errors.append('Rò rỉ nhóm giữa các tập: '+str(group))
        paths={}
        for field in ['cv_text_path','jd_text_path']:
            path=(root/pair[field]).resolve()
            if pair[field] not in manifest['text_hashes'] or not path.is_relative_to(root) or not path.is_file():
                errors.append('Đường dẫn nội dung không hợp lệ: '+key);continue
            text=path.read_text(encoding='utf-8').strip(); digest=hashlib.sha256(text.encode()).hexdigest()
            if not text:errors.append('Nội dung trống: '+key)
            old=texts.setdefault(digest,split)
            # JD lặp được phép chỉ trong giao thức đánh giá CV mới với JD đã biết.
            if old!=split and (split_policy=='both' or field=='cv_text_path'):errors.append('Văn bản trùng giữa các tập: '+key)
            paths[field]=str(path)
        approved.append({**pair,**paths,'label':int(decision['final_label']),'split':split})
        label_counts[(split,decision['final_label'])]+=1;languages[(split,language)]+=1;splits[split]+=1
    for split in ['train','validation','test']:
        if not splits[split]:errors.append('Tập chưa có dữ liệu đã duyệt: '+split)
        for label in ['0','1']:
            if not label_counts[(split,label)]:errors.append('Thiếu lớp '+label+' trong tập '+split)
        for lang in ['vi','en']:
            if not languages[(split,lang)]:errors.append('Thiếu tiếng '+lang+' trong tập '+split)
    return {'ready':not errors,'pairs':len(pairs),'approved_pairs':len(approved),'split_policy':split_policy,'errors':errors,'splits':dict(splits),'manifest':manifest},approved

if __name__ == '__main__':
    import argparse
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('dataset',type=Path);p.add_argument('--split-policy',choices=['both','cv'],default='both');p.add_argument('--allow-pilot',action='store_true');args=p.parse_args()
    report,_=validate(args.dataset,args.split_policy,args.allow_pilot)
    print(json.dumps(report,ensure_ascii=False,indent=2));raise SystemExit(0 if report['ready'] else 2)
