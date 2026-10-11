"""Run Hybrid with real local SBERT and evidence from the source DOCX."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.document_parser import parse_file
from core.sbert_baseline import SbertBaseline
from core.text_features import SkillEvidence
from core.hybrid import analyze
from prepare_dataset import validate


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--weights', nargs=3, type=float, default=[0.5, 0.3, 0.2],
                        metavar=('SEMANTIC', 'SKILLS', 'EXPERIENCE'))
    args = parser.parse_args()
    pair = json.loads((LAB / 'demo_pair.json').read_text(encoding='utf-8'))
    dataset = LAB.parent / 'data/development_v1'
    validate(dataset)
    source = LAB.parent / pair['job_file']
    jobs = [j for j in json.loads(source.read_text(encoding='utf-8-sig')) if j['id'] == pair['job_id']]
    if len(jobs) != 1:
        raise ValueError('Expected exactly one JD')
    document = parse_file(LAB.parent / pair['cv_file'])
    jd_text = (dataset / 'jds' / (pair['job_id'] + '.txt')).read_text(encoding='utf-8')
    result = analyze(document['segments'], jd_text, jobs[0], SbertBaseline(LAB / '.cache/sbert'),
                     SkillEvidence(LAB.parent / 'data/skills_taxonomy.json'),
                     dict(zip(('semantic', 'skills', 'experience'), args.weights)))
    result['inputs'] = {'cv_id': pair['cv_id'], 'job_id': pair['job_id'],
                        'cv_sha256': document['sha256'],
                        'jd_source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'jd_text_sha256': hashlib.sha256(jd_text.encode('utf-8')).hexdigest(),
                        'dataset': 'development_v1', 'evaluation': False}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2, allow_nan=False)
    print(json.dumps({k: result[k] for k in ('scores', 'normalized_weights', 'contributions',
                                           'overall_score', 'status', 'review_required')}, indent=2))


if __name__ == '__main__':
    main()
