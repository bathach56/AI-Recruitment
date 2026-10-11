# Ngày 1 — Môi trường, kiểm kê và cặp ví dụ

## Đã làm và đã chạy

- Tạo `.venv` riêng bằng Python 3.14.7 đã có trên máy. Không đổi Python hệ thống.
- Chạy thành công `scripts/day1_audit.py`: kiểm tra môi trường, đọc manifest/CSV, mở XML của 20 DOCX, kiểm tra file tham chiếu, ghi SHA-256 và báo cáo JSON.
- Chạy thành công `scripts/preview_pair.py`: đọc CV DOCX thật và JD JSON theo ID, hiển thị nội dung nguồn bằng UTF-8.
- Không sửa ứng dụng chính, AI service hiện có hoặc dữ liệu nguồn. Không chạy benchmark, không sinh điểm matching.
- Thư mục gốc hiện chưa được Git nhận diện là repository; không có git diff/commit để xác nhận lịch sử thay đổi.

## Chạy lại bằng PowerShell

Từ thư mục gốc project, không cần activate môi trường:

```powershell
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/day1_audit.py'
& './backend test/.venv/Scripts/python.exe' './backend test/scripts/preview_pair.py'
```

Để tái tạo môi trường trên máy khác: dùng Python đã cài để chạy `python -m venv "backend test/.venv"`. Hai script ngày 1 chỉ dùng thư viện chuẩn, chưa cần pip install. Trên máy hiện tại lệnh `python` trong PATH từng trỏ tới WindowsApps và không chạy được; dùng đường dẫn `.venv` như trên.

Môi trường này **mới sẵn sàng cho kiểm kê**, chưa được xác minh cho ML. Chưa cài scikit-learn, Sentence Transformers, PyTorch, PyMuPDF hoặc python-docx vào môi trường riêng; chưa tải model, kiểm tra GPU hay inference. Khi tới bước cần thư viện sẽ kiểm tra hỗ trợ Python/platform, cài dependency thực sự cần và khóa phiên bản đã chạy được. Nếu cần Python khác cho ML, tạo lại môi trường có kiểm soát; không mặc định Python 3.14 tương thích mọi gói.

## Kết quả kiểm kê

Chi tiết và hash nguồn: `reports/day1_inventory.json`. Đây là thống kê file, không phải metric nghiên cứu.

| Nguồn | Kết quả |
|---|---|
| CV mẫu | 20 mục manifest, có đủ DOCX/TXT tương ứng |
| JD mẫu | 10 mục |
| Taxonomy | 60 kỹ năng, 7 nhóm |
| Ground truth chính | 100 dòng: 50 nhãn 1, 50 nhãn 0 |
| Ground truth template | 10 dòng: 5 nhãn 1, 5 nhãn 0 |
| UpdatedResumeDataSet.csv | 962 dòng |
| job_title_des.csv | 2.277 dòng |
| raw_resumes/Resume.csv | 2.484 dòng |

Các bộ CSV không được cộng thành một dataset chung vì chưa kiểm tra trùng lặp/nguồn. Các archive và JSON dữ liệu NER chưa được thẩm định nội dung ở ngày 1. Bộ mẫu được tài liệu `data/README.md` ghi là fixture giả lập; license/provenance của dữ liệu ngoài chưa được xác nhận. Mẫu CV/JD đã xem có tiếng Việt kết hợp tên kỹ thuật tiếng Anh; chưa thống kê ngôn ngữ toàn bộ dữ liệu ngoài.

### Vấn đề cần xử lý ngày 2–3

1. Cả 20 TXT bị heuristic đánh dấu có dấu hiệu mojibake. Đây là cờ rà soát, không phải bộ phát hiện encoding hoàn hảo. DOCX không bị heuristic này đánh dấu; CV_001 DOCX đã xem có tiếng Việt đọc được.
2. TXT và DOCX của CV_001 còn khác nội dung/độ dài, nên TXT hiện tại không phải oracle nguyên văn để kiểm thử parser DOCX.
3. Ground truth 100 dòng có **75 ID CV khác nhau** và **2 ID JD khác nhau** chưa tìm thấy trong bộ mẫu hiện có. Không đồng nghĩa các hồ sơ này không tồn tại ở mọi nguồn; cần truy nguồn và lập mapping.
4. Template có ID CV trùng bộ mẫu nhưng **5 ID JD khác nhau** không khớp. ID trùng chưa chứng minh nội dung đúng: ví dụ CV_002 trong manifest là .NET, trong dòng template là Java. Phải kiểm tra ngữ nghĩa từng liên kết.
5. Nhãn cân bằng không chứng minh nhãn đúng hoặc dataset đủ đại diện. Không dùng matched/missing skills đã gán nhãn để dựng lại input model.

## Cặp ví dụ đã chọn

Định nghĩa tại `demo_pair.json`: **CV_001 → JOB_001**, cùng hướng Senior Backend .NET Engineer.

- CV nguồn: `data/sample_cvs/CV_NguyenVanAn_Senior_DotNet.docx`.
- JD nguồn: phần tử `JOB_001` của `data/sample_jds/sample_jds.json`.
- CV ghi 5.5 năm; JD ghi yêu cầu 4.5 năm. Đây là nội dung nguồn, chưa phải kết quả thuật toán trích xuất kinh nghiệm.
- Dùng cặp này làm ví dụ phát triển, không đưa vào test giữ riêng sau khi đã dùng để chỉnh thuật toán.
- Chưa gán nhãn phù hợp và chưa đặt điểm kỳ vọng. Không kết luận đáp ứng toàn bộ JD chỉ từ thâm niên.
- Script đọc XML DOCX bằng thư viện chuẩn chỉ phục vụ kiểm kê/preview; parser chính ngày 4 vẫn dùng python-docx và PyMuPDF theo quy định.

## Module hiện có: giữ ý tưởng nào, cần sửa gì trước khi kế thừa

| Nguồn | Phần có thể kế thừa | Điều cần xử lý trong bản thử nghiệm |
|---|---|---|
| services/text_extractor.py | PDF/DOCX extraction | Không decode bytes thay parser khi thiếu dependency; không nhận .doc như .docx; phân biệt kinh nghiệm không biết với 0 |
| services/preprocessor.py | Làm sạch khoảng trắng/URL, cấu trúc tách bước | Kiểm tra giữ C#, C++, .NET và phủ định; preprocessing riêng cho TF-IDF/SBERT |
| services/skill_matcher.py | Taxonomy/alias và tập matched/missing | Báo lỗi taxonomy thiếu; kết quả có thứ tự ổn định; làm rõ bonus/nice-to-have và trường hợp không có required skills |
| models/tfidf_model.py | scikit-learn + cosine | Bỏ fallback Jaccard; tách fit/transform theo thiết kế đánh giá; kiểm tra token công nghệ |
| models/sbert_model.py | SentenceTransformer encode + cosine | Bỏ fallback token overlap; cấu hình model/ngôn ngữ/độ dài và lỗi tải rõ ràng |
| models/hybrid_model.py | Tách semantic/skill/experience | Validate trọng số, xử lý thông tin thiếu và thực nghiệm trọng số; khuyến nghị chỉ hỗ trợ người dùng |
| app.py | Hình dạng request/response hiện có | `true` gây NameError; giới hạn upload/validation; chưa đưa API vào lab ngày 1 |
| research/*.py | Công thức confusion matrix và xuất kết quả | Đầu vào phải là văn bản nguồn, không dựng từ cột matched/missing; lưu split/config/version và dự đoán từng cặp |

Đây là review code, chưa phải xác nhận các module đã chạy. Chưa sao chép hay sửa module chính.

## Đề xuất input/output để trao đổi với đồng đội

Trạng thái: **bản đề xuất, chưa được đồng đội xác nhận**. Đối chiếu với `webAI/Models/MatchingModels.cs` và schema Python hiện có.

- Input lõi: CV text, JD text, model_type; Hybrid thêm required_skills, nice_to_have_skills, kinh nghiệm và weights. Ghi rõ skills/kinh nghiệm do parser hay người dùng cung cấp. Trường chưa biết cần được biểu diễn riêng, không tự biến thành 0.
- Output chính giữ tên hiện có khi phù hợp: model_used, overall_score, breakdown, skill_analysis, experience_analysis, processing_time_ms. TF-IDF/SBERT không được hiển thị skill/experience mặc định 0 như thể đã đánh giá hai thành phần đó.
- Metadata giải thích đề xuất: model version, preprocessing version, weights_used, nguồn/bằng chứng trích xuất và cảnh báo giới hạn. Chốt schema cụ thể khi làm module tương ứng; không sửa DTO chính ngày 1.
- ID fixture là chuỗi `CV_001`/`JOB_001`, DTO hiện có nhận integer. Giữ ID nguồn trong lab; adapter tích hợp phải map với database ID, không âm thầm đổi hoặc bịa ID.
- Chỉ báo success khi phương pháp yêu cầu thật sự chạy; không trả điểm thay thế khi model thiếu.

## Bàn giao cho ngày 2

Ưu tiên sửa bản dữ liệu phát triển có version, truy nguồn các ID và kiểm tra nội dung liên kết trước khi gán nhãn/chia tập. Giữ dữ liệu nguồn bất biến. Chốt ngôn ngữ mục tiêu và yêu cầu fine-tuning với người làm đồ án trước khi chọn model nghiên cứu. Xác nhận contract với đồng đội vẫn là việc cần người dùng trao đổi.
