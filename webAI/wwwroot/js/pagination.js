/* Shared list pagination. Selection remains in the owning feature's state. */
(() => {
 'use strict';
 const controllers=new Map();
 function page(items,wanted=1,size=10){const pages=Math.max(1,Math.ceil(items.length/size)),current=Math.max(1,Math.min(pages,Math.trunc(Number(wanted))||1));return {current,pages,total:items.length,start:(current-1)*size,items:items.slice((current-1)*size,current*size)}}
 function bind(container,selector){
  let state=controllers.get(container);
  if(state){state.selector=selector;state.refresh();return state}
  state={current:1,selector,signature:''};controllers.set(container,state);
  const nav=document.createElement('nav');nav.className='list-pagination';nav.setAttribute('aria-label','Phân trang danh sách');
  state.nav=nav;
  const host=container.tagName==='TBODY'?(container.closest('.batch-table-scroll')||container.closest('table')):container;
  const size=container.id==='jobList'?5:10;
  host.insertAdjacentElement('afterend',nav);
  state.refresh=()=>{
   if(!container.isConnected){nav.remove();return}
   const nodes=[...container.children].filter(n=>n.matches(state.selector));const view=page(nodes,state.current,size);state.current=view.current;
   nodes.forEach((n,i)=>n.toggleAttribute('data-page-hidden',i<view.start||i>=view.start+size));
   nav.hidden=nodes.length<=size;
   const signature=view.current+':'+view.total;if(signature===state.signature)return;state.signature=signature;
   nav.replaceChildren();
   const info=document.createElement('span');info.className='pagination-summary';info.textContent=`${view.total?view.start+1:0}–${Math.min(view.start+size,view.total)} / ${view.total} mục`;nav.append(info);
   const move=target=>{state.current=target;state.refresh();container.dispatchEvent(new CustomEvent('paginationchange',{bubbles:true}));host.scrollIntoView({block:'start',behavior:'auto'})};
   const button=(label,target,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=()=>move(target);nav.append(b);return b};
   button('Trước',view.current-1,view.current===1);
   const start=Math.max(1,Math.min(view.current-2,view.pages-4));
   for(let i=start;i<=Math.min(view.pages,start+4);i++){const b=button(String(i),i);b.setAttribute('aria-label','Trang '+i);if(i===view.current)b.setAttribute('aria-current','page')}
   button('Sau',view.current+1,view.current===view.pages);
   const label=document.createElement('label');label.textContent='Đến trang ';const select=document.createElement('select');select.setAttribute('aria-label','Chọn số trang');
   for(let i=1;i<=view.pages;i++){const o=document.createElement('option');o.value=String(i);o.textContent=String(i);select.append(o)}
   select.value=String(view.current);select.onchange=()=>move(Number(select.value));label.append(select);nav.append(label);
  };
  state.refresh();return state;
 }
 function scan(){
  const groups=new Map();
  document.querySelectorAll('.job-card,.application-review-card,.recruiter-job-row,.cv-file,.notification-card,.feedback-message,.feedback-candidate,.recipient-preview,.review-evidence-row,.candidate-application-card,.candidate-response-card').forEach(n=>{
   const parent=n.parentElement;if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(n);
  });
  for(const [parent,items] of groups){items.forEach(n=>n.setAttribute('data-pagination-item',''));bind(parent,'[data-pagination-item]')}
  for(const [id,selector] of [['applicationChoices','.source-choice'],['excelChoices','.source-choice'],['selectedFiles','li'],['batchRows','tr'],['reviewRows','tr']]){const n=document.getElementById(id);if(n)bind(n,selector)}
  document.querySelectorAll('tbody').forEach(n=>bind(n,'tr'));
  for(const [container,state]of controllers){if(!container.isConnected){state.nav.remove();controllers.delete(container)}else state.refresh()}
 }
 window.RecruitPagination={page,bind,slice:(container,items)=>page(items,controllers.get(container)?.current||1,container?.id==='jobList'?5:10).items,refresh:scan};
 document.addEventListener('DOMContentLoaded',()=>{
  scan();let queued=false;
  new MutationObserver(records=>{if(records.every(r=>r.target.closest?.('.list-pagination')))return;if(!queued){queued=true;queueMicrotask(()=>{queued=false;scan()})}}).observe(document.body,{childList:true,subtree:true});
 });
})();
