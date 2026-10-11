import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_dataset import prepare, validate, unique_index


class DatasetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / 'dataset'
        prepare(self.output)

    def test_sources_and_unlabelled_links(self):
        self.assertEqual(validate(self.output), 200)
        for reviewer in ('reviewer_a', 'reviewer_b'):
            with (self.output / f'{reviewer}.csv').open(encoding='utf-8-sig', newline='') as stream:
                self.assertTrue(all(r['label'] == '' for r in csv.DictReader(stream)))

    def test_rerun_preserves_annotations(self):
        path = self.output / 'reviewer_a.csv'
        original = path.read_bytes()
        with self.assertRaises(FileExistsError):
            prepare(self.output)
        self.assertEqual(path.read_bytes(), original)

    def test_modified_text_rejected(self):
        (self.output / 'cvs/CV_001.txt').write_text('changed', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Derived text changed'):
            validate(self.output)

    def test_duplicate_source_id_rejected(self):
        with self.assertRaises(ValueError):
            unique_index([{'id': 'CV_001'}, {'id': 'CV_001'}])

    def test_wrong_pair_reference_rejected(self):
        path = self.output / 'pairs.csv'
        text = path.read_text(encoding='utf-8-sig')
        path.write_text(text.replace('cvs/CV_001.txt', 'cvs/CV_002.txt', 1), encoding='utf-8-sig')
        with self.assertRaisesRegex(ValueError, 'Invalid pair'):
            validate(self.output)


if __name__ == '__main__':
    unittest.main()
