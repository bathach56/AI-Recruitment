"""Build an immutable, unlabelled development fixture from existing DOCX/JD sources."""
import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from day1_audit import DATA, ROOT, digest, docx_text, read_json, suspicious

DEFAULT_OUTPUT = DATA / 'development_v1'


def unique_index(rows):
    result = {}
    for row in rows:
        key = row['id']
        if not re.fullmatch(r'[A-Za-z0-9_]+', key) or key in result:
            raise ValueError(f'Invalid or duplicate ID: {key}')
        result[key] = row
    return result


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_csv(path, columns, rows):
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def prepare(output):
    if output.exists():
        raise FileExistsError(f'Refusing to overwrite dataset or annotations: {output}')
    cvs = unique_index(read_json(DATA / 'sample_cvs/sample_cvs_manifest.json'))
    jobs = unique_index(read_json(DATA / 'sample_jds/sample_jds.json'))
    source_paths = [DATA / 'sample_cvs/sample_cvs_manifest.json', DATA / 'sample_jds/sample_jds.json']
    texts = {}
    for key, cv in cvs.items():
        path = DATA / 'sample_cvs' / cv['file_name']
        if path.resolve().parent != (DATA / 'sample_cvs').resolve():
            raise ValueError('CV source must stay inside sample_cvs')
        text = docx_text(path)
        if not text.strip() or suspicious(text):
            raise ValueError(f'Empty or suspicious source needs manual review: {key}')
        texts[f'cvs/{key}.txt'] = text + '\n'
        source_paths.append(path)
    for key, job in jobs.items():
        # Source fields only, never labels or matched/missing annotations.
        text = '\n'.join([job['title'], job['description'], *job['responsibilities'],
            'Required skills: ' + ', '.join(job['required_skills']),
            'Nice-to-have skills: ' + ', '.join(job['nice_to_have_skills']),
            f"Required experience: {job['experience_years_required']} years"])
        if suspicious(text):
            raise ValueError(f'Suspicious JD source needs manual review: {key}')
        texts[f'jds/{key}.txt'] = text + '\n'

    legacy = []
    for path in sorted((DATA / 'ground_truth').glob('*.csv')):
        source_paths.append(path)
        with path.open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                cv, job = cvs.get(row['cv_id']), jobs.get(row['job_id'])
                legacy.append({'source': path.name, 'pair_id': row['pair_id'],
                    'cv_id': row['cv_id'], 'cv_exists_in_samples': bool(cv),
                    'legacy_cv_category': row.get('cv_category', ''),
                    'sample_cv_role': cv['target_role'] if cv else '',
                    'job_id': row['job_id'], 'job_exists_in_samples': bool(job),
                    'legacy_job_title': row['job_title'],
                    'sample_job_title': job['title'] if job else '',
                    'job_title_exact_match': bool(job and job['title'].casefold() == row['job_title'].casefold()),
                    'decision': 'quarantined_pending_source_and_label_review'})

    before = {p.relative_to(ROOT).as_posix(): digest(p) for p in source_paths}
    output.mkdir(parents=True)
    for name, text in texts.items():
        path = output / name
        path.parent.mkdir(exist_ok=True)
        path.write_text(text, encoding='utf-8')
    pairs = [{'pair_id': f'{cv}__{job}', 'cv_id': cv, 'job_id': job,
              'cv_text_path': f'cvs/{cv}.txt', 'jd_text_path': f'jds/{job}.txt',
              'usage': 'development_only'} for cv in sorted(cvs) for job in sorted(jobs)]
    write_csv(output / 'pairs.csv', list(pairs[0]), pairs)
    annotation_columns = ['pair_id', 'reviewer_id', 'label', 'domain_evidence',
                          'skill_evidence', 'experience_evidence', 'notes']
    for reviewer in ('reviewer_a', 'reviewer_b'):
        write_csv(output / f'{reviewer}.csv', annotation_columns,
                  [{'pair_id': pair['pair_id'], 'reviewer_id': reviewer} for pair in pairs])
    write_csv(output / 'legacy_link_audit.csv', list(legacy[0]), legacy)
    duplicates = defaultdict(list)
    for name in texts:
        duplicates[digest(output / name)].append(name)
    write_json(output / 'manifest.json', {
        'version': 'development_v1', 'purpose': 'synthetic development fixtures, not held-out research test',
        'extractor': 'stdlib DOCX XML inventory reader; not an independent parser oracle',
        'label_status': 'unlabelled; no legacy labels imported',
        'source_hashes': before,
        'text_hashes': {name: digest(output / name) for name in texts},
        'counts': {'cvs': len(cvs), 'jds': len(jobs), 'pairs': len(pairs), 'legacy_rows_quarantined': len(legacy)},
        'exact_duplicate_text_groups': [names for names in duplicates.values() if len(names) > 1],
        'near_duplicates_checked': False,
        'txt_policy': 'Regenerated from DOCX; original TXT not repaired or overwritten',
        'split_policy': 'All development; research split pending source/label review'
    })
    if before != {p.relative_to(ROOT).as_posix(): digest(p) for p in source_paths}:
        raise RuntimeError('Source changed during build; do not use this output')
    return len(pairs)


def validate(output):
    manifest = read_json(output / 'manifest.json')
    for name, expected in manifest['source_hashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError(f'Source changed: {name}')
    for name, expected in manifest['text_hashes'].items():
        if digest(output / name) != expected:
            raise ValueError(f'Derived text changed: {name}')
    with (output / 'pairs.csv').open(encoding='utf-8-sig', newline='') as stream:
        pairs = list(csv.DictReader(stream))
    ids = {p['pair_id'] for p in pairs}
    # Validate against actual text IDs, not an assumed label distribution.
    actual_expected = {(Path(c).stem, Path(j).stem) for c in manifest['text_hashes'] if c.startswith('cvs/')
                       for j in manifest['text_hashes'] if j.startswith('jds/')}
    if len(ids) != len(pairs) or {(p['cv_id'], p['job_id']) for p in pairs} != actual_expected:
        raise ValueError('Missing or duplicate pair links')
    for p in pairs:
        if (p['pair_id'] != f"{p['cv_id']}__{p['job_id']}" or
                p['cv_text_path'] != f"cvs/{p['cv_id']}.txt" or
                p['jd_text_path'] != f"jds/{p['job_id']}.txt" or p['usage'] != 'development_only'):
            raise ValueError('Invalid pair path, ID or usage')
    for reviewer in ('reviewer_a', 'reviewer_b'):
        with (output / f'{reviewer}.csv').open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.DictReader(stream))
        if len(rows) != len(ids) or {r['pair_id'] for r in rows} != ids:
            raise ValueError('Annotation IDs do not match pairs')
        for row in rows:
            if row['label'] not in ('', '0', '1', 'uncertain'):
                raise ValueError('Label must be empty, 0, 1 or uncertain')
            if row['label'] and (not row['reviewer_id'].strip() or not row['notes'].strip()):
                raise ValueError('Label requires reviewer and rationale')
    return len(pairs)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--validate', action='store_true')
    args = parser.parse_args()
    count = validate(args.output) if args.validate else prepare(args.output)
    print(f'OK: {count} development pairs; no research metrics generated. Output: {args.output}')


if __name__ == '__main__':
    main()
