"""Nhập nhãn do người đánh giá quyết định; không gọi AI và không tự điền nhãn."""
import argparse
import csv
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path
from workflow import read_csv

def save_rows(path,rows):
    # Same-directory atomic replacement: an interrupted prompt never truncates a sheet.
    with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8-sig',newline='',dir=path.parent,delete=False) as stream:
        temporary=Path(stream.name)
        writer=csv.DictWriter(stream,fieldnames=list(rows[0]),lineterminator='\n');writer.writeheader();writer.writerows(rows)
    try:os.replace(temporary,path)
    finally:
        if temporary.exists():temporary.unlink()

def ask(label,choices=None):
    while True:
        value=input(label+': ').strip()
        if value and (choices is None or value in choices):return value
        print('Cần nhập thông tin hợp lệ'+(' ('+', '.join(choices)+')' if choices else '')+'.')

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset',type=Path,required=True);parser.add_argument('--role',choices=['a','b','adjudicator'],required=True)
    parser.add_argument('--reviewer-id',required=True);parser.add_argument('--pair',required=True);args=parser.parse_args()
    root=args.dataset.resolve();manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    if not args.reviewer_id.strip():raise ValueError('Cần mã người đánh giá.')
    if hashlib.sha256((root/'pairs.csv').read_bytes()).hexdigest()!=manifest['text_hashes'].get('pairs.csv'):raise ValueError('Danh sách cặp đã thay đổi so với manifest.')
    pair=next((p for p in read_csv(root/'pairs.csv') if p['pair_id']==args.pair),None)
    if pair is None:raise ValueError('Không có mã cặp này.')
    print('Cặp:',pair['pair_id'],'| Ngôn ngữ:',pair['language'])
    for field,title in [('jd_text_path','YÊU CẦU CÔNG VIỆC'),('cv_text_path','HỒ SƠ')]:
        path=(root/pair[field]).resolve()
        if not path.is_relative_to(root) or hashlib.sha256(path.read_bytes()).hexdigest()!=manifest['text_hashes'].get(pair[field]):raise ValueError('Nguồn không hợp lệ hoặc đã thay đổi.')
        print('\n'+title+'\n'+path.read_text(encoding='utf-8'))
    if args.role in ('a','b'):
        other=read_csv(root/('reviewer_b.csv' if args.role=='a' else 'reviewer_a.csv'))
        if any(r.get('reviewer_id','').strip().casefold()==args.reviewer_id.strip().casefold() for r in other):raise ValueError('Hai phiếu phải do hai người khác nhau đánh giá.')
        path=root/('reviewer_'+args.role+'.csv');rows=read_csv(path);row=next(r for r in rows if r['pair_id']==args.pair)
        if row.get('label'):raise ValueError('Cặp đã có nhãn. Giữ phiếu gốc; sửa có chủ đích trong CSV nếu cần và lưu lịch sử.')
        row.update(reviewer_id=args.reviewer_id.strip(),label=ask('Nhãn 0 / 1 / uncertain',['0','1','uncertain']))
        for key,title in [('domain_evidence','Bằng chứng lĩnh vực'),('skill_evidence','Bằng chứng kỹ năng'),('experience_evidence','Bằng chứng kinh nghiệm'),('notes','Lý do và lưu ý')]:row[key]=ask(title)
    else:
        for name in ['reviewer_a.csv','reviewer_b.csv']:
            row=next(r for r in read_csv(root/name) if r['pair_id']==args.pair)
            if not row.get('label'):raise ValueError('Cần đủ hai phiếu trước khi phân xử.')
            print('\nPhiếu '+name+': '+json.dumps(row,ensure_ascii=False))
        path=root/'adjudication.csv';rows=read_csv(path);row=next(r for r in rows if r['pair_id']==args.pair)
        if row.get('final_label'):raise ValueError('Đã phân xử; không ghi đè tự động.')
        practice=manifest.get('intended_use')=='annotation_practice'
        choices=['0','1','uncertain'] if practice else ['0','1']
        row.update(final_label=ask('Nhãn cuối '+ ' / '.join(choices),choices),adjudicator_id=args.reviewer_id.strip(),rationale=ask('Lý do phân xử'),split='' if practice else ask('Tập theo giao thức đã chốt',['train','validation','test']))
    print(json.dumps(row,ensure_ascii=False,indent=2))
    if ask('Gõ LUU để xác nhận ghi phiếu',['LUU','HUY'])=='LUU':save_rows(path,rows);print('Đã lưu phiếu do bạn đánh giá.')

if __name__=='__main__':main()
