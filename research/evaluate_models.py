"""
Script Đánh giá Thực nghiệm (Benchmark Evaluation Pipeline):
Chạy so sánh 3 mô hình NLP (TF-IDF vs Sentence-BERT vs Hybrid) trên tập dữ liệu kiểm thử Ground-Truth.
Tuân thủ nguyên tắc AGENTS.md:
- Không bịa số liệu.
- Lưu trữ kết quả thực nghiệm rõ ràng theo từng phiên bản.
- Ghi nhận đầy đủ: Precision, Recall, F1-score, Cosine Similarity và Processing Time.
"""
import os
import sys
import csv
import json
import time
from typing import List, Dict, Any

# Đưa thư mục ai-service vào path
ai_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai-service"))
sys.path.insert(0, ai_service_dir)

from models.tfidf_model import TfidfMatchingModel
from models.sbert_model import SBertMatchingModel
from models.hybrid_model import HybridMatchingModel
from services.skill_matcher import SkillMatcher


def run_evaluation(ground_truth_path: str, threshold: float = 0.65) -> Dict[str, Any]:
    print(f"=== BẮT ĐẦU CHẠY THỰC NGHIỆM ĐÁNH GIÁ 3 MÔ HÌNH ===")
    print(f"Dataset Ground-truth: {ground_truth_path}")
    print(f"Ngưỡng Matching Threshold: {threshold * 100:.1f}%\n")

    if not os.path.exists(ground_truth_path):
        raise FileNotFoundError(f"Không tìm thấy file: {ground_truth_path}")

    # Đọc dữ liệu ground truth
    rows = []
    with open(ground_truth_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    total_pairs = len(rows)
    print(f"Tổng số cặp mẫu kiểm thử: {total_pairs}")

    # Khởi tạo models
    skill_matcher = SkillMatcher()
    tfidf = TfidfMatchingModel()
    sbert = SBertMatchingModel()
    hybrid = HybridMatchingModel(sbert_model=sbert, skill_matcher=skill_matcher)

    models = {
        "TF-IDF (Baseline)": tfidf,
        "Sentence-BERT": sbert,
        "Hybrid Model": hybrid
    }

    results = []

    for name, model in models.items():
        print(f"\n---> Đang đánh giá mô hình: {name}...")
        tp, fp, fn, tn = 0, 0, 0, 0
        latencies = []
        scores = []

        for row in rows:
            ground_truth = int(row.get("ground_truth_label", 0))
            cv_cat = row.get("cv_category", "")
            job_title = row.get("job_title", "")
            matched_skills = [s.strip() for s in row.get("matched_core_skills", "").split(",") if s.strip()]
            missing_skills = [s.strip() for s in row.get("missing_core_skills", "").split(",") if s.strip()]

            # Giả lập văn bản từ thông tin mẫu
            cv_text = f"Candidate role: {cv_cat}. Experienced in {', '.join(matched_skills)}. Worked on various enterprise software development projects."
            jd_text = f"Job Title: {job_title}. We require candidates with {', '.join(matched_skills + missing_skills)}. Minimum 3 years experience."

            if name == "TF-IDF (Baseline)":
                score, lat = model.calculate_similarity(cv_text, jd_text)
            elif name == "Sentence-BERT":
                score, lat = model.calculate_similarity(cv_text, jd_text)
            else:  # Hybrid
                h_res = model.match(
                    cv_text=cv_text,
                    cv_skills=matched_skills,
                    cv_experience_years=3.0,
                    jd_text=jd_text,
                    required_skills=matched_skills + missing_skills,
                    job_experience_years_required=3.0
                )
                score = h_res["overall_score"]
                lat = h_res["processing_time_ms"]

            latencies.append(lat)
            scores.append(score)

            # Phân loại nhị phân dựa trên ngưỡng
            pred = 1 if score >= (threshold * 100.0) else 0

            if pred == 1 and ground_truth == 1:
                tp += 1
            elif pred == 1 and ground_truth == 0:
                fp += 1
            elif pred == 0 and ground_truth == 1:
                fn += 1
            else:
                tn += 1

        precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
        f1 = round(2 * precision * recall / (precision + recall), 4) if (precision + recall) > 0 else 0.0
        avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

        model_stat = {
            "model_name": name,
            "total_tested": total_pairs,
            "threshold": threshold,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "avg_matching_score": avg_score,
            "avg_latency_ms": avg_latency
        }
        results.append(model_stat)

        print(f"    TP={tp}, FP={fp}, FN={fn}, TN={tn}")
        print(f"    Precision: {precision:.4f} | Recall: {recall:.4f} | F1-Score: {f1:.4f}")
        print(f"    Avg Latency: {avg_latency:.2f} ms")

    # Lưu kết quả vào thư mục results
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "results"))
    os.makedirs(output_dir, exist_ok=True)

    json_path = os.path.join(output_dir, "benchmark_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": ground_truth_path,
            "threshold": threshold,
            "results": results
        }, f, indent=2, ensure_ascii=False)

    csv_path = os.path.join(output_dir, "benchmark_summary.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "model_name", "total_tested", "threshold", "tp", "fp", "fn", "tn",
            "precision", "recall", "f1_score", "avg_matching_score", "avg_latency_ms"
        ])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n[Hoàn thành] Đã xuất kết quả thực nghiệm ra:")
    print(f"- JSON: {json_path}")
    print(f"- CSV:  {csv_path}")

    return {
        "timestamp": time.time(),
        "results": results
    }


if __name__ == "__main__":
    gt_file = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", "data", "ground_truth", "ground_truth_matching_template.csv"
    ))
    run_evaluation(gt_file, threshold=0.65)
