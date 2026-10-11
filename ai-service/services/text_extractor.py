"""
Module TextExtractor: Bóc tách văn bản thô từ tệp PDF và DOCX.
Sử dụng PyMuPDF (fitz) cho PDF và python-docx cho DOCX theo chuẩn AGENTS.md.
"""
import io
import os
import re
from typing import Dict, Any, List

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import docx
except ImportError:
    docx = None


class TextExtractor:
    @staticmethod
    def extract_from_bytes(file_bytes: bytes, filename: str) -> str:
        """Trích xuất văn bản từ mảng byte dựa trên đuôi file."""
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".pdf":
            return TextExtractor.extract_from_pdf_bytes(file_bytes)
        elif ext in [".docx", ".doc"]:
            return TextExtractor.extract_from_docx_bytes(file_bytes)
        elif ext in [".txt", ".text"]:
            return file_bytes.decode("utf-8", errors="ignore")
        else:
            raise ValueError(f"Định dạng tệp không được hỗ trợ: {ext}. Chỉ hỗ trợ .pdf, .docx, .txt")

    @staticmethod
    def extract_from_file_path(file_path: str) -> str:
        """Trích xuất văn bản từ đường dẫn tệp trên ổ đĩa."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Không tìm thấy tệp: {file_path}")
        with open(file_path, "rb") as f:
            return TextExtractor.extract_from_bytes(f.read(), file_path)

    @staticmethod
    def extract_from_pdf_bytes(pdf_bytes: bytes) -> str:
        """Trích xuất nội dung từ tệp PDF bằng PyMuPDF."""
        if fitz is None:
            # Fallback nếu chưa cài PyMuPDF
            return pdf_bytes.decode("utf-8", errors="ignore")
        text_content = []
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc:
                text_content.append(page.get_text())
        return "\n".join(text_content).strip()

    @staticmethod
    def extract_from_docx_bytes(docx_bytes: bytes) -> str:
        """Trích xuất nội dung từ tệp DOCX bằng python-docx."""
        if docx is None:
            return docx_bytes.decode("utf-8", errors="ignore")
        file_stream = io.BytesIO(docx_bytes)
        doc = docx.Document(file_stream)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    paragraphs.append(" | ".join(row_text))
        return "\n".join(paragraphs).strip()

    @staticmethod
    def extract_metadata(text: str) -> Dict[str, Any]:
        """Trích xuất sơ bộ email, số điện thoại, và ước lượng số năm kinh nghiệm."""
        # Email
        email_pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
        emails = re.findall(email_pattern, text)
        email = emails[0] if emails else ""

        # Số điện thoại
        phone_pattern = r"(?:(?:\+84|0)[3|5|7|8|9][0-9]{8}\b)|(?:\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b)"
        phones = re.findall(phone_pattern, text)
        phone = phones[0] if phones else ""

        # Ước lượng kinh nghiệm (ví dụ: "5.5 năm", "3 years", "2018 - 2023")
        exp_pattern = r"(\d+(?:\.\d+)?)\s*(?:năm|years?|yrs?)"
        exp_matches = re.findall(exp_pattern, text, re.IGNORECASE)
        experience_years = 0.0
        if exp_matches:
            try:
                experience_years = max([float(x) for x in exp_matches if float(x) <= 30.0])
            except ValueError:
                experience_years = 0.0

        return {
            "email": email,
            "phone": phone,
            "estimated_experience_years": experience_years
        }
