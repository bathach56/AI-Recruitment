"""Huấn luyện có giám sát sau khi nhãn/nguồn/cách chia tập đã được duyệt."""
import argparse
import hashlib
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from workflow import validate

ROOT=Path(__file__).resolve().parents[2]

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dataset',type=Path,required=True);p.add_argument('--output',type=Path)
    p.add_argument('--check-only',action='store_true');p.add_argument('--allow-pilot',action='store_true')
    p.add_argument('--split-policy',choices=['both','cv'],default='both');p.add_argument('--epochs',type=int,default=3)
    p.add_argument('--device',choices=['cpu','cuda'],default='cpu');p.add_argument('--seed',type=int,default=42);p.add_argument('--learning-rate',type=float,default=2e-5)
    args=p.parse_args();report,rows=validate(args.dataset,args.split_policy,args.allow_pilot)
    if not report['ready']:
        print(json.dumps({'message':'Chưa được phép huấn luyện: dữ liệu chưa đạt điều kiện.','pairs':report['pairs'],'approved':report['approved_pairs'],'total_errors':len(report['errors']),'errors':report['errors'][:12]},ensure_ascii=False,indent=2));return 2
    if args.check_only:
        print('Cấu trúc đạt; vẫn cần chuyên gia xác nhận chất lượng nhãn.');return 0
    if args.output is None or args.output.exists() or not 1<=args.epochs<=20 or not 0<args.learning_rate<=1e-3:
        raise ValueError('Cần thư mục đầu ra mới và tham số huấn luyện hợp lệ.')
    import torch
    from torch.nn import functional as F
    from sentence_transformers import SentenceTransformer
    sys.path.insert(0,str(ROOT/'backend test'))
    from core.sbert_baseline import chunk_text
    from core.text_features import preprocess
    base=ROOT/'backend test/.cache/sbert';provenance=json.loads((base/'provenance.json').read_text(encoding='utf-8'))
    if args.device=='cuda' and not torch.cuda.is_available():raise ValueError('Không có CUDA; hãy chọn CPU rõ ràng nếu muốn tiếp tục.')
    random.seed(args.seed);torch.manual_seed(args.seed);torch.set_num_threads(4)
    model=SentenceTransformer(str(base),device=args.device,local_files_only=True,trust_remote_code=False)
    cache={}
    for row in rows:
        if row['split']=='test':continue
        for field in ['cv_text_path','jd_text_path']:
            path=row[field]
            if path not in cache:cache[path]=chunk_text(preprocess(Path(path).read_text(encoding='utf-8'))['semantic_text'],model.tokenizer,model.max_seq_length)
    def embedding(path):
        chunks=cache[path];features={k:v.to(args.device) for k,v in model.tokenize([c['text'] for c in chunks]).items()}
        vectors=F.normalize(model(features)['sentence_embedding'],p=2,dim=1)
        specials=model.tokenizer.num_special_tokens_to_add(pair=False)
        weights=torch.tensor([max(1,c['token_count']-specials) for c in chunks],dtype=vectors.dtype,device=args.device)
        return F.normalize((vectors*weights[:,None]).sum(0)/weights.sum(),p=2,dim=0)
    def loss_for(row):return ((embedding(row['cv_text_path'])*embedding(row['jd_text_path'])).sum()-float(row['label'])).square()
    train=[r for r in rows if r['split']=='train'];validation=[r for r in rows if r['split']=='validation']
    def evaluate_validation():
        model.eval()
        with torch.no_grad():return sum(float(loss_for(r)) for r in validation)/len(validation)
    baseline=evaluate_validation();best=baseline;history=[];args.output.mkdir(parents=True)
    optimizer=torch.optim.AdamW(model.parameters(),lr=args.learning_rate,weight_decay=.01)
    for epoch in range(1,args.epochs+1):
        model.train();order=list(train);random.Random(args.seed+epoch).shuffle(order);total=0
        for row in order:
            optimizer.zero_grad();loss=loss_for(row)
            if not torch.isfinite(loss):raise ValueError('Mất mát không hữu hạn; dừng huấn luyện.')
            loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1);optimizer.step();total+=float(loss.detach())
        value=evaluate_validation();history.append({'epoch':epoch,'train_mse':total/len(train),'validation_mse':value})
        if value<best:best=value;model.save_pretrained(str(args.output/'candidate'))
        print(json.dumps(history[-1]))
    result={'created_at':datetime.now(timezone.utc).isoformat(),'base_model':provenance,'dataset_manifest':report['manifest'],'split_policy':args.split_policy,'pilot_only':report['manifest'].get('intended_use')!='research','seed':args.seed,'epochs':args.epochs,'learning_rate':args.learning_rate,'device':args.device,'baseline_validation_mse':baseline,'best_validation_mse':best,'candidate_saved':best<baseline,'history':history,'test_used_for_selection':False,'note':'Chưa đánh giá test hoặc chứng minh cải thiện xét CV; không tự thay mô hình ứng dụng.'}
    result['annotation_sha256']={name:hashlib.sha256((args.dataset/name).read_bytes()).hexdigest() for name in ['reviewer_a.csv','reviewer_b.csv','adjudication.csv']}
    (args.output/'training_report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    if best<baseline:
        files=sorted((args.output/'candidate').glob('*.safetensors'));digest=hashlib.sha256(b''.join(hashlib.sha256(f.read_bytes()).digest() for f in files)).hexdigest()
        (args.output/'candidate/provenance.json').write_text(json.dumps({'model_id':'local/cv-jd-vi-en','revision':digest,'base_model':provenance,'training_report':'../training_report.json'},indent=2),encoding='utf-8',newline='\n')
    print('Đã lưu lần chạy nghiên cứu. Cần đánh giá test trước khi thay mô hình đang dùng.');return 0

if __name__=='__main__':raise SystemExit(main())
