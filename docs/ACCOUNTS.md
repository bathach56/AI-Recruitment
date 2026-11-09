# Tài khoản và phân quyền

Ứng dụng dùng cookie ASP.NET Core, PasswordHasher và SQL Server. Vai trò và subject do backend cấp từ bảng USERS; không lấy vai trò đăng nhập từ JavaScript hoặc localStorage. Chỉ cho đăng ký Candidate hoặc Recruiter. API thay đổi dữ liệu tài khoản/workspace yêu cầu antiforgery token; đăng nhập/đăng ký giới hạn 15 yêu cầu/phút/IP.

Khách được xem danh sách và chi tiết tin tuyển dụng, đăng nhập và đăng ký. Truy cập trực tiếp Candidate/Recruiter/Matching khi chưa đăng nhập sẽ chuyển tới Login. API bảo vệ trả 401; truy cập sai vai trò trả 403.

- Candidate: lưu hồ sơ, tải/lấy CV riêng, tạo CV để in PDF, lưu/bỏ lưu việc, ứng tuyển bằng CV của mình, xem trạng thái và thông báo.
- Recruiter: lưu thông tin công ty, gửi giấy tờ xác minh, tạo tin nháp, đăng/đóng tin của mình sau xác minh, xem CV đã ứng tuyển vào tin của mình, cập nhật trạng thái và gửi phản hồi trên web. Công cụ đối chiếu CV/JD dùng AI service hiện có.
- Admin: chỉ bảo vệ trang Admin hiện có; không tạo tài khoản Admin hoặc thêm hệ thống duyệt mới trong thay đổi này.

Tin minh họa không nhận hồ sơ. Công ty chưa được xác minh chỉ lưu tin nháp; gửi giấy tờ không tự chuyển thành Verified. Chưa tích hợp Gmail/OAuth và quên mật khẩu. Nhà tuyển dụng có thể xét CV hàng loạt theo JD, lọc/sắp xếp và xuất XLSX trong Kết quả xét CV. API chấm điểm ngẫu nhiên cũ `/api/cv/upload` và `/api/cv/result/{id}` đã ngừng, trả HTTP 410.

## Bộ dữ liệu kiểm thử hiện tại

Giữ tài khoản `congty@recruitai.test`, công ty **RecruitAI Engineering Lab (kiểm thử)**, với 3 tin Backend, Frontend và Database. Sáu tài khoản `backend1`, `backend2`, `frontend1`, `frontend2`, `database1`, `database2` tại miền `recruitai.test` có CV PDF riêng và mỗi tài khoản nộp đúng một tin tương ứng. Tài khoản `ungvien@recruitai.test` và bộ mẫu cũ đã được thay thế.

Mật khẩu được sinh ngẫu nhiên, băm bằng PasswordHasher trong SQL; tệp thông tin đăng nhập cục bộ ở `webAI/App_Data/scenario-accounts.json`, được Git bỏ qua. Mật khẩu tài khoản công ty được giữ nguyên. Không đưa các mật khẩu hoặc database lên GitHub.

Năm công ty bổ sung: Aurora Cloud, Sen Commerce, Cobalt Security, Mây Design và Bình Minh Media. Mỗi công ty có một JD khác nhau để thử bộ lọc; các tin này được đánh dấu minh họa và không nhận ứng tuyển.

Tài khoản công ty chính được gán Verified **chỉ trong bộ fixture LocalDB này** để thử luồng đăng tin và ứng tuyển; đây không phải xác minh doanh nghiệp ngoài đời. Ba tin chính ghi rõ dữ liệu kiểm thử nhưng dùng luồng ứng tuyển thực của ứng dụng. Cơ chế xác minh tài khoản mới không thay đổi.

Công cụ `tools/DemoScenario` chỉ chạy thủ công bằng `--replace-demo-data <repository-root>`, sao lưu SQL với COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY trước khi thay dữ liệu cũ; không chạy khi khởi động web và từ chối tạo trùng tài khoản mới. CV và kết quả AI nằm trong App_Data. Xem `docs/LOCAL_SCENARIO.md` để tái hiện kiểm tra.

## Nâng cấp database hiện hữu

Repository chưa có EF migrations. `AccountSetup` chạy lệnh SQL bổ sung bảng USERS nếu chưa có, không xóa/chỉnh sửa dữ liệu cũ. Bảng này dùng entity User sẵn có, bỏ các navigation thuộc schema cũ khỏi context đang hoạt động. Khi bắt đầu dùng migrations cần baseline schema thực tế trước.

Chạy từ thư mục webAI sau khi build:

```powershell
dotnet ../.preview-build-auth/webAI.dll --initialize-accounts --environment Development
```

Muốn tạo tài khoản thử, cấp cấu hình `TestAccounts__Candidate__Email`, `TestAccounts__Candidate__Password` và cặp tương ứng cho Recruiter qua biến môi trường trước lệnh trên. Tài khoản đã tồn tại giữ nguyên mật khẩu. Không đưa mật khẩu vào source hoặc appsettings.

Tệp riêng lưu dưới `webAI/App_Data/documents`, ngoài wwwroot và được Git bỏ qua. API tải CV kiểm tra chính chủ hoặc công ty đã nhận đúng CV qua ứng tuyển. Kiểm tra loại, kích thước, signature; DOCX được kiểm tra ZIP/XML. Upload chỉ lưu tài liệu, chưa phân tích nội dung hay tạo điểm AI.

## Kiểm tra

`node --test webAI/tests/accounts.integration.cjs` chạy khi có `TEST_CANDIDATE_PASSWORD` và `TEST_RECRUITER_PASSWORD`. Mặc định dùng localhost:5132 và email `backend1@recruitai.test`, `congty@recruitai.test`; đổi ứng viên bằng `TEST_CANDIDATE_EMAIL`, đổi URL bằng `TEST_BASE_URL`. Bài kiểm tra tạo một tin nháp mang tên “Bản nháp kiểm tra tài khoản” và CV kiểm thử; cần dọn các fixture này sau khi chạy. Không dùng bài kiểm tra này trên production.

Kiểm tra frontend sẵn có: `node --test webAI/tests/frontend-api.test.cjs webAI/tests/personalization.test.cjs webAI/tests/status.test.cjs`.
