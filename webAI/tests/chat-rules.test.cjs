const test = require('node:test');
const assert = require('node:assert/strict');
const { findAnswer } = require('../wwwroot/js/chat.js');

test('recognizes Vietnamese phrases with or without accents and punctuation', () => {
  for (const [message, intent] of [
    ['   XIN   CHÀO!!! ', 'hello'],
    ['TÔI KHÔNG TẢI ĐƯỢC CV?', 'uploadIssue'],
    ['tai sao cv bi loi', 'uploadIssue'],
    ['Tôi không thấy kết quả phân tích.', 'resultIssue'],
    ['Làm sao để xem kết quả phân tích CV?', 'results'],
    ['Làm thế nào để tải CV?', 'upload'],
    ['Website hỗ trợ định dạng CV nào?', 'formats'],
    ['he thong hoat dong nhu the nao?', 'about'],
    ['Làm sao để phân tích CV?', 'analyze'],
    ['Làm thế nào để sử dụng website?', 'start'],
    ['Bạn có thể giúp gì?', 'help'],
    ['Cam on.', 'thanks'],
    ['Tạm biệt!', 'bye']
  ]) assert.equal(findAnswer(message).id, intent, message);
});

test('uses specific intent before greetings and falls back on unrelated words', () => {
  assert.equal(findAnswer('Xin chào, tôi không tải được CV.').id, 'uploadIssue');
  assert.equal(findAnswer('Tải nhạc ở đâu?').id, 'fallback');
  assert.equal(findAnswer('Tại sao hôm nay trời đẹp?').id, 'fallback');
  assert.equal(findAnswer('Phân tích bài thơ').id, 'fallback');
  assert.equal(findAnswer('...').id, 'fallback');
  assert.match(findAnswer('Định dạng CV').reply, /PDF hoặc DOCX.*10 MiB/);
});

test('answers expanded questions about CVs, matching and the recruitment workflow', () => {
  const groups = {
    scan: ['PDF scan có được hỗ trợ không?', 'CV chụp ảnh có đọc được không?'],
    fileLimit: ['CV tối đa bao nhiêu MB?', 'dung luong toi da cua tep cv', 'Tải CV nặng 12 MB được không?'],
    textInput: ['Dán văn bản CV ở đâu?', 'khong co file cv thi lam sao'],
    jobDescription: ['JD là gì?', 'Cần điền những gì trong mô tả công việc?'],
    skills: ['Kỹ năng bắt buộc và ưu tiên khác nhau thế nào?', 'ky nang bat buoc nhap sao'],
    experience: ['Kinh nghiệm được tính thế nào?', 'ghi so nam kinh nghiem trong cv nhu the nao'],
    modelChoice: ['Nên chọn phương pháp nào để phân tích CV?', 'so sanh TF-IDF, Sentence-BERT va Hybrid'],
    tfidf: ['TF-IDF là gì?', 'TF IDF hoạt động thế nào?'],
    sbert: ['Sentence-BERT là gì?', 'SBERT so sanh gi'],
    hybrid: ['Hybrid là gì?', 'trong so hybrid co y nghia gi'],
    missingScore: ['Tại sao điểm tổng để trống?', 'diem so khop khong hien thi'],
    scoreMeaning: ['Điểm so khớp nghĩa là gì?', 'Điểm cao có chắc được tuyển không?'],
    exportResults: ['Tải kết quả JSON ở đâu?', 'lam sao luu ket qua phan tich'],
    candidateSubmit: ['Tôi có thể nộp CV ứng tuyển không?', 'gui cv cho nha tuyen dung the nao'],
    privacy: ['Chatbox có gửi dữ liệu ra ngoài không?', 'lich su chat luu o dau', 'Xóa lịch sử chat thế nào?'],
    improveCv: ['Làm sao cải thiện CV?', 'viet cv the nao cho ro rang']
  };
  for (const [intent, questions] of Object.entries(groups)) {
    for (const question of questions) assert.equal(findAnswer(question).id, intent, question);
    assert.equal(findAnswer(findAnswer(questions[0]).question).id, intent, intent);
  }
  assert.equal(findAnswer('Dán văn bản bài thơ').id, 'fallback');
  assert.equal(findAnswer('Tải kết quả xổ số').id, 'fallback');
  assert.equal(findAnswer('Hybrid xe hơi').id, 'fallback');
});

test('answers career questions and distinguishes external platforms', () => {
  for (const [message, id] of [
    ['tao cv tren top cv nhu the nao', 'topcvCreate'],
    ['Tìm việc trên TopCV ra sao?', 'topcvJobs'],
    ['Nộp CV trên CareerViet', 'careerviet'],
    ['Viết kinh nghiệm làm việc trong CV thế nào?', 'experience'],
    ['cach viet ky nang trong cv', 'skills'],
    ['CV cho sinh viên chưa có kinh nghiệm', 'firstCv'],
    ['CV chuẩn ATS là gì?', 'ats'],
    ['Tóm tắt CV', 'summaryGuide'],
    ['Cách viết tóm tắt CV?', 'summaryWriting'],
    ['Mục tiêu nghề nghiệp nên viết gì?', 'objective'],
    ['Viết CV thế nào?', 'cvWriting'],
    ['Mưa làm sao?', 'fallback']
  ]) assert.equal(findAnswer(message).id, id, message);
  assert.match(findAnswer('Tạo CV trên TopCV').source, /^https:\/\/www\.topcv\.vn\//);
});

test('extracts only supported CV sections and preserves source facts', () => {
  const { summarizeCv } = require('../wwwroot/js/chat.js');
  const summary = summarizeCv([
    'Họ tên: Người mẫu', 'Email: test@example.test',
    'KINH NGHIỆM LÀM VIỆC', '- Viết API bằng C# trong 2 năm',
    'KỸ NĂNG: C#, SQL Server', 'SĐT: 0901234567',
    'HỌC VẤN', 'Cử nhân Công nghệ thông tin',
    'DỰ ÁN', 'Ứng dụng quản lý kho'
  ].join('\n'));
  assert.match(summary, /Kinh nghiệm: Viết API bằng C# trong 2 năm/);
  assert.match(summary, /Kỹ năng: C#, SQL Server/);
  assert.match(summary, /Học vấn: Cử nhân Công nghệ thông tin/);
  assert.match(summary, /Dự án: Ứng dụng quản lý kho/);
  assert.doesNotMatch(summary, /Người mẫu|example\.test|0901234567|phù hợp/);
  assert.equal(summarizeCv('Chào bạn'), null);
  assert.equal(summarizeCv('Kỹ năng: test@example.test'), null);
});
