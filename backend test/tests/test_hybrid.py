import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.hybrid import combine, analyze
from core.text_features import SkillEvidence


class HybridTests(unittest.TestCase):
    def test_manual_sum_and_scale_invariance(self):
        scores = dict(semantic=80, skills=60, experience=100)
        result = combine(scores)
        self.assertEqual(result['overall_score'], 78)
        self.assertEqual(result['contributions'], dict(semantic=40, skills=18, experience=20))
        self.assertEqual(combine(scores, dict(semantic=5, skills=3, experience=2))['overall_score'], 78)

    def test_missing_is_not_zero_or_renormalized(self):
        result = combine(dict(semantic=80, skills=60, experience=None))
        self.assertIsNone(result['overall_score'])
        self.assertEqual(result['missing_components'], ['experience'])
        self.assertEqual(result['normalized_weights']['semantic'], 0.5)
        self.assertEqual(combine(dict(semantic=80, skills=60, experience=0))['overall_score'], 58)

    def test_explicit_ablation(self):
        result = combine(dict(semantic=80, skills=60, experience=None), dict(semantic=1, skills=0, experience=0))
        self.assertEqual(result['overall_score'], 80)
        self.assertEqual(result['contributions']['experience'], 0)

    def test_invalid_numbers_and_keys(self):
        scores = dict(semantic=80, skills=60, experience=100)
        for value in (-1, 101, float('nan'), float('inf'), True, '80'):
            with self.assertRaises(ValueError):
                combine(dict(scores, semantic=value))
        for value in (-1, float('nan'), float('inf'), True):
            with self.assertRaises(ValueError):
                combine(scores, dict(semantic=value, skills=1, experience=1))
        with self.assertRaises(ValueError):
            combine(scores, dict(semantic=0, skills=0, experience=0))
        with self.assertRaises(ValueError):
            combine({'semantic': 80})

    def test_controlled_component_change(self):
        before = combine(dict(semantic=80, skills=100, experience=100))
        after = combine(dict(semantic=80, skills=50, experience=100))
        self.assertEqual(before['overall_score'] - after['overall_score'], 15)

    def test_pipeline_and_failure_propagation(self):
        # Stub isolates combination behavior; real inference is run by the demo CLI.
        model = Mock()
        model.explain.return_value = {'overall_score': 80}
        extractor = SkillEvidence(LAB.parent / 'data/skills_taxonomy.json')
        job = dict(required_skills=['Python'], nice_to_have_skills=[], experience_years_required=4)
        segments = [{'location': 'test:1', 'text': 'Python'},
                    {'location': 'test:2', 'text': 'Total experience: 2 years'}]
        result = analyze(segments, 'Python developer', job, model, extractor)
        self.assertEqual(result['overall_score'], 80)
        self.assertEqual(result['experience']['candidate_years'], 2)
        model.explain.side_effect = RuntimeError('Model failed')
        with self.assertRaises(RuntimeError):
            analyze(segments, 'Python developer', job, model, extractor)


if __name__ == '__main__':
    unittest.main()
