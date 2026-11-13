"""Đánh giá có nhãn trên giao thức đã duyệt; chọn ngưỡng bằng validation, không bằng test."""
import argparse
import hashlib
import json
import math
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from workflow import validate

ROOT=Path(__file__).resolve().parents[2]

def metrics(rows,threshold):
    computed=[r for r in rows if r['score'] is not None];tp=fp=tn=fn=0
    for row in computed:
        actual=bool(row['label']);predicted=row['score']>=threshold
        tp+=actual and predicted;fp+=not actual and predicted;tn+=not actual and not predicted;fn+=actual and not predicted
    precision=tp/(tp+fp) if tp+fp else 0.0;recall=tp/(tp+fn) if tp+fn else 0.0
    return {'total':len(rows),'computed':len(computed),'abstained':len(rows)-len(computed),'coverage':len(computed)/len(rows) if rows else None,
            'precision':precision if computed else None,'recall':recall if computed else None,'f1':2*precision*recall/(precision+recall) if computed and precision+recall else 0.0 if computed else None,
            'confusion_matrix':{'tp':tp,'fp':fp,'tn':tn,'fn':fn},'threshold':threshold,'mean_processing_ms':sum(r['elapsed_ms'] for r in rows)/len(rows) if rows else None}

def choose_threshold(validation):
    if not any(r['score'] is not None for r in validation):return None
    # A declared one-point grid and deterministic tie break; never inspect test labels here.
    candidates=[metrics(validation,value) for value in range(101)]
    return max(candidates,key=lambda m:(m['f1'],m['recall'],-abs(m['threshold']-50),-m['threshold']))['threshold']

def main():
    sys.stdout.reconfigure(encoding='utf-8');p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dataset',type=Path,required=True);p.add_argument('--output',type=Path);p.add_argument('--check-only',action='store_true')
    p.add_argument('--allow-pilot',action='store_true');p.add_argument('--split-policy',choices=['both','cv'],default='both');p.add_argument('--candidate-model',type=Path)
    args=p.parse_args();report,pairs=validate(args.dataset,args.split_policy,args.allow_pilot)
    if not report['ready']:
        print(json.dumps({'message':'Chưa đánh giá: cần bộ nhãn hợp lệ đã được duyệt.','approved':report['approved_pairs'],'errors':report['errors'][:8]},ensure_ascii=False,indent=2));return 2
    metadata_path=args.dataset/'jd_metadata.json'
    if not metadata_path.is_file():raise ValueError('Cần jd_metadata.json với yêu cầu kỹ năng/kinh nghiệm đã được người đánh giá duyệt.')
    metadata=json.loads(metadata_path.read_text(encoding='utf-8'))
    for group in {r['jd_group'] for r in pairs}:
        job=metadata.get(group,{})
        if not job.get('reviewed_by') or not isinstance(job.get('required_skills'),list) or not job['required_skills'] or not isinstance(job.get('nice_to_have_skills'),list):raise ValueError('Chưa duyệt yêu cầu JD: '+group)
        years=job.get('experience_years_required')
        if years is not None and (isinstance(years,bool) or not isinstance(years,(int,float)) or not math.isfinite(years) or not 0<=years<=100):raise ValueError('Số năm JD không hợp lệ: '+group)
        if any(not isinstance(s,str) or not s.strip() or len(s)>200 for s in job['required_skills']+job['nice_to_have_skills']):raise ValueError('Tên kỹ năng JD không hợp lệ: '+group)
    if args.check_only:print('Đầu vào đã đủ; chưa chạy mô hình hoặc xuất chỉ số.');return 0
    if args.output is None or args.output.exists():raise ValueError('Cần đường dẫn đầu ra mới để giữ nguyên kết quả cũ.')
    sys.path.insert(0,str(ROOT/'backend test'))
    from core.sbert_baseline import SbertBaseline
    from core.tfidf_baseline import TfidfBaseline
    from core.text_features import SkillEvidence
    from core.hybrid import analyze
    train=[r for r in pairs if r['split']=='train'];texts={}
    for row in pairs:
        for field in ['cv_text_path','jd_text_path']:texts[row[field]]=Path(row[field]).read_text(encoding='utf-8')
    fit_paths=sorted({r[k] for r in train for k in ['cv_text_path','jd_text_path']})
    tfidf=TfidfBaseline().fit(texts[path] for path in fit_paths)
    semantic=SbertBaseline(ROOT/'backend test/.cache/sbert');skills=SkillEvidence(ROOT/'data/skills_taxonomy.json')
    models={'Sentence-BERT':semantic}
    if args.candidate_model:
        training_path=args.candidate_model.parent/'training_report.json';training=json.loads(training_path.read_text(encoding='utf-8'))
        hashes={name:hashlib.sha256((args.dataset/name).read_bytes()).hexdigest() for name in ['reviewer_a.csv','reviewer_b.csv','adjudication.csv']}
        if training.get('dataset_manifest')!=report['manifest'] or training.get('annotation_sha256')!=hashes or training.get('test_used_for_selection') is not False:raise ValueError('Không xác minh được nguồn huấn luyện hoặc cách ly test của mô hình ứng viên.')
        models['Sentence-BERT tinh chỉnh']=SbertBaseline(args.candidate_model)
    predictions=[]
    for row in pairs:
        if row['split']=='train':continue
        cv=texts[row['cv_text_path']];jd=texts[row['jd_text_path']]
        results={'TF-IDF':tfidf.explain(cv,jd)}
        results.update({name:model.explain(cv,jd) for name,model in models.items()})
        results['Hybrid']=analyze([{'text':cv,'location':'text:1'}],jd,metadata[row['jd_group']],semantic,skills)
        for method,result in results.items():
            predictions.append({'pair_id':row['pair_id'],'language':row['language'],'split':row['split'],'label':row['label'],'method':method,'score':result['overall_score'],'elapsed_ms':result['processing_time_ms'],'cosine':result.get('cosine_similarity',result.get('semantic',{}).get('cosine_similarity'))})
    summary={}
    for method in sorted({r['method'] for r in predictions}):
        threshold=choose_threshold([r for r in predictions if r['method']==method and r['split']=='validation'])
        test=[r for r in predictions if r['method']==method and r['split']=='test']
        summary[method]={'threshold_selected_on':'validation','overall':metrics(test,threshold) if threshold is not None else {'message':'Không có điểm validation để chọn ngưỡng'},
                         'by_language':{lang:metrics([r for r in test if r['language']==lang],threshold) for lang in ['vi','en']} if threshold is not None else {}}
    output={'created_at':datetime.now(timezone.utc).isoformat(),'pilot_only':report['manifest'].get('intended_use')!='research','dataset':report['manifest'],'split_policy':args.split_policy,
            'annotation_sha256':{name:hashlib.sha256((args.dataset/name).read_bytes()).hexdigest() for name in ['reviewer_a.csv','reviewer_b.csv','adjudication.csv','jd_metadata.json']},
            'tfidf_fit':tfidf.metadata(),'base_model':semantic.provenance,'platform':platform.platform(),'python':sys.version,'hybrid_weights':{'semantic':.5,'skills':.3,'experience':.2},
            'summary':summary,'predictions':predictions,'note':'Không tự kích hoạt mô hình. Điểm thiếu được báo abstained; chỉ số trên phần có điểm phải đọc cùng coverage. Bộ dịch cùng nội dung không phải các quan sát độc lập.'}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x',encoding='utf-8',newline='\n') as stream:json.dump(output,stream,ensure_ascii=False,indent=2,allow_nan=False)
    print('Đã lưu kết quả tính thật: '+str(args.output));return 0

if __name__=='__main__':raise SystemExit(main())
