"""
Module HybridMatchingModel: Triển khai phương pháp kết hợp Đa tầng (Hybrid Model).
Theo đúng quy định tại AGENTS.md Mục 8:
Semantic Similarity + Skill Matching + Experience Matching -> Hybrid result.
Trọng số mặc định: 50% Semantic, 35% Skill, 15% Experience (có thể tùy biến).
"""
import time
from typing import Dict, Any, List

from models.sbert_model import SBertMatchingModel
from models.tfidf_model import TfidfMatchingModel
from services.skill_matcher import SkillMatcher


class HybridMatchingModel:
    def __init__(self, sbert_model: SBertMatchingModel, skill_matcher: SkillMatcher):
        self.sbert_model = sbert_model
        self.skill_matcher = skill_matcher

    def match(
        self,
        cv_text: str,
        cv_skills: List[str],
        cv_experience_years: float,
        jd_text: str,
        required_skills: List[str],
        nice_to_have_skills: List[str] = None,
        job_experience_years_required: float = 0.0,
        semantic_weight: float = 0.50,
        skill_weight: float = 0.35,
        experience_weight: float = 0.15
    ) -> Dict[str, Any]:
        """
        Tính toán toàn diện kết quả Hybrid Matching:
        1. Điểm Ngữ nghĩa (Semantic Score)
        2. Điểm Khớp Kỹ năng (Skill Score)
        3. Điểm Thâm niên (Experience Score)
        4. Tổng hợp điểm Hybrid theo trọng số
        5. Phân tích giải trình (Explainable AI Analysis)
        """
        start_time = time.time()

        # 1. Tính Semantic Score (Sentence-BERT)
        semantic_score, sbert_latency = self.sbert_model.calculate_similarity(cv_text, jd_text)

        # 2. Tính Skill Matching Score & Phân tích Skill Gap
        # Nếu cv_skills rỗng, tự động trích xuất từ cv_text
        if not cv_skills:
            detected = self.skill_matcher.extract_skills_from_text(cv_text)
            cv_skills = [d["normalized"] for d in detected]

        skill_analysis = self.skill_matcher.calculate_skill_matching(
            cv_skills=cv_skills,
            required_skills=required_skills,
            nice_to_have_skills=nice_to_have_skills or []
        )
        skill_score = skill_analysis["skill_score"]

        # 3. Tính Experience Score
        experience_analysis = self._calculate_experience_score(
            years_found=cv_experience_years,
            years_required=job_experience_years_required
        )
        experience_score = experience_analysis["experience_score"]

        # 4. Chuẩn hóa trọng số và tính điểm Hybrid tổng thể
        total_w = semantic_weight + skill_weight + experience_weight
        if total_w <= 0:
            total_w = 1.0

        w_sem = semantic_weight / total_w
        w_ski = skill_weight / total_w
        w_exp = experience_weight / total_w

        overall_score = (
            (semantic_score * w_sem) +
            (skill_score * w_ski) +
            (experience_score * w_exp)
        )
        overall_score = round(max(0.0, min(100.0, overall_score)), 2)

        # 5. Sinh nhận định và khuyến nghị của AI (Explainable AI Recommendation)
        ai_recommendation = self._generate_recommendation(
            overall_score=overall_score,
            coverage=skill_analysis["coverage_percentage"],
            exp_status=experience_analysis["status"],
            missing_skills=skill_analysis["missing_skills"]
        )

        total_latency_ms = round((time.time() - start_time) * 1000.0, 2)

        return {
            "overall_score": overall_score,
            "breakdown": {
                "semantic_score": round(semantic_score, 2),
                "skill_score": round(skill_score, 2),
                "experience_score": round(experience_score, 2)
            },
            "weights_used": {
                "semantic_weight": round(w_sem, 2),
                "skill_weight": round(w_ski, 2),
                "experience_weight": round(w_exp, 2)
            },
            "skill_analysis": skill_analysis,
            "experience_analysis": experience_analysis,
            "ai_recommendation": ai_recommendation,
            "processing_time_ms": total_latency_ms
        }

    def _calculate_experience_score(self, years_found: float, years_required: float) -> Dict[str, Any]:
        """Tính điểm thâm niên dựa trên độ chênh lệch số năm làm việc."""
        if years_required <= 0:
            return {
                "experience_score": 100.0,
                "years_found": years_found,
                "years_required": years_required,
                "status": "Qualified",
                "experience_gap": years_found
            }

        gap = years_found - years_required
        if gap >= 0:
            # Vượt hoặc bằng yêu cầu
            score = 100.0
            status = "Qualified" if gap <= 3.0 else "Highly Experienced"
        elif gap >= -1.0:
            # Thiếu dưới 1 năm: xem xét tốt
            score = 80.0
            status = "Acceptable"
        elif gap >= -2.0:
            # Thiếu 1 - 2 năm: điểm vừa
            score = 60.0
            status = "Borderline"
        else:
            # Thiếu nhiều năm: phạt điểm nặng
            ratio = max(0.1, years_found / years_required)
            score = round(ratio * 50.0, 1)
            status = "Underqualified"

        return {
            "experience_score": score,
            "years_found": years_found,
            "years_required": years_required,
            "status": status,
            "experience_gap": round(gap, 1)
        }

    def _generate_recommendation(
        self,
        overall_score: float,
        coverage: float,
        exp_status: str,
        missing_skills: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Tạo văn bản giải trình ngắn gọn cho Recruiter."""
        missing_names = [s["name"] for s in missing_skills[:3]]
        missing_str = ", ".join(missing_names) if missing_names else "Không có"

        if overall_score >= 80.0 and coverage >= 70.0:
            decision = "Highly Recommended"
            badge_color = "success"
            summary = (
                f"Ứng viên đạt mức tương thích xuất sắc ({overall_score}%). "
                f"Đáp ứng {coverage}% kỹ năng bắt buộc và thâm niên đạt chuẩn ({exp_status}). "
                "Khuyến nghị xếp lịch phỏng vấn chuyên môn sớm."
            )
        elif overall_score >= 65.0:
            decision = "Consider Interview"
            badge_color = "warning"
            summary = (
                f"Ứng viên có tiềm năng tốt ({overall_score}%). "
                f"Tuy nhiên cần lưu ý kiểm tra thêm các kỹ năng còn thiếu: {missing_str}."
            )
        else:
            decision = "Not Recommended"
            badge_color = "danger"
            summary = (
                f"Mức độ tương thích thấp ({overall_score}%). "
                f"Ứng viên chưa đáp ứng đủ các tiêu chuẩn kỹ thuật cốt lõi hoặc thiếu thâm niên cần thiết."
            )

        return {
            "decision_badge": decision,
            "badge_color": badge_color,
            "summary": summary
        }
