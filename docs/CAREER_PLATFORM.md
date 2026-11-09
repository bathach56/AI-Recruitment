# RecruitAI: nền tảng việc làm

## Phạm vi hiện tại

Ứng dụng dùng ASP.NET Core Razor Pages, HTML/CSS/JavaScript và SQL Server. Đăng nhập, đăng ký và các API workspace đã được nối; xem [Tài khoản và phân quyền](ACCOUNTS.md) để biết hành vi hiện tại. Các ghi chép thiết kế và contract bên dưới mô tả giai đoạn preview trước khi tích hợp tài khoản.

Đã hoạt động:
- Trang chủ đọc tin từ SQL Server qua `GET /api/jobs`, tìm kiếm không dấu theo vị trí/kỹ năng/công ty, lọc tỉnh/thành, ngành nghề, cách làm việc, kinh nghiệm, lương và nhu cầu tuyển. Sắp xếp mới nhất/lương cao/cần nhân lực.
- Chi tiết tin `/Jobs/{id}`, JD, yêu cầu, quyền lợi, thông tin tuyển và luồng xem trước ứng tuyển.
- Ứng viên: xem trước thông tin cá nhân; chọn/xem trước CV PDF, chọn DOCX; tạo CV bằng biểu mẫu và in/lưu PDF trên thiết bị.
- Nhà tuyển dụng: tổng quan, danh sách tin, soạn/xem trước JD; xem bố cục hồ sơ và xếp hạng; chuẩn bị hồ sơ doanh nghiệp; soạn/xem trước phản hồi.
- Đăng ký/đăng nhập chia vai trò ứng viên/doanh nghiệp, kiểm tra dữ liệu và sẵn bố cục cho nhà cung cấp OAuth sau này. Không gửi/lưu mật khẩu hoặc tạo đăng nhập giả.
- Sáng trắng–xanh lam, tối đen–xanh dương, lựa chọn theme lưu trong localStorage. Không lưu CV/thông tin cá nhân vào localStorage.
- Công cụ đối chiếu API AI cũ được giữ nguyên tại `/Matching`.

Đã bổ sung đăng ký/đăng nhập thật, lưu hồ sơ/CV, lưu việc, tin nháp và đăng tin sau xác minh, ứng tuyển và phản hồi web theo tài khoản. Chưa có OAuth/Gmail, quên mật khẩu, luồng duyệt doanh nghiệp trên UI, tự động xếp hạng hay xuất Excel. Tin minh họa không nhận ứng tuyển. Chi tiết xem [ACCOUNTS.md](ACCOUNTS.md).

## Chạy và SQL Server

Instance được kiểm tra trên máy: `(localdb)\MSSQLLocalDB`. Database riêng: `AIRecruitmentDb`; Windows Authentication, không có mật khẩu trong source. Không sửa database khác.

```powershell
dotnet build webAI/webAI.csproj -o .preview-build
dotnet .preview-build/webAI.dll --initialize-database
dotnet run --project webAI/webAI.csproj --launch-profile http
```

Khởi tạo là lệnh riêng, không chạy tự động mỗi lần web khởi động. `EnsureCreated` chỉ dùng cho nền schema đầu tiên vì repository chưa có migrations; không dùng để nâng cấp schema hiện hữu. Khi bổ sung nghiệp vụ, tạo baseline EF migrations theo schema đang có trước khi thay đổi. Sao lưu trước khi áp dụng thay đổi dữ liệu. Không tự xóa/tạo lại DB.

Cấu hình instance khác bằng `ConnectionStrings__Recruitment`. LocalDB thuộc tài khoản Windows: khởi động web bằng cùng tài khoản đã tạo database. Bản preview hiện dùng cổng `5132`.

Database chứa 9 bảng: Companies, Jobs, Candidates, Resumes, Applications, SavedJobs, Matches, Notifications, Verifications. Có khóa ngoại, unique candidate subject, unique ứng tuyển theo ứng viên/tin và nullable score. Chưa lưu hồ sơ cá nhân thật. Có 6 công ty và 8 tin mẫu với `IsDemo=true`; không sao chép tin thật của bên thứ ba và không nhận ứng tuyển vào tin mẫu.

## Thiết kế

- Nền `#F5F7FB`, bề mặt `#FFFFFF`, chữ `#18243D`, hành động `#1458E8`, chữ phụ `#637088`. Tối: nền `#080E19`, bề mặt `#101A2B`, chữ `#EDF3FF`, xanh `#79A9FF`, chữ phụ `#A4B2CA`.
- Be Vietnam Pro phục vụ tiếng Việt, một font với phân cấp rõ. Danh sách việc làm là trọng tâm; hero gọn, thanh tìm kiếm rộng; bộ lọc trái, danh sách giữa, hướng dẫn CV phải. Mobile gộp bộ lọc, sidebar thành thanh điều hướng ngang.
- Kế hoạch đã chỉnh bỏ hero quảng bá AI/điểm số để phục vụ tìm việc. Không dùng các số lượng tuyển dụng, đánh giá hoặc chứng nhận giả. Hình minh họa chỉ nói về công việc/CV.
- Địa điểm hiện là tỉnh/thành do người dùng chọn. Không gọi GPS, không gán khoảng cách gần giả. Muốn “gần tôi” theo km cần tọa độ công việc, quyền vị trí và thuật toán khoảng cách phía API.
- Tham khảo: [TopCV – luồng ứng tuyển](https://faq.topcv.vn/faqs/find-job-and-apply/quy-trinh-ung-tuyen-tren-topcv.html), [TopCV – trang tìm việc](https://www.topcv.vn/), [Indeed – tìm theo từ khóa/địa điểm](https://www.indeed.com/), [Indeed – theo dõi trạng thái](https://www.indeed.com/help/job-seekers/articles/204652920-applying-for-a-job-on-indeed?co=GB&hl=en). VietnamWorks chặn truy cập HTTP 403 nên không dùng làm bằng chứng đã kiểm tra giao diện.

## Contract dự kiến để gắn API được cung cấp sau

Các route dưới đây là đề xuất, chưa phải endpoint đang hoạt động. Điều chỉnh adapter theo contract backend thực tế thay vì tạo API trùng.

| Nghiệp vụ | Contract dự kiến | Ràng buộc |
|---|---|---|
| Tài khoản hiện tại | `GET /api/session` | Provider xác thực server; claim subject và role từ token đã xác minh |
| Đăng ký/đăng nhập | Provider OAuth/OIDC hoặc API được cung cấp | Ứng viên về `/`; doanh nghiệp về xác minh; không dùng role localStorage để cấp quyền |
| Hồ sơ ứng viên | `GET/PUT /api/candidate/profile` | Chỉ chính chủ; validation và giới hạn độ dài |
| CV | `GET/POST /api/candidate/resumes` | PDF/DOCX, 10 MiB; kiểm tra signature, parser; private storage, SQL metadata |
| Tin đã lưu | `GET/POST/DELETE /api/candidate/saved-jobs` | Khóa ghép candidate/job; không lưu dữ liệu cá nhân ở localStorage |
| Ứng tuyển | `POST /api/jobs/{id}/applications` | Job thật còn hạn; CV thuộc ứng viên; tránh nộp trùng |
| Theo dõi | `GET /api/candidate/applications` | Submitted, Reviewing, Interview, Offered, Rejected; không lộ thứ hạng người khác |
| Doanh nghiệp | `GET/PUT /api/recruiter/company` | Chủ sở hữu lấy từ identity, không từ client |
| Xác minh | `POST /api/recruiter/company/verification` | Giấy chứng nhận đăng ký doanh nghiệp, trạng thái Pending/Verified/Rejected; không tự duyệt |
| Tin tuyển | `GET/POST/PUT /api/recruiter/jobs` | Owner + role Recruiter + doanh nghiệp được xác minh trước khi đăng công khai |
| Hồ sơ nhận | `GET /api/recruiter/jobs/{id}/applications` | Company ownership; lấy điểm thật mới nhất, score null ở cuối |
| AI trên hồ sơ | Background job/service gọi AI matching hiện có | Lưu model, evidence, input version, score nullable; lỗi không tạo điểm fallback |
| Xuất Excel | `GET /api/recruiter/jobs/{id}/applications/export` | XLSX thật; dữ liệu cùng bộ lọc/thứ tự; quyền owner; chống formula injection |
| Phản hồi | `POST /api/recruiter/applications/{id}/responses` | Lưu thông báo web; email tạo outbox; không tự chọn ứng viên bằng AI |
| Gmail | OAuth Gmail + email outbox | Secret ngoài Git; token mã hóa; email trạng thái Pending/Sent/Failed, retry idempotent |

OAuth/OIDC chưa được tích hợp. Đăng nhập email/mật khẩu và cookie đã hoạt động; cookie chứa subject và vai trò từ SQL, không lấy từ localStorage. Không giả định “AuthAO” là một nhà cung cấp cụ thể.

## Lưu ý bàn giao

Giao diện hiện dùng Google Fonts; nếu không có mạng sẽ fallback sans-serif. Thông tin file và biểu mẫu dùng text escaping; PDF Blob URL được thu hồi. Chọn tệp chưa phải upload. Mọi thông báo/email đều là bản xem trước, không gửi ra ngoài. Không có nghiên cứu hoặc metric AI mới được tạo trong thay đổi này.
