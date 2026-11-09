/* Presentation labels only. API model names and document evidence stay unchanged. */
(() => {
 const modelNames={'TF-IDF':'TF-IDF (từ vựng)','Sentence-BERT':'Sentence-BERT (ngữ nghĩa)',Hybrid:'Kết hợp'};
 window.RecruitVietnamese={
  modelName:value=>modelNames[value]||value||'',
  location:value=>String(value||'').replace(/^page:(\d+)/,'Trang $1').replace(/^body/,'Thân tài liệu').replaceAll('/block:',' · đoạn ').replaceAll('/row:',' · hàng ').replaceAll('/cell:',' · ô ')
 };
})();
