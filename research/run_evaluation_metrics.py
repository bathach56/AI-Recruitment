"""
Script Đo lường Chỉ số Thực nghiệm (Evaluation Metrics Engine) - Ngày 2
Nhiệm vụ: Chạy kiểm thử tự động, tính toán chính xác ma trận nhầm lẫn (Confusion Matrix)
và các chỉ số khoa học: Precision, Recall, F1-score, Specificity, Accuracy, Latency.
Tuân thủ nguyên tắc: Không bịa kết quả - số liệu được tính trực tiếp từ tập nhãn Ground-Truth.
"""
import os
import sys
import csv
import json
import time
from typing import Dict, Any, List

# Nạp thư mục ai-service
ai_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai-service"))
sys.path.insert(0, ai_service_dir)

from models.tfidf_model import TfidfMatchingModel
from models.sbert_model import SBertMatchingModel
from models.hybrid_model import HybridMatchingModel
from services.skill_matcher import SkillMatcher


def calculate_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
    """Tính toán toàn diện các chỉ số phân loại nhị phân."""
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / len(y_true) if len(y_true) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    return {
        "TP": tp,
        "FP": fp,
        "FN": fn,
        "TN": tn,
        "Precision": round(precision, 4),
        "Recall": round(recall, 4),
        "F1_Score": round(f1, 4),
        "Accuracy": round(accuracy, 4),
        "Specificity": round(specificity, 4)
    }


def evaluate_ground_truth(dataset_path: str, threshold: float = 0.65):
    print("=" * 70)
    print("CHƯƠNG TRÌNH KIỂM THỬ ĐÁNH GIÁ MÔ HÌNH TRÊN TẬP GROUND-TRUTH (NGÀY 2)")
    print("=" * 70)
    print(f"Dataset path: {dataset_path}")
    print(f"Ngưỡng Match Score phân định: {threshold * 100:.1f}%\n")

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Không tìm thấy tập Ground-truth: {dataset_path}")

    pairs = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            pairs.append(r)

    print(f"Tổng số mẫu kiểm thử: {len(pairs)}")
    positive_count = sum(1 for p in pairs if int(p["ground_truth_label"]) == 1)
    negative_count = len(pairs) - positive_count
    print(f"- Số mẫu Positive (Match = 1): {positive_count}")
    print(f"- Số mẫu Negative (Mismatch = 0): {negative_count} (gồm cả Hard & Easy Negatives)\n")

    # Khởi tạo mô hình
    skill_matcher = SkillMatcher()
    tfidf_model = TfidfMatchingModel()
    sbert_model = SBertMatchingModel()
    hybrid_model = HybridMatchingModel(sbert_model=sbert_model, skill_matcher=skill_matcher)

    models = {
        "TF-IDF (Baseline)": tfidf_model,
        "Sentence-BERT": sbert_model,
        "Hybrid Model (Semantic + Skill + Exp)": hybrid_model
    }

    y_true = [int(p["ground_truth_label"]) for p in pairs]
    benchmark_report = []

    for model_name, model in models.items():
        print(f"--> Đang chạy mô hình: {model_name}...")
        y_pred = []
        latencies = []
        scores = []

        for p in pairs:
            cv_cat = p.get("cv_category", "")
            job_title = p.get("job_title", "")
            matched_skills = [s.strip() for s in p.get("matched_core_skills", "").split(",") if s.strip()]
            missing_skills = [s.strip() for s in p.get("missing_core_skills", "").split(",") if s.strip()]
            cv_exp = float(p.get("cv_exp_years", 3.0))
            jd_exp = float(p.get("jd_exp_years", 3.0))

            cv_text = f"Candidate role: {cv_cat}. Skills: {', '.join(matched_skills)}. Experience: {cv_exp} years."
            jd_text = f"Job title: {job_title}. Required: {', '.join(matched_skills + missing_skills)}. Required experience: {jd_exp} years."

            if model_name == "TF-IDF (Baseline)":
                score, lat = model.calculate_similarity(cv_text, jd_text)
            elif model_name == "Sentence-BERT":
                score, lat = model.calculate_similarity(cv_text, jd_text)
            else:  # Hybrid
                h_res = model.match(
                    cv_text=cv_text,
                    cv_skills=matched_skills,
                    cv_experience_years=cv_exp,
                    jd_text=jd_text,
                    required_skills=matched_skills + missing_skills,
                    job_experience_years_required=jd_exp
                )
                score = h_res["overall_score"]
                lat = h_res["processing_time_ms"]

            scores.append(score)
            latencies.append(lat)
            y_pred.append(1 if score >= (threshold * 100.0) else 0)

        # Tính toán metrics
        metrics = calculate_metrics(y_true, y_pred)
        avg_lat = round(sum(latencies) / len(latencies), 2)
        avg_score = round(sum(scores) / len(scores), 2)

        metrics["Avg_Matching_Score"] = avg_score
        metrics["Avg_Latency_ms"] = avg_lat
        metrics["Model_Name"] = model_name
        benchmark_report.append(metrics)

        print(f"    Confusion Matrix: TP={metrics['TP']}, FP={metrics['FP']}, FN={metrics['FN']}, TN={metrics['TN']}")
        print(f"    Precision:   {metrics['Precision'] * 100:.2f}%")
        print(f"    Recall:      {metrics['Recall'] * 100:.2f}%")
        print(f"    F1-Score:    {metrics['F1_Score'] * 100:.2f}%")
        print(f"    Accuracy:    {metrics['Accuracy'] * 100:.2f}%")
        print(f"    Avg Latency: {avg_lat} ms\n")

    # Lưu kết quả
    results_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "results"))
    os.makedirs(results_dir, exist_ok=True)

    json_path = os.path.join(results_dir, "day2_benchmark_metrics.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": dataset_path,
            "threshold": threshold,
            "total_samples": len(pairs),
            "benchmark_report": benchmark_report
        }, f, indent=2, ensure_ascii=False)

    print(f"[THÀNH CÔNG] Đã lưu kết quả đo lường vào: {json_path}")
    return benchmark_report


if __name__ == "__main__":
    gt_file = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", "data", "ground_truth", "ground_truth_matching.csv"
    ))
    evaluate_ground_truth(gt_file, threshold=0.65)
