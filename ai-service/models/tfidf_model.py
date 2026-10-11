"""
Module TfidfMatchingModel: Triển khai phương pháp Baseline TF-IDF + Cosine Similarity.
Theo đúng quy định tại AGENTS.md Mục 8:
CV -> TF-IDF vector, JD -> TF-IDF vector -> Cosine Similarity.
"""
import time
from typing import Tuple, Dict, Any

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    TfidfVectorizer = None
    cosine_similarity = None

from services.preprocessor import Preprocessor


class TfidfMatchingModel:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            token_pattern=r"(?u)\b[\w#+.-]+\b"
        ) if TfidfVectorizer else None

    def calculate_similarity(self, cv_text: str, jd_text: str) -> Tuple[float, float]:
        """
        Tính điểm tương đồng Cosine Similarity giữa CV và JD.
        Trả về (điểm 0-100%, thời gian tính toán ms).
        """
        start_time = time.time()
        
        cv_clean = Preprocessor.get_processed_string(cv_text)
        jd_clean = Preprocessor.get_processed_string(jd_text)

        if not cv_clean or not jd_clean:
            return 0.0, 0.0

        if self.vectorizer is None:
            # Fallback nếu scikit-learn chưa cài
            cv_words = set(cv_clean.split())
            jd_words = set(jd_clean.split())
            intersection = len(cv_words.intersection(jd_words))
            union = len(cv_words.union(jd_words))
            jaccard = (intersection / union) if union > 0 else 0.0
            elapsed = (time.time() - start_time) * 1000
            return round(jaccard * 100.0, 2), round(elapsed, 2)

        tfidf_matrix = self.vectorizer.fit_transform([cv_clean, jd_clean])
        cos_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        # Đưa về thang điểm 0 - 100
        score = max(0.0, min(100.0, float(cos_sim) * 100.0))
        elapsed_ms = (time.time() - start_time) * 1000.0
        
        return round(score, 2), round(elapsed_ms, 2)
