"""
Module SkillMatcher: Trích xuất kỹ năng, chuẩn hóa theo Taxonomy và tính toán Skill Gap Analysis.
"""
import json
import os
import re
from typing import Dict, List, Set, Any, Tuple


class SkillMatcher:
    def __init__(self, taxonomy_path: str = None):
        if taxonomy_path is None:
            # Mặc định tìm file skills_taxonomy.json ở thư mục data/
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            taxonomy_path = os.path.join(base_dir, "data", "skills_taxonomy.json")

        self.taxonomy_path = taxonomy_path
        self.skills_db: Dict[str, Dict[str, Any]] = {}
        self.alias_to_canonical: Dict[str, str] = {}
        self.load_taxonomy()

    def load_taxonomy(self):
        """Đọc và nạp từ điển kỹ năng."""
        if not os.path.exists(self.taxonomy_path):
            # Fallback nếu đường dẫn chưa đúng
            return

        with open(self.taxonomy_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        taxonomy = data.get("taxonomy", {})
        for category, skill_list in taxonomy.items():
            for item in skill_list:
                canonical = item["normalized"]
                self.skills_db[canonical] = {
                    "id": item["id"],
                    "name": item["name"],
                    "normalized": canonical,
                    "category": category,
                    "aliases": item["aliases"]
                }
                for alias in item["aliases"]:
                    self.alias_to_canonical[alias.lower().strip()] = canonical

    def extract_skills_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Trích xuất danh sách các kỹ năng chuẩn hóa xuất hiện trong đoạn văn bản."""
        if not text:
            return []

        text_lower = f" {text.lower()} "
        found_canonical: Set[str] = set()

        # Quét qua tất cả alias đã định nghĩa
        for alias, canonical in self.alias_to_canonical.items():
            # Sử dụng regex pattern với word boundary tương thích ký tự đặc biệt (#, +, .)
            # Nếu alias có ký tự đặc biệt như c#, .net core thì escape
            escaped = re.escape(alias)
            # Đối chiếu từ nguyên cụm
            pattern = rf"(?<![a-zA-Z0-9_]){escaped}(?![a-zA-Z0-9_])"
            if re.search(pattern, text_lower):
                found_canonical.add(canonical)

        result = []
        for canonical in found_canonical:
            info = self.skills_db.get(canonical)
            if info:
                result.append({
                    "name": info["name"],
                    "normalized": canonical,
                    "category": info["category"]
                })
        return result

    def calculate_skill_matching(
        self,
        cv_skills: List[str],
        required_skills: List[str],
        nice_to_have_skills: List[str] = None
    ) -> Dict[str, Any]:
        """
        Tính điểm tương thích kỹ năng và phân tích Skill Gap:
        - Matched skills: kỹ năng trùng khớp (Required & Nice-to-have)
        - Missing skills: kỹ năng bắt buộc mà ứng viên còn thiếu
        - Bonus skills: kỹ năng ứng viên có nhưng JD chỉ coi là điểm cộng
        - Skill Score: thang điểm từ 0 đến 100
        """
        if nice_to_have_skills is None:
            nice_to_have_skills = []

        # Chuẩn hóa về canonical normalized id
        def normalize_list(lst: List[str]) -> Set[str]:
            res = set()
            for s in lst:
                sl = s.lower().strip()
                if sl in self.alias_to_canonical:
                    res.add(self.alias_to_canonical[sl])
                elif sl in self.skills_db:
                    res.add(sl)
                else:
                    res.add(sl)
            return res

        cv_set = normalize_list(cv_skills)
        req_set = normalize_list(required_skills)
        nice_set = normalize_list(nice_to_have_skills)

        # Trùng khớp
        matched_required = cv_set.intersection(req_set)
        matched_nice = cv_set.intersection(nice_set)
        missing_required = req_set - cv_set
        bonus_skills = cv_set - req_set

        # Tính điểm có trọng số:
        # Mỗi kỹ năng bắt buộc: 1.5 điểm
        # Mỗi kỹ năng ưu tiên: 1.0 điểm
        total_possible_score = (len(req_set) * 1.5) + (len(nice_set) * 1.0)
        actual_score = (len(matched_required) * 1.5) + (len(matched_nice) * 1.0)

        if total_possible_score > 0:
            score_percentage = min(100.0, round((actual_score / total_possible_score) * 100.0, 2))
        else:
            score_percentage = 100.0 if not req_set else 0.0

        # Định dạng kết quả trả về
        def format_skill_objects(slug_set: Set[str], skill_type: str) -> List[Dict[str, Any]]:
            items = []
            for slug in slug_set:
                info = self.skills_db.get(slug, {"name": slug.title(), "normalized": slug})
                items.append({
                    "name": info["name"],
                    "normalized": slug,
                    "type": skill_type
                })
            return items

        return {
            "skill_score": score_percentage,
            "matched_skills": (
                format_skill_objects(matched_required, "Required") +
                format_skill_objects(matched_nice, "Nice-to-have")
            ),
            "missing_skills": format_skill_objects(missing_required, "Required"),
            "bonus_skills": format_skill_objects(bonus_skills, "Bonus"),
            "coverage_percentage": round((len(matched_required) / max(1, len(req_set))) * 100.0, 1)
        }
