import sys
import unittest
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.structured_matching import extract_experience, experience_match, match_skills
from core.text_features import SkillEvidence


def segments(*texts):
    return [{'text': text, 'location': f'test:{i}'} for i, text in enumerate(texts)]


class StructuredTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.extractor = SkillEvidence(LAB.parent / 'data/skills_taxonomy.json')

    def test_dedup_and_weighted_coverage(self):
        result = match_skills(self.extractor, segments('Python'), ['Python', 'python'], ['Python', 'Docker'])
        self.assertEqual(len(result['requirements']), 2)
        self.assertEqual(result['score'], 60)

    def test_unknown_requirement_not_dropped(self):
        result = match_skills(self.extractor, segments('Python'), ['Python', 'UnknownTool'], [])
        self.assertEqual(result['score'], 50)
        self.assertEqual(result['requirements'][1]['status'], 'needs_review')

    def test_negation_and_conflict_not_positive(self):
        for texts in [('Chưa biết Docker',), ('Docker', 'Chưa biết Docker')]:
            result = match_skills(self.extractor, segments(*texts), ['Docker'], [])
            self.assertEqual(result['score'], 0)
            self.assertEqual(result['requirements'][0]['status'], 'needs_review')

    def test_no_requirements_and_invalid_weights(self):
        self.assertIsNone(match_skills(self.extractor, [], [], [])['score'])
        for weight in (0, -1, float('nan'), float('inf'), True):
            with self.assertRaises(ValueError):
                match_skills(self.extractor, [], [], [], required_weight=weight)

    def test_explicit_years_not_added_and_offsets(self):
        source = segments('Số năm kinh nghiệm: 5,5 năm', 'Tổng kinh nghiệm: 5.5 năm', 'Kinh nghiệm liên quan: 4 năm')
        result = extract_experience(source)
        self.assertEqual(result['scopes']['total']['years'], 5.5)
        self.assertEqual(result['scopes']['relevant']['years'], 4)
        for e in result['evidence']:
            self.assertEqual(source[e['segment_index']]['text'][e['start']:e['end']], e['matched_text'])
        self.assertEqual(experience_match(result, 4.5)['score'], 100)

    def test_unsupported_narrative_is_unknown(self):
        for text in ('5 years Python, 3 years Docker', 'Total experience: 3-5 years', 'Total experience: -2 years', 'Chưa có 5 năm kinh nghiệm'):
            self.assertIsNone(experience_match(extract_experience(segments(text)), 4)['score'])

    def test_conflicting_experience(self):
        for source in (segments('Total experience: 2 years', 'Total experience: 5 years'),
                       segments('Total experience: 2 years', 'Relevant experience: 5 years')):
            result = extract_experience(source)
            self.assertEqual(result['scopes']['total']['status'], 'conflicting')
            self.assertIsNone(experience_match(result, 4)['score'])

    def test_zero_unknown_and_requirement_validation(self):
        result = extract_experience(segments('Total experience: 0 years'))
        self.assertEqual(experience_match(result, 4)['score'], 0)
        self.assertIsNone(experience_match(result, 0)['score'])
        self.assertIsNone(experience_match(extract_experience([]), 4)['score'])
        for required in (-1, float('nan'), '4', True):
            with self.assertRaises(ValueError):
                experience_match(result, required)


if __name__ == '__main__':
    unittest.main()
