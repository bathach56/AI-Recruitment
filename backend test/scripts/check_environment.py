"""Import checks and small local smoke checks; no network or model download."""
import importlib
import importlib.metadata
import io
import json
import os
import platform
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR', str(LAB / '.cache/matplotlib'))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    packages = {'PyMuPDF': 'pymupdf', 'python-docx': 'docx', 'scikit-learn': 'sklearn',
                'sentence-transformers': 'sentence_transformers', 'torch': 'torch',
                'pandas': 'pandas', 'matplotlib': 'matplotlib', 'ipykernel': 'ipykernel',
                'fastapi': 'fastapi', 'uvicorn': 'uvicorn', 'python-multipart': 'python_multipart'}
    results = {}
    for package, module in packages.items():
        importlib.import_module(module)
        results[package] = importlib.metadata.version(package)
    import pandas as pd
    import matplotlib
    matplotlib.use('Agg')
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import torch
    assert pd.DataFrame({'x': [1, 2]})['x'].sum() == 3
    figure = Figure()
    figure.subplots().plot([0, 1], [0, 1])
    buffer = io.BytesIO()
    FigureCanvasAgg(figure).print_png(buffer)
    assert buffer.getvalue().startswith(b'\x89PNG')
    app = FastAPI()
    @app.get('/health')
    def health():
        return {'status': 'ok'}
    with TestClient(app) as client:
        assert client.get('/health').json() == {'status': 'ok'}
    report = {'python': platform.python_version(), 'executable': sys.executable,
              'packages': results, 'cuda_available': torch.cuda.is_available(),
              'smoke_checks': ['imports', 'pandas calculation', 'matplotlib PNG in memory', 'FastAPI in-process health'],
              'not_checked': ['real network API integration', 'notebook UI', 'fine-tuning']}
    target = LAB / 'reports/environment_current.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
