import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from audit_annotations import audit_rows


def row(reviewer, label='1'):
    return dict(pair_id='pair1', reviewer_id=reviewer, label=label,
                domain_evidence='source domain', skill_evidence='source skill',
                experience_evidence='unknown, explicitly reviewed', notes='reason')


class AnnotationTests(unittest.TestCase):
    def audit(self, a, b):
        return audit_rows([{'pair_id': 'pair1'}], [a], [b])

    def test_agreement_is_not_research_truth(self):
        result = self.audit(row('A'), row('B'))
        self.assertEqual(result['status_counts'], {'agreement_candidate': 1})
        self.assertFalse(result['research_ready'])

    def test_blank_and_uncertain_remain_unresolved(self):
        for label, reason in (('', 'pending_labels'), ('uncertain', 'uncertain_label')):
            result = self.audit(row('A', label), row('B'))
            self.assertIn(reason, result['queue'][0]['reasons'])

    def test_disagreement_and_same_person(self):
        result = self.audit(row('A'), row(' a ', '0'))
        self.assertEqual(set(result['queue'][0]['reasons']), {'disagreement', 'same_reviewer'})

    def test_evidence_required(self):
        a = row('A')
        a['skill_evidence'] = ' '
        self.assertIn('a_missing_skill_evidence', self.audit(a, row('B'))['queue'][0]['reasons'])

    def test_bad_links_and_labels_rejected(self):
        for rows in ([], [row('A'), row('A')], [dict(row('A'), pair_id='other')], [row('A', '2')]):
            with self.assertRaises(ValueError):
                audit_rows([{'pair_id': 'pair1'}], rows, [row('B')])


if __name__ == '__main__':
    unittest.main()
