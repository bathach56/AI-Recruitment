(() => {
 'use strict';
 const $=id=>document.getElementById(id), history=$('reviewHistory');
 if(!history)return;
 let active=new URLSearchParams(location.search).get('batch'),busy=false,pending=false,polling=false,detailVersion=0,historyVersion=0,previewVersion=0,selectionVersion=0;
 const queueLabels={Idle:'Chưa đưa vào hàng đợi',Queued:'Đang chờ máy chủ',Running:'Đang xét nền',Paused:'Đã tạm dừng',Complete:'Đã xử lý xong'};
 const labels={Queued:'Chưa xét',Running:'Đang xét',Complete:'Có điểm tổng',Incomplete:'Thiếu dữ liệu',Error:'Lỗi'};
 const sources={Application:'Ứng tuyển',ExcelOrText:'Excel / văn bản',Upload:'Tệp tải lên'};
 function node(tag,text='',className=''){const n=document.createElement(tag);n.textContent=text;n.className=className;return n}
 function score(v){return typeof v==='number'?v.toFixed(1)+'%':'—'}
 async function api(path,options={}){
  if(options.method){const s=await fetch('/api/account/session',{cache:'no-store'});if(!s.ok)throw Error('Không tải được phiên đăng nhập.');const session=await s.json();options.headers={...options.headers,'X-CSRF-TOKEN':session.token}}
  const response=await fetch('/api/recruiter/reviews'+path,{...options,cache:'no-store'});const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.message|| (response.status===404?'Không tìm thấy đợt xét của công ty bạn.':'Không tải được kết quả. Kiểm tra đăng nhập và thử lại.'));return data;
 }
 function filter(){const p=new URLSearchParams();if($('reviewQuery').value.trim())p.set('q',$('reviewQuery').value.trim());p.set('state',$('reviewState').value);p.set('sort',$('reviewOrder').value);if($('reviewMinimum').value!=='')p.set('min',$('reviewMinimum').value);return p.toString()}
 function evidence(item){
  previewVersion++;$('mainDialog').classList.remove('cv-detail-dialog');$('mainDialog').setAttribute('aria-label','Đánh giá AI và bằng chứng CV');
  const content=$('dialogContent');content.replaceChildren(node('h2',item.name));content.append(node('p',`${sources[item.source]||item.source} · ${labels[item.state]||item.state}`));
  const scores=node('div','','review-evidence-scores');[['Điểm tổng',item.score],['Ngữ nghĩa / từ vựng',item.semanticScore],['Kỹ năng',item.skillScore],['Kinh nghiệm',item.experienceScore]].forEach(([label,value])=>{const cell=node('div');cell.append(node('small',label),node('strong',score(value)));scores.append(cell)});content.append(scores);
  if(item.error)content.append(node('p',item.error,'error-text'));
  const explanation=item.result?.explanation;
  const requirements=explanation?.skills?.requirements;
  if(Array.isArray(requirements)&&requirements.length){content.append(node('h3','Yêu cầu và bằng chứng CV'));requirements.forEach(r=>{const section=node('section','','review-evidence-row');section.append(node('strong',r.requirement||r.normalized||'Kỹ năng'),node('p',({matched:'Đã đề cập',not_found:'Chưa tìm thấy',needs_review:'Cần rà soát'})[r.status]||'Chưa xác định'));(r.evidence||[]).forEach(e=>section.append(node('blockquote',e.context||e.matched_text||'')));content.append(section)})}
  if(Array.isArray(explanation?.missing_components)&&explanation.missing_components.length)content.append(node('p','Chưa đủ dữ liệu cho: '+explanation.missing_components.map(k=>({semantic:'ngữ nghĩa',skills:'kỹ năng',experience:'kinh nghiệm'})[k]||k).join(', ')));
  if(item.result?.document?.raw_text){const details=node('details');details.append(node('summary','Văn bản trích xuất từ CV'),node('pre',item.result.document.raw_text));content.append(details)}
  content.append(node('p','Điểm hỗ trợ rà soát hồ sơ. Quyết định tuyển dụng thuộc về nhà tuyển dụng.','batch-disclaimer'));$('mainDialog').showModal();
 }
 async function previewCv(item,batchId){
  const version=++previewVersion,content=$('dialogContent'),modal=$('mainDialog');modal.classList.add('cv-detail-dialog');modal.setAttribute('aria-label','Xem CV đã lưu trong đợt xét');content.replaceChildren(node('h2','CV: '+(item.name||item.fileName||'Chưa cung cấp tên')),node('p','Đang tải hồ sơ…'));if(!modal.open)modal.showModal();
  const path='/'+encodeURIComponent(batchId)+'/items/'+item.id;
  try{const data=await api(path+'/preview');if(previewVersion!==version||!modal.open)return;
   content.replaceChildren(node('h2',item.source==='Upload'?'CV tải lên: '+(item.fileName||item.name):'CV: '+(item.name||'Chưa cung cấp tên')),node('p','Email người gửi: '+(item.email||'Chưa cung cấp')));
   if(item.fileName){const link=node('a','Tải tệp gốc','button secondary small');link.href='/api/recruiter/reviews'+path+'/document';content.append(link)}
   if(data.kind==='pdf'){const frame=node('iframe','','review-cv-preview');frame.title='Nội dung CV đã lưu';frame.src='/api/recruiter/reviews'+path+'/document?inline=true';content.append(frame,node('p','Nếu trình duyệt không hiển thị PDF, dùng Tải tệp gốc để xem.'))}
   else if(data.kind==='text'){content.append(node('p',data.note||''),node('pre',data.text,'review-cv-text'))}
   else throw Error('Định dạng xem CV chưa được hỗ trợ.');
  }catch(e){if(previewVersion===version&&modal.open){content.replaceChildren(node('h2','Chưa mở được CV'),node('p',e.message,'error-text'));if(item.fileName){const link=node('a','Tải tệp gốc','button secondary');link.href='/api/recruiter/reviews'+path+'/document';content.append(link)}}}
 }
 $('mainDialog').addEventListener('close',()=>{previewVersion++});
 async function loadDetail(){
  if(!active)return;const id=active,query=filter(),version=++detailVersion;const batch=await api('/'+id+'?'+query);if(active!==id||query!==filter()||version!==detailVersion)return;
  pending=['Queued','Running'].includes(batch.queueState);
  $('resumeReview').disabled=busy||pending||(batch.completed===batch.total&&!batch.errors);
  $('pauseReview').disabled=busy||!pending;
  $('reviewDetail').hidden=false;$('reviewTitle').textContent=batch.title;$('reviewMeta').textContent=`${window.RecruitVietnamese?.modelName(batch.model)||batch.model} · ${queueLabels[batch.queueState]||''} · ${batch.completed??0}/${batch.total??batch.items.length} đã có kết quả · ${batch.errors??0} lỗi · ${batch.items.length} hiển thị`;
  $('reviewSelectionStatus').textContent='Đang xem: '+batch.title+' · '+new Date(batch.createdAt).toLocaleString('vi-VN');
  $('reviewJDText').textContent=batch.configuration?.job_description||'Đợt cũ chưa lưu nội dung JD.';
  $('exportReviews').href='/api/recruiter/reviews/'+id+'/excel?'+query;
  const jobId=Number(batch.configuration?.job_id);if($('reviewFeedbackLink'))$('reviewFeedbackLink').href='/Recruiter?tab=notifications'+(Number.isSafeInteger(jobId)&&jobId>0?'&job='+jobId:'');
  $('reviewRows').replaceChildren();$('reviewEmpty').hidden=batch.items.length>0;
  for(const item of batch.items){const row=node('tr'),name=node('td');name.append(node('strong',item.source==='Upload'?'Chưa cung cấp tên người gửi':item.name||'Chưa cung cấp tên'),node('small',item.email||'Email: chưa cung cấp'));if(item.fileName)name.append(node('small','Tệp: '+item.fileName));
   row.append(name,node('td',sources[item.source]||item.source),node('td',new Date(batch.createdAt).toLocaleString('vi-VN')),node('td',labels[item.state]||item.state),...['score','semanticScore','skillScore','experienceScore'].map(key=>node('td',score(item[key]),'batch-score')));
   const action=node('td'),actions=node('div','','review-row-actions'),cv=node('button','Xem CV','button secondary small'),button=node('button','Xem đánh giá AI','button secondary small');cv.type=button.type='button';cv.onclick=()=>previewCv(item,id);button.onclick=()=>evidence(item);actions.append(cv,button);action.append(actions);row.append(action);$('reviewRows').append(row)}
  window.RecruitPagination?.refresh();
 }
 async function chooseBatch(id){
  if(busy)return;active=id||null;detailVersion++;pending=false;$('reviewDetail').hidden=true;$('reviewRows').replaceChildren();window.RecruitPagination?.reset($('reviewRows'));$('resumeReview').disabled=$('pauseReview').disabled=true;$('reviewActivity').textContent='';historyState();
  $('reviewSelectionStatus').textContent=active?'Đang tải hồ sơ của đợt đã chọn…':'Chọn một đợt xét ở trên để xem danh sách CV và đánh giá AI.';
  const version=++selectionVersion;try{await loadDetail()}catch(e){if(selectionVersion===version)$('reviewSelectionStatus').textContent=e.message}
 }
 async function loadHistory(initial=false){
  const query=new URLSearchParams(),from=$('batchFrom').value,to=$('batchTo').value;
  if(from&&to&&from>to)throw Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if($('batchQuery').value.trim())query.set('q',$('batchQuery').value.trim());
  if(from)query.set('from',new Date(from+'T00:00:00').toISOString());if(to){const until=new Date(to+'T00:00:00');until.setDate(until.getDate()+1);query.set('to',until.toISOString())}
  if($('batchArchived').checked)query.set('includeArchived','true');
  const version=++historyVersion;$('batchSearchStatus').textContent='Đang tìm đợt xét…';const batches=await api(query.size?'?'+query:'');if(version!==historyVersion)return;history.replaceChildren();
  $('batchSearchStatus').textContent=batches.length?`${batches.length} đợt phù hợp${batches.length===200?' (tối đa 200 đợt mới nhất; hãy thu hẹp tên hoặc ngày để tìm đợt cũ hơn)':''}.`:'Không có đợt phù hợp. Thử thay bộ lọc hoặc tạo đợt xét mới.';
  const label=node('label','Chọn đợt xét'),select=node('select');select.className='review-batch-select';select.setAttribute('aria-label','Chọn đợt xét đã lưu');
  const placeholder=node('option','— Chọn một đợt xét —');placeholder.value='';select.append(placeholder);
  batches.forEach(b=>{const option=node('option',`${b.title} · ${window.RecruitVietnamese?.modelName(b.model)||b.model} · ${b.completed}/${b.total} đã xét · ${new Date(b.createdAt).toLocaleString('vi-VN')}`);option.value=b.id;select.append(option)});
  if(active&&!batches.some(b=>b.id===active)){const current=node('option','Đợt đang mở (ngoài bộ lọc hiện tại)');current.value=active;select.append(current)}select.value=active||'';
  select.onchange=async()=>{if(busy){select.value=active||'';return}await chooseBatch(select.value)};
  label.append(select);history.append(label);if(initial&&active)await chooseBatch(active);
 }
 function historyState(){window.history.replaceState(null,'','/ReviewResults'+(active?'?batch='+encodeURIComponent(active):''))}
 $('batchSearchForm').onsubmit=async event=>{event.preventDefault();try{await loadHistory()}catch(e){$('batchSearchStatus').textContent=e.message}};
 $('reviewFilters').onsubmit=async event=>{event.preventDefault();try{await loadDetail();window.RecruitPagination?.reset($('reviewRows'))}catch(e){$('reviewActivity').textContent=e.message}};
 $('resumeReview').onclick=async()=>{
  if(busy||!active)return;busy=true;$('resumeReview').disabled=true;
  try{const result=await api('/'+active+'/queue',{method:'POST'});$('reviewActivity').textContent=result.message;}
  catch(e){$('reviewActivity').textContent=e.message}finally{busy=false;await loadDetail().catch(e=>$('reviewActivity').textContent=e.message)}
 };
 $('pauseReview').onclick=async()=>{if(busy||!active)return;busy=true;try{const result=await api('/'+active+'/pause',{method:'POST'});$('reviewActivity').textContent=result.message}catch(e){$('reviewActivity').textContent=e.message}finally{busy=false;await loadDetail().catch(e=>$('reviewActivity').textContent=e.message)}};
 if($('exportReviewJson'))$('exportReviewJson').onclick=async()=>{if(!active)return;const button=$('exportReviewJson'),id=active;button.disabled=true;try{const data=await api('/'+id+'?'+filter()),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ket-qua-cv-'+id+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){$('reviewActivity').textContent=e.message}finally{button.disabled=false}};
 const timer=setInterval(async()=>{if(!pending||busy||polling||document.hidden)return;polling=true;try{await loadDetail()}catch(e){$('reviewActivity').textContent='Chưa cập nhật được tiến độ. '+e.message}finally{polling=false}},3000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 loadHistory(true).catch(e=>{history.replaceChildren(node('p',e.message,'error-text'));$('reviewSelectionStatus').textContent='Chưa tải được danh sách. Bấm Tìm đợt xét để thử lại.'});
})();
