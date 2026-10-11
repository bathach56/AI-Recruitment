"""Read-only source inventory. Outputs stay in backend test/reports; no model runs."""
import argparse
import csv
import hashlib
import importlib.metadata
import json
import platform
import sys
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

LAB = Path(__file__).resolve().parents[1]
ROOT = LAB.parent
DATA = ROOT / 'data'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def docx_text(path):
    # Inventory only; the production parser will use python-docx on day 4.
    with zipfile.ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read('word/document.xml'))
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    return '\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p', ns))


def suspicious(text):
    # Heuristic only: flag for human review, never automatically repair text.
    return any(marker in text for marker in ('Ã', 'Ä', 'Æ', 'á»', 'áº', '\ufffd'))


def audit():
    cvs = read_json(DATA / 'sample_cvs/sample_cvs_manifest.json')
    jobs = read_json(DATA / 'sample_jds/sample_jds.json')
    cv_ids = {row['id'] for row in cvs}
    job_ids = {row['id'] for row in jobs}
    cv_files = []
    for row in cvs:
        record = {'id': row['id'], 'files': []}
        for suffix in ('.docx', '.txt'):
            path = (DATA / 'sample_cvs' / row['file_name']).with_suffix(suffix)
            item = {'path': path.relative_to(ROOT).as_posix(), 'exists': path.is_file()}
            if path.is_file():
                text = docx_text(path) if suffix == '.docx' else path.read_text(encoding='utf-8-sig')
                item.update(sha256=digest(path), characters=len(text),
                            possible_encoding_damage=suspicious(text))
            record['files'].append(item)
        cv_files.append(record)

    csv_files = []
    for path in sorted(DATA.rglob('*.csv')):
        with path.open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream)
            headers = reader.fieldnames
            count = 0
            labels = Counter()
            missing_cvs, missing_jobs = set(), set()
            for row in reader:
                count += 1
                if path.parent.name == 'ground_truth':
                    labels[row.get('ground_truth_label', '')] += 1
                    if row.get('cv_id') not in cv_ids:
                        missing_cvs.add(row.get('cv_id'))
                    if row.get('job_id') not in job_ids:
                        missing_jobs.add(row.get('job_id'))
        item = {'path': path.relative_to(ROOT).as_posix(), 'rows': count,
                'columns': headers, 'sha256': digest(path)}
        if path.parent.name == 'ground_truth':
            item.update(label_counts=dict(labels),
                        cv_ids_not_in_sample_manifest=sorted(missing_cvs),
                        job_ids_not_in_sample_jds=sorted(missing_jobs))
        csv_files.append(item)

    packages = {}
    for name in ('scikit-learn', 'sentence-transformers', 'torch', 'PyMuPDF',
                 'python-docx', 'pandas', 'numpy', 'matplotlib', 'fastapi', 'uvicorn'):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = None
    taxonomy = read_json(DATA / 'skills_taxonomy.json')
    report = {
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'purpose': 'Day 1 inventory, not model evaluation',
        'environment': {'python': platform.python_version(), 'executable': sys.executable,
                        'platform': platform.platform(), 'virtual_environment': sys.prefix != sys.base_prefix,
                        'packages': packages, 'model_inference_tested': False},
        'samples': {'cv_count': len(cvs), 'jd_count': len(jobs), 'cv_files': cv_files,
                    'duplicate_cv_ids': [k for k,v in Counter(r['id'] for r in cvs).items() if v > 1],
                    'duplicate_job_ids': [k for k,v in Counter(r['id'] for r in jobs).items() if v > 1]},
        'taxonomy_categories': {k: len(v) for k,v in taxonomy.get('taxonomy', {}).items()},
        'csv_inventory': csv_files,
        'source_policy': 'See data/README.md; external licenses and labels remain unverified.'
    }
    return report


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=LAB / 'reports/day1_inventory.json')
    args = parser.parse_args()
    report = audit()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Python {report['environment']['python']}; venv={report['environment']['virtual_environment']}")
    print(f"CVs={report['samples']['cv_count']}; JDs={report['samples']['jd_count']}")
    damaged = sum(f.get('possible_encoding_damage', False) for c in report['samples']['cv_files'] for f in c['files'])
    print(f'Files flagged for encoding review: {damaged}')
    for item in report['csv_inventory']:
        print(f"{item['path']}: {item['rows']} rows")
        if 'label_counts' in item:
            print(f"  Labels: {item['label_counts']}; unresolved CV IDs={len(item['cv_ids_not_in_sample_manifest'])}; unresolved JD IDs={len(item['job_ids_not_in_sample_jds'])}")
    print(f'Report: {args.output}')


if __name__ == '__main__':
    main()
