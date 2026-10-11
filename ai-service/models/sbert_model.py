"""
Module SBertMatchingModel: Triển khai phương pháp Semantic Similarity sử dụng Sentence-BERT.
Theo đúng quy định tại AGENTS.md Mục 8:
CV -> Sentence-BERT embedding, JD -> Sentence-BERT embedding -> Cosine Similarity.
"""
import time
from typing import Tuple

try:
    from sentence_transformers import SentenceTransformer, util
except ImportError:
    SentenceTransformer = None
    util = None

from services.preprocessor import Preprocessor


class SBertMatchingModel:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self._load_model()

    def _load_model(self):
        """Khởi tạo hoặc tải mô hình SentenceTransformer."""
        if SentenceTransformer is not None:
            try:
                # Load pre-trained model nhẹ, tối ưu cho tốc độ và bộ nhớ CPU
                self.model = SentenceTransformer(self.model_name)
            except Exception as e:
                print(f"[Warning] Chưa thể tải mô hình {self.model_name}: {e}")
                self.model = None

    def calculate_similarity(self, cv_text: str, jd_text: str) -> Tuple[float, float]:
        """
        Tính điểm tương đồng ngữ nghĩa Cosine Similarity giữa CV và JD.
        Trả về (điểm 0-100%, thời gian tính toán ms).
        """
        start_time = time.time()
        
        cv_clean = Preprocessor.clean_text(cv_text)
        jd_clean = Preprocessor.clean_text(jd_text)

        if not cv_clean or not jd_clean:
            return 0.0, 0.0

        if self.model is not None and util is not None:
            # Mã hóa văn bản thành vector embeddings 384 chiều
            cv_embedding = self.model.encode(cv_clean, convert_to_tensor=True)
            jd_embedding = self.model.encode(jd_clean, convert_to_tensor=True)

            # Tính Cosine Similarity
            cos_score = util.cos_sim(cv_embedding, jd_embedding).item()
            score = max(0.0, min(100.0, float(cos_score) * 100.0))
        else:
            # Fallback nếu môi trường chưa tải được weights
            # Tính tương đồng ngữ cảnh qua n-gram overlap
            cv_tokens = set(cv_clean.split())
            jd_tokens = set(jd_clean.split())
            inter = len(cv_tokens.intersection(jd_tokens))
            score = (inter / max(1, len(jd_tokens))) * 100.0

        elapsed_ms = (time.time() - start_time) * 1000.0
        return round(score, 2), round(elapsed_ms, 2)
