"""Development walkthrough, not held-out evaluation."""
import argparse
import csv
import json
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
ROOT = LAB.parent
sys.path.insert(0, str(LAB))
from core.tfidf_baseline import TfidfBaseline
from prepare_dataset import validate


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cv-id', default='CV_001')
    parser.add_argument('--job-id', default='JOB_001')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    dataset = ROOT / 'data/development_v1'
    validate(dataset)
    manifest = json.loads((dataset / 'manifest.json').read_text(encoding='utf-8'))
    paths = sorted(manifest['text_hashes'])
    corpus = [(dataset / name).read_text(encoding='utf-8') for name in paths]
    cv_name, jd_name = f'cvs/{args.cv_id}.txt', f'jds/{args.job_id}.txt'
    if cv_name not in paths or jd_name not in paths:
        parser.error('CV/JD ID is not present in development_v1')
    model = TfidfBaseline().fit(corpus)
    result = model.explain(corpus[paths.index(cv_name)], corpus[paths.index(jd_name)])
    report = {'purpose': 'development walkthrough; queried documents ARE in fit corpus',
              'dataset_version': manifest['version'], 'fit_paths': paths,
              'cv_id': args.cv_id, 'job_id': args.job_id,
              'metadata': model.metadata(), 'result': result}
    if args.output:
        args.output.mkdir(parents=True, exist_ok=False)
        (args.output / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        with (args.output / 'feature_weights.csv').open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(result['features'][0]))
            writer.writeheader()
            writer.writerows(result['features'])
        # Inspectable model state; not an executable pickle. Re-fit deterministically from hashed sources.
        (args.output / 'vocabulary_idf.json').write_text(json.dumps({
            'metadata': model.metadata(),
            'features': model.vectorizer.get_feature_names_out().tolist(),
            'idf': model.vectorizer.idf_.tolist()}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"DEVELOPMENT ONLY: {args.cv_id} / {args.job_id}")
    print(f"Fit: {len(paths)} documents; vocabulary: {model.metadata()['vocabulary_size']}")
    print(f"Cosine: {result['cosine_similarity']:.6f}; matching score: {result['overall_score']:.2f}/100")
    print(f"Sum of feature contributions: {result['contribution_sum']:.6f}")
    for row in result['features'][:12]:
        print(f"{row['feature']}: {row['cv_weight']:.5f} x {row['jd_weight']:.5f} = {row['cosine_contribution']:.6f}")
    print('No ground-truth labels used; no Precision/Recall/F1 calculated.')


if __name__ == '__main__':
    main()
