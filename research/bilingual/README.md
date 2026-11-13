# Gán nhãn và huấn luyện CV–JD tiếng Việt, tiếng Anh

## Trạng thái thực tế

Chưa có bộ nhãn được con người phê duyệt; chưa huấn luyện riêng mô hình của đồ án. Ứng dụng tiếp tục dùng Sentence-BERT đa ngôn ngữ huấn luyện sẵn. Mô hình gốc hỗ trợ cả tiếng Việt và tiếng Anh, nhưng điều đó không chứng minh chất lượng xét tuyển trên dữ liệu của đồ án.

Nguồn: [thẻ mô hình](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), [danh sách ngôn ngữ chính thức](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html).

## Bộ làm quen để gán nhãn

**Bắt đầu với đợt thử nhỏ mới:** [hướng dẫn 20 cặp tiếng Việt](../../docs/THU_GAN_NHAN_20_CAP.md), [mở danh sách cặp](../../data/annotation_trial_20_vi_v1/BAT_DAU.md). Bộ này dành riêng cho tập thống nhất tiêu chí, nhãn trống và chưa chia tập; không phải bộ nghiên cứu có ground truth. Bộ 36 cặp song ngữ dưới đây vẫn được giữ riêng.

Thư mục `data/bilingual_pilot_v1` có 6 CV × 3 JD × 2 ngôn ngữ = 36 cặp, tương ứng 18 cặp nội dung được dịch. Đây là dữ liệu giả lập, không phải 36 quan sát độc lập hay tập kiểm chứng chất lượng. Tên, email và địa chỉ đã được loại khỏi văn bản phục vụ nghiên cứu. Người thông thạo hai ngôn ngữ cần kiểm tra bản dịch trước khi dùng.

- `pairs.csv`: mã cặp, ngôn ngữ, nhóm CV/JD và đường dẫn văn bản.
- `reviewer_a.csv`, `reviewer_b.csv`: hai người đánh giá độc lập, không xem nhãn của nhau hoặc điểm AI trước khi ghi nhãn.
- `adjudication.csv`: người phân xử ghi nhãn cuối, lý do và tập dữ liệu.
- `manifest.json`: nguồn, mục đích sử dụng và mã kiểm tra nội dung.

Mọi nhãn ban đầu đều trống. Không dùng AI tự điền nhãn để chứng minh chính chất lượng của AI đó. Dữ liệu `development_v1` đã dùng phát triển hệ thống cũng không được gọi là tập kiểm tra độc lập.

## Quy tắc đánh giá cần thống nhất trước

Nhãn `1`: hồ sơ có bằng chứng đáp ứng các yêu cầu cốt lõi đã thống nhất của vị trí, đủ để chuyển cho người tuyển dụng xem xét. Nhãn `0`: có bằng chứng không đáp ứng yêu cầu cốt lõi. Nhãn `uncertain`: chưa đủ thông tin hoặc yêu cầu chưa rõ; không suy diễn thành phù hợp hay không phù hợp.

Mỗi người ghi `reviewer_id`, `label`, bằng chứng về lĩnh vực (`domain_evidence`), kỹ năng (`skill_evidence`), kinh nghiệm (`experience_evidence`) và `notes`. Ghi rõ “không thấy bằng chứng” khi thông tin thiếu; phân biệt điều này với bằng chứng không đáp ứng. Không dùng tuổi, giới tính, tên hoặc thông tin không liên quan để quyết định nhãn.

Thử gán nhãn một nhóm nhỏ, thảo luận điểm bất đồng rồi chốt phiên bản hướng dẫn trước đợt chính. Lưu cả hai phiếu gốc; người phân xử ghi `final_label` bằng 0/1, `adjudicator_id`, `rationale`. Chỉ chốt nhãn khi đủ cơ sở. Tính tỷ lệ đồng thuận và Cohen's kappa từ phiếu thật, không điền số minh họa vào báo cáo.

## Thu thập và chia tập chính thức

Thu thập thêm CV–JD có quyền sử dụng, khử nhận dạng và ghi nguồn/giấy phép/người duyệt trong manifest (`source_notes`, `license`, `approved_by`, `intended_use=research`). Không chỉ đổi cờ của bộ giả lập để tuyên bố đây là dữ liệu nghiên cứu thực tế.

Chốt trước giao thức, tỷ lệ chia và hạt ngẫu nhiên; cân bằng ngôn ngữ, nhóm nghề và nhãn theo khả năng dữ liệu. Các bản dịch của cùng CV/JD phải ở cùng một tập. Mặc định `--split-policy both` yêu cầu cả nhóm CV và JD không giao nhau giữa `train`, `validation`, `test`. Vì bộ làm quen chứa toàn bộ tổ hợp 6×3, không thể chia nguyên tất cả các cặp thành ba tập độc lập theo cách này; cần thiết kế nhóm thu thập riêng hoặc loại các cặp giao nhau.

Chỉ dùng `--split-policy cv` khi nghiên cứu đã công bố rõ tình huống CV mới, JD đã biết; cách đó không chứng minh khả năng với JD mới. Không chia ngẫu nhiên từng dòng rồi để bản dịch hoặc CV trùng lọt qua tập kiểm tra.

## Lệnh kiểm tra và huấn luyện

Chạy từ gốc dự án bằng PowerShell, dùng môi trường Python hiện có:

```powershell
& 'backend test/.venv/Scripts/python.exe' research/bilingual/train.py --dataset data/bilingual_pilot_v1 --check-only
```

Hiện lệnh này phải từ chối vì thiếu nhãn và bộ làm quen chưa được duyệt cho nghiên cứu. Đây là cơ chế kiểm soát đầu vào, không phải kết quả huấn luyện. `--allow-pilot` chỉ phục vụ thử quy trình sau khi có nhãn; không bỏ qua kiểm tra nhãn, nguồn văn bản hoặc rò rỉ tập.

Sau khi có bộ chính thức được duyệt, thay đường dẫn bộ dữ liệu và thư mục đầu ra mới:

```powershell
& 'backend test/.venv/Scripts/python.exe' research/bilingual/train.py --dataset data/bo_nhan_da_duyet --check-only
& 'backend test/.venv/Scripts/python.exe' research/bilingual/train.py --dataset data/bo_nhan_da_duyet --output research/runs/vi_en_lan_01 --epochs 3 --device cpu --seed 42
```

Phương án ban đầu là tinh chỉnh Sentence-BERT bằng sai số bình phương giữa cosine và nhãn 0/1. Đây là lựa chọn thí nghiệm cần đánh giá, chưa được chứng minh tối ưu. Script giữ cách tiền xử lý/chia đoạn của hệ thống, chỉ cập nhật từ tập huấn luyện, chọn ứng viên theo sai số tập xác thực và ghi cấu hình, nguồn mô hình, mã kiểm tra nhãn. Không dùng tập kiểm tra để chọn checkpoint; không tự thay mô hình của website. Nếu không cải thiện so với mô hình gốc trên tập xác thực thì không lưu ứng viên mới.

Nhánh huấn luyện thực sự chưa chạy vì chưa có nhãn; kiểm thử hiện tại xác minh bộ kiểm tra dữ liệu và việc chặn huấn luyện, chưa chứng minh chất lượng mô hình hoặc toàn bộ lần chạy tối ưu hóa.

## Công cụ nhập nhãn và theo dõi tiến độ

Chạy một cặp mỗi lần; công cụ hiển thị nguyên văn JD/CV và yêu cầu bạn tự quyết định, không gọi AI. Hai người đánh giá dùng mã riêng và không xem phiếu của nhau trước khi hoàn tất. Cột `uncertain` dùng khi chưa đủ cơ sở, không ép thành 0 hoặc 1.

```powershell
& 'backend test/.venv/Scripts/python.exe' research/bilingual/annotate.py --dataset data/bilingual_pilot_v1 --role a --reviewer-id nguoi_01 --pair CV_001__JD_001__vi
& 'backend test/.venv/Scripts/python.exe' research/bilingual/annotate.py --dataset data/bilingual_pilot_v1 --role b --reviewer-id nguoi_02 --pair CV_001__JD_001__vi
& 'backend test/.venv/Scripts/python.exe' research/bilingual/annotate.py --dataset data/bilingual_pilot_v1 --role adjudicator --reviewer-id nguoi_phan_xu --pair CV_001__JD_001__vi
& 'backend test/.venv/Scripts/python.exe' research/bilingual/progress.py data/bilingual_pilot_v1
```

Đây là mã minh họa để bạn thay bằng mã người thật, không phải các người đánh giá đã có sẵn. Hai người cùng nhóm có thể làm hai phiếu độc lập; khi bất đồng nên có người hướng dẫn/chuyên gia phân xử. Công cụ không ghi đè cặp đã có nhãn; lưu CSV bằng thay thế nguyên tử để giảm nguy cơ hỏng phiếu khi bị ngắt. Chọn tập theo giao thức đã chốt trước, không tùy tiện chia từng dòng khi phân xử.

Tiến độ hiện tại: 0/36 cặp được duyệt. Công cụ để tỷ lệ đồng thuận và Cohen's kappa là `null` khi chưa có phiếu so sánh; không điền số minh họa.

`jd_metadata.json` là biểu mẫu yêu cầu có cấu trúc để đánh giá Hybrid: kỹ năng bắt buộc, ưu tiên, số năm tối thiểu và `reviewed_by`. Bản mẫu lấy yêu cầu từ JD giả lập, chưa được người đánh giá duyệt. Kiểm tra nội dung, xác nhận mã người duyệt; không đổi trường này chỉ để vượt bước kiểm tra. Khi tạo bộ dữ liệu mới cần tạo metadata tương ứng từng nhóm JD. Đây là yêu cầu của JD, không phải nhãn phù hợp của CV.

## Chạy đánh giá thật sau khi có nhãn

```powershell
& 'backend test/.venv/Scripts/python.exe' research/bilingual/evaluate.py --dataset data/bo_nhan_da_duyet --check-only
& 'backend test/.venv/Scripts/python.exe' research/bilingual/evaluate.py --dataset data/bo_nhan_da_duyet --output research/runs/danh_gia_01.json
```

Script mới dùng đúng các lớp trong `backend test/core`, không dùng mô hình của thư mục `ai-service` cũ. TF-IDF fit chỉ trên các văn bản train của bộ nghiên cứu; Sentence-BERT gốc và Hybrid dùng cùng cặp validation/test. Trọng số Hybrid 0,5/0,3/0,2 là cấu hình giả định được ghi lại. Ngưỡng từng phương pháp được chọn trên validation bằng lưới 0–100, bước 1, tối đa F1 rồi recall; khi hòa ưu tiên gần 50 và ngưỡng nhỏ hơn. Test không được dùng chọn ngưỡng.

Kết quả lưu chỉ số chung, theo Việt/Anh, ma trận nhầm lẫn, thời gian, điểm/cosine từng cặp, hash dữ liệu và phiên bản mô hình. Hybrid thiếu thành phần phải có `abstained` và coverage; chỉ số trên phần tính được không được báo như kết quả trên toàn bộ hồ sơ. Quy ước chia cho 0 của precision/recall là 0 nếu có mẫu tính điểm; không có điểm thì chỉ số là `null`.

Nếu có checkpoint từ script train, thêm `--candidate-model research/runs/vi_en_lan_01/candidate`; công cụ kiểm tra báo cáo huấn luyện và hash phiếu trước khi thêm phương pháp “Sentence-BERT tinh chỉnh”. Không tự đổi mô hình website. Đường dẫn kết quả phải mới để không ghi đè lần chạy trước.

Đã thử toàn bộ đường chạy ba phương pháp bằng fixture phần mềm trong thư mục tạm, gắn `pilot_only=true` rồi xóa fixture tạm. Đây là kiểm tra mã đánh giá, không phải kết quả nghiên cứu; hiện vẫn chưa có Precision/Recall/F1 hợp lệ cho đồ án.

## Đánh giá trước khi tích hợp

Đóng băng tập kiểm tra. So sánh TF-IDF, Sentence-BERT gốc, Sentence-BERT tinh chỉnh và phương pháp kết hợp trên cùng giao thức; chỉ chọn ngưỡng và trọng số bằng tập xác thực. Báo cáo Precision, Recall, F1, ma trận nhầm lẫn, thời gian xử lý, phần cứng, phiên bản dữ liệu/mô hình và cấu hình từ lần chạy thật. Phân tách kết quả Việt, Anh; nếu muốn tuyên bố hỗ trợ đối chiếu chéo ngôn ngữ thì cần thêm CV Việt–JD Anh và chiều ngược lại, bộ hiện tại chưa có hai chiều này.

Điểm tương đồng không phải độ chính xác hay xác suất trúng tuyển. Chỉ tích hợp mô hình mới sau khi kết quả độc lập và các lỗi điển hình đã được rà soát. Quyết định tuyển dụng vẫn thuộc nhà tuyển dụng.
