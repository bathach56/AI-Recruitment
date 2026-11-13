"""Prepare an unlabeled Vietnamese practice pack; no AI calls or database writes."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import random
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
REVIEW_FIELDS = ['pair_id', 'reviewer_id', 'label', 'domain_evidence', 'skill_evidence', 'experience_evidence', 'notes']
PAIR_FIELDS = ['pair_id', 'cv_group', 'jd_group', 'language', 'cv_text_path', 'jd_text_path']


def csv_text(fields, rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def prepare(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.exists():
        raise FileExistsError('Không ghi đè bộ đã tạo hoặc phiếu người đánh giá: ' + str(output))
    specs = json.loads(source.read_text(encoding='utf-8'))['candidates']
    if len(specs) != 5 or len({s['category'] for s in specs}) != 5:
        raise ValueError('Cần 5 JD thuộc 5 lĩnh vực khác nhau.')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.annotation-trial-', dir=output.parent) as temporary:
        staging = Path(temporary) / 'pack'
        staging.mkdir()
        hashes = {}

        def write(relative, text, hashed=True, csv=False):
            path = staging / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding='utf-8-sig' if csv else 'utf-8', newline='')
            if hashed:
                hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()

        order = list(range(10))
        random.Random(20261111).shuffle(order)
        cv_ids = {index: f'CV_{order[index]+1:03}' for index in range(10)}
        cv_texts, jd_texts, metadata = {}, {}, {}
        for index, spec in enumerate(specs):
            jd_id = f'JD_{index+1:03}'
            jd_texts[jd_id] = f"Vị trí: {spec['role']}\n\nMÔ TẢ CÔNG VIỆC\n{spec['description']}\n\nYÊU CẦU\n{spec['requirements']}"
            metadata[jd_id] = {'sector': spec['category'], 'title': spec['role'], 'requirements_source': 'YÊU CẦU trong JD; không tự biến kỹ năng ưu tiên thành bắt buộc.'}
            cv_texts[cv_ids[index]] = '\n\n'.join([
                'HỒ SƠ GIẢ LẬP ĐÃ BỎ THÔNG TIN LIÊN HỆ', 'Vị trí mong muốn: ' + spec['role'],
                'GIỚI THIỆU\n' + spec['summary'], 'KỸ NĂNG\n' + spec['skills'],
                'KINH NGHIỆM\n' + spec['experience'], 'DỰ ÁN\n' + spec['projects'], 'HỌC VẤN\n' + spec['education']])
            cv_texts[cv_ids[index+5]] = '\n\n'.join([
                'HỒ SƠ GIẢ LẬP ĐÃ BỎ THÔNG TIN LIÊN HỆ', 'Vị trí mong muốn: ' + spec['role'],
                'KỸ NĂNG\n' + ', '.join(spec['skills'].split(', ')[:2]),
                'KINH NGHIỆM\nTổng kinh nghiệm: 1 năm. Tham gia hỗ trợ nhóm chuyên môn; hồ sơ chưa mô tả rõ phạm vi trách nhiệm.',
                'DỰ ÁN\nTham gia một dự án học tập theo nhóm. Chưa cung cấp sản phẩm, quy mô hoặc bằng chứng về vai trò cá nhân.',
                'HỌC VẤN\nĐã học chuyên ngành liên quan đến vị trí mong muốn; chưa cung cấp chứng chỉ bổ sung.'])
        for key, text in cv_texts.items():
            write('vi/' + key + '.txt', text + '\n')
        for key, text in jd_texts.items():
            write('vi/' + key + '.txt', text + '\n')
        combinations = []
        for index in range(5):
            # Sampling composition is not a prediction/label; humans judge every pair.
            for cv_index in [index, index+5, (index+1) % 5, (index+3) % 5]:
                combinations.append((cv_ids[cv_index], f'JD_{index+1:03}'))
        random.Random(137).shuffle(combinations)
        pairs = [dict(zip(PAIR_FIELDS, [f'P{number:03}', cv, jd, 'vi', 'vi/' + cv + '.txt', 'vi/' + jd + '.txt']))
                 for number, (cv, jd) in enumerate(combinations, 1)]
        write('pairs.csv', csv_text(PAIR_FIELDS, pairs), csv=True)
        for role in ['a', 'b']:
            write(f'reviewer_{role}.csv', csv_text(REVIEW_FIELDS, [dict.fromkeys(REVIEW_FIELDS, '') | {'pair_id': pair['pair_id']} for pair in pairs]), hashed=False, csv=True)
        fields = ['pair_id', 'final_label', 'adjudicator_id', 'rationale', 'split']
        write('adjudication.csv', csv_text(fields, [dict.fromkeys(fields, '') | {'pair_id': pair['pair_id']} for pair in pairs]), hashed=False, csv=True)
        write('jd_metadata.json', json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
        links = []
        for pair in pairs:
            cv, jd, key = pair['cv_group'], pair['jd_group'], pair['pair_id']
            write('packets/' + key + '.md', f'# Cặp {key}\n\nDữ liệu giả lập tập gán nhãn. Không có điểm AI hoặc nhãn gợi ý.\n\n## JD {jd}\n\n{jd_texts[jd]}\n\n## CV {cv}\n\n{cv_texts[cv]}\n\n## Ghi phiếu\n\nChọn 1 / 0 / uncertain, ghi bằng chứng và lý do vào phiếu riêng. Không đánh giá theo tên, giới tính hoặc thông tin liên hệ.\n', hashed=True)
            links.append(f'- [{key} — {cv} / {jd}](packets/{key}.md)')
        write('BAT_DAU.md', '# Bộ tập gán nhãn 20 cặp\n\n**Chưa có đáp án chuẩn hoặc điểm AI.** Hai người đọc cùng các cặp dưới đây và điền `reviewer_a.csv` / `reviewer_b.csv` riêng, không xem phiếu của nhau.\n\nHướng dẫn: [quy trình gán nhãn](../../docs/THU_GAN_NHAN_20_CAP.md). Chưa chia train/validation/test; không dùng bộ này để công bố chất lượng mô hình.\n\n' + '\n'.join(links) + '\n')
        manifest = {'version': 'annotation_trial_20_vi_v1', 'intended_use': 'annotation_practice', 'synthetic': True,
                    'source_notes': 'Derived from the fictional five-sector app fixture plus fictional incomplete-profile variants. Not an independent model evaluation set.',
                    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'source_file': 'tools/DemoScenario/five-sectors.json',
                    'license': 'Project-authored fictional practice material; no real candidate records.', 'approved_by': '',
                    'language': 'vi', 'pairs': 20, 'cv_count': 10, 'jd_count': 5, 'sample_seed': 137,
                    'text_hashes': hashes, 'labels_generated_by_ai': False, 'split_assigned': False,
                    'limitations': ['Repeated CV/JD groups are not independent observations.', 'No inferred labels or expected class balance.', 'No evaluation or fine-tuning authorization.']}
        (staging / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        staging.rename(output)
    return output


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/annotation_trial_20_vi_v1')
    args = parser.parse_args()
    print(prepare(ROOT / 'tools/DemoScenario/five-sectors.json', args.output))
