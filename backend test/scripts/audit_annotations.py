"""Report annotation readiness without generating labels or research metrics."""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from prepare_dataset import DEFAULT_OUTPUT, validate


def read_rows(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def audit_rows(pairs, reviewer_a, reviewer_b):
    expected = [row['pair_id'] for row in pairs]
    if not expected or len(set(expected)) != len(expected):
        raise ValueError('Pairs must be nonempty and unique')
    indexes = []
    fields = ('domain_evidence', 'skill_evidence', 'experience_evidence', 'notes')
    for rows in (reviewer_a, reviewer_b):
        index = {}
        for row in rows:
            key = row['pair_id']
            if key in index or key not in expected:
                raise ValueError('Duplicate or unknown annotation pair')
            if row.get('label') not in ('', '0', '1', 'uncertain'):
                raise ValueError('Invalid annotation label')
            index[key] = row
        if set(index) != set(expected):
            raise ValueError('Missing annotation rows')
        indexes.append(index)
    queue = []
    for key in expected:
        a, b = (index[key] for index in indexes)
        reasons = []
        if not a['label'] or not b['label']:
            reasons.append('pending_labels')
        for name, row in (('a', a), ('b', b)):
            if row['label']:
                for field in ('reviewer_id', *fields):
                    if not row.get(field, '').strip():
                        reasons.append(f'{name}_missing_{field}')
        if a['label'] and b['label']:
            if a.get('reviewer_id', '').strip().casefold() == b.get('reviewer_id', '').strip().casefold():
                reasons.append('same_reviewer')
            if 'uncertain' in (a['label'], b['label']):
                reasons.append('uncertain_label')
            elif a['label'] != b['label']:
                reasons.append('disagreement')
        queue.append({'pair_id': key, 'label_a': a['label'], 'label_b': b['label'],
                      'status': 'needs_review' if reasons else 'agreement_candidate',
                      'reasons': reasons})
    counts = Counter(row['status'] for row in queue)
    reasons = Counter(reason for row in queue for reason in row['reasons'])
    return {'total_pairs': len(expected), 'status_counts': dict(counts),
            'reason_counts': dict(reasons), 'queue': queue,
            'research_ready': False,
            'remaining_gates': ['Human adjudication and rubric/version sign-off',
                                'Research dataset provenance and leakage-safe held-out split',
                                'Validation-only selection of thresholds and weights'],
            'warning': 'Agreement candidates are not final ground truth; this is not a model evaluation.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    validate(args.dataset)
    names = ('pairs.csv', 'reviewer_a.csv', 'reviewer_b.csv')
    result = audit_rows(*(read_rows(args.dataset / name) for name in names))
    result['input_sha256'] = {name: hashlib.sha256((args.dataset / name).read_bytes()).hexdigest()
                              for name in (*names, 'manifest.json')}
    result['dataset'] = 'development_v1; synthetic development only'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in result.items() if k != 'queue'}, indent=2))


if __name__ == '__main__':
    main()
