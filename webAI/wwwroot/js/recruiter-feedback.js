(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const score=v=>typeof v==='number'?v.toFixed(1)+' / 100':'—';
 function markup(list){return `<section class="panel section-card"><h2>Gửi phản hồi & kết quả AI</h2><p>Đối chiếu kết quả theo đúng CV và JD trước khi gửi kết quả tuyển dụng.</p>${list.length?`<div class="feedback-filters"><div class="field"><label for="feedbackJob">Tin tuyển dụng</label><select id="feedbackJob"><option value="">Tất cả tin của công ty</option></select></div><div class="field"><label for="feedbackSearch">Tìm ứng viên</label><input id="feedbackSearch" type="search" placeholder="Tên hoặc email"></div></div><div class="feedback-selection"><label><input type="checkbox" id="feedbackSelectPage"> Chọn tất cả hồ sơ trên trang này</label><strong id="feedbackSelectedCount" aria-live="polite"></strong><button type="button" id="feedbackClear" class="button secondary small">Bỏ chọn tất cả</button></div><div id="feedbackCandidates"></div><div class="feedback-workspace"><form id="responseForm" class="feedback-composer"><h3>Nội dung gửi chung</h3><div class="field"><label for="feedbackOutcome">Kết quả do nhà tuyển dụng chọn</label><select id="feedbackOutcome" required><option value="Offered">Trúng tuyển</option><option value="Rejected">Không trúng tuyển</option></select></div><div class="field"><label for="responseTitle">Tiêu đề</label><input id="responseTitle" required maxlength="200" value="Thông báo kết quả tuyển dụng"></div><div class="field"><label for="responseContent">Nội dung phản hồi</label><textarea id="responseContent" required maxlength="12000" placeholder="Viết nội dung chung gửi đến các ứng viên được chọn…"></textarea></div><p>Kiểm tra danh sách người nhận trước khi gửi. Thông báo hiển thị trong tài khoản ứng viên.</p><button class="button" id="sendFeedback" type="submit">Kiểm tra & gửi phản hồi</button></form></div>`:'<div class="empty-state"><h3>Chưa có ứng viên để phản hồi</h3><p>Các hồ sơ nộp vào tin của công ty sẽ xuất hiện tại đây.</p></div>'}</section>`}
 function assessmentMarkup(assessment,error=''){
  if(error)return `<p class="notice">Chưa tải được đánh giá AI. ${esc(error)}</p>`;
  if(!assessment)return '<p class="ai-review-pending">Chưa có kết quả AI cho CV và JD này.</p>';
  const requirements=assessment.result?.explanation?.skills?.requirements||[];
  const groups=[['matched','Kỹ năng đã đề cập'],['not_found','Chưa tìm thấy trong CV'],['needs_review','Cần rà soát']];
  return `<div class="feedback-ai-summary"><div class="row"><strong>AI: ${score(assessment.score)}</strong><span>${esc(window.RecruitVietnamese?.modelName(assessment.model)||assessment.model)} · ${assessment.state==='Incomplete'?'Thiếu dữ liệu tính tổng':'Đã phân tích'}</span></div><p>Ngữ nghĩa / từ vựng: ${score(assessment.semanticScore)} · Kỹ năng: ${score(assessment.skillScore)} · Kinh nghiệm: ${score(assessment.experienceScore)}</p>${groups.map(([state,label])=>{const skills=requirements.filter(r=>r.status===state);return skills.length?`<p><strong>${label}:</strong> ${skills.map(r=>esc(r.requirement||r.normalized)).join(', ')}</p>`:''}).join('')}<small>Xét lúc ${new Date(assessment.analyzedAt).toLocaleString('vi-VN')}. Điểm hỗ trợ tham khảo; nhà tuyển dụng quyết định.</small></div>`;
 }
 async function mount(root,list,{api,dialog,toast,openCvDetail,statuses}){
  root.innerHTML=markup(list);if(!list.length)return;
  const $=s=>root.querySelector(s),selected=new Set(),candidateNode=$('#feedbackCandidates'),sendButton=$('#sendFeedback');let assessments=new Map(),aiError='';
  const active=()=>root.isConnected&&$('#feedbackCandidates')===candidateNode;
  $('#feedbackSelectPage').disabled=true;sendButton.disabled=true;candidateNode.textContent='Đang tải hồ sơ và đánh giá AI…';
  const jobs=[...new Map(list.map(a=>[a.jobId,a.title])).entries()];for(const [id,title]of jobs){const o=document.createElement('option');o.value=String(id);o.textContent=title;$('#feedbackJob').append(o)}
  const requestedJob=new URLSearchParams(window.location?.search||'').get('job');if(jobs.some(([id])=>String(id)===requestedJob))$('#feedbackJob').value=requestedJob;
  function filtered(){return window.RecruitUX.matchesApplications(list,{job:$('#feedbackJob').value,q:$('#feedbackSearch').value})}
  function visible(){return window.RecruitPagination?.slice($('#feedbackCandidates'),filtered())||filtered().slice(0,10)}
  function count(){if(!active())return;const page=visible(),checked=page.filter(a=>selected.has(a.id)).length,box=$('#feedbackSelectPage');box.checked=page.length>0&&checked===page.length;box.indeterminate=checked>0&&checked<page.length;box.disabled=!page.length;$('#feedbackSelectedCount').textContent=`Đã chọn ${selected.size} hồ sơ`;sendButton.disabled=!selected.size}
  function render(){if(!active())return;$('#feedbackCandidates').innerHTML=filtered().map(a=>`<article class="feedback-candidate"><div class="application-review-heading"><label class="feedback-check"><input type="checkbox" data-feedback-pick="${a.id}" ${selected.has(a.id)?'checked':''}><span><strong>${esc(a.fullName)}</strong><small>${esc(a.email)} · ${esc(a.title)} · JD #${a.jobId}</small></span></label><span class="application-status">${esc(statuses[a.status]||a.status)}</span></div>${assessmentMarkup(assessments.get(a.id),aiError)}<div class="row"><button type="button" class="button secondary small" data-feedback-cv="${a.id}">Chi tiết CV</button><a class="text-link" href="/Matching?job=${a.jobId}">Xét CV theo JD</a></div></article>`).join('')||'<p>Không có hồ sơ phù hợp bộ lọc.</p>';
   root.querySelectorAll('[data-feedback-pick]').forEach(n=>n.onchange=()=>{n.checked?selected.add(Number(n.dataset.feedbackPick)):selected.delete(Number(n.dataset.feedbackPick));count()});
   root.querySelectorAll('[data-feedback-cv]').forEach(b=>b.onclick=()=>openCvDetail(list.find(a=>a.id===Number(b.dataset.feedbackCv))));
   window.RecruitPagination?.refresh();count();
  }
  $('#feedbackSelectPage').onchange=e=>{const checked=e.target.checked;visible().forEach(a=>checked?selected.add(a.id):selected.delete(a.id));render()};
  $('#feedbackClear').onclick=()=>{selected.clear();render()};$('#feedbackSearch').oninput=render;$('#feedbackJob').onchange=render;
  root.feedbackPaginationAbort?.abort();root.feedbackPaginationAbort=new AbortController();root.addEventListener('paginationchange',count,{signal:root.feedbackPaginationAbort.signal});
  $('#responseForm').onsubmit=e=>{
   e.preventDefault();const ids=[...selected],recipients=list.filter(a=>selected.has(a.id));if(!ids.length||ids.length>100){toast('Chọn từ 1 đến 100 hồ sơ.');return}
   const body={applicationIds:ids,status:$('#feedbackOutcome').value,title:$('#responseTitle').value,content:$('#responseContent').value};
   if(!body.title.trim()||!body.content.trim()){toast('Nhập tiêu đề và nội dung phản hồi.');return}
   const outcome=body.status==='Offered'?'Trúng tuyển':'Không trúng tuyển';document.getElementById('mainDialog').classList.remove('cv-detail-dialog');
   dialog(`<h2>Xác nhận gửi ${recipients.length} phản hồi</h2><p>Kết quả: <strong>${outcome}</strong></p><div>${recipients.map(a=>`<p class="recipient-preview">${esc(a.fullName)} · ${esc(a.email)} · ${esc(a.title)}</p>`).join('')}</div><h3>${esc(body.title)}</h3><p class="feedback-preview-text">${esc(body.content)}</p><button id="confirmBatchFeedback" class="button" type="button">Xác nhận gửi cho ${recipients.length} hồ sơ</button>`);
   const confirm=document.getElementById('confirmBatchFeedback');confirm.onclick=async()=>{confirm.disabled=true;confirm.textContent='Đang gửi…';sendButton.disabled=true;
    try{const result=await api('workspace/applications/responses/batch','POST',body);ids.forEach(id=>{selected.delete(id);const a=list.find(a=>a.id===id);if(a)a.status=body.status});document.getElementById('mainDialog').close();toast(`Đã gửi ${result.sent} phản hồi và cập nhật trạng thái.`);render()}catch(error){toast(error.message);confirm.disabled=false;confirm.textContent='Thử gửi lại';count()}
   };
  };
  try{const rows=await api('workspace/applications/assessments');assessments=new Map(rows.map(r=>[r.applicationId,r.assessment]))}catch(e){aiError=e.message}
  render();
 }
 window.RecruiterFeedback={markup,assessmentMarkup,mount};
})();
