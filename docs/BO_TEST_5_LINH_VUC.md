# Bộ test mới: 5 lĩnh vực

Ngày tạo: 11/11/2026. Tất cả tên người, doanh nghiệp, kinh nghiệm và JD là giả lập để kiểm thử đồ án; không phải dữ liệu nghiên cứu có nhãn hoặc tin tuyển dụng thật.

## Dữ liệu hoạt động

- 10 tài khoản: 5 Candidate và 5 Recruiter, mật khẩu riêng.
- 5 công ty có một JD công khai riêng: kinh doanh, thiết kế, công nghệ, tiếp thị, dữ liệu.
- 5 CV PDF tiếng Việt khác nhau, mỗi ứng viên sở hữu một bản. Có kinh nghiệm, kỹ năng, dự án và học vấn.
- Chưa có đơn ứng tuyển, việc đã lưu, đợt xét, kết quả AI, phản hồi hoặc thông báo. Bạn tự thao tác để kiểm tra luồng từ đầu.
- Không giữ tài khoản công ty chính hoặc tài khoản Admin cũ. Các tài khoản tự đăng ký sau này dùng cơ chế hiện tại.

Danh sách email: [ACCOUNTS.md](ACCOUNTS.md). Mật khẩu: [tệp cục bộ không đưa lên Git](../webAI/App_Data/TEST_ACCOUNTS_LOCAL.md).

## Cách test

1. Mở web local, đăng nhập một ứng viên. Vào CV của tôi để xem PDF đã lưu.
2. Chọn một JD trên trang chủ và nộp CV. Có thể nộp cả đúng ngành và chéo ngành để so sánh chức năng; không suy ra chất lượng mô hình chỉ từ các ví dụ này.
3. Đăng nhập công ty nhận CV. Mục hồ sơ và Đối chiếu CV & JD chỉ hiện hồ sơ đã gửi vào JD của công ty đó.
4. Tạo đợt xét; cần Python AI service đang chạy để có điểm thật. Có thể bổ sung PDF/DOCX hoặc Excel từ bên ngoài. Bộ mới chưa chạy AI, không có điểm giả.
5. Vào Kết quả xét CV, chọn đợt, xem lại CV, đọc bằng chứng và tải Excel. Gửi kết quả trên web cho ứng viên đã ứng tuyển, rồi đăng nhập ứng viên để xem thông báo.

Kiểm tra chỉ đọc sau khi tạo:

```powershell
node tools/DemoScenario/verify-five-sectors.cjs
```

Khi đã tự nộp đơn, kiểm tra trên có thể không còn đạt điều kiện “trống đơn ứng tuyển”; đó là điều kiện dành riêng cho bộ vừa tạo.

## Sao lưu và tái tạo

Bản sao trước khi thay: `webAI/App_Data/backups/sql-20261111-115755-1ac164/AIRecruitmentDb.bak`. Đã xác minh bằng RESTORE VERIFYONLY; tệp bao gồm tài liệu trong SQL. Thông tin đăng nhập cũ được sao chép cùng thư mục để phục hồi khi cần, không còn dùng cho web hiện tại.

Nguồn dữ liệu: `tools/DemoScenario/five-sectors.json`. CV PDF/PNG: `webAI/App_Data/five-sector-cvs`. Báo cáo ID và SHA-256: `webAI/App_Data/five-sector-reset.json`; kiểm tra HTTP: `webAI/App_Data/five-sector-check.json`.

Không chạy lại các lệnh sau nếu chỉ muốn mở web: chúng **xóa toàn bộ dữ liệu hoạt động**, sau khi sao lưu. Dừng web trước khi chạy để tránh ghi đồng thời.

```powershell
& '.\backend test\.venv\Scripts\python.exe' tools/DemoScenario/create_cvs.py --five-sectors
dotnet build tools/DemoScenario/DemoScenario.csproj -p:UseAppHost=false -o .preview-build-check/five-sectors
dotnet .preview-build-check/five-sectors/DemoScenario.dll --reset-five-sectors (Get-Location).Path --confirm-reset
```

Giao dịch thay dữ liệu không xóa bảng hoặc tái sử dụng ID cũ. Mật khẩu dùng PasswordHasher như luồng đăng ký; cookie của tài khoản bị xóa không còn truy cập được dữ liệu. Bản PDF đã được trích xuất văn bản, render và kiểm tra bố cục trước khi lưu.
