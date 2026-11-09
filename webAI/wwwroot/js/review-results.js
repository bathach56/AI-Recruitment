(() => {
 'use strict';
 const $=id=>document.getElementById(id), history=$('reviewHistory');
 if(!history)return;
 let active=new URLSearchParams(location.search).get('batch'),busy=false;
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
 async function loadDetail(){
  if(!active)return;const id=active,query=filter();const batch=await api('/'+id+'?'+query);if(active!==id||query!==filter())return;
  $('reviewDetail').hidden=false;$('reviewTitle').textContent=batch.title;$('reviewMeta').textContent=`${window.RecruitVietnamese?.modelName(batch.model)||batch.model} · ${new Date(batch.createdAt).toLocaleString('vi-VN')} · ${batch.items.length} hồ sơ hiển thị`;
  $('exportReviews').href='/api/recruiter/reviews/'+id+'/excel?'+query;
  $('reviewRows').replaceChildren();$('reviewEmpty').hidden=batch.items.length>0;
  for(const item of batch.items){const row=node('tr'),name=node('td');name.append(node('strong',item.name),node('small',item.email));
   row.append(name,node('td',sources[item.source]||item.source),node('td',labels[item.state]||item.state),...['score','semanticScore','skillScore','experienceScore'].map(key=>node('td',score(item[key]),'batch-score')));
   const action=node('td'),button=node('button','Xem bằng chứng','button secondary small');button.type='button';button.onclick=()=>evidence(item);action.append(button);row.append(action);$('reviewRows').append(row)}
 }
 async function loadHistory(){
  const batches=await api('');history.replaceChildren();
  if(!batches.length){history.append(node('p','Chưa có đợt xét được lưu. Mở Đối chiếu CV & JD và chọn hồ sơ để bắt đầu.'));return}
  const label=node('label','Chọn đợt xét'),select=node('select');select.className='review-batch-select';select.setAttribute('aria-label','Chọn đợt xét đã lưu');
  batches.forEach(b=>{const option=node('option',`${b.title} · ${window.RecruitVietnamese?.modelName(b.model)||b.model} · ${b.completed}/${b.total} đã xét · ${new Date(b.createdAt).toLocaleString('vi-VN')}`);option.value=b.id;select.append(option)});
  if(!active)active=batches[0].id;
  if(batches.some(b=>b.id===active))select.value=active;
  select.onchange=async()=>{if(busy){select.value=active;return}active=select.value;historyState();$('reviewActivity').textContent='';try{await loadDetail()}catch(e){$('reviewActivity').textContent=e.message}};
  label.append(select);history.append(label);await loadDetail();
 }
 function historyState(){window.history.replaceState(null,'','/ReviewResults?batch='+encodeURIComponent(active))}
 $('reviewFilters').onsubmit=async event=>{event.preventDefault();try{await loadDetail()}catch(e){$('reviewActivity').textContent=e.message}};
 $('resumeReview').onclick=async()=>{
  if(busy||!active)return;busy=true;$('resumeReview').disabled=true;
  try{const batch=await api('/'+active);const items=batch.items.filter(i=>['Queued','Error','Running'].includes(i.state));
   if(!items.length){$('reviewActivity').textContent='Tất cả hồ sơ đã có kết quả. Đổi bộ lọc để xem.';return}
   for(const [index,item]of items.entries()){$('reviewActivity').textContent=`Đang xét ${index+1}/${items.length}: ${item.name}`;await api('/'+active+'/items/'+item.id+'/analyze',{method:'POST'});await loadDetail()}
   $('reviewActivity').textContent='Đã xử lý đợt. Các hồ sơ lỗi được giữ riêng để kiểm tra và chạy lại.';
  }catch(e){$('reviewActivity').textContent=e.message}finally{busy=false;$('resumeReview').disabled=false}
 };
 loadHistory().catch(e=>{history.replaceChildren(node('p',e.message,'error-text'))});
})();
