"""CLI for inspecting actual PDF/DOCX extraction without running matching."""
import argparse
import json
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.document_parser import ParseError, parse_file


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', nargs='?', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    source = args.file
    if source is None:
        pair = json.loads((LAB / 'demo_pair.json').read_text(encoding='utf-8'))
        source = LAB.parent / pair['cv_file']
    try:
        result = parse_file(source)
    except (ParseError, OSError) as exc:
        print(json.dumps({'success': False, 'code': getattr(exc, 'code', 'file_access_error'),
                          'message': str(exc)}, ensure_ascii=False))
        return 1
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Never overwrite an input file or earlier evidence.
        with args.output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
    print(result['raw_text'])
    print('\nWARNINGS: ' + ' | '.join(result['warnings']))
    print(f"Parser: {result['parser']}; segments: {len(result['segments'])}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
