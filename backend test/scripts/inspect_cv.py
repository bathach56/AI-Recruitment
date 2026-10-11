"""Show parsing, preprocessing and source evidence without model predictions."""
import argparse
import json
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.document_parser import ParseError, parse_file
from core.text_features import SkillEvidence, preprocess


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', nargs='?', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        pair = json.loads((LAB / 'demo_pair.json').read_text(encoding='utf-8'))
        document = parse_file(args.file or LAB.parent / pair['cv_file'])
        result = {'document': document, 'preprocessing': preprocess(document['raw_text']),
                  'skills': SkillEvidence(LAB.parent / 'data/skills_taxonomy.json').extract(document['segments'])}
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with args.output.open('x', encoding='utf-8') as stream:
                json.dump(result, stream, ensure_ascii=False, indent=2)
        print('RAW TEXT:\n' + document['raw_text'])
        print('\nTF-IDF TOKENS:\n' + ' | '.join(result['preprocessing']['tfidf_tokens']))
        print('\nSKILL EVIDENCE (mentions, not verified proficiency):')
        for item in result['skills']['evidence']:
            print(f"{item['name']} [{item['status']}] {item['location']} [{item['start']}:{item['end']}]")
            print('  ' + item['context'])
        print('\nNo matching score or inferred experience generated.')
        return 0
    except (OSError, ValueError, KeyError) as exc:
        print(f"ERROR [{getattr(exc, 'code', 'invalid_input')}]: {exc}")
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
