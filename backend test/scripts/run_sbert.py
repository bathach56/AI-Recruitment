"""Run actual offline SBERT on development data without training or labels."""
import argparse
import json
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB))
from core.sbert_baseline import SbertBaseline
from prepare_dataset import validate


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cv-id', default='CV_001')
    parser.add_argument('--job-id', default='JOB_001')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    dataset = LAB.parent / 'data/development_v1'
    validate(dataset)
    manifest = json.loads((dataset / 'manifest.json').read_text(encoding='utf-8'))
    paths = [f'cvs/{args.cv_id}.txt', f'jds/{args.job_id}.txt']
    if any(path not in manifest['text_hashes'] for path in paths):
        parser.error('CV/JD not in development dataset')
    model = SbertBaseline(LAB / '.cache/sbert')
    result = model.explain(*[(dataset / p).read_text(encoding='utf-8') for p in paths])
    result['inputs'] = {p: manifest['text_hashes'][p] for p in paths}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
    print(f"{args.cv_id} / {args.job_id}; dimension={result['embedding_dimension']}")
    print(f"Chunks: {len(result['cv_chunks'])} CV, {len(result['jd_chunks'])} JD")
    print(f"Cosine={result['cosine_similarity']:.6f}; score={result['overall_score']:.2f}/100")
    print(f"Load={result['model_load_ms']:.1f} ms; processing={result['processing_time_ms']:.1f} ms")
    print('Pretrained inference only; no fine-tuning, no Precision/Recall/F1.')


if __name__ == '__main__':
    main()
