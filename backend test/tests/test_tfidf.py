import math
import sys
import unittest
from pathlib import Path
from sklearn.exceptions import NotFittedError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.tfidf_baseline import TfidfBaseline


class TfidfTests(unittest.TestCase):
    def test_manual_cosine_and_idf(self):
        model = TfidfBaseline().fit(['python', 'python docker'])
        result = model.explain('python', 'python docker')
        rare_idf = 1 + math.log(3 / 2)
        expected = 1 / math.sqrt(1 + 2 * rare_idf ** 2)
        self.assertAlmostEqual(result['cosine_similarity'], expected)
        self.assertAlmostEqual(result['contribution_sum'], expected)

    def test_identity_symmetry_and_disjoint(self):
        model = TfidfBaseline().fit(['C# .NET', 'Python Docker'])
        self.assertAlmostEqual(model.explain('C# .NET', 'C# .NET')['overall_score'], 100)
        self.assertEqual(model.explain('C#', 'Python')['overall_score'], 0)
        a = model.explain('C# Python', 'Python Docker')['overall_score']
        b = model.explain('Python Docker', 'C# Python')['overall_score']
        self.assertAlmostEqual(a, b)

    def test_inference_does_not_fit(self):
        model = TfidfBaseline().fit(['C# C++ .NET', 'Python'])
        vocab, idf = model.vectorizer.vocabulary_.copy(), model.vectorizer.idf_.copy()
        result = model.explain('C# neverseen', 'C#')
        self.assertIn('neverseen', result['out_of_vocabulary_features']['cv'])
        self.assertEqual(model.vectorizer.vocabulary_, vocab)
        self.assertTrue((model.vectorizer.idf_ == idf).all())
        for technology in ('c#', 'c++', '.net'):
            self.assertIn(technology, vocab)
        with self.assertRaises(ValueError):
            model.fit(['new corpus'])

    def test_reject_unfitted_empty_and_zero_vector(self):
        with self.assertRaises(NotFittedError):
            TfidfBaseline().explain('Python', 'Python')
        with self.assertRaises(ValueError):
            TfidfBaseline().fit(['https://example.com'])
        model = TfidfBaseline().fit(['Python'])
        for invalid in ('', 'https://example.com', 'unknownword'):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                model.explain(invalid, 'Python')


if __name__ == '__main__':
    unittest.main()
