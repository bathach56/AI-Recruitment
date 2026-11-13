# Frontend matching kết nối API

> Ghi chép lịch sử của giai đoạn preview. Luồng hiện tại đã có xác thực/phân quyền, ứng tuyển và lưu kết quả theo JD; xem [Tài khoản](../ACCOUNTS.md), [Xét CV](SAVED_CV_REVIEWS.md) và [Kiểm thử AI thật](../archive/LOCAL_SCENARIO.md). Các mô tả chưa có API/phân quyền và giới hạn 10 CV bên dưới không còn áp dụng cho giao diện hiện tại.

Giao diện giữ ASP.NET Razor Pages, HTML, JavaScript và Bootstrap 5.3 hiện có.
Không cần npm install hay frontend build riêng.

## Chạy

Thiết lập Python/model và khởi động hai service theo
[`backend test/BACKEND_API.md`](../../backend%20test/BACKEND_API.md).
Mở frontend qua máy chủ ASP.NET, không mở HTML bằng `file://`:

- `/` hoặc `/index.html`: trang chủ.
- `/Candidate` hoặc `/candidate-portal.html`: ba bước thông tin cá nhân → chọn CV → xem trước; không nhập JD, chọn mô hình hoặc phân tích. Nút gửi bị vô hiệu hóa vì chưa có API tiếp nhận hồ sơ.
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
- Hybrid mặc định 0.5/0.3/0.2. Thanh kéo cho phép đổi từng trọng số; API chuẩn hóa theo tổng. Tổng phải lớn hơn 0. Trọng số chưa được xác thực thực nghiệm.
- `incomplete`/`overall_score=null` hiển thị thiếu dữ liệu, không đổi thành 0.
- Điểm 0 thật vẫn hiển thị 0; TF-IDF được gọi là tương đồng từ vựng.
- Lỗi, timeout và response sai định dạng không tạo điểm fallback.
- Thay đổi đầu vào giữ kết quả trước đó với thông báo dữ liệu đã thay đổi. Phân tích mới thay kết quả cũ; khi đang gửi, form bị khóa.
- Bằng chứng dùng `textContent`, tránh thực thi HTML trong CV/phản hồi.
- Kết quả chỉ giữ trong bộ nhớ trang. Có thể tải JSON; JSON có thể chứa văn bản CV.
- Đăng nhập/đăng ký, việc làm, ứng tuyển, lưu lịch sử và cấu hình quản trị đang
  chờ API nghiệp vụ. Không mô phỏng thành công các chức năng này.

Thiết kế theo concept Navy/Indigo–Violet, nền off-white, Sora cho tiêu đề và
Be Vietnam Pro cho nội dung. `product.css` ghi đè token/component dùng chung,
`home.css` dành cho bố cục trang chủ. Light là mặc định; lựa chọn Light/Dark
được lưu bằng localStorage. Font, Bootstrap và Bootstrap Icons vẫn dùng CDN,
không thêm thư viện JavaScript hoặc framework mới.

Trang tuyển dụng hiển thị JD và CV trong cột trái, kết quả ở cột phải. Kết quả
thật có vòng điểm, điểm thành phần, chip kỹ năng và bộ lọc tất cả/đã phân tích/
cần rà soát/lỗi. Null không vẽ thành 0%. Minh họa có điểm mẫu chỉ xuất hiện ở
hero trang chủ, được ghi rõ là dữ liệu minh họa. Không đưa điểm mẫu vào luồng API.

`personalization.js` chỉ ghi nhớ vai trò giao diện; tên và vị trí mong muốn được
lưu khi người dùng chọn checkbox ghi nhớ trên trang ứng viên. Khóa lưu là
`recruitai-preferences-v1`. Email, điện thoại và CV không lưu trong localStorage.
Có nút xóa thông tin đã ghi nhớ. Vai trò này không dùng để xác thực hoặc cấp quyền.
PDF được xem qua Blob URL trên thiết bị và được thu hồi khi thay tệp/rời trang;
DOCX chỉ hiển thị thông tin tệp vì chưa có trình xem DOCX. Hồ sơ chưa được gửi.

Dashboard hệ thống hiển thị kết nối API, AI, nhật ký và thời gian đo từ các lần
health request thật trong trang. Biểu đồ chỉ xuất hiện khi có ít nhất 2 lần kiểm
tra thành công. Chưa có kiểm tra trạng thái riêng từng mô hình hoặc số liệu độ chính xác.
Tài khoản vẫn chưa khả dụng; biểu mẫu bị vô hiệu hóa nằm trong phần xem trước.
Đọc `../DESIGN.md` và `FRONTEND_REDESIGN.md` để biết quy ước và phạm vi xác minh.

## Kiểm tra

```powershell
dotnet build webAI/webAI.csproj --no-restore
node --check webAI/wwwroot/js/matching.js
node --check webAI/wwwroot/js/account.js
node --test webAI/tests/frontend-api.test.cjs
node --test webAI/tests/personalization.test.cjs webAI/tests/status.test.cjs
dotnet run --project tests/HealthCancellationChecks
```

Kiểm tra C# mô phỏng rời trang khi health request đang chạy: request hủy kết thúc bình thường, không báo AI mất kết nối; request kế tiếp vẫn dùng được. Timeout và lỗi kết nối AI vẫn trả 503.

Test JavaScript kiểm tra contract với phản hồi fixture, không đo chất lượng AI.
Kiểm tra thủ công thêm: nhập JD trống, CV trống, tệp sai định dạng/quá lớn,
Hybrid thiếu kinh nghiệm, ba phương pháp, lỗi 503 khi Python tắt, upload nhiều
tệp và bố cục mobile. Để xác nhận suy luận thật, chạy lại với Python/model theo
runbook; phản hồi fixture không thay thế bước này.
