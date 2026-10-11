"""Start isolated loopback services, verify HTTP integration, then stop both."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import httpx

LAB = Path(__file__).resolve().parents[1]
ROOT = LAB.parent


def wait_ready(client, url, process):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('Service exited before becoming ready')
        try:
            if client.get(url).status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(.25)
    raise TimeoutError('Service startup timed out')


def main():
    env = dict(os.environ, AiService__BaseUrl='http://127.0.0.1:18000', ASPNETCORE_ENVIRONMENT='Development')
    processes = []
    report = {'checks': []}
    with (LAB / 'reports/backend_smoke.log').open('w', encoding='utf-8') as log, httpx.Client(timeout=60) as client:
        try:
            ai = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'api:app', '--app-dir', str(LAB),
                                   '--host', '127.0.0.1', '--port', '18000'], stdout=log, stderr=log)
            processes.append(ai)
            wait_ready(client, 'http://127.0.0.1:18000/health', ai)
            web = subprocess.Popen(['dotnet', str(ROOT / 'webAI/bin/Debug/net10.0/webAI.dll'),
                                    '--urls', 'http://127.0.0.1:18001'], cwd=ROOT / 'webAI',
                                   env=env, stdout=log, stderr=log)
            processes.append(web)
            wait_ready(client, 'http://127.0.0.1:18001/api/matching/health', web)
            payload = dict(cv_text='Python\nTotal experience: 5 years', job_description='Python developer',
                           required_skills=['Python'], job_experience_years_required=3)
            for model in ('TF-IDF', 'Sentence-BERT', 'Hybrid'):
                payload['model_type'] = model
                direct = client.post('http://127.0.0.1:18000/api/ai/match', json=payload)
                proxy = client.post('http://127.0.0.1:18001/api/matching/analyze', json=payload)
                assert direct.status_code == proxy.status_code == 200, proxy.text
                a, b = direct.json(), proxy.json()
                assert abs(a['overall_score'] - b['overall_score']) < 1e-6
                assert b['explanation']['model_used' if model != 'Hybrid' else 'version']
                assert b['model_used'] == model
                report['checks'].append(model + ': Python/ASP.NET score parity')
            payload['cv_text'] = 'Python'
            result = client.post('http://127.0.0.1:18001/api/matching/analyze', json=payload)
            assert result.status_code == 200 and result.json()['overall_score'] is None, result.text
            report['checks'].append('Missing experience remains null through ASP.NET')
            path = ROOT / 'data/sample_cvs/CV_NguyenVanAn_Senior_DotNet.docx'
            result = client.post('http://127.0.0.1:18001/api/matching/analyze-file',
                                 files={'file': (path.name, path.read_bytes())},
                                 data={'request_json': json.dumps(payload)})
            assert result.status_code == 200, result.text
            assert result.json()['explanation']['experience']['candidate_years'] == 5.5
            report['checks'].append('DOCX -> ASP.NET -> Python parser -> Hybrid -> evidence')
            result = client.post('http://127.0.0.1:18001/api/matching/analyze', json=dict(payload, model_type='unknown'))
            assert result.status_code == 422, result.text
            report['checks'].append('Invalid model returns 422')
            ai.terminate()
            ai.wait(timeout=15)
            result = client.post('http://127.0.0.1:18001/api/matching/analyze', json=payload)
            assert result.status_code == 503 and 'overall_score' not in result.json(), result.text
            report['checks'].append('Python unavailable returns 503 without fallback')
        finally:
            for process in reversed(processes):
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=15)
    (LAB / 'reports/backend_smoke.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
