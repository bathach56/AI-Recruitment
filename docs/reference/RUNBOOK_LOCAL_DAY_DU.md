# Sổ tay local, SQL và khôi phục chi tiết

Hướng dẫn mở nhanh: [CHAY_LOCAL.md](../CHAY_LOCAL.md). Phần dưới giữ chi tiết kỹ thuật và lần kiểm tra khôi phục lịch sử; database khôi phục thử nghiệm cũ đã được dọn. Chạy `--verify-restore` sẽ tạo bản mới, không tự ghi đè database đang dùng.

# Các thao tác chi tiết

## Mở nhanh trên máy hiện tại

Nhấp đúp **MO_WEB_LOCAL.cmd** tại thư mục gốc dự án. Hoặc mở PowerShell ở thư mục dự án và chạy:

```powershell
.\tools\Start-Local.ps1
```

Web: **http://localhost:5132**. Dịch vụ AI: **http://127.0.0.1:8000/health**. Script biên dịch khi web chưa chạy, mở hai dịch vụ ẩn và chờ kiểm tra sức khỏe. Nếu có dịch vụ đang chạy thì dùng lại; không tự đóng tiến trình khác đang chiếm cổng. Khi thay mã nguồn, dừng bản do script mở rồi chạy lại để nạp mã mới.

Máy hiện tại chặn `.ps1` theo chính sách mặc định. Tệp `.cmd` dùng `-ExecutionPolicy Bypass` **chỉ cho tiến trình PowerShell đó**, không đổi chính sách toàn máy. Có thể gọi tương đương `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Local.ps1`. Nếu không muốn dùng tùy chọn này, chạy các lệnh thủ công bên dưới. Với Stop-Local.ps1 cũng có thể dùng cùng cách gọi theo tiến trình.

Các tùy chọn:

```powershell
.\tools\Start-Local.ps1 -NoBrowser
.\tools\Start-Local.ps1 -WebOnly
.\tools\Start-Local.ps1 -SkipBuild
.\tools\Stop-Local.ps1
```

`-WebOnly` vẫn cho đăng nhập, tìm việc, xem CV, ứng tuyển và đọc kết quả SQL đã lưu; chưa xét CV mới nếu AI không chạy. `-SkipBuild` chỉ dùng khi đã có bản biên dịch `.local-run/web/webAI.dll`. Script dừng chỉ xử lý PID do script khởi động và kiểm tra lại lệnh tiến trình; không dừng dịch vụ khác được mở thủ công. Không tự đổi cổng vì web đang cấu hình AI ở 8000.

Đợt xét mới chạy bằng worker của web và lưu hàng đợi trong SQL. Đóng trình duyệt không hủy tác vụ. Nếu tắt web, phần chờ vẫn còn; khi mở lại sẽ tiếp tục. Nếu tiến trình bị tắt đột ngột giữa một CV, hệ thống chờ lease 5 phút trước khi nhận lại CV đó để tránh chấm đồng thời. Tạm dừng ở Kết quả xét CV giữ kết quả đã xong và cho hồ sơ đang chạy hoàn tất; chạy tiếp sẽ thử lại các hồ sơ lỗi. Khi AI lỗi, trạng thái lỗi được giữ, không tự tạo điểm hoặc lặp thử vô hạn.

## Khi không dùng được script

Mở hai cửa sổ PowerShell, cùng bắt đầu từ thư mục gốc dự án.

Cửa sổ web:

```powershell
dotnet run --project .\webAI\webAI.csproj --no-launch-profile -- --urls http://localhost:5132 --environment Development
```

Cửa sổ AI:

```powershell
Set-Location '.\backend test'
& '.\.venv\Scripts\python.exe' -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Giữ hai cửa sổ mở, đợi AI báo khởi động xong rồi truy cập web. Nhấn Ctrl+C trong từng cửa sổ để dừng. Nếu chính sách máy chặn chạy `.ps1`, có thể dùng các lệnh trên trực tiếp mà không thay đổi chính sách bảo mật toàn máy.

## Những thứ cần có trên máy dự phòng

- Windows, .NET SDK 10 theo `webAI/webAI.csproj`, SQL Server LocalDB và database `AIRecruitmentDb` đã được khôi phục.
- Mã nguồn đúng phiên bản; các gói .NET đã restore trước khi mất mạng.
- Môi trường Python tương thích `backend test/requirements-lock.txt`. Không sao chép nguyên `.venv` sang máy khác rồi mặc định rằng sẽ chạy; tạo môi trường và cài dependency trước ngày demo.
- Cache mô hình ở `backend test/.cache/sbert` cùng provenance, dữ liệu phát triển/danh mục kỹ năng mà dịch vụ AI đang tham chiếu. Chuẩn bị và thử trước để không cần tải mô hình lúc báo cáo.
- Tệp thông tin tài khoản mẫu ở `webAI/App_Data/scenario-accounts.json` chỉ là bản phát tài khoản cục bộ, không phải nguồn xác thực. Mật khẩu băm thực nằm trong SQL. Mang bản phát tài khoản riêng, không đẩy lên Git.

Không cần tạo lại các tài khoản/tin mẫu khi mở web. Không chạy công cụ `--replace-demo-data` để “sửa” lỗi khởi động vì công cụ đó thay dữ liệu mẫu.

## SQL hiện lưu những gì?

Tài khoản, hồ sơ cá nhân, doanh nghiệp, JD, ứng tuyển, việc đã lưu, thông báo/phản hồi, cấu hình và kết quả xét nằm trong SQL. Nội dung nhị phân của CV/PDF/DOCX/giấy xác minh nằm trong bảng `Documents` (`varbinary(max)`), có mã SHA-256. Xem CV và xét CV đều đọc từ SQL.

Chuỗi JSON trong các cột kết quả/cấu hình vẫn là dữ liệu **bên trong SQL**, không phải tệp JSON riêng. Tệp Excel là phương tiện nhập/xuất; hồ sơ nhập và kết quả lưu được ghi vào SQL. Tùy chọn giao diện sáng/tối vẫn có thể lưu tại trình duyệt. Mô hình AI, mã nguồn, cấu hình triển khai, nhật ký và bộ dữ liệu nghiên cứu không phải bản ghi nghiệp vụ nên vẫn là tệp.

Chuyển dữ liệu cũ trên máy khác (chỉ sau khi đã có database cũ và bản build mới; dừng web bản cũ trước):

```powershell
Push-Location .\webAI
dotnet ..\.local-run\web\webAI.dll --migrate-documents
Pop-Location
```

Lệnh sao lưu SQL, kiểm tra bản sao, nhập tệp cũ trong giao dịch và kiểm tra từng nội dung sau ghi. Thiếu tệp hoặc nội dung xung đột thì dừng, không âm thầm bỏ qua. Tệp cũ được giữ nguyên. Không cần chạy lại trên máy hiện tại vì đã chuyển xong ngày 11/11/2026.

## Sao lưu trước demo hoặc khi dữ liệu quan trọng thay đổi

Sau khi script đã tạo bản build:

```powershell
Push-Location .\webAI
dotnet ..\.local-run\web\webAI.dll --backup-database
Pop-Location
```

Lệnh tạo `.bak` mới trong `webAI/App_Data/backups`, dùng COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY. Bản sao SQL **sau chuyển đổi** chứa cả tài liệu; bản sao trước chuyển đổi vẫn cần thư mục CV cũ tương ứng. Không xóa bản dự phòng trước chuyển đổi khi chưa thử khôi phục bản mới.

Đã có công cụ thử khôi phục thật, luôn tạo tên database mới và tệp mới, không dùng REPLACE hoặc ghi đè database nguồn:

```powershell
Push-Location .\webAI
dotnet ..\.local-run\web\webAI.dll --verify-restore
Pop-Location
```

Công cụ tạo bản sao mới, RESTORE sang `AIRecruitmentRecovery_<mã ngẫu nhiên>`, chạy CHECKDB, kiểm tra SHA-256 và các tham chiếu tài liệu; báo cáo `recovery-report.json` nằm cạnh `.bak`. Database thử được giữ để bạn kiểm tra tiếp, nên không chạy lặp nhiều lần không cần thiết vì sẽ tăng dung lượng. Không tự xóa database bản sao.

Ngày 11/11/2026 đã thực sự khôi phục thành `AIRecruitmentRecovery_39f8c6a05476`, CHECKDB đạt, cả 36 tài liệu đúng hash; đã mở web riêng cổng 5133 với worker tắt và kiểm tra đăng nhập/xem CV/phân quyền đạt, sau đó dừng web thử. Đây là kiểm tra trên cùng máy; vẫn cần mang bản sao sang máy dự phòng để thử môi trường độc lập.

Khi mở bản phục hồi chỉ để kiểm tra, đặt `$env:ReviewQueue__Enabled='false'` trước khi khởi động web để không xét lại các đợt đang chờ của bản sao. Bỏ biến hoặc đặt lại `true` khi muốn chạy worker trên database đang sử dụng.

Sao chép `.bak` sau chuyển đổi cùng mã nguồn, cache mô hình và bản phát tài khoản vào ổ dự phòng riêng. `.bak` chứa dữ liệu cá nhân, cần giữ riêng; không đưa lên Git hoặc chia sẻ công khai. VERIFYONLY kiểm tra cấu trúc bản sao, không thay thế thử khôi phục và đăng nhập/xem CV trên máy dự phòng.

Khôi phục bằng SQL Server Management Studio: kết nối `(localdb)\MSSQLLocalDB`, dùng Restore Database → Device → chọn `.bak`. Ưu tiên khôi phục thành database **mới** như `AIRecruitmentRecovered` để không ghi đè dữ liệu hiện tại. Trước khi chạy web, đặt chuỗi kết nối trong PowerShell hiện tại:

```powershell
$env:ConnectionStrings__Recruitment='Server=(localdb)\MSSQLLocalDB;Database=AIRecruitmentRecovered;Integrated Security=true;TrustServerCertificate=true'
.\tools\Start-Local.ps1
```

Đảm bảo bản web cũ đã dừng; dịch vụ đang chạy không tự nhận biến môi trường mới. Sau khi thử, đóng PowerShell hoặc bỏ biến nếu muốn quay về database gốc. Không có script tự động ghi đè/khôi phục database gốc.

## Khi gặp lỗi

1. Web không mở: xem `.local-run/web.stderr.log` và `web.stdout.log`; kiểm tra SQL LocalDB, SDK và cổng 5132. Lỗi đăng nhập/xem danh sách SQL không thể sửa bằng việc chỉ chạy AI.
2. Web mở nhưng AI lỗi: xem `.local-run/ai.stderr.log`, `ai.stdout.log` và `/health`; kiểm tra môi trường Python, cache mô hình, cổng 8000. Có thể dùng web riêng, nhưng không được trình bày kết quả cũ như một lần xét AI vừa chạy.
3. Không thấy CV sau chuyển máy: kiểm tra đã khôi phục bản SQL sau chuyển đổi và có dữ liệu bảng Documents; nếu là bản cũ thì phục hồi thư mục tài liệu rồi chạy lệnh chuyển.
4. Sau khi sửa mã vẫn thấy bản cũ: dịch vụ đã chạy sẽ được dùng lại; dừng đúng dịch vụ rồi mở lại. Đừng đóng tiến trình không rõ nguồn hoặc chạy nhiều bản cùng cổng.
