(() => {
  const defaults = ['summaryGuide', 'upload', 'topcvCreate', 'about', 'results'];
  const faq = {
    uploadIssue: {
      match: /\b(?:(?:khong|chua) (?:the )?(?:tai|them|chon)(?: len)? (?:duoc )?(?:tep )?cv|(?:tai|them)(?: len)? (?:tep )?cv (?:bi loi|khong duoc)|cv (?:bi loi|khong doc duoc))\b/,
      reply: 'Hãy kiểm tra tệp là PDF hoặc DOCX, tối đa 10 MiB và có thể mở bình thường. Với PDF scan không chọn được chữ, hãy dùng bản có văn bản hoặc chọn Dán văn bản trong phần Hồ sơ.',
      next: ['formats', 'upload']
    },
    resultIssue: {
      match: /\b(?:(?:khong|chua) (?:the )?(?:thay|co|xem duoc) ket qua|(?:phan tich cv|ket qua) (?:bi loi|khong hien))\b/,
      reply: 'Trong Không gian tuyển dụng, hãy kiểm tra đã nhập mô tả công việc, thêm CV và bấm Phân tích hồ sơ. Nếu có thông báo lỗi, hãy xử lý theo nội dung hiển thị rồi thử lại. Kết quả chỉ giữ trong trang đang mở.',
      next: ['analyze', 'results']
    },
    topcvJobs: {
      match: /\b(?:top ?cv\b.*\b(?:tim viec|ung tuyen)|(?:tim viec|ung tuyen)\b.*\btop ?cv)\b/,
      question: 'Tìm việc trên TopCV thế nào?',
      reply: 'Trên TopCV, tìm theo vị trí và địa điểm, mở tin phù hợp để đọc yêu cầu rồi ứng tuyển từ trang tin.',
      source: 'https://www.topcv.vn/quy-trinh-tim-kiem-viec-lam-thanh-cong-tren-topcv',
      next: ['topcvCreate', 'careerviet']
    },
    topcvCreate: {
      match: /\btop ?cv\b/,
      question: 'Tạo CV trên TopCV thế nào?',
      reply: 'TopCV có thư viện mẫu CV. Chọn mẫu theo ngành hoặc phong cách, điền thông tin phù hợp với công việc, rồi xem lại nội dung và định dạng trước khi lưu.',
      source: 'https://www.topcv.vn/cach-tao-cv-online-tren-topcv',
      next: ['topcvJobs', 'careerviet', 'ats']
    },
    careerviet: {
      match: /\b(?:career ?viet|cv ?hay)\b/,
      question: 'Tạo và nộp CV trên CareerViet thế nào?',
      reply: 'CVHay là công cụ tạo CV của CareerViet. Bạn có thể chọn mẫu, điền nội dung, lưu hồ sơ rồi dùng CV để ứng tuyển trên CareerViet.',
      source: 'https://careerviet.vn/vi/talentcommunity/ho-so-xin-viec-online-gom-nhung-gi-cach-tao-va-nop-ho-so.35A522C4.html',
      next: ['topcvCreate', 'cvWriting']
    },
    summaryWriting: {
      match: /\b(?:viet (?:phan |muc )?tom tat cv|tom tat cv (?:nen viet gi|nen viet the nao))\b/,
      question: 'Cách viết tóm tắt CV?',
      reply: 'Viết 2–3 câu nêu vị trí hoặc hướng nghề nghiệp, thế mạnh liên quan đến JD và một bằng chứng cụ thể. Chỉ dùng số liệu bạn có thể giải thích khi phỏng vấn.',
      next: ['summaryGuide', 'experience']
    },
    summaryGuide: {
      match: /\b(?:tom tat|rut gon) (?:cv|ho so)\b/,
      question: 'Tóm tắt CV',
      reply: 'Gõ “Tóm tắt CV:” rồi xuống dòng và dán CV văn bản. Giữ các tiêu đề như Kinh nghiệm, Kỹ năng, Học vấn, Dự án và bỏ thông tin cá nhân trước khi dán. Bản tóm tắt chỉ hiện trong trang này.',
      next: ['summaryWriting', 'improveCv']
    },
    scan: {
      match: /\b(?:pdf scan|ocr|cv chup anh|cv (?:dang )?anh chup)\b/,
      question: 'PDF scan có được hỗ trợ không?',
      reply: 'RecruitAI chưa hỗ trợ OCR. Hãy dùng PDF có thể chọn chữ, tệp DOCX hoặc dán văn bản CV.',
      next: ['textInput', 'formats']
    },
    fileLimit: {
      match: /\b(?:cv toi da bao nhieu|dung luong toi da cua (?:tep )?cv|(?:cv|tep) nang \d+ m(?:i)?b|gioi han dung luong cv)\b/,
      question: 'CV tối đa bao nhiêu MB?',
      reply: 'Giới hạn là 10 MiB mỗi tệp PDF hoặc DOCX. Với tệp quá lớn, bạn có thể giảm dung lượng hoặc dán văn bản CV.',
      next: ['formats', 'textInput']
    },
    textInput: {
      match: /\b(?:dan (?:van ban|noi dung) cv|khong co (?:file|tep) cv)\b/,
      question: 'Dán văn bản CV ở đâu?',
      reply: 'Trong Không gian tuyển dụng, mở bước Hồ sơ rồi chọn Dán văn bản và dán nội dung CV.',
      next: ['analyze', 'formats']
    },
    jobDescription: {
      match: /\b(?:jd la gi|(?:can )?dien\b.*\bmo ta cong viec|mo ta cong viec gom gi)\b/,
      question: 'JD là gì?',
      reply: 'JD là mô tả công việc. Nhập trách nhiệm và yêu cầu của vị trí. Điền thêm kỹ năng bắt buộc, kỹ năng ưu tiên và số năm nếu có tiêu chí cụ thể.',
      next: ['skills', 'analyze']
    },
    skills: {
      match: /\b(?:ky nang (?:bat buoc|uu tien)|(?:cach viet|viet|trinh bay|ghi) (?:phan )?ky nang (?:trong )?cv)\b/,
      question: 'Kỹ năng bắt buộc và ưu tiên khác nhau thế nào?',
      reply: 'Kỹ năng bắt buộc là yêu cầu chính, còn kỹ năng ưu tiên là lợi thế bổ sung. Khi viết CV, chọn kỹ năng liên quan đến JD và gắn mỗi kỹ năng quan trọng với một dự án hoặc kết quả thực tế.',
      source: 'https://www.topcv.vn/cach-viet-ky-nang-trong-cv',
      next: ['jobDescription', 'experience']
    },
    experience: {
      match: /\b(?:kinh nghiem (?:duoc tinh|tinh the nao)|(?:ghi|viet) (?:so nam )?kinh nghiem\b.*\bcv)\b/,
      question: 'Kinh nghiệm được tính thế nào?',
      reply: 'Trong RecruitAI, ghi rõ số năm, ví dụ “Tổng kinh nghiệm: 3 năm”. Khi viết CV, nêu vị trí, thời gian, việc đã làm và kết quả. Dùng số liệu khi có bằng chứng.',
      source: 'https://www.topcv.vn/cach-viet-kinh-nghiem-lam-viec-trong-cv',
      next: ['skills', 'firstCv']
    },
    modelChoice: {
      match: /\b(?:(?:nen )?chon (?:phuong phap|mo hinh) nao|(?:so sanh|phan biet) (?:tf idf|sentence bert|sbert|hybrid))\b/,
      question: 'Nên chọn phương pháp nào để phân tích CV?',
      reply: 'TF-IDF so sánh theo từ vựng. Sentence-BERT so sánh theo ngữ nghĩa. Hybrid kết hợp ngữ nghĩa, kỹ năng và kinh nghiệm. Chọn theo loại bằng chứng muốn xem.',
      next: ['tfidf', 'sbert', 'hybrid']
    },
    tfidf: {
      match: /\btf idf (?:la gi|hoat dong|so sanh|dung de lam gi)\b/,
      question: 'TF-IDF là gì?',
      reply: 'TF-IDF biểu diễn CV và JD bằng trọng số từ, sau đó dùng cosine để so mức độ tương đồng về từ vựng.',
      next: ['sbert', 'modelChoice']
    },
    sbert: {
      match: /\b(?:sentence bert|sbert) (?:la gi|hoat dong|so sanh|dung de lam gi)\b/,
      question: 'Sentence-BERT là gì?',
      reply: 'Sentence-BERT tạo biểu diễn ngữ nghĩa cho văn bản rồi dùng cosine để so mức độ tương đồng giữa CV và JD.',
      next: ['hybrid', 'modelChoice']
    },
    hybrid: {
      match: /\b(?:hybrid (?:la gi|hoat dong|ket hop)|trong so hybrid)\b/,
      question: 'Hybrid là gì?',
      reply: 'Hybrid kết hợp ngữ nghĩa, kỹ năng và kinh nghiệm. Trọng số trên giao diện là giá trị giả định và chưa được tối ưu thực nghiệm.',
      next: ['missingScore', 'modelChoice']
    },
    missingScore: {
      match: /\bdiem (?:tong|so khop|phu hop) (?:bi )?(?:de trong|khong hien thi|khong co)\b/,
      question: 'Tại sao điểm tổng để trống?',
      reply: 'Hybrid có thể để trống điểm tổng khi một thành phần đang dùng thiếu dữ liệu. Hãy đọc bằng chứng và thông báo trong kết quả để biết mục cần rà soát.',
      next: ['hybrid', 'scoreMeaning']
    },
    scoreMeaning: {
      match: /\b(?:diem (?:phu hop|so khop) (?:la gi|nghia la gi)|diem cao\b.*\b(?:duoc tuyen|trung tuyen))\b/,
      question: 'Điểm so khớp nghĩa là gì?',
      reply: 'Điểm so khớp mô tả mức độ CV phù hợp với JD theo phương pháp đã chọn. Khi đánh giá hồ sơ, hãy xem thêm bằng chứng và tiêu chí của vị trí.',
      next: ['results', 'missingScore']
    },
    exportResults: {
      match: /\b(?:tai ket qua json|(?:luu|xuat) ket qua (?:phan tich|doi chieu|json))\b/,
      question: 'Tải kết quả JSON ở đâu?',
      reply: 'Sau khi phân tích, chọn Tải kết quả JSON trên thẻ kết quả. Hãy tải trước khi phân tích lại hoặc rời trang.',
      next: ['results', 'analyze']
    },
    candidateSubmit: {
      match: /\b(?:nop cv ung tuyen|gui cv cho nha tuyen dung|ung tuyen tren recruitai)\b/,
      question: 'Tôi có thể nộp CV ứng tuyển không?',
      reply: 'Ở RecruitAI, trang ứng viên hiện cho xem trước hồ sơ. Chức năng gửi hồ sơ ứng tuyển chưa khả dụng.',
      next: ['topcvJobs', 'careerviet']
    },
    privacy: {
      match: /\b(?:chatbox\b.*\bgui du lieu ra ngoai|lich su chat|xoa lich su tro chuyen)\b/,
      question: 'Lịch sử chat lưu ở đâu?',
      reply: 'Câu hỏi FAQ lưu trong trình duyệt và có thể xóa bằng nút Xóa lịch sử. Nội dung gửi bằng lệnh Tóm tắt CV và kết quả tóm tắt chỉ nằm trong trang đang mở.',
      next: ['summaryGuide', 'about']
    },
    firstCv: {
      match: /\b(?:cv (?:cho )?(?:sinh vien|fresher|nguoi chua co kinh nghiem)|cv\b.*\bchua co kinh nghiem)\b/,
      question: 'Viết CV khi chưa có kinh nghiệm thế nào?',
      reply: 'Chọn dự án, đồ án, thực tập hoặc hoạt động liên quan đến vị trí. Với mỗi mục, ghi phần bạn phụ trách, công cụ sử dụng và kết quả có thể kiểm chứng.',
      source: 'https://www.topcv.vn/cach-viet-kinh-nghiem-lam-viec-trong-cv',
      next: ['skills', 'objective']
    },
    ats: {
      match: /\b(?:cv (?:chuan )?ats|ats la gi|toi uu cv cho ats)\b/,
      question: 'CV chuẩn ATS là gì?',
      reply: 'ATS là hệ thống quản lý hồ sơ ứng tuyển. Để CV dễ đọc, dùng tiêu đề mục rõ ràng, bố cục đơn giản và từ khóa đúng với kinh nghiệm thực tế và yêu cầu công việc.',
      source: 'https://www.topcv.vn/bang-kiem-tra-loi-cv',
      next: ['skills', 'improveCv']
    },
    objective: {
      match: /\bmuc tieu nghe nghiep\b/,
      question: 'Mục tiêu nghề nghiệp nên viết gì?',
      reply: 'Nêu vai trò bạn hướng tới và giá trị bạn có thể đóng góp. Chọn một mục tiêu cụ thể liên quan đến vị trí ứng tuyển.',
      next: ['summaryWriting', 'firstCv']
    },
    improveCv: {
      match: /\b(?:cai thien cv|sua loi cv|viet cv the nao cho ro rang|kiem tra loi cv)\b/,
      question: 'Làm sao cải thiện CV?',
      reply: 'So từng mục với JD, giữ ví dụ sát vị trí, kiểm tra lỗi chính tả và mở thử bản xuất để kiểm tra bố cục.',
      source: 'https://www.topcv.vn/bang-kiem-tra-loi-cv',
      next: ['ats', 'summaryGuide']
    },
    cvWriting: {
      match: /\b(?:viet cv(?: the nao| nhu the nao| ra sao)?|cv gom nhung gi|bo cuc cv)\b/,
      question: 'Viết CV thế nào?',
      reply: 'Dùng các mục dễ tìm như tóm tắt, kinh nghiệm, học vấn, kỹ năng và dự án liên quan. Sắp xếp thông tin theo mức độ phù hợp với vị trí.',
      source: 'https://careerviet.vn/vi/talentcommunity/cach-viet-cv-cho-moi-nganh-chuan-nhat-tang-co-hoi-trung-tuyen.35A4EC6D.html',
      next: ['firstCv', 'summaryWriting', 'ats']
    },
    formats: {
      match: /\b(?:dinh dang (?:tep |file )?(?:cv|ho so)|(?:cv|ho so) (?:dinh dang|dang (?:gi|nao))|(?:ho tro|chap nhan) (?:tep |file )?(?:pdf|docx)|(?:pdf|docx) (?:co )?(?:duoc|ho tro))\b/,
      question: 'Website hỗ trợ định dạng CV nào?',
      reply: 'Bạn có thể tải tệp PDF hoặc DOCX tối đa 10 MiB mỗi tệp, hoặc dán văn bản CV. PDF scan cần OCR hiện chưa được hỗ trợ.',
      next: ['upload', 'analyze']
    },
    results: {
      match: /\b(?:(?:xem|doc|tim) ket qua|ket qua (?:o dau|xem o dau|doi chieu la gi)|diem (?:phu hop|so khop) (?:la gi|nghia la gi))\b/,
      question: 'Làm sao để xem kết quả?',
      reply: 'Sau khi phân tích, xem mục Kết quả đối chiếu trên cùng trang. Kết quả có thể gồm mức độ tương đồng, kỹ năng và bằng chứng về kinh nghiệm. Điểm so khớp hỗ trợ người đọc CV, và có thể để trống khi thiếu dữ liệu.',
      next: ['analyze', 'formats']
    },
    upload: {
      match: /\b(?:(?:tai|them|chon|upload)(?: len)? (?:tep |file )?(?:cv|ho so)|dan (?:van ban|noi dung) cv)\b/,
      question: 'Làm thế nào để tải CV?',
      reply: 'Mở Không gian tuyển dụng, nhập mô tả công việc rồi chọn Đến phần thêm CV. Trong mục Hồ sơ, chọn Tải tệp và chọn hoặc kéo thả CV vào vùng tải.',
      next: ['formats', 'analyze']
    },
    analyze: {
      match: /\b(?:phan tich (?:cv|ho so)|(?:so khop|doi chieu) cv)\b/,
      question: 'Làm sao để phân tích CV?',
      reply: 'Trong Không gian tuyển dụng, nhập mô tả công việc, chọn phương pháp so khớp, thêm CV rồi bấm Phân tích hồ sơ.',
      next: ['results', 'upload']
    },
    about: {
      match: /\b(?:(?:website|trang web|he thong|recruitai)(?: nay)? (?:dung de lam gi|lam gi|hoat dong(?: nhu the nao)?|la gi)|lam gi (?:tren|voi) (?:website|trang web|recruitai))\b/,
      question: 'Website này dùng để làm gì?',
      reply: 'RecruitAI giúp người tuyển dụng đối chiếu CV với mô tả công việc (JD) để xem mức độ tương đồng và bằng chứng về kỹ năng, kinh nghiệm.',
      next: ['upload', 'analyze']
    },
    start: {
      match: /\b(?:(?:cach|huong dan) (?:dung|su dung) (?:website|trang web|recruitai)|(?:dung|su dung) (?:website|trang web|recruitai)(?: nhu the nao)?|bat dau tu dau)\b/,
      reply: 'Để bắt đầu, mở Không gian tuyển dụng và nhập mô tả công việc. Sau đó thêm CV và chọn Phân tích hồ sơ.',
      next: ['upload', 'analyze']
    },
    help: {
      match: /\b(?:ban (?:co the )?giup (?:toi |minh )?(?:duoc )?gi|tro ly (?:lam duoc gi|giup gi))\b/,
      reply: 'Mình có thể hướng dẫn tải CV, phân tích hồ sơ và đọc kết quả đối chiếu. Bạn muốn bắt đầu từ đâu?'
    },
    hello: {
      match: /^(?:(?:xin )?chao(?: ban| tro ly)?|hello|hi)$/,
      reply: 'Chào bạn! Mình có thể hướng dẫn tải CV, phân tích hồ sơ và xem kết quả.'
    },
    thanks: {
      match: /^(?:(?:xin )?cam on(?: ban| nhieu| rat nhieu)?|thanks)$/,
      reply: 'Rất vui được hỗ trợ bạn!'
    },
    bye: {
      match: /^(?:tam biet(?: ban)?|hen gap lai|bye)$/,
      reply: 'Chào bạn, hẹn gặp lại!'
    },
    fallback: {
      reply: 'Mình chưa có câu trả lời phù hợp. Bạn có thể chọn một câu hỏi gợi ý hoặc hỏi cụ thể hơn về cách dùng RecruitAI.'
    }
  };

  function normalize(message) {
    return message.toLowerCase().normalize('NFD')
      .replace(/\p{M}/gu, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function findAnswer(message) {
    const normalized = normalize(message);
    // Specific failures and questions take precedence over general actions.
    const id = Object.keys(faq).find(key => faq[key].match?.test(normalized)) ?? 'fallback';
    return { id, ...faq[id] };
  }

  const cvSections = [
    { name: 'Kinh nghiệm', heading: /^(?:kinh nghiem(?: lam viec)?|(?:work )?experience)$/ },
    { name: 'Kỹ năng', heading: /^(?:ky nang(?: chuyen mon)?|(?:technical )?skills)$/ },
    { name: 'Học vấn', heading: /^(?:hoc van|trinh do hoc van|education)$/ },
    { name: 'Dự án', heading: /^(?:du an(?: ca nhan)?|(?:personal )?projects?)$/ },
    { name: 'Chứng chỉ', heading: /^(?:chung chi|certifications?)$/ }
  ];

  function summarizeCv(text) {
    const excerpts = cvSections.map(() => []);
    let section = -1;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/^[-•*–]\s*/, '');
      if (!line) continue;
      const colon = line.indexOf(':');
      const heading = normalize(colon < 0 ? line : line.slice(0, colon));
      const recognized = cvSections.findIndex(item => item.heading.test(heading));
      if (recognized !== -1 || /^(?:ho ten|thong tin(?: ca nhan| lien he)?|lien he|email|sdt|so dien thoai|dia chi|ngay sinh|so thich|muc tieu(?: nghe nghiep)?|contact(?: information)?|phone|address|name|date of birth|references)$/.test(heading)) {
        section = recognized;
        if (colon < 0) continue;
      }
      const content = recognized !== -1 ? line.slice(colon + 1).trim() : line;
      if (section < 0 || !content || /@|https?:\/\/|(?:\+?84|0)(?:[ .()-]*\d){8,10}\b/i.test(content)) continue;
      const entry = content.length > 180 ? content.slice(0, 179).trimEnd() + '…' : content;
      const group = excerpts[section];
      if (group.length < 2 && !group.includes(entry)) group.push(entry);
    }

    const lines = cvSections.flatMap(({ name }, index) =>
      excerpts[index].length ? [name + ': ' + excerpts[index].join(' · ')] : []);
    return lines.length ? lines.join('\n') : null;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { findAnswer, summarizeCv };
    return;
  }

  const storageKey = 'recruitai.cv-help.v1';
  const messageLimit = 500;
  const historyLimit = 16;
  const cvLimit = 12000;
  const widget = document.createElement('aside');
  widget.className = 'recruit-chat';
  widget.setAttribute('aria-label', 'Hỗ trợ CV');
  widget.innerHTML = `
    <section class="recruit-chat-panel" id="recruit-chat-panel" role="dialog"
        aria-labelledby="recruit-chat-title" hidden>
      <header class="recruit-chat-header">
        <h2 id="recruit-chat-title">Trợ lý hỗ trợ CV</h2>
        <button type="button" class="btn btn-outline-secondary" data-chat-clear>Xóa lịch sử</button>
        <button type="button" class="btn btn-outline-secondary" data-chat-close aria-label="Đóng trợ lý hỗ trợ CV">×</button>
      </header>
      <p class="recruit-chat-note" id="recruit-chat-note">
        Hướng dẫn nhanh về CV. Lịch sử lưu trên trình duyệt này. Vui lòng tránh nhập thông tin cá nhân.
      </p>
      <div class="recruit-chat-log" role="log" aria-label="Tin nhắn" tabindex="0"></div>
      <div class="recruit-chat-feedback">
        <p class="recruit-chat-typing" role="status"></p>
        <p role="alert"></p>
      </div>
      <div class="recruit-chat-suggestions" role="group" aria-label="Câu hỏi gợi ý"></div>
      <form class="recruit-chat-form">
        <label class="visually-hidden" for="recruit-chat-input">Câu hỏi của bạn</label>
        <textarea id="recruit-chat-input" class="form-control" rows="2" maxlength="${cvLimit + 32}"
            aria-describedby="recruit-chat-note" placeholder="Nhập câu hỏi…"></textarea>
        <button type="submit" class="btn btn-primary" disabled>Gửi</button>
      </form>
    </section>
    <button type="button" class="btn btn-primary recruit-chat-toggle"
        aria-controls="recruit-chat-panel" aria-expanded="false">
      <i class="bi bi-chat-dots" aria-hidden="true"></i> Hỗ trợ CV
    </button>`;
  document.body.append(widget);

  const panel = widget.querySelector('section');
  const toggle = widget.querySelector('.recruit-chat-toggle');
  const log = widget.querySelector('[role="log"]');
  const typing = widget.querySelector('[role="status"]');
  const error = widget.querySelector('[role="alert"]');
  const suggestions = widget.querySelector('.recruit-chat-suggestions');
  const form = widget.querySelector('form');
  const input = widget.querySelector('textarea');
  const send = form.querySelector('button');
  let history = [];
  let replyTimer;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      history = saved.slice(-historyLimit).filter(message =>
        typeof message === 'string' && message.length <= messageLimit && message.trim());
    }
  } catch {
    // Chat stays usable when storage is unavailable or contains malformed data.
  }

  function saveHistory() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      error.textContent = 'Lịch sử chỉ lưu được trong trang đang mở.';
    }
  }

  function addMessage(role, content, source) {
    const item = document.createElement('div');
    item.className = 'recruit-chat-message';
    item.dataset.role = role;
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'Bạn' : 'Trợ lý CV';
    const body = document.createElement('p');
    body.textContent = content;
    item.append(label, body);
    if (source) {
      const link = document.createElement('a');
      link.href = source;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Đọc hướng dẫn từ ' + new URL(source).hostname.replace(/^www\./, '');
      item.append(link);
    }
    log.append(item);
    log.scrollTop = log.scrollHeight;
  }

  function renderSuggestions(ids = defaults) {
    suggestions.replaceChildren();
    for (const id of ids) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = faq[id].question;
      button.addEventListener('click', () => submitMessage(faq[id].question));
      suggestions.append(button);
    }
  }

  function renderConversation() {
    log.replaceChildren();
    addMessage('assistant', faq.hello.reply);
    let lastAnswer;
    for (const message of history) {
      addMessage('user', message);
      lastAnswer = findAnswer(message);
      addMessage('assistant', lastAnswer.reply, lastAnswer.source);
    }
    renderSuggestions(lastAnswer?.next);
  }

  function updateControls() {
    const waiting = replyTimer !== undefined;
    send.disabled = waiting || !input.value.trim();
    typing.textContent = waiting ? 'Trợ lý đang nhập…' : '';
    for (const button of suggestions.children) button.disabled = waiting;
  }

  function submitMessage(rawMessage) {
    const message = rawMessage.trim();
    if (!message || replyTimer !== undefined) return;
    const command = /^([^:\r\n]{1,24}):([\s\S]*)$/.exec(message);
    const isSummary = command && normalize(command[1]) === 'tom tat cv';
    const cvText = isSummary ? command[2].trim() : '';
    if (isSummary ? cvText.length > cvLimit : message.length > messageLimit) {
      error.textContent = isSummary
        ? 'Nội dung CV được giới hạn 12.000 ký tự.'
        : `Câu hỏi được giới hạn ${messageLimit} ký tự.`;
      return;
    }
    error.textContent = '';
    if (rawMessage === input.value) input.value = '';
    if (!isSummary) {
      history = [...history.slice(1 - historyLimit), message];
      saveHistory();
    }
    const summary = cvText && summarizeCv(cvText);
    const answer = isSummary ? {
      reply: summary
        ? 'Tóm tắt trích từ các mục trong CV\n' + summary
        : (cvText ? 'Chưa tìm thấy mục có nội dung. Hãy giữ các tiêu đề Kinh nghiệm, Kỹ năng, Học vấn hoặc Dự án.' : faq.summaryGuide.reply),
      next: faq.summaryGuide.next
    } : findAnswer(message);
    if (log.children.length >= historyLimit * 2 + 1) {
      log.children[2].remove();
      log.children[1].remove();
    }
    addMessage('user', isSummary ? 'Tóm tắt CV' : message);
    input.focus();
    replyTimer = window.setTimeout(() => {
      replyTimer = undefined;
      addMessage('assistant', answer.reply, answer.source);
      renderSuggestions(answer.next);
      updateControls();
    }, 360);
    updateControls();
  }

  function showPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      input.focus();
      log.scrollTop = log.scrollHeight;
    } else {
      toggle.focus();
    }
  }

  renderConversation();
  toggle.addEventListener('click', () => showPanel(panel.hidden));
  widget.querySelector('[data-chat-close]').addEventListener('click', () => showPanel(false));
  widget.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      showPanel(false);
    }
  });
  widget.querySelector('[data-chat-clear]').addEventListener('click', () => {
    if (log.children.length <= 1 || !window.confirm('Xóa lịch sử trò chuyện trên trình duyệt này?')) return;
    window.clearTimeout(replyTimer);
    replyTimer = undefined;
    history = [];
    input.value = '';
    error.textContent = '';
    saveHistory();
    renderConversation();
    updateControls();
    input.focus();
  });
  input.addEventListener('input', updateControls);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitMessage(input.value);
  });
})();
