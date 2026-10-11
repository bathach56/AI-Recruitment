"""
FastAPI Microservice: Lõi Trí tuệ Nhân tạo Xử lý CV & So khớp Tuyển dụng.
Cung cấp các API:
1. POST /api/ai/parse-cv: Bóc tách text, kỹ năng, thâm niên từ file PDF/DOCX.
2. POST /api/ai/match: Tính điểm so khớp (TF-IDF, S-BERT, Hybrid) và phân tích Skill Gap.
3. POST /api/ai/benchmark: Đo lường và báo cáo các chỉ số thực nghiệm (Precision, Recall, F1, Latency).
"""
import os
import sys
import time
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Thêm thư mục hiện tại vào sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.text_extractor import TextExtractor
from services.skill_matcher import SkillMatcher
from models.tfidf_model import TfidfMatchingModel
from models.sbert_model import SBertMatchingModel
from models.hybrid_model import HybridMatchingModel

# Khởi tạo FastAPI App
app = FastAPI(
    title="RecruitAI - AI Recruitment Service",
    description="Python AI Service cho Hệ thống Tuyển dụng & So khớp Hồ sơ CV với Job Description",
    version="1.0.0"
)

# Cấu hình CORS để ASP.NET Core và Frontend có thể gọi trực tiếp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo các Singletons Service & Models
skill_matcher = SkillMatcher()
tfidf_model = TfidfMatchingModel()
sbert_model = SBertMatchingModel()
hybrid_model = HybridMatchingModel(sbert_model=sbert_model, skill_matcher=skill_matcher)


# ==========================================
# PYDANTIC SCHEMAS (DATA CONTRACTS)
# ==========================================

class MatchWeights(BaseModel):
    semantic_weight: float = Field(default=0.50, ge=0.0, le=1.0)
    skill_weight: float = Field(default=0.35, ge=0.0, le=1.0)
    experience_weight: float = Field(default=0.15, ge=0.0, le=1.0)


class MatchRequest(BaseModel):
    cv_id: Optional[int] = 0
    cv_text: str = Field(..., description="Văn bản trích xuất từ CV của ứng viên")
    cv_skills: Optional[List[str]] = Field(default_factory=list, description="Danh sách kỹ năng bóc tách từ CV")
    cv_experience_years: Optional[float] = Field(default=0.0, description="Số năm kinh nghiệm của ứng viên")
    job_id: Optional[int] = 0
    job_title: Optional[str] = ""
    job_description: str = Field(..., description="Nội dung mô tả công việc (JD)")
    required_skills: Optional[List[str]] = Field(default_factory=list, description="Kỹ năng bắt buộc (Must-have)")
    nice_to_have_skills: Optional[List[str]] = Field(default_factory=list, description="Kỹ năng ưu tiên (Nice-to-have)")
    job_experience_years_required: Optional[float] = Field(default=0.0, description="Số năm kinh nghiệm tối thiểu yêu cầu")
    model_type: Optional[str] = Field(default="Hybrid", description="Mô hình sử dụng: 'TF-IDF', 'Sentence-BERT', 'Hybrid'")
    weights: Optional[MatchWeights] = Field(default_factory=MatchWeights)


class BenchmarkRequest(BaseModel):
    test_dataset_path: Optional[str] = "data/ground_truth/ground_truth_matching_template.csv"
    threshold: float = Field(default=0.65, ge=0.0, le=1.0, description="Ngưỡng Matching Score để coi là Match")
    models: Optional[List[str]] = Field(default_factory=lambda: ["TF-IDF", "Sentence-BERT", "Hybrid"])


# ==========================================
# API ENDPOINTS
# ==========================================

@app.get("/health")
def health_check():
    """Kiểm tra tình trạng hoạt động của dịch vụ AI."""
    return {
        "status": "healthy",
        "service": "RecruitAI Python Microservice",
        "timestamp": time.time(),
        "sbert_loaded": sbert_model.model is not None,
        "skills_loaded": len(skill_matcher.skills_db)
    }


@app.post("/api/ai/parse-cv")
async def parse_cv(file: UploadFile = File(...)):
    """
    Bóc tách văn bản thô, nhận diện thông tin và kỹ năng từ file CV tải lên (.pdf, .docx, .txt).
    """
    start_time = time.time()
    filename = file.filename or "uploaded_cv"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in [".pdf", ".docx", ".doc", ".txt"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Định dạng tệp không được hỗ trợ: {ext}. Chỉ chấp nhận .pdf, .docx, .txt"
        )

    try:
        content = await file.read()
        raw_text = TextExtractor.extract_from_bytes(content, filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Không thể bóc tách nội dung văn bản từ tệp: {str(e)}"
        )

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tệp rỗng hoặc không chứa văn bản có thể trích xuất."
        )

    # Trích xuất metadata và kỹ năng
    meta = TextExtractor.extract_metadata(raw_text)
    detected_skills = skill_matcher.extract_skills_from_text(raw_text)
    elapsed_ms = round((time.time() - start_time) * 1000.0, 2)

    return {
        "success": true,
        "filename": filename,
        "raw_text": raw_text,
        "parsed_data": {
            "candidate_name": meta.get("name", ""),
            "email": meta.get("email", ""),
            "phone": meta.get("phone", ""),
            "estimated_experience_years": meta.get("estimated_experience_years", 0.0),
            "detected_skills": detected_skills
        },
        "processing_time_ms": elapsed_ms
    }


@app.post("/api/ai/match")
def match_cv_to_jd(request: MatchRequest):
    """
    So khớp văn bản CV và JD bằng phương pháp được chọn:
    - 'TF-IDF'
    - 'Sentence-BERT'
    - 'Hybrid' (mặc định)
    """
    if not request.cv_text.strip() or not request.job_description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cv_text và job_description không được để trống."
        )

    model_type = request.model_type.strip()

    if model_type == "TF-IDF":
        score, latency = tfidf_model.calculate_similarity(request.cv_text, request.job_description)
        return {
            "success": True,
            "cv_id": request.cv_id,
            "job_id": request.job_id,
            "model_used": "TF-IDF",
            "overall_score": score,
            "breakdown": {
                "semantic_score": score,
                "skill_score": 0.0,
                "experience_score": 0.0
            },
            "processing_time_ms": latency
        }

    elif model_type == "Sentence-BERT":
        score, latency = sbert_model.calculate_similarity(request.cv_text, request.job_description)
        return {
            "success": True,
            "cv_id": request.cv_id,
            "job_id": request.job_id,
            "model_used": "Sentence-BERT",
            "overall_score": score,
            "breakdown": {
                "semantic_score": score,
                "skill_score": 0.0,
                "experience_score": 0.0
            },
            "processing_time_ms": latency
        }

    else:  # Mặc định: Hybrid Model
        res = hybrid_model.match(
            cv_text=request.cv_text,
            cv_skills=request.cv_skills,
            cv_experience_years=request.cv_experience_years,
            jd_text=request.job_description,
            required_skills=request.required_skills,
            nice_to_have_skills=request.nice_to_have_skills,
            job_experience_years_required=request.job_experience_years_required,
            semantic_weight=request.weights.semantic_weight,
            skill_weight=request.weights.skill_weight,
            experience_weight=request.weights.experience_weight
        )
        return {
            "success": True,
            "cv_id": request.cv_id,
            "job_id": request.job_id,
            "model_used": "Hybrid",
            **res
        }


@app.post("/api/ai/benchmark")
def run_benchmark(request: BenchmarkRequest):
    """
    Chạy thực nghiệm đánh giá Precision, Recall, F1-score và Latency trên tập Ground-Truth.
    """
    import csv

    # Xác định đường dẫn file ground truth
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    path = os.path.join(base_dir, request.test_dataset_path)

    if not os.path.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tập dữ liệu ground truth tại: {request.test_dataset_path}"
        )

    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    total_pairs = len(rows)
    if total_pairs == 0:
        raise HTTPException(status_code=400, detail="Tập dữ liệu kiểm thử rỗng.")

    results = []
    threshold_pct = request.threshold * 100.0

    for model_name in request.models:
        tp = 0
        fp = 0
        fn = 0
        tn = 0
        latencies = []

        for row in rows:
            ground_truth = int(row.get("ground_truth_label", 0))
            cv_cat = row.get("cv_category", "")
            job_title = row.get("job_title", "")
            matched_skills = [s.strip() for s in row.get("matched_core_skills", "").split(",") if s.strip()]
            missing_skills = [s.strip() for s in row.get("missing_core_skills", "").split(",") if s.strip()]

            cv_mock = f"{cv_cat} with skills: {', '.join(matched_skills)}."
            jd_mock = f"Job title: {job_title}. Required: {', '.join(matched_skills + missing_skills)}."

            if model_name == "TF-IDF":
                score, lat = tfidf_model.calculate_similarity(cv_mock, jd_mock)
            elif model_name == "Sentence-BERT":
                score, lat = sbert_model.calculate_similarity(cv_mock, jd_mock)
            else:
                h_res = hybrid_model.match(
                    cv_text=cv_mock,
                    cv_skills=matched_skills,
                    cv_experience_years=3.0,
                    jd_text=jd_mock,
                    required_skills=matched_skills + missing_skills,
                    job_experience_years_required=3.0
                )
                score = h_res["overall_score"]
                lat = h_res["processing_time_ms"]

            latencies.append(lat)
            pred = 1 if score >= threshold_pct else 0

            if pred == 1 and ground_truth == 1:
                tp += 1
            elif pred == 1 and ground_truth == 0:
                fp += 1
            elif pred == 0 and ground_truth == 1:
                fn += 1
            else:
                tn += 1

        precision = round(tp / (tp + fp), 3) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn), 3) if (tp + fn) > 0 else 0.0
        f1 = round(2 * precision * recall / (precision + recall), 3) if (precision + recall) > 0 else 0.0
        avg_lat = round(sum(latencies) / len(latencies), 2) if latencies else 0.0

        results.append({
            "model": model_name,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "avg_latency_ms": avg_lat
        })

    return {
        "success": True,
        "total_pairs_tested": total_pairs,
        "threshold": request.threshold,
        "metrics": results
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
