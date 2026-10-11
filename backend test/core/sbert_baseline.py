"""Local pretrained SBERT; explicit chunks instead of silent truncation."""
import json
import re
import time
from importlib.metadata import version
from pathlib import Path
import numpy as np
from core.text_features import VERSION, preprocess


def chunk_text(text, tokenizer, limit):
    words = list(re.finditer(r'\S+', text))
    if not words:
        raise ValueError('Empty text after preprocessing')
    chunks, start, end = [], words[0].start(), words[0].start()
    def length(value):
        return len(tokenizer(value, add_special_tokens=True, truncation=False, verbose=False)['input_ids'])
    for word in words:
        if length(text[start:word.end()]) > limit:
            if end == start:
                raise ValueError('A single word exceeds model token limit')
            chunks.append({'text': text[start:end], 'start': start, 'end': end,
                           'token_count': length(text[start:end])})
            start = word.start()
            if length(word.group()) > limit:
                raise ValueError('A single word exceeds model token limit')
        end = word.end()
    chunks.append({'text': text[start:end], 'start': start, 'end': end,
                   'token_count': length(text[start:end])})
    return chunks


class SbertBaseline:
    def __init__(self, model_path: Path):
        from sentence_transformers import SentenceTransformer
        model_path = Path(model_path)
        if not (model_path / 'modules.json').is_file():
            raise FileNotFoundError('Model missing; run scripts/download_sbert.py first')
        self.provenance = json.loads((model_path / 'provenance.json').read_text(encoding='utf-8'))
        start = time.perf_counter()
        self.model = SentenceTransformer(str(model_path), device='cpu', local_files_only=True,
                                         trust_remote_code=False)
        self.model.eval()
        self.load_ms = (time.perf_counter() - start) * 1000

    def explain(self, cv_text, jd_text):
        start = time.perf_counter()
        texts = [preprocess(t)['semantic_text'] for t in (cv_text, jd_text)]
        if any(len(text) > 100_000 for text in texts):
            raise ValueError('Document exceeds 100,000 character lab limit')
        chunks = [chunk_text(t, self.model.tokenizer, self.model.max_seq_length) for t in texts]
        all_chunks = chunks[0] + chunks[1]
        vectors = self.model.encode([c['text'] for c in all_chunks], batch_size=8,
            normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
        if not np.isfinite(vectors).all():
            raise ValueError('Non-finite model output')
        split = len(chunks[0])
        embeddings = []
        specials = self.model.tokenizer.num_special_tokens_to_add(pair=False)
        for group, encoded in zip(chunks, (vectors[:split], vectors[split:])):
            weights = [max(1, c['token_count'] - specials) for c in group]
            pooled = np.average(encoded, axis=0, weights=weights)
            norm = np.linalg.norm(pooled)
            if norm <= 0:
                raise ValueError('Zero embedding')
            embeddings.append(pooled / norm)
        cosine = float(np.clip(np.dot(*embeddings), -1, 1))
        return {'model_used': 'Sentence-BERT', **self.provenance,
            'preprocessing_version': VERSION, 'device': 'cpu',
            'versions': {name: version(name) for name in ('sentence-transformers', 'transformers', 'torch')},
            'max_seq_length': self.model.max_seq_length, 'embedding_dimension': len(embeddings[0]),
            'aggregation': 'token-count-weighted mean of normalized chunk embeddings, then L2 normalize',
            'cv_chunks': chunks[0], 'jd_chunks': chunks[1],
            'cv_embedding': embeddings[0].tolist(), 'jd_embedding': embeddings[1].tolist(),
            'chunk_cosines': (vectors[:split] @ vectors[split:].T).tolist(),
            'cosine_similarity': cosine, 'overall_score': max(0, cosine) * 100,
            'model_load_ms': self.load_ms, 'processing_time_ms': (time.perf_counter()-start)*1000,
            'warnings': ['Development inference, not accuracy or hiring probability.',
                         'Chunk aggregation is a configurable design assumption, not a proven optimum.',
                         'Embedding dimensions are not named skills. Chunk similarity is not causal explanation.']}
