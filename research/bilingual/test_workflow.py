import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from workflow import validate

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);pairs=[];labels=[];decisions=[];hashes={}
        # Chỉ là fixture kiểm tra phần mềm trong thư mục tạm, không phải nhãn nghiên cứu.
        for split in ['train','validation','test']:
            for label in ['0','1']:
                for lang in ['vi','en']:
                    key=f'{split}_{label}_{lang}';cv=f'cv_{key}.txt';jd=f'jd_{key}.txt'
                    for path,text in [(cv,'CV fixture '+key),(jd,'JD fixture '+key)]:
                        (self.root/path).write_text(text,encoding='utf-8');hashes[path]=hashlib.sha256((self.root/path).read_bytes()).hexdigest()
                    pairs.append(dict(pair_id=key,cv_group=f'cv_{split}_{label}',jd_group=f'jd_{split}_{label}',language=lang,cv_text_path=cv,jd_text_path=jd))
                    labels.append(dict(pair_id=key,reviewer_id='a',label=label,domain_evidence='fixture',skill_evidence='fixture',experience_evidence='fixture',notes='fixture'))
                    decisions.append(dict(pair_id=key,final_label=label,adjudicator_id='c',rationale='fixture',split=split))
        self.write('pairs.csv',pairs);self.write('reviewer_a.csv',labels);self.write('reviewer_b.csv',[{**r,'reviewer_id':'b'} for r in labels]);self.write('adjudication.csv',decisions)
        hashes['pairs.csv']=hashlib.sha256((self.root/'pairs.csv').read_bytes()).hexdigest()
        self.manifest={'intended_use':'research','source_notes':'temporary software fixture','license':'test-only','approved_by':'test fixture','text_hashes':hashes}
        self.save_manifest()
    def tearDown(self):self.temp.cleanup()
    def write(self,name,rows):
        with (self.root/name).open('w',encoding='utf-8',newline='') as stream:
            writer=csv.DictWriter(stream,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    def read(self,name):
        with (self.root/name).open(encoding='utf-8') as stream:return list(csv.DictReader(stream))
    def save_manifest(self):(self.root/'manifest.json').write_text(json.dumps(self.manifest),encoding='utf-8')
    def test_complete_structure_and_bilingual_group_split(self):
        report,rows=validate(self.root);self.assertTrue(report['ready'],report['errors']);self.assertEqual(len(rows),12)
    def test_blank_labels_never_become_ground_truth(self):
        rows=self.read('reviewer_a.csv');rows[0]['label']='';self.write('reviewer_a.csv',rows);report,_=validate(self.root);self.assertFalse(report['ready'])
    def test_same_reviewer_and_missing_adjudication_rejected(self):
        rows=self.read('reviewer_b.csv');rows[0]['reviewer_id']='a';self.write('reviewer_b.csv',rows);self.assertFalse(validate(self.root)[0]['ready'])
    def test_translation_group_cannot_cross_splits(self):
        rows=self.read('adjudication.csv');rows[1]['split']='test';self.write('adjudication.csv',rows);report,_=validate(self.root);self.assertTrue(any('Rò rỉ nhóm' in e for e in report['errors']))
    def test_modified_source_and_pilot_claim_rejected(self):
        (self.root/'cv_train_0_vi.txt').write_text('Changed',encoding='utf-8');self.manifest['intended_use']='pilot_only';self.save_manifest();self.assertFalse(validate(self.root)[0]['ready'])

if __name__=='__main__':unittest.main()
