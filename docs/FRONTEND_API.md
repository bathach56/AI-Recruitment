# Frontend matching kết nối API

Giao diện giữ ASP.NET Razor Pages, HTML, JavaScript và Bootstrap 5.3 hiện có.
Không cần npm install hay frontend build riêng.

## Chạy

Thiết lập Python/model và khởi động hai service theo
[`backend test/BACKEND_API.md`](../backend%20test/BACKEND_API.md).
Mở frontend qua máy chủ ASP.NET, không mở HTML bằng `file://`:

- `/` hoặc `/index.html`: trang chủ.
- `/Candidate` hoặc `/candidate-portal.html`: đối chiếu một CV với JD tự nhập.
- `/Recruiter` hoặc `/recruiter-dashboard.html`: đối chiếu tối đa 10 CV, gửi lần lượt.
- `/Admin` hoặc `/admin-portal.html`: trạng thái dịch vụ, chưa có quản trị tài khoản.
- `/Results`: mở giao diện đối chiếu; không truy xuất kết quả cũ bằng query ID.

Các trang Razor và HTML dùng chung `wwwroot/partials/matching-workspace.html`,
`wwwroot/js/matching.js` và `wwwroot/css/theme.css`. Template tải từ cùng origin.

## Contract và hành vi

- Health gọi `GET /api/matching/health`.
- CV văn bản gọi `POST /api/matching/analyze` bằng JSON.
- Tệp gọi `POST /api/matching/analyze-file`; multipart có `file` và `request_json`.
- CV lấy từ tệp/văn bản thực tế, không dựng từ danh sách kỹ năng khớp giả lập.
- Tệp phải là PDF/DOCX, có nội dung, tối đa 10 MiB. Backend/parser kiểm tra tiếp.
- Hybrid mặc định 0.5/0.3/0.2. Trọng số chưa được xác thực thực nghiệm.
- `incomplete`/`overall_score=null` hiển thị thiếu dữ liệu, không đổi thành 0.
- Điểm 0 thật vẫn hiển thị 0; TF-IDF được gọi là tương đồng từ vựng.
- Lỗi, timeout và response sai định dạng không tạo điểm fallback.
- Thay đổi đầu vào sẽ xóa kết quả trước đó; khi đang gửi, form bị khóa.
- Bằng chứng dùng `textContent`, tránh thực thi HTML trong CV/phản hồi.
- Kết quả chỉ giữ trong bộ nhớ trang. Có thể tải JSON; JSON có thể chứa văn bản CV.
- Đăng nhập/đăng ký, việc làm, ứng tuyển, lưu lịch sử và cấu hình quản trị đang
  chờ API nghiệp vụ. Không mô phỏng thành công các chức năng này.

Font Be Vietnam Pro có fallback Segoe UI; Bootstrap, icons và font vẫn tải
từ CDN như thiết lập frontend hiện có. `enterprise.css` cung cấp các màu bề mặt,
gradient Indigo/Purple, ring Teal và trạng thái Emerald cho cả hai theme.
`theme.js` áp dụng Dark mode mặc định và lưu lựa chọn Light/Dark bằng localStorage;
nếu trình duyệt chặn lưu trữ, nút chuyển theme vẫn hoạt động trong trang.
Form chia hai tab JD/CV, giữ nguyên ID input và payload API; validation tự mở tab
chứa ô lỗi. Thẻ tệp hiển thị loại, tên, dung lượng và cho phép bỏ chọn.
Thanh hoạt họa chỉ thể hiện yêu cầu đang gửi/phân tích, không giả lập phần trăm
upload. Theme có focus rõ ràng, menu mobile và tôn trọng `prefers-reduced-motion`.

## Kiểm tra

```powershell
dotnet build webAI/webAI.csproj --no-restore
node --check webAI/wwwroot/js/matching.js
node --check webAI/wwwroot/js/account.js
node --test webAI/tests/frontend-api.test.cjs
```

Test JavaScript kiểm tra contract với phản hồi fixture, không đo chất lượng AI.
Kiểm tra thủ công thêm: nhập JD trống, CV trống, tệp sai định dạng/quá lớn,
Hybrid thiếu kinh nghiệm, ba phương pháp, lỗi 503 khi Python tắt, upload nhiều
tệp và bố cục mobile. Để xác nhận suy luận thật, chạy lại với Python/model theo
runbook; phản hồi fixture không thay thế bước này.
