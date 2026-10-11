import copy
import sys
import unicodedata
import unittest
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.text_features import SkillEvidence, preprocess
from core.document_parser import parse_file


class FeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.extractor = SkillEvidence(LAB.parent / 'data/skills_taxonomy.json')

    def extract(self, text):
        return self.extractor.extract([{'location': 'test:1', 'text': text}])

    def test_technology_tokens_and_negation(self):
        result = preprocess('C# C++ .NET ASP.NET Core CI/CD Node.js không biết Docker; not Python')
        for token in ('c#', 'c++', '.net', 'asp.net', 'ci/cd', 'node.js', 'không', 'not'):
            self.assertIn(token, result['tfidf_tokens'])

    def test_unicode_and_contacts(self):
        result = preprocess(unicodedata.normalize('NFD', 'Kỹ năng\r\n  C#  ') + ' a@docker.com https://python.org')
        self.assertEqual(result['semantic_text'], 'Kỹ năng\nC#')
        self.assertEqual(self.extract('a@docker.com https://python.org')['evidence'], [])

    def test_word_boundaries(self):
        result = self.extract('JavaScript C++ C# MySQL')
        self.assertIn('javascript', result['mentioned_skills'])
        self.assertNotIn('java', result['mentioned_skills'])
        self.assertIn('cpp', result['mentioned_skills'])
        self.assertEqual(self.extract('C+++ JavaScripted')['evidence'], [])

    def test_longest_alias_and_offsets(self):
        text = 'Kỹ năng: ASP.NET Core, Entity Framework Core.'
        result = self.extract(text)
        self.assertEqual(len(result['evidence']), 2)
        for evidence in result['evidence']:
            self.assertEqual(text[evidence['start']:evidence['end']], evidence['matched_text'])
        self.assertEqual(result['evidence'][0]['matched_text'], 'ASP.NET Core')

    def test_negation_learning_and_clause_reset(self):
        result = self.extract('Chưa có kinh nghiệm Docker nhưng sử dụng Python. Đang học Kubernetes.')
        self.assertNotIn('docker', result['mentioned_skills'])
        self.assertIn('python', result['mentioned_skills'])
        docker = next(e for e in result['evidence'] if e['normalized'] == 'docker')
        self.assertIn('negation_or_learning_context', docker['reasons'])
        self.assertTrue(all(e['status'] == 'needs_review' for e in self.extract('No experience with Docker or Python')['evidence']))

    def test_ambiguous_and_broad_aliases(self):
        result = self.extract('We go to work. LINQ, NoSQL, container.')
        self.assertEqual(result['mentioned_skills'], [])
        self.assertTrue(result['review_skills'])

    def test_missing_taxonomy_fails(self):
        with self.assertRaises(FileNotFoundError):
            SkillEvidence(LAB / 'does-not-exist.json')

    def test_sample_preserves_input_and_evidence(self):
        doc = parse_file(LAB.parent / 'data/sample_cvs/CV_NguyenVanAn_Senior_DotNet.docx')
        original = copy.deepcopy(doc)
        result = self.extractor.extract(doc['segments'])
        preprocess(doc['raw_text'])
        self.assertEqual(doc, original)
        self.assertIn('csharp', result['mentioned_skills'])
        for e in result['evidence']:
            text = doc['segments'][e['segment_index']]['text']
            self.assertEqual(text[e['start']:e['end']], e['matched_text'])
        self.assertEqual(result, self.extractor.extract(doc['segments']))


if __name__ == '__main__':
    unittest.main()
