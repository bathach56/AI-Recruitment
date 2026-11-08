# Trợ lý AI RecruitAI

Chatbox trả lời câu hỏi về cách dùng website, quy trình tuyển dụng và cách đọc kết quả đối chiếu CV–JD. Tin nhắn được giữ trong bộ nhớ của trang và được xóa khi chọn **Chat mới** hoặc rời trang. Hãy tránh nhập CV hoặc thông tin cá nhân.

Trình duyệt gọi `POST /api/chat` trên ASP.NET Core. API chỉ chấp nhận kết nối loopback, tối đa 12 yêu cầu/phút cho cả tiến trình, với tối đa 9 tin nhắn mỗi yêu cầu. API chuyển nội dung chat tới Ollama trên loopback. Dịch vụ matching Python tiếp tục xử lý CV/JD riêng. RecruitAI chưa có xác thực và phân quyền hồ sơ, nên chat chỉ hướng dẫn chung và API từ chối các trường bổ sung như `cvId` hoặc `cvText`.

## Chạy cục bộ

Khởi động Python matching theo [runbook](../backend%20test/BACKEND_API.md). Cài Ollama từ [tài liệu chính thức](https://docs.ollama.com/), sau đó mở các terminal sau. Có thể chọn mô hình hội thoại cục bộ đã tải trên máy.

```sh
# Terminal 1
OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11434 ollama serve

# Terminal 2
ollama pull qwen2.5:1.5b
Chat__Model=qwen2.5:1.5b dotnet run --project webAI --no-launch-profile --urls http://127.0.0.1:5133
```

Mở `http://127.0.0.1:5133`. `Chat__Port` mặc định là `11434`, có thể đổi nếu Ollama chạy ở cổng khác trên cùng máy. Khi thiếu `Chat__Model`, API trả 503 với thông báo cấu hình. Khi gặp lỗi kết nối hoặc timeout, Chatbox giữ câu hỏi để người dùng thử lại.

## Kiểm thử

```sh
node --test webAI/tests/*.test.cjs
node --test webAI/tests/chat-api.integration.cjs
# Dùng môi trường kiểm thử có Google Chrome và playwright-core.
node --test webAI/tests/chat.browser.cjs
```

Các bài kiểm thử chat dùng website cục bộ có mô hình đã cấu hình, mặc định ở cổng 5133. Dùng `CHAT_TEST_URL` để đổi URL. Với một phiên bản ASP.NET chạy riêng và để trống `Chat__Model`, đặt `CHAT_DISABLED_TEST_URL` để kiểm tra lỗi thiếu cấu hình.

Để kiểm tra timeout và giới hạn tần suất, chạy `python3 webAI/tests/chat-provider-fixture.py 11435`, sau đó khởi động một tiến trình ASP.NET riêng với `Chat__Port=11435` và `Chat__Model=fixture`. Đặt `CHAT_FAILURE_TEST_URL` trỏ đến tiến trình đó trước khi chạy bộ kiểm thử API. Fixture chỉ mô phỏng lỗi đường truyền trong kiểm thử.
