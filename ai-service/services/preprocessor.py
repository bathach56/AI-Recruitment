"""
Module Preprocessor: Làm sạch, tiền xử lý và chuẩn hóa văn bản CV và JD.
Bao gồm: Lowercase, loại bỏ URL, ký tự đặc biệt thừa (giữ lại #, +, . cho tên công nghệ), chuẩn hóa khoảng trắng.
"""
import re
from typing import List


class Preprocessor:
    # Danh sách stopwords thông dụng trong tiếng Anh và tiếng Việt thường gặp trong CV
    STOPWORDS = {
        "and", "the", "to", "of", "a", "in", "for", "is", "on", "that", "by", "this", "with",
        "i", "you", "it", "not", "or", "be", "are", "from", "at", "as", "your", "all", "have",
        "new", "more", "an", "was", "we", "will", "home", "can", "us", "about", "if", "my",
        "has", "but", "our", "one", "other", "do", "no", "they", "he", "she", "so", "than",
        "và", "của", "các", "có", "được", "cho", "trong", "với", "những", "là", "tại", "về",
        "người", "khi", "để", "từ", "nhiều", "như", "đã", "theo", "này", "qua", "sau", "trên"
    }

    @staticmethod
    def clean_text(text: str) -> str:
        """Làm sạch văn bản: bỏ url, ký tự rác, chuẩn hóa khoảng trắng."""
        if not text:
            return ""

        # Loại bỏ URL
        text = re.sub(r"http\S+|www\.\S+", " ", text)
        # Loại bỏ email
        text = re.sub(r"\S+@\S+", " ", text)
        # Chuyển về chữ thường
        text = text.lower()
        # Thay thế các ký tự đặc biệt ngoại trừ những ký tự thuộc tên công nghệ (c#, c++, .net)
        # Giữ lại chữ cái, chữ số, khoảng trắng, và các ký tự: #, +, ., -
        text = re.sub(r"[^\w\s#+.\-]", " ", text)
        # Chuẩn hóa khoảng trắng
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def tokenize_and_remove_stopwords(text: str) -> List[str]:
        """Tách từ và loại bỏ stopwords đơn giản."""
        cleaned = Preprocessor.clean_text(text)
        tokens = cleaned.split()
        return [t for t in tokens if t not in Preprocessor.STOPWORDS and len(t) > 1]

    @staticmethod
    def get_processed_string(text: str) -> str:
        """Trả về chuỗi văn bản đã loại bỏ stopwords để đưa vào TF-IDF."""
        tokens = Preprocessor.tokenize_and_remove_stopwords(text)
        return " ".join(tokens)
