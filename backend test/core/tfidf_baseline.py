"""Frozen-corpus TF-IDF with per-feature cosine contributions."""
import hashlib
import time
from collections import Counter
from importlib.metadata import version

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.utils.validation import check_is_fitted
from core.text_features import VERSION, preprocess


def tokenize(text):
    return preprocess(text)['tfidf_tokens']


class TfidfBaseline:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(tokenizer=tokenize, token_pattern=None,
            lowercase=False, ngram_range=(1, 2), max_features=5000,
            norm='l2', smooth_idf=True, sublinear_tf=False)
        self.corpus_hashes = None

    def fit(self, documents):
        if self.corpus_hashes is not None:
            raise ValueError('Already fitted; create a new model to change the corpus')
        documents = list(documents)
        if not documents or any(not tokenize(text) for text in documents):
            raise ValueError('Fit requires non-empty tokenizable documents')
        self.vectorizer.fit(documents)
        self.corpus_hashes = [hashlib.sha256(t.encode('utf-8')).hexdigest() for t in documents]
        return self

    def metadata(self):
        check_is_fitted(self.vectorizer)
        return {'model': 'TF-IDF', 'sklearn_version': version('scikit-learn'),
                'preprocessing_version': VERSION, 'fit_document_count': len(self.corpus_hashes),
                'fit_document_sha256': self.corpus_hashes,
                'ngram_range': [1, 2], 'max_features': 5000, 'norm': 'l2',
                'smooth_idf': True, 'sublinear_tf': False,
                'vocabulary_size': len(self.vectorizer.vocabulary_)}

    def explain(self, cv_text, jd_text):
        check_is_fitted(self.vectorizer)
        started = time.perf_counter()
        if not tokenize(cv_text) or not tokenize(jd_text):
            raise ValueError('CV and JD must contain tokens after preprocessing')
        matrix = self.vectorizer.transform([cv_text, jd_text])
        cv, jd = matrix[0], matrix[1]
        if not cv.nnz or not jd.nnz:
            raise ValueError('Zero vector: CV or JD has no features in fitted vocabulary')
        cosine = float(cosine_similarity(cv, jd)[0, 0])
        names = self.vectorizer.get_feature_names_out()
        analyzer = self.vectorizer.build_analyzer()
        counts = [Counter(analyzer(t)) for t in (cv_text, jd_text)]
        cv_weights = dict(zip(cv.indices.tolist(), cv.data.tolist()))
        jd_weights = dict(zip(jd.indices.tolist(), jd.data.tolist()))
        rows = []
        for index in sorted(set(cv_weights) | set(jd_weights)):
            name = str(names[index])
            a, b = cv_weights.get(index, 0.0), jd_weights.get(index, 0.0)
            rows.append({'feature': name, 'cv_tf': counts[0][name], 'jd_tf': counts[1][name],
                         'idf': float(self.vectorizer.idf_[index]), 'cv_weight': a, 'jd_weight': b,
                         'cosine_contribution': a * b})
        rows.sort(key=lambda row: (-row['cosine_contribution'], row['feature']))
        return {'model_used': 'TF-IDF', 'cosine_similarity': cosine,
                'overall_score': min(100.0, max(0.0, cosine * 100)),
                'contribution_sum': sum(r['cosine_contribution'] for r in rows),
                'features': rows,
                'out_of_vocabulary_features': {
                    side: sorted(set(counts[i]) - set(self.vectorizer.vocabulary_))
                    for i, side in enumerate(('cv', 'jd'))},
                'processing_time_ms': (time.perf_counter() - started) * 1000,
                'timing_scope': 'transform, cosine and explanation; excludes fit and file parsing',
                'warning': 'Lexical similarity, not accuracy, hiring probability or verified skills.'}
