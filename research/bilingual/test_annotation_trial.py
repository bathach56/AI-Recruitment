import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from prepare_annotation_trial import ROOT, prepare
from annotate import save_rows
from workflow import read_csv, validate


class AnnotationTrialTests(unittest.TestCase):
    def test_twenty_unlabeled_pairs_are_reproducible_anonymous_and_not_a_training_set(self):
        with tempfile.TemporaryDirectory() as directory:
            one, two = Path(directory)/'one', Path(directory)/'two'
            source=ROOT/'tools/DemoScenario/five-sectors.json'
            prepare(source,one);prepare(source,two)
            pairs=read_csv(one/'pairs.csv');self.assertEqual(len(pairs),20);self.assertEqual(len({p['cv_group'] for p in pairs}),10)
            self.assertEqual(len({p['jd_group'] for p in pairs}),5);self.assertEqual(len({(p['cv_group'],p['jd_group']) for p in pairs}),20)
            for jd in {p['jd_group'] for p in pairs}:self.assertEqual(sum(p['jd_group']==jd for p in pairs),4)
            for role in ['a','b']:
                rows=read_csv(one/f'reviewer_{role}.csv');self.assertEqual(len(rows),20);self.assertTrue(all(not value for row in rows for key,value in row.items() if key!='pair_id'))
            self.assertTrue(all(not row['split'] and not row['final_label'] for row in read_csv(one/'adjudication.csv')))
            manifest=json.loads((one/'manifest.json').read_text(encoding='utf-8'));self.assertEqual(manifest['intended_use'],'annotation_practice')
            for relative,digest in manifest['text_hashes'].items():self.assertEqual(hashlib.sha256((one/relative).read_bytes()).hexdigest(),digest)
            specs=json.loads(source.read_text(encoding='utf-8'))['candidates']
            for path in (one/'vi').glob('CV_*.txt'):
                text=path.read_text(encoding='utf-8')
                for spec in specs:self.assertNotIn(spec['email'],text);self.assertNotIn(spec['name'],text)
            self.assertEqual((one/'manifest.json').read_bytes(),(two/'manifest.json').read_bytes())
            with self.assertRaises(FileExistsError):prepare(source,one)
            report,_=validate(one);self.assertFalse(report['ready']);self.assertEqual(report['approved_pairs'],0)

    def test_practice_adjudication_allows_unresolved_case_without_forcing_a_research_split(self):
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/'trial';prepare(ROOT/'tools/DemoScenario/five-sectors.json',output)
            for role,label in [('a','0'),('b','1')]:
                path=output/f'reviewer_{role}.csv';rows=read_csv(path);rows[0].update(reviewer_id='fixture_'+role,label=label);save_rows(path,rows)
            result=subprocess.run([sys.executable,str(ROOT/'research/bilingual/annotate.py'),'--dataset',str(output),'--role','adjudicator','--reviewer-id','fixture_consensus','--pair','P001'],input='uncertain\nInsufficient evidence fixture\nLUU\n',capture_output=True,text=True,encoding='utf-8')
            self.assertEqual(result.returncode,0,result.stderr);row=read_csv(output/'adjudication.csv')[0]
            self.assertEqual(row['final_label'],'uncertain');self.assertEqual(row['split'],'');self.assertEqual(row['adjudicator_id'],'fixture_consensus')


if __name__=='__main__':unittest.main()
