import tempfile
import unittest
from pathlib import Path
from annotate import save_rows
from evaluate import choose_threshold,metrics
from progress import agreement
from workflow import read_csv

class EvaluationToolsTests(unittest.TestCase):
    def test_no_labels_have_no_agreement_metric(self):
        self.assertIsNone(agreement({'x':{'label':''}},{'x':{'label':''}})['cohens_kappa'])
    def test_human_agreement_and_same_reviewer_exclusion(self):
        a={str(i):{'label':v,'reviewer_id':'a'} for i,v in enumerate(['0','0','1','1'])}
        b={str(i):{'label':v,'reviewer_id':'b'} for i,v in enumerate(['0','1','1','1'])}
        result=agreement(a,b);self.assertEqual(result['agreement'],.75);self.assertAlmostEqual(result['cohens_kappa'],.5)
        for row in b.values():row['reviewer_id']='a'
        self.assertEqual(agreement(a,b)['compared'],0)
    def test_metrics_include_abstentions_and_do_not_turn_missing_into_zero(self):
        rows=[{'score':80,'label':1,'elapsed_ms':2},{'score':20,'label':0,'elapsed_ms':2},{'score':None,'label':1,'elapsed_ms':2}]
        result=metrics(rows,50);self.assertEqual(result['f1'],1);self.assertEqual(result['coverage'],2/3);self.assertEqual(result['abstained'],1)
        self.assertIsNone(metrics([rows[2]],50)['f1'])
    def test_threshold_only_uses_the_validation_rows_given_to_it(self):
        rows=[{'score':90,'label':1,'elapsed_ms':1},{'score':10,'label':0,'elapsed_ms':1}]
        self.assertEqual(choose_threshold(rows),50);self.assertIsNone(choose_threshold([{'score':None,'label':1,'elapsed_ms':1}]))
    def test_atomic_sheet_write_preserves_vietnamese_and_columns(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'review.csv';rows=[{'pair_id':'x','label':'uncertain','notes':'Chưa đủ bằng chứng'}]
            save_rows(path,rows);self.assertEqual(read_csv(path),rows);self.assertEqual(len(list(Path(folder).iterdir())),1)

if __name__=='__main__':unittest.main()
