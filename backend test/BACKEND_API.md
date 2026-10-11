# Backend matching thật — chạy local

## Khởi động

Chạy từ gốc project, mở hai terminal:

```powershell
# Terminal 1: API dùng đúng lõi đã kiểm thử; model nạp một lần khi khởi động
& './backend test/.venv/Scripts/python.exe' -m uvicorn api:app --app-dir 'backend test' --host 127.0.0.1 --port 8000

# Terminal 2: ASP.NET
dotnet run --project webAI --no-launch-profile --urls http://127.0.0.1:5000
```

Không chạy đồng thời `ai-service/app.py` cũ ở cổng 8000. Phiên bản cũ chưa chuyển
sang lõi kiểm chứng và có benchmark dựng đầu vào từ nhãn. API mới chủ động trả
409 cho benchmark thay vì sinh metrics không hợp lệ. Hiện lõi vẫn có một bản
duy nhất tại `backend test/core`; đây là tích hợp local trước khi đóng gói chuyển
sang `ai-service`, không phải bản triển khai production.

ASP.NET dùng cấu hình `AiService:BaseUrl` (biến môi trường `AiService__BaseUrl`),
mặc định `http://127.0.0.1:8000`; timeout gọi AI là 60 giây.

## Contract

- `GET /api/matching/health`: 200 khi Python sẵn sàng, 503 khi không kết nối được.
- `POST /api/matching/analyze`: JSON văn bản CV/JD.
- `POST /api/matching/analyze-file`: multipart, trường `file` là PDF/DOCX tối đa
  10 MiB, trường `request_json` chứa JSON mô tả JD/cấu hình như dưới đây.

```json
{
  "cv_text": "Python\nTotal experience: 5 years",
  "job_description": "Python developer",
  "required_skills": ["Python"],
  "nice_to_have_skills": [],
  "job_experience_years_required": 3,
  "model_type": "Hybrid",
  "weights": {"semantic_weight": 0.5, "skill_weight": 0.3, "experience_weight": 0.2}
}
```

Upload dùng nội dung file và bỏ qua `cv_text`. `cv_skills` và
`cv_experience_years` từ caller không được dùng để chấm; phải trích bằng chứng
từ CV. `job_description` là chính văn bản đầu vào semantic, không tự ghép thêm
trường để tránh thay đổi đầu vào âm thầm. Hỗ trợ đúng tên `TF-IDF`,
`Sentence-BERT`, `Hybrid`; tên khác trả 422.

Response có `model_used`, `overall_score`, `breakdown`, `status`,
`processing_time_ms` và `explanation` giữ cấu hình, bằng chứng, vector hoặc
feature contributions. Upload còn trả `document` chứa thông tin parser/hash.
`overall_score=null` với `status=incomplete` là xử lý thành công nhưng thiếu dữ
liệu để chấm tổng; frontend phải hiển thị chưa đủ dữ liệu. Không hiển thị 0%.
Các object legacy `skill_analysis`, `experience_analysis`, `ai_recommendation`
có thể null; giao diện matching mới phải dùng bằng chứng trong `explanation`.

Lỗi: 413 quá dung lượng, 415 sai loại file, 422 input không hợp lệ, 503 AI
không sẵn sàng/bận/lỗi inference, 504 timeout tại ASP.NET. Không trả stack trace
hoặc điểm fallback. Inference được giới hạn một tác vụ mỗi process; yêu cầu
đồng thời bị từ chối 503 để client chủ động thử lại.

## Kiểm tra

```powershell
dotnet build webAI/webAI.csproj --no-restore
& './backend test/.venv/Scripts/python.exe' -m unittest discover -s 'backend test/tests' -v
& './backend test/.venv/Scripts/python.exe' 'backend test/scripts/smoke_backend.py'
```

Smoke test mở cổng loopback 18000/18001, đối chiếu điểm Python/ASP.NET cho cả ba
phương pháp, kiểm tra upload DOCX, null, model sai và tắt Python không sinh điểm
fallback. Script tự dừng các process do nó tạo; báo cáo ở `reports/backend_smoke.json`.

## Phần còn lại trước khi gọi là backend hoàn chỉnh

- Chưa lưu kết quả matching vào SQL Server; chưa có lịch sử bền vững sau restart.
- Luồng mới là API local, chưa kiểm thử giao diện web gọi nó.
- Chưa có xác thực/phân quyền cho các endpoint này; không mở ra Internet.
- `api/cv/upload` và trang chấm chất lượng CV cũ thuộc luồng mô phỏng riêng,
  chưa thay bằng phân tích thật; không dùng kết quả đó để báo cáo nghiên cứu.
- Chưa đánh giá độ chính xác trên ground truth; chưa hỗ trợ OCR hay kinh nghiệm
  diễn đạt tự do. Các việc này không thể được xác nhận bằng việc API trả 200.

Phần nghiệp vụ người dùng/SQL cần phối hợp với đồng đội, giữ kiến trúc ASP.NET
+ SQL Server hiện có. Không tạo một kho dữ liệu khác chỉ để thay thế tạm.
