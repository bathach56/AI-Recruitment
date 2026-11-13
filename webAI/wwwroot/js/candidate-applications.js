(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const href=id=>'/Candidate?tab=applications&application='+encodeURIComponent(id);
 const outcome=status=>status==='Offered'?'Trúng tuyển':status==='Rejected'?'Không trúng tuyển':'Chưa có kết quả tuyển dụng cuối cùng';
 function listMarkup(list,statuses){return list.length?`${list.length>1?`<section class="application-switcher"><div class="field"><label for="applicationChoice">Chọn hồ sơ đã ứng tuyển</label><select id="applicationChoice">${list.map(a=>`<option value="${a.id}">${esc(a.title)} — ${esc(a.companyName)} (${esc(['Offered','Rejected'].includes(a.status)?outcome(a.status):statuses[a.status]||a.status)})</option>`).join('')}</select></div><span class="soft-label">${list.length} hồ sơ</span></section>`:''}<section id="candidateApplicationDetail" class="panel section-card application-detail-panel" aria-live="polite"><p>Đang tải kết quả ứng tuyển…</p></section>`:'<section class="panel section-card"><div class="empty-state"><h3>Chưa có hồ sơ ứng tuyển</h3><p>Chọn công việc đang tuyển và CV của bạn để ứng tuyển.</p><a class="button" href="/">Tìm việc làm</a></div></section>'}
 function compactListMarkup(list,statuses){return list.length?`<section class="panel section-card"><h2>Việc đã ứng tuyển</h2><p class="application-list-hint">Chọn một hồ sơ để xem kết quả và phản hồi từ công ty.</p><div id="candidateApplicationRows">${list.map(a=>`<a class="candidate-application-card application-compact-row" data-application-detail="${a.id}" href="${href(a.id)}"><span class="application-compact-info"><strong>${esc(a.title)}</strong><span>${esc(a.companyName||'Công ty chưa cập nhật')}</span></span><time>${a.submittedAt?new Date(a.submittedAt).toLocaleDateString('vi-VN'):''}</time><span class="application-status status-${esc(a.status)}">${esc(statuses[a.status]||outcome(a.status))}</span><span aria-hidden="true">›</span></a>`).join('')}</div></section><dialog id="candidateApplicationDialog" class="dialog application-result-dialog" aria-label="Chi tiết kết quả ứng tuyển"><button type="button" class="button secondary small application-result-close" data-close-application autofocus>Đóng ×</button><section id="candidateApplicationDetail" class="application-detail-panel" aria-live="polite"></section></dialog>`:listMarkup([],statuses)}
 function safeWebsite(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null}catch{return null}}
 function detailMarkup(detail,statuses){
  const a=detail.application,company=a.company,job=a.job,site=safeWebsite(company.website);
  return `<div class="card-heading"><div><small>Kết quả hồ sơ #${a.id}</small><h2>${esc(a.title)}</h2><p>${esc(company.name)}</p></div><span class="application-status status-${esc(a.status)}">${esc(outcome(a.status))}</span></div><p>Tiến trình: <strong>${esc(statuses[a.status]||a.status)}</strong> · Đã nộp ${new Date(a.submittedAt).toLocaleString('vi-VN')}</p><div class="candidate-company-detail"><h3>Công ty đã nhận hồ sơ</h3><strong>${esc(company.name)}</strong><p>${esc(company.industry||'Chưa cập nhật lĩnh vực')} · ${esc([job.district,job.city].filter(Boolean).join(', '))}</p>${site?`<a class="text-link" href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(company.website)}</a>`:'<p>Chưa cập nhật website.</p>'}<p>${esc(job.employmentType)} · ${esc(job.workMode)} · Kinh nghiệm: ${esc(job.experience||'Chưa khai báo')}</p></div><section class="candidate-result-responses"><h3>Kết quả & nội dung phản hồi từ công ty</h3><div id="candidateResponseList">${detail.responses.length?detail.responses.map(n=>`<article class="candidate-response-card"><div class="row"><strong>${esc(n.title)}</strong><time>${new Date(n.createdAt).toLocaleString('vi-VN')}</time></div><p>${esc(n.content)}</p></article>`).join(''):'<p>Công ty chưa gửi nội dung phản hồi cho hồ sơ này.</p>'}</div></section><div class="row mt"><button type="button" class="button secondary small" data-application-cv>Chi tiết CV đã nộp</button><a class="button secondary small" href="/Jobs/${a.jobId}">Xem tin tuyển dụng</a></div><details class="candidate-job-description"><summary>Nội dung tin đã ứng tuyển</summary>${[['Mô tả công việc',job.description],['Yêu cầu',job.requirements],['Quyền lợi',job.benefits]].map(([label,text])=>`<h4>${label}</h4><p>${esc(text||'Chưa cập nhật.')}</p>`).join('')}</details>`;
 }
 async function mount(root,{api,openCvDetail,statuses,toast,refreshNotifications}){
  const token=Symbol();root.candidateMountToken=token;
  const list=await api('workspace/applications');if(root.candidateMountToken!==token||new URLSearchParams(location.search).get('tab')!=='applications')return;
  root.innerHTML=compactListMarkup(list,statuses);if(!list.length)return;
  const panel=root.querySelector('#candidateApplicationDetail'),choice=list.length>1?root.querySelector('#applicationChoice'):null;let version=0,displayed=null;const reading=new Set();
  const modal=root.querySelector('#candidateApplicationDialog');
  const active=()=>root.isConnected&&root.querySelector('#candidateApplicationDetail')===panel;
  modal.querySelector('[data-close-application]').onclick=()=>modal.close();
  modal.addEventListener('click',e=>{if(e.target!==modal)return;const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close()});
  modal.addEventListener('close',()=>{version++;displayed=null;window.history.replaceState(null,'','/Candidate?tab=applications')});
  async function markVisible(){
   if(!active()||!modal.open||!displayed)return;const container=panel.querySelector('#candidateResponseList');if(!container)return;
   const rows=window.RecruitPagination?.slice(container,displayed.responses)||displayed.responses.slice(0,10);
   const unread=rows.filter(n=>!n.readAt&&!reading.has(n.id));if(!unread.length)return;
   try{await Promise.all(unread.map(async n=>{reading.add(n.id);try{await api('workspace/notifications/'+n.id+'/read','POST');n.readAt=new Date().toISOString()}catch(e){reading.delete(n.id);throw e}}));await refreshNotifications()}catch(e){toast('Đã mở phản hồi nhưng chưa cập nhật được trạng thái đã đọc. '+e.message)}
  }
  async function open(id){
   if(choice&&list.some(a=>a.id===id))choice.value=String(id);
   const request=++version;panel.hidden=false;panel.innerHTML='<p>Đang tải kết quả ứng tuyển…</p>';if(!modal.open)modal.showModal();
   window.history.replaceState(null,'',href(id));
   try{const detail=await api('workspace/applications/'+id);if(!active()||version!==request)return;
    displayed=detail;panel.innerHTML=detailMarkup(detail,statuses);panel.querySelector('[data-application-cv]').onclick=()=>openCvDetail(detail.application);
    window.RecruitPagination?.refresh();modal.scrollTop=0;await markVisible();
   }catch(e){if(active()&&version===request){panel.textContent=e.message;displayed=null}}
  }
  panel.hidden=true;
  root.querySelectorAll('[data-application-detail]').forEach(link=>{link.onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();return open(Number(link.dataset.applicationDetail))}});
  window.RecruitPagination?.refresh();
  root.candidateApplicationAbort?.abort();root.candidateApplicationAbort=new AbortController();root.addEventListener('paginationchange',e=>{if(e.target.id==='candidateResponseList')markVisible()},{signal:root.candidateApplicationAbort.signal});
  const wanted=Number(new URLSearchParams(location.search).get('application'));if(wanted>0)await open(wanted);
 }
 window.CandidateApplications={href,outcome,listMarkup:compactListMarkup,detailMarkup,mount};
})();
