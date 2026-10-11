import json
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from api import create_app


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(create_app())
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def payload(self, model='Hybrid'):
        return dict(cv_text='Python\nTotal experience: 5 years', job_description='Python developer',
                    required_skills=['Python'], job_experience_years_required=3, model_type=model)

    def test_real_models(self):
        self.assertEqual(self.client.get('/health').status_code, 200)
        for model in ('TF-IDF', 'Sentence-BERT', 'Hybrid'):
            response = self.client.post('/api/ai/match', json=self.payload(model))
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json()
            self.assertEqual(result['model_used'], model)
            self.assertTrue(0 <= result['overall_score'] <= 100)

    def test_missing_experience_and_untrusted_fields(self):
        p = self.payload()
        p.update(cv_text='Python', cv_experience_years=99, cv_skills=['Docker'])
        r = self.client.post('/api/ai/match', json=p).json()
        self.assertIsNone(r['overall_score'])
        self.assertEqual(r['status'], 'incomplete')

    def test_validation_and_benchmark(self):
        for changes in ({'cv_text': ''}, {'model_type': 'fake'}, {'job_description': ' '},
                        {'weights': dict(semantic_weight=0, skill_weight=0, experience_weight=0)}):
            self.assertEqual(self.client.post('/api/ai/match', json=dict(self.payload(), **changes)).status_code, 422)
        self.assertEqual(self.client.post('/api/ai/benchmark').status_code, 409)

    def test_docx_upload_and_invalid_file(self):
        path = LAB.parent / 'data/sample_cvs/CV_NguyenVanAn_Senior_DotNet.docx'
        response = self.client.post('/api/ai/match-file', files={'file': (path.name, path.read_bytes())},
                                    data={'request_json': json.dumps(self.payload())})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['explanation']['experience']['candidate_years'], 5.5)
        self.assertEqual(self.client.post('/api/ai/parse-cv', files={'file': ('bad.docx', b'broken')}).status_code, 422)
        self.assertEqual(self.client.post('/api/ai/parse-cv', files={'file': ('bad.exe', b'x')}).status_code, 415)

    def test_model_failure_has_no_fallback(self):
        def fail():
            raise RuntimeError('Unavailable model')
        with TestClient(create_app(fail)) as client:
            self.assertEqual(client.get('/health').status_code, 503)
            response = client.post('/api/ai/match', json=self.payload())
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('overall_score', response.json())


if __name__ == '__main__':
    unittest.main()
