"""Display selected source pair only; no matching score or inferred experience."""
import sys
from day1_audit import LAB, ROOT, read_json, docx_text, digest


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    pair = read_json(LAB / 'demo_pair.json')
    matches = [job for job in read_json(ROOT / pair['job_file']) if job['id'] == pair['job_id']]
    if len(matches) != 1:
        raise ValueError('Expected exactly one JD for the selected ID')
    cv = ROOT / pair['cv_file']
    text = docx_text(cv)
    if not text.strip():
        raise ValueError('Selected CV contains no text')
    job = matches[0]
    print(f"DEVELOPMENT INPUT ONLY: {pair['cv_id']} -> {pair['job_id']}")
    print(f'CV SHA256: {digest(cv)}')
    print('\nCV SOURCE TEXT:\n' + text)
    print('\nJD SOURCE TEXT:\n' + job['title'] + '\n' + job['description'])
    print('\n'.join(job['responsibilities']))
    print('Required skills: ' + ', '.join(job['required_skills']))
    print('Nice-to-have skills: ' + ', '.join(job['nice_to_have_skills']))
    print(f"Required experience (JD source): {job['experience_years_required']} years")
    print('\nNo label, score or research metric has been generated.')


if __name__ == '__main__':
    main()
