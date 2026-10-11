import sys
import unittest
from pathlib import Path
import numpy as np

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.sbert_baseline import chunk_text, SbertBaseline


class ChunkTests(unittest.TestCase):
    def test_no_words_lost_and_limit(self):
        tokenizer = lambda text, **kwargs: {'input_ids': [0] + text.split() + [1]}
        text = 'một hai ba\n bốn năm sáu bảy'
        chunks = chunk_text(text, tokenizer, 5)
        self.assertEqual(' '.join(c['text'] for c in chunks).split(), text.split())
        self.assertTrue(all(c['token_count'] <= 5 for c in chunks))
        for c in chunks:
            self.assertEqual(text[c['start']:c['end']], c['text'])

    def test_empty_and_oversize_word(self):
        tokenizer = lambda text, **kwargs: {'input_ids': list(text) + [0, 1]}
        for text in (' ', 'abcdefghij'):
            with self.assertRaises(ValueError):
                chunk_text(text, tokenizer, 5)


@unittest.skipUnless((LAB / '.cache/sbert/provenance.json').exists(), 'Real model not downloaded')
class RealSbertTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = SbertBaseline(LAB / '.cache/sbert')

    def test_identity_and_dimension(self):
        result = self.model.explain('Lập trình Python và SQL.', 'Lập trình Python và SQL.')
        self.assertAlmostEqual(result['cosine_similarity'], 1, places=5)
        self.assertEqual(result['embedding_dimension'], 384)
        self.assertTrue(np.isfinite(result['cv_embedding']).all())

    def test_symmetry_long_text_and_bounds(self):
        a = 'Tôi phát triển ứng dụng với Python và SQL. ' * 25
        b = 'Kỹ sư phần mềm xây dựng dịch vụ dữ liệu.'
        result = self.model.explain(a, b)
        reverse = self.model.explain(b, a)
        self.assertGreater(len(result['cv_chunks']), 1)
        self.assertTrue(all(c['token_count'] <= result['max_seq_length'] for c in result['cv_chunks']))
        self.assertAlmostEqual(result['cosine_similarity'], reverse['cosine_similarity'], places=5)
        self.assertGreaterEqual(result['cosine_similarity'], -1)
        self.assertLessEqual(result['cosine_similarity'], 1)

    def test_empty_input(self):
        with self.assertRaises(ValueError):
            self.model.explain('', 'Python')


if __name__ == '__main__':
    unittest.main()
