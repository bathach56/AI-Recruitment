# Frontend matching kết nối API

Giao diện giữ ASP.NET Razor Pages, HTML, JavaScript và Bootstrap 5.3 hiện có.
Không cần npm install hay frontend build riêng.

## Chạy

Thiết lập Python/model và khởi động hai service theo
[`backend test/BACKEND_API.md`](../backend%20test/BACKEND_API.md).
Mở frontend qua máy chủ ASP.NET, không mở HTML bằng `file://`:

- `/` hoặc `/index.html`: trang chủ.
- `/Candidate` hoặc `/candidate-portal.html`: chọn một CV trên thiết bị; không nhập JD, chọn mô hình hoặc phân tích. Nút gửi bị vô hiệu hóa vì chưa có API tiếp nhận hồ sơ.
- `/Recruiter` hoặc `/recruiter-dashboard.html`: đối chiếu tối đa 10 CV, gửi lần lượt.
- `/Admin` hoặc `/admin-portal.html`: trạng thái dịch vụ, chưa có quản trị tài khoản.
- `/Results`: mở giao diện đối chiếu dành cho tuyển dụng; không truy xuất kết quả cũ bằng query ID.

Các trang tuyển dụng Razor và HTML dùng chung `wwwroot/partials/matching-workspace.html`,
`wwwroot/js/matching.js` và `wwwroot/css/theme.css`. Template tải từ cùng origin.

Trang ứng viên dùng `wwwroot/js/candidate.js` để kiểm tra tệp rỗng, định dạng và kích thước trước khi chọn; không gọi API, không lưu tệp và không tạo kết quả giả. Đây là tách chức năng giao diện, chưa phải phân quyền bảo mật. Các trang/API tuyển dụng chưa được bảo vệ bằng đăng nhập hoặc role phía backend.

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
- Thay đổi đầu vào giữ kết quả trước đó với thông báo dữ liệu đã thay đổi. Phân tích mới thay kết quả cũ; khi đang gửi, form bị khóa.
- Bằng chứng dùng `textContent`, tránh thực thi HTML trong CV/phản hồi.
- Kết quả chỉ giữ trong bộ nhớ trang. Có thể tải JSON; JSON có thể chứa văn bản CV.
- Đăng nhập/đăng ký, việc làm, ứng tuyển, lưu lịch sử và cấu hình quản trị đang
  chờ API nghiệp vụ. Không mô phỏng thành công các chức năng này.

Thiết kế Swiss editorial dùng Be Vietnam Pro, trắng/xám trung tính và cobalt.
`enterprise.css` giữ semantic tokens cho hai theme; `theme.css` giữ layout/component.
Light là mặc định; lựa chọn Light/Dark được lưu bằng localStorage. Font, Bootstrap
và Bootstrap Icons vẫn dùng CDN; font có fallback Helvetica Neue/Arial.

Form chia hai bước JD/CV, giữ ID input và payload API. Tiếp tục kiểm tra JD trước
khi mở CV; nút phân tích chỉ xuất hiện ở bước CV. Bảng kết quả đặt yêu cầu, bằng
chứng và trạng thái cạnh nhau; trên mobile chuyển thành các hàng có nhãn.
Không dùng vòng điểm hoặc gradient. Loading chỉ biểu thị request đang xử lý.
Tài khoản vẫn chưa khả dụng; biểu mẫu bị vô hiệu hóa nằm trong phần xem trước.
Đọc `../DESIGN.md` và `FRONTEND_REDESIGN.md` để biết quy ước và phạm vi xác minh.

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
