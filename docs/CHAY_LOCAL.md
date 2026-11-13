# Chạy web local

Thực hiện tại thư mục gốc dự án. Muốn bắt đầu đọc tài liệu, xem [mục lục](README.md).

## Mở và dừng

Nhấp đúp **MO_WEB_LOCAL.cmd**, hoặc chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Local.ps1
```

- Web: **http://localhost:5132**.
- Kiểm tra AI: **http://127.0.0.1:8000/health**.
- Đăng nhập: [danh sách tài khoản](ACCOUNTS.md); mật khẩu nằm trong tệp riêng cục bộ được liên kết ở đó.

Script biên dịch nếu cần, mở dịch vụ ẩn và dùng lại dịch vụ đang chạy. `ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình PowerShell vừa mở, không đổi chính sách toàn máy.

```powershell
# Dừng đúng các dịch vụ do script mở
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Stop-Local.ps1
```

Sau khi sửa mã: dừng rồi mở lại để nạp bản mới. Không tự tắt tiến trình khác đang chiếm cổng.

Tùy chọn Start-Local: `-NoBrowser` không mở trình duyệt; `-WebOnly` chỉ mở web; `-SkipBuild` dùng bản build đã có. Web vẫn dùng được dữ liệu SQL khi AI tắt, nhưng chưa xét CV mới.

## Chạy thủ công khi script gặp lỗi

Mở hai cửa sổ PowerShell ở gốc dự án:

```powershell
# Cửa sổ 1: web
 dotnet run --project .\webAI\webAI.csproj --no-launch-profile -- --urls http://localhost:5132 --environment Development
```

```powershell
# Cửa sổ 2: AI
Set-Location '.\backend test'
& '.\.venv\Scripts\python.exe' -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Giữ hai cửa sổ mở; nhấn Ctrl+C để dừng từng dịch vụ.

## Điều kiện và dữ liệu

Cần Windows, .NET SDK 10, SQL Server LocalDB với `AIRecruitmentDb`, môi trường Python và mô hình ở `backend test/.cache/sbert`. Cài môi trường/mô hình trên máy mới theo [README dự án](../README.md); không sao chép `.venv` rồi mặc định sẽ chạy.

Tài khoản, JD, CV nhị phân và kết quả được lưu trong SQL. Không cần tạo lại bộ mẫu khi mở web. **Không chạy lệnh reset dữ liệu để sửa lỗi khởi động.** Xem [bộ test 5 lĩnh vực](BO_TEST_5_LINH_VUC.md).

Đợt xét chạy ở máy chủ; đóng trình duyệt không hủy. Tắt web sẽ giữ hàng đợi trong SQL; sau sự cố giữa một CV có thể chờ lease 5 phút mới nhận lại. Trạng thái lỗi không được thay bằng điểm giả.

## Lỗi thường gặp và sao lưu

| Hiện tượng | Kiểm tra |
|---|---|
| Web không mở | `.local-run/web.stderr.log`, SQL LocalDB, SDK và cổng 5132 |
| Web mở nhưng AI lỗi | `.local-run/ai.stderr.log`, Python, mô hình và cổng 8000; nếu AI mở thủ công, xem cửa sổ chạy AI |
| Sau sửa mã vẫn thấy bản cũ | Dừng và khởi động lại, rồi Ctrl+F5 |
| Chuyển máy không thấy CV | Phục hồi bản SQL có bảng `Documents`; kiểm tra chuỗi kết nối |

Sao lưu sau khi đã có bản build:

```powershell
Push-Location .\webAI
dotnet ..\.local-run\web\webAI.dll --backup-database
Pop-Location
```

Bản `.bak` nằm trong `webAI/App_Data/backups`, có cả tài liệu SQL và được kiểm tra bằng CHECKSUM/VERIFYONLY. Tệp chứa dữ liệu riêng, không đưa lên Git. VERIFYONLY không thay thế thử khôi phục thật trên máy dự phòng.

Cài máy dự phòng, chuyển tài liệu cũ, thử restore và chạy trên database phục hồi: [sổ tay chi tiết](reference/RUNBOOK_LOCAL_DAY_DU.md).
