/* Shared presentation rules; permissions remain enforced by the API. */
(() => {
 'use strict';
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
 function jobState(job,now=Date.now()){return job.status==='Published'&&new Date(job.deadline).getTime()<now?'Expired':job.status}
 function matchesApplications(list,state){const q=normalize(state.q);return list.filter(a=>(!state.job||String(a.jobId)===String(state.job))&&(!state.status||a.status===state.status)&&(!q||normalize(`${a.fullName} ${a.email} ${a.title}`).includes(q)))}
 function searchState(query){return {q:query.get('q')||'',city:query.get('city')||'',category:query.get('category')||'',modes:query.getAll('mode'),salary:query.get('salary')||'0',experience:query.get('experience')||'',sort:query.get('sort')||'newest',urgent:query.get('urgent')==='1'}}
 function searchQuery(state){const p=new URLSearchParams();for(const key of ['q','city','category','experience'])if(state[key]?.trim())p.set(key,state[key].trim());for(const mode of state.modes||[])p.append('mode',mode);if(Number(state.salary)>0)p.set('salary',String(state.salary));if(['salary','urgent'].includes(state.sort))p.set('sort',state.sort);if(state.urgent)p.set('urgent','1');return p.toString()}
 const limits={fullName:150,email:150,authEmail:150,authName:150,phone:30,cvPhone:30,desiredTitle:200,legalName:200,taxCode:30,companyWebsite:300,jobTitle:200,jobDistrict:150,jobExperience:150,requiredSkills:450};
 function fieldErrors(form,errors={}){
  if(!form?.querySelectorAll)return false;
  form.querySelectorAll('[data-field-error]').forEach(n=>n.remove());form.querySelectorAll('[aria-invalid=true]').forEach(n=>{n.removeAttribute('aria-invalid');n.removeAttribute('aria-describedby')});
  const aliases={name:form.id==='authForm'?'authName':'legalName',email:form.id==='authForm'?'authEmail':'email',password:'authPassword',title:'jobTitle',city:form.id==='profileForm'?'profileCity':'jobCity',district:'jobDistrict',workmode:'jobMode',category:'jobCategory',experience:'jobExperience',skills:'requiredSkills',description:'jobDescription',requirements:'jobRequirements',benefits:'jobBenefits',website:'companyWebsite'};
  let first;
  for(const [key,messages]of Object.entries(errors)){const name=key.split('.').pop().toLowerCase();const inputs=[...form.querySelectorAll('input,select,textarea')];const input=inputs.find(n=>n.id===(aliases[name]||key)||n.name?.toLowerCase()===name);if(!input)continue;
   const hint=document.createElement('p');hint.id=input.id+'Error';hint.className='error-text field-error';hint.dataset.fieldError='';hint.textContent=Array.isArray(messages)?messages.join(' '):String(messages);input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',hint.id);(input.closest('.field')||input.parentElement).append(hint);first??=input;
  }
  first?.focus();return !!first;
 }
 function prepareForm(form){if(!form)return;form.querySelectorAll('input').forEach(input=>{if(limits[input.id])input.maxLength=limits[input.id];if(input.type==='email')input.autocomplete=form.id==='authForm'?'username':'email';if(input.type==='tel')input.autocomplete='tel'});for(const id of ['salaryMin','salaryMax','vacancies']){const input=form.querySelector('#'+id);if(input){input.min=id==='vacancies'?'1':'0';input.max=id==='vacancies'?'10000':'1000';input.step=id==='vacancies'?'1':'0.01'}}}
 window.RecruitUX={normalize,jobState,matchesApplications,searchState,searchQuery,limits,fieldErrors,prepareForm};
 document.addEventListener('submit',event=>{if(event.target.tagName==='FORM')fieldErrors(event.target)},true);
 document.addEventListener('input',event=>{if(event.target.getAttribute?.('aria-invalid')==='true'){event.target.removeAttribute('aria-invalid');const id=event.target.getAttribute('aria-describedby');if(id)document.getElementById(id)?.remove();event.target.removeAttribute('aria-describedby')}},true);
})();
