# Bàn giao phần AI cho đồng đội

Đọc `../AGENTS.md` trước khi sửa. Phạm vi bàn giao là lõi AI và kết nối API local;
không phải backend nghiệp vụ hoặc bản sẵn sàng triển khai công khai.

## Bắt đầu

1. Đọc [BACKEND_API.md](BACKEND_API.md), chạy hai terminal theo hướng dẫn.
2. Gửi [examples/match.json](examples/match.json) tới ASP.NET:

```powershell
# Chạy từ gốc project sau khi bật hai service
curl.exe --fail-with-body -H "Content-Type: application/json" --data-binary "@backend test/examples/match.json" http://127.0.0.1:5000/api/matching/analyze

# Upload file thật; cv_text trong JSON bị bỏ qua khi dùng endpoint này
curl.exe --fail-with-body -F "file=@data/sample_cvs/CV_NguyenVanAn_Senior_DotNet.docx" -F "request_json=<backend test/examples/match.json" http://127.0.0.1:5000/api/matching/analyze-file
```

Mẫu request dùng JD Python để kiểm tra contract; không phải JD chuẩn của CV .NET
trong lệnh upload. Không dùng cặp này để kết luận chất lượng mô hình.

Trên máy mới cần tạo lại `.venv`, cài dependencies, tải model bằng
`scripts/download_sbert.py`. Không chỉ gửi mã Python: API còn cần
`data/skills_taxonomy.json`, `data/development_v1/{manifest.json,cvs/,jds/}` và
`.cache/sbert` gồm model cùng provenance. Giữ cấu trúc thư mục tương đối hiện tại.
`requirements-lock.txt` ghi môi trường đã dùng; phải kiểm tra lại nếu đổi OS/Python.

## Các file project chính đã sửa trước bàn giao

| File dưới `webAI/` | Thay đổi cần giữ khi ghép code |
|---|---|
| `Controllers/MatchingController.cs` | Analyze JSON, analyze-file multipart, health và ánh xạ lỗi |
| `Services/AiMatchingService.cs` | Gọi Python thật, timeout 60 giây, không fallback C# |
| `Services/IAiMatchingService.cs` | Thêm contract gọi upload matching |
| `Models/MatchingModels.cs` | Điểm có thể null, giữ explanation qua extension data, trọng số 0,5/0,3/0,2 |

Đối chiếu và ghép từng thay đổi vào nhánh của đồng đội, không ghi đè toàn bộ các
file nếu đồng đội đã phát triển thêm. Chưa có commit bàn giao; thư mục làm việc
trước đó không được Git nhận diện là repository.

## Cách dùng response

| Trường | Cách xử lý |
|---|---|
| `success` | Request xử lý được; không chứng minh ứng viên phù hợp |
| `status=incomplete`, `overall_score=null` | Hiển thị chưa đủ dữ liệu, không đổi thành 0 |
| `breakdown` | Điểm thành phần; TF-IDF dùng trường semantic_score cho điểm tương đồng từ vựng, không gọi nó là hiểu ngữ nghĩa |
| `explanation.skills.requirements` (Hybrid) | Kỹ năng khớp, chưa tìm thấy hoặc cần rà soát, kèm evidence |
| `explanation.experience` (Hybrid) | Số năm và trạng thái; không tự suy ra kinh nghiệm đúng chuyên môn |
| `explanation.normalized_weights`, `contributions` (Hybrid) | Giải thích phép tính tổng |
| `document` (upload) | Văn bản, segments và hash parser; chứa dữ liệu CV cần bảo vệ |

Các trường legacy skill_analysis/experience_analysis/ai_recommendation có thể
null. Không dựng nhãn tuyển/loại từ điểm hoặc dùng các trường rỗng đó thay bằng chứng.
Chi tiết TF-IDF và SBERT có cấu trúc khác Hybrid; chọn giao diện theo model_used.
Request `cv_id`/`job_id` hiện chỉ được trả lại, chưa xác minh với database hoặc quyền
sở hữu. Backend nghiệp vụ phải lấy CV/JD được phép truy cập từ server, không tin ID
và nội dung do client tự gửi. Trọng số nghiên cứu cần được khóa phía server khi đánh giá.

## Phần đồng đội phụ trách tiếp

- Đối chiếu entity hiện có trước khi thêm trường/migration SQL Server.
- Lưu liên kết CV/JD, thời điểm, model, trạng thái, điểm nullable, cấu hình và
  bằng chứng cần thiết. Đây là yêu cầu dữ liệu đề xuất, chưa phải schema đã có.
- Lưu snapshot/hash CV và JD để giải thích kết quả cũ khi JD thay đổi; bảo vệ
  nội dung CV, không ghi vào log công khai hoặc thư mục static.
- Thêm xác thực, phân quyền sở hữu, lịch sử kết quả và API truy xuất có kiểm soát.
- Nối giao diện vào `/api/matching/*`; luồng `/api/cv/upload` chấm chất lượng
  CV cũ vẫn là mô phỏng và không thuộc kết quả nghiên cứu mới.
- Khi đóng gói, chuyển lõi một lần sang ai-service và cập nhật import/test,
  tránh duy trì hai bản thuật toán khác nhau. Không khởi động app.py cũ nhầm cổng.

## Tiêu chí nhận bàn giao

- Chạy build và test theo BACKEND_API.md. Lần kiểm chứng trước bàn giao đạt
  54 tests Python, build .NET và 7 kiểm tra HTTP trong reports/backend_smoke.json.
  Đây là kết quả đã chạy trước đó, không phải cam kết máy mới tự động đạt.
- Chạy lại smoke_backend.py trên máy nhận; giữ cổng 18000/18001 trống.
- Kiểm tra thiếu kinh nghiệm vẫn null; model sai trả 422; Python tắt trả 503.
- Sau khi nối SQL, restart ứng dụng rồi kiểm tra lịch sử, quyền truy cập và
  điểm/bằng chứng vẫn giống response gốc.
- Sau khi nối UI, kiểm tra thông báo lỗi, trạng thái chờ và thiếu dữ liệu.

Chưa có kết quả Precision/Recall/F1 hợp lệ; bộ 200 cặp phát triển đang chờ gán
nhãn ở lần audit đã lưu. Fine-tuning chỉ là hướng phát triển, không phải việc
bắt buộc cho đợt này. Dữ liệu thật, OCR và kinh nghiệm mô tả tự do còn cần kiểm chứng.
