# Tài khoản và phân quyền

Ứng dụng dùng cookie ASP.NET Core, PasswordHasher và SQL Server. Vai trò và subject do backend cấp từ bảng USERS; không lấy vai trò đăng nhập từ JavaScript hoặc localStorage. Chỉ cho đăng ký Candidate hoặc Recruiter. API thay đổi dữ liệu tài khoản/workspace yêu cầu antiforgery token; đăng nhập/đăng ký giới hạn 15 yêu cầu/phút/IP.

Khách được xem danh sách và chi tiết tin tuyển dụng, đăng nhập và đăng ký. Truy cập trực tiếp Candidate/Recruiter/Matching khi chưa đăng nhập sẽ chuyển tới Login. API bảo vệ trả 401; truy cập sai vai trò trả 403.

- Candidate: lưu hồ sơ, tải/lấy CV riêng, tạo CV để in PDF, lưu/bỏ lưu việc, ứng tuyển bằng CV của mình, xem trạng thái và thông báo.
- Recruiter: lưu thông tin công ty, gửi giấy tờ xác minh, tạo tin nháp, đăng/đóng tin của mình sau xác minh, xem CV đã ứng tuyển vào tin của mình, cập nhật trạng thái và gửi phản hồi trên web. Công cụ đối chiếu CV/JD dùng AI service hiện có.
- Admin: chỉ bảo vệ trang Admin hiện có; không tạo tài khoản Admin hoặc thêm hệ thống duyệt mới trong thay đổi này.

Tin minh họa không nhận hồ sơ. Công ty chưa được xác minh chỉ lưu tin nháp; gửi giấy tờ không tự chuyển thành Verified. Chưa tích hợp Gmail/OAuth và quên mật khẩu. Nhà tuyển dụng có thể xét CV hàng loạt theo JD, lọc/sắp xếp và xuất XLSX trong Kết quả xét CV. API chấm điểm ngẫu nhiên cũ `/api/cv/upload` và `/api/cv/result/{id}` đã ngừng, trả HTTP 410.

## Bộ dữ liệu kiểm thử hiện tại

Ngày 11/11/2026 đã thay toàn bộ dữ liệu hoạt động theo yêu cầu: đúng **5 tài khoản ứng viên, 5 CV PDF khác nhau, 5 tài khoản công ty và 5 JD**. Các tài khoản cũ, gồm `congty@recruitai.test`, `backend1`, `frontend1`, `database1` và các tài khoản cùng bộ trước đó, không còn đăng nhập được. Cookie của tài khoản đã xóa bị thu hồi khi truy cập lại.

| Ngành | Ứng viên | Email ứng viên | Công ty | Email công ty |
|---|---|---|---|---|
| Kinh doanh | Nguyễn Hoàng Nam | kinhdoanh@recruitai.test | Thương mại An Phát | congty.kinhdoanh@recruitai.test |
| Thiết kế | Trần Ngọc Linh | thietke@recruitai.test | Sáng tạo Mộc | congty.thietke@recruitai.test |
| Công nghệ | Lê Minh Khang | congnghe@recruitai.test | Phần mềm Sao Việt | congty.congnghe@recruitai.test |
| Tiếp thị | Phạm Thu Hà | tiepthi@recruitai.test | Truyền thông Hướng Dương | congty.tiepthi@recruitai.test |
| Dữ liệu | Võ Gia Bảo | dulieu@recruitai.test | Phân tích Minh Tri | congty.dulieu@recruitai.test |

Mỗi tài khoản có mật khẩu ngẫu nhiên riêng, được băm bằng PasswordHasher trong SQL. **Mở [bảng mật khẩu cục bộ](../webAI/App_Data/TEST_ACCOUNTS_LOCAL.md)** để đăng nhập. Dữ liệu máy đọc ở `webAI/App_Data/scenario-accounts.json` dùng các trường `email`, `password`, `name`, `group`, `role`. Toàn bộ App_Data được Git bỏ qua; không đưa mật khẩu hoặc database lên GitHub.

Cả 5 công ty có tên kèm “(kiểm thử)”, được gán Verified **chỉ trong LocalDB này** và có tin nhận được ứng tuyển để thử luồng thật. JD và CV đều ghi rõ giả lập. Không có xác minh doanh nghiệp ngoài đời; cơ chế xác minh tài khoản tự đăng ký không thay đổi. Chưa tạo sẵn đơn ứng tuyển, thông báo hoặc kết quả AI.

Công cụ mới chỉ chạy thủ công bằng `--reset-five-sectors <repository-root> --confirm-reset`; có sao lưu SQL COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY trước khi thay trong giao dịch. Không DROP hoặc đặt lại identity. CV được lưu trong SQL; bản PDF/PNG kiểm tra ở `webAI/App_Data/five-sector-cvs`. Chi tiết bản sao lưu và ID ở `webAI/App_Data/five-sector-reset.json`. Hướng dẫn bộ mới: [BO_TEST_5_LINH_VUC.md](BO_TEST_5_LINH_VUC.md).

## Nâng cấp database hiện hữu

Repository chưa có EF migrations. `AccountSetup` chạy lệnh SQL bổ sung bảng USERS nếu chưa có, không xóa/chỉnh sửa dữ liệu cũ. Bảng này dùng entity User sẵn có, bỏ các navigation thuộc schema cũ khỏi context đang hoạt động. Khi bắt đầu dùng migrations cần baseline schema thực tế trước.

Chạy từ thư mục webAI sau khi build:

```powershell
dotnet ../.preview-build-auth/webAI.dll --initialize-accounts --environment Development
```

Muốn tạo tài khoản thử, cấp cấu hình `TestAccounts__Candidate__Email`, `TestAccounts__Candidate__Password` và cặp tương ứng cho Recruiter qua biến môi trường trước lệnh trên. Tài khoản đã tồn tại giữ nguyên mật khẩu. Không đưa mật khẩu vào source hoặc appsettings.

Tài liệu riêng lưu trong SQL `Documents`, có nội dung nhị phân và SHA-256. API tải CV kiểm tra chính chủ hoặc công ty đã nhận đúng CV qua ứng tuyển. Kiểm tra loại, kích thước, signature; DOCX được kiểm tra ZIP/XML. Upload chỉ lưu tài liệu, chưa tạo điểm AI. Thư mục `webAI/App_Data/documents` giữ tệp cũ dự phòng, không còn là nguồn đọc của web. Xem `docs/CHAY_LOCAL.md` để chuyển database cũ hoặc sao lưu.

## Kiểm tra

Bộ mới: `node tools/DemoScenario/verify-five-sectors.cjs` kiểm tra 10 lượt đăng nhập, CV/JD và phân quyền, chỉ đọc dữ liệu. Các integration test cũ mặc định dùng `backend1@recruitai.test`/`congty@recruitai.test` thuộc bộ đã lưu trữ; không dùng trực tiếp để kiểm tra bộ 5 lĩnh vực mới.

Kiểm tra frontend sẵn có: `node --test webAI/tests/frontend-api.test.cjs webAI/tests/personalization.test.cjs webAI/tests/status.test.cjs`.
