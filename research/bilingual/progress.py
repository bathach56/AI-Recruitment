"""Báo tiến độ và đồng thuận từ phiếu thật; không suy ra nhãn còn thiếu."""
import argparse
import json
import sys
from pathlib import Path
from collections import Counter
from workflow import read_csv

def agreement(a,b):
    pairs=[(a[k]['label'],b[k]['label']) for k in a.keys()&b.keys() if a[k].get('label') in ('0','1') and b[k].get('label') in ('0','1') and a[k].get('reviewer_id') and b[k].get('reviewer_id') and a[k]['reviewer_id'].strip().casefold()!=b[k]['reviewer_id'].strip().casefold()]
    if not pairs:return {'compared':0,'agreement':None,'cohens_kappa':None}
    n=len(pairs);observed=sum(x==y for x,y in pairs)/n;ca=Counter(x for x,_ in pairs);cb=Counter(y for _,y in pairs);expected=sum(ca[k]*cb[k] for k in ['0','1'])/(n*n)
    return {'compared':n,'agreement':observed,'cohens_kappa':(observed-expected)/(1-expected) if expected<1 else None}

def main():
    sys.stdout.reconfigure(encoding='utf-8');p=argparse.ArgumentParser(description=__doc__);p.add_argument('dataset',type=Path);args=p.parse_args()
    a={r['pair_id']:r for r in read_csv(args.dataset/'reviewer_a.csv')};b={r['pair_id']:r for r in read_csv(args.dataset/'reviewer_b.csv')};final=read_csv(args.dataset/'adjudication.csv')
    print(json.dumps({'total':len(a),'reviewer_a_completed':sum(bool(r.get('label')) for r in a.values()),'reviewer_b_completed':sum(bool(r.get('label')) for r in b.values()),'adjudicated':sum(r.get('final_label') in ('0','1') for r in final),'agreement':agreement(a,b),'note':'Đồng thuận người gán nhãn không phải độ chính xác AI; bản dịch không phải quan sát độc lập.'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
