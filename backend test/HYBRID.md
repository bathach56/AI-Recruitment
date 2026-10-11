# Hybrid: công thức và bằng chứng

Chạy tại thư mục gốc project:

```powershell
& './backend test/.venv/Scripts/python.exe' 'backend test/scripts/run_hybrid.py'
```

Thêm `--output <file JSON mới>` để lưu; file đã tồn tại sẽ không bị ghi đè.
Thay trọng số bằng `--weights 0.5 0.3 0.2` theo thứ tự semantic, kỹ năng, kinh nghiệm.
Đây là giả định khởi đầu để thử nghiệm, chưa phải trọng số tốt nhất.

Đã chạy demo CV_001/JOB_001: semantic 82,9727; kỹ năng 81,4815;
kinh nghiệm 100. Đóng góp lần lượt 41,4863 + 24,4444 + 20 = 85,9308/100.
Kết quả lưu ở `../research/backend_test/hybrid_dev_v1/result.json`;
`review_required=true`. Toàn bộ 44 tests đạt, gồm 6 tests Hybrid và kiểm thử
SBERT local; đây là kiểm chứng kỹ thuật, chưa phải đánh giá chất lượng nghiên cứu.

Điểm tổng = semantic × 0,5 + kỹ năng × 0,3 + kinh nghiệm × 0,2.
Các điểm thành phần đều trên thang 0–100. Trọng số được chuẩn hóa theo tổng;
không chấp nhận số âm, NaN, vô hạn hoặc tổng trọng số bằng 0.

Kết quả JSON giữ điểm, trọng số, đóng góp từng thành phần, embedding/chunks,
bằng chứng kỹ năng, trường kinh nghiệm và SHA256 đầu vào. SBERT chạy local;
lỗi model được báo trực tiếp, không chuyển âm thầm sang cách tính khác.

Nếu thành phần có trọng số dương trả `null`, điểm tổng cũng là `null`, trạng thái
`incomplete`. Không tự đổi trọng số hoặc biến dữ liệu thiếu thành 0. Điều này
cũng áp dụng khi JD không có yêu cầu kinh nghiệm/kỹ năng; người thực nghiệm có
thể chủ động chọn cấu hình bỏ thành phần đó bằng trọng số 0, nhưng phải ghi lại
cấu hình và không so sánh các điểm khác cấu hình như cùng một thước đo.

`computed` chỉ nghĩa là tính được công thức. `review_required` vẫn bật nếu có
kỹ năng cần rà soát. Tổng kinh nghiệm tự khai không chứng minh kinh nghiệm liên
quan tới JD. Điểm không phải accuracy, xác suất trúng tuyển hoặc quyết định tuyển dụng.

## Trình bày với hội đồng

1. Mở văn bản CV/JD gốc, sau đó đối chiếu `cv_segments` và `semantic.jd_chunks`.
2. Xem `scores`, `normalized_weights`, `contributions`; cộng các đóng góp để kiểm tra điểm tổng.
3. Xem bằng chứng từng kỹ năng, phân biệt chưa tìm thấy và cần rà soát.
4. Xem số năm trích xuất và nguồn trường, chỉ rõ giới hạn trích xuất hiện tại.
5. Thử cấu hình trọng số khác có ghi nhận. Kiểm thử đơn vị giữ semantic/kinh nghiệm
   cố định và giảm kỹ năng 50 điểm: tổng giảm 15 điểm với trọng số kỹ năng 0,3.
   Đây là kiểm tra công thức, không phải kết quả thực nghiệm trên CV thật.

## Đối chiếu phạm vi đã mô tả trong AGENTS.md

| Nội dung | Bằng chứng hiện có | Việc còn phải kiểm chứng |
|---|---|---|
| Đọc CV PDF/DOCX | Parser và kiểm thử trong lab | CV thực tế nhiều bố cục; PDF scan chưa có OCR |
| TF-IDF, pretrained SBERT | Module và demo local | Đánh giá chung trên tập nhãn đã rà soát |
| Kỹ năng khớp/chưa tìm thấy | Bằng chứng và vị trí văn bản | Alias/ngữ cảnh, độ bao phủ taxonomy |
| Kinh nghiệm | Trường số năm khai rõ | Mô tả tự do, lịch sử chồng lấn, mức liên quan JD |
| Hybrid giải thích được | Công thức, thành phần và đóng góp | Chọn trọng số bằng validation, đánh giá test giữ riêng |
| Precision/Recall/F1 | Chưa có kết quả hợp lệ của lab | Hoàn tất nhãn, chia tập, khóa ngưỡng và chạy đánh giá |
| Web gọi AI và lưu kết quả | Chưa kiểm chứng xuyên suốt ở bước này | HTTP, upload, timeout, SQL, đối chiếu kết quả với lab |
| Fine-tuning | Chưa thực hiện | Chốt yêu cầu, chuẩn bị dữ liệu và so sánh nếu nằm trong phạm vi |

Bảng này đối chiếu tài liệu dự án hiện có, không xác nhận đầy đủ bản báo cáo đã
nộp cho thầy vì chưa có nội dung bản đó để đối chiếu. Dữ liệu thực tế cần thử
trước khi hoàn thiện giao diện. Chỉ chuyển lõi sang ứng dụng chính sau khi kiểm
chứng; sau chuyển phải kiểm tra cùng CV/JD cho kết quả tương đương lab.
