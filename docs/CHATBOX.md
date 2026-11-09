# Trợ lý hỗ trợ CV

Chatbox dùng FAQ và quy tắc JavaScript để hướng dẫn tải CV, phân tích hồ sơ và đọc kết quả. Sau khi trang tải xong, phần chat hoạt động ngay cả khi mất mạng. Demo chatbox chỉ cần chạy website ASP.NET, không cần API key, Ollama hay dịch vụ AI.

Lịch sử giữ tối đa 16 lượt trong trình duyệt trên cùng địa chỉ website. Nút **Xóa lịch sử** yêu cầu xác nhận. Hãy tránh nhập CV hoặc thông tin cá nhân vào chat. Khi trình duyệt chặn lưu trữ, chat vẫn hoạt động trong trang đang mở.

## Hỏi về CV và tóm tắt tại chỗ

Chatbox có câu hỏi về kỹ năng, kinh nghiệm, CV cho người mới, ATS và cách dùng TopCV, CareerViet. Các câu trả lời có nguồn tham khảo sẽ hiện liên kết đến bài hướng dẫn.

Để tóm tắt, nhập lệnh ở dòng đầu rồi dán CV dạng văn bản. Dùng Shift + Enter để xuống dòng trong ô nhập.

```text
Tóm tắt CV:
Kinh nghiệm: Phát triển API quản lý kho bằng C# trong 2 năm
Kỹ năng: C#, SQL Server
Học vấn: Cử nhân Công nghệ thông tin
```

Tính năng trích tối đa hai ý mỗi mục nhận diện và hỗ trợ tối đa 12.000 ký tự nội dung CV. Nên bỏ thông tin cá nhân trước khi dán. Nội dung gửi bằng lệnh và bản tóm tắt không được ghi vào lịch sử trình duyệt. Hãy giữ tiêu đề rõ ràng vì tài liệu không có mục nhận diện sẽ cần định dạng lại.

## Chạy cục bộ

Từ thư mục gốc, chạy:

```powershell
dotnet run --project webAI --no-launch-profile --urls http://127.0.0.1:5133
```

Mở `http://127.0.0.1:5133` và chọn **Hỗ trợ CV** ở góc dưới bên phải. Để demo cả phần phân tích CV, khởi động thêm dịch vụ Python theo [runbook matching](../backend%20test/BACKEND_API.md).

## Kiểm thử

```powershell
node --test webAI/tests/*.test.cjs
# Cần website đang chạy, Chrome và playwright-core khả dụng với Node.
node --test webAI/tests/chat.browser.cjs
```

Dùng `CHAT_TEST_URL` nếu chạy website trên cổng khác.
