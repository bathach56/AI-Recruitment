# AI-Recruitment

Tài liệu sử dụng và phát triển: **[docs/README.md](docs/README.md)**.

AI Recruitment: CV–JD matching with TF-IDF, pretrained Sentence-BERT and Hybrid.

Mở web local: nhấp đúp **MO_WEB_LOCAL.cmd** hoặc xem [hướng dẫn chạy local, sao lưu và khôi phục](docs/CHAY_LOCAL.md). Địa chỉ: http://localhost:5132. Đã chuyển cả nội dung CV/giấy xác minh vào SQL Server ngày 11/11/2026.

Hiện trạng sau dọn dữ liệu 11/11/2026: [tổng kết chức năng và kiểm tra](docs/TONG_KET_HIEN_TRANG_2026_11_11.md), [bộ 5 lĩnh vực hiện tại](docs/BO_TEST_5_LINH_VUC.md), [tài khoản](docs/ACCOUNTS.md). Các số liệu kiểm tra ở phần Status bên dưới thuộc lần bàn giao trước; dùng tổng kết mới để xem kết quả kiểm tra hiện tại.

Start with [AI handoff](backend%20test/HANDOFF.md) and [API runbook](backend%20test/BACKEND_API.md).
The verified API entry point is `backend test/api.py`; the older `ai-service/app.py` is retained as legacy code and must not be used for the verified demo or research metrics.

## Local environment

From the repository root, with Python 3.14 and .NET 10 installed:

```powershell
python -m venv 'backend test/.venv'
& './backend test/.venv/Scripts/python.exe' -m pip install -r 'backend test/requirements-lock.txt'
& './backend test/.venv/Scripts/python.exe' 'backend test/scripts/download_sbert.py'
dotnet restore webAI/webAI.csproj
```

Dependencies were verified on Windows/Python 3.14.7; validate compatibility on another platform. Model weights and virtual environments are intentionally excluded from Git. Downloading the model requires internet access; inference is local.

## Status

- Verified AI core and ASP.NET API integration; 54 Python tests and 7 HTTP integration checks passed in the development workspace before handoff.
- Included CV/JD fixtures are synthetic development data, not a held-out evaluation set.
- No validated Precision/Recall/F1 results yet. Legacy evaluation scripts are not valid evidence of model performance.
- Matching frontend now calls the ASP.NET APIs for text and file input; see [frontend runbook](docs/reference/FRONTEND_API.md). UI contract checks use controlled fixtures; rerun with the real Python/model environment to verify inference end to end.
- SQL Server, xác thực/phân quyền và các API tuyển dụng đã hoạt động. Dữ liệu nghiệp vụ và tài liệu tải lên được lưu trong SQL; triển khai production vẫn cần cấu hình và kiểm tra riêng.
- Fine-tuning is future work.

External resume datasets with unverified provenance, machine-specific caches, logs, build outputs and secrets are not included.
Read AGENTS.md before making changes.
