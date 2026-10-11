"""Explain skills and explicit experience for the configured source demo pair."""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.document_parser import parse_file
from core.text_features import SkillEvidence
from core.structured_matching import VERSION, extract_experience, experience_match, match_skills


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    pair = json.loads((LAB / 'demo_pair.json').read_text(encoding='utf-8'))
    source = LAB.parent / pair['job_file']
    jobs = [j for j in json.loads(source.read_text(encoding='utf-8-sig')) if j['id'] == pair['job_id']]
    if len(jobs) != 1:
        raise ValueError('Expected exactly one JD')
    job = jobs[0]
    start = time.perf_counter()
    document = parse_file(LAB.parent / pair['cv_file'])
    extractor = SkillEvidence(LAB.parent / 'data/skills_taxonomy.json')
    skills = match_skills(extractor, document['segments'], job['required_skills'], job['nice_to_have_skills'])
    experience = extract_experience(document['segments'])
    result = {'version': VERSION, 'purpose': 'Development demonstration, no evaluation labels',
              'inputs': {'cv_id': pair['cv_id'], 'job_id': pair['job_id'],
                         'cv_sha256': document['sha256'],
                         'jd_source_sha256': hashlib.sha256(source.read_bytes()).hexdigest()},
              'jd_requirement_source': 'Structured JD fields, not inferred from prose',
              'skills': skills, 'experience_evidence': experience,
              'experience': experience_match(experience, job['experience_years_required']),
              'cv_segments': document['segments'],
              'processing_time_ms': (time.perf_counter() - start) * 1000}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
    for row in skills['requirements']:
        print(f"{row['group']}: {row['requirement']} -> {row['status']}")
    print(f"Skills: {skills['score']}; experience: {result['experience']}")


if __name__ == '__main__':
    main()
