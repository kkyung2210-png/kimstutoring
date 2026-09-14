(function(root){
 'use strict';
 function filterLessons(items,filters){
  const region=String(filters.region||'').normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
  return items.filter(p=>(!filters.target||p.target===filters.target)&&(!filters.subject||p.subject===filters.subject)&&(!region||`${p.province} ${p.region}`.toLocaleLowerCase('ko-KR').includes(region)));
 }
 if(typeof module==='object'&&module.exports)module.exports={filterLessons};
 if(!root.document)return;
 const form=root.document.querySelector('[data-tutoring-finder]');if(!form)return;
 const items=JSON.parse(root.document.getElementById('tutoring-search-data').textContent);
 const dialog=root.document.querySelector('[data-finder-dialog]');if(!dialog)return;
 const list=dialog.querySelector('[data-finder-dialog-results]'),status=dialog.querySelector('[data-finder-dialog-status]');
 const prev=dialog.querySelector('[data-finder-prev]'),next=dialog.querySelector('[data-finder-next]'),pageLabel=dialog.querySelector('[data-finder-page]');
 const pageSize=12;let found=[],page=0;
 function render(){
  const totalPages=Math.max(1,Math.ceil(found.length/pageSize));
  list.replaceChildren();
  found.slice(page*pageSize,(page+1)*pageSize).forEach(p=>{
   const li=root.document.createElement('li'),a=root.document.createElement('a');
   a.href='/'+p.slug+'/';a.textContent=p.keyword;li.append(a);list.append(li);
  });
  status.textContent=found.length?`선택한 조건에 맞는 수업 ${found.length}개를 찾았습니다.`:'조건에 맞는 수업이 없습니다. 창을 닫고 지역명이나 선택 조건을 바꿔보세요.';
  pageLabel.textContent=found.length?`${page+1} / ${totalPages}`:'';
  prev.disabled=page===0;next.disabled=page+1>=totalPages;
  prev.hidden=next.hidden=totalPages<=1;
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();page=0;
  found=filterLessons(items,{target:form.elements.target.value,subject:form.elements.subject.value,region:form.elements.region.value});
  if(found.length===1){root.location.assign('/'+found[0].slug+'/');return;}
  render();dialog.showModal();
 });
 form.addEventListener('reset',()=>{if(dialog.open)dialog.close();found=[];page=0;list.replaceChildren();status.textContent='';});
 prev.addEventListener('click',()=>{if(page>0){page--;render();}});
 next.addEventListener('click',()=>{if((page+1)*pageSize<found.length){page++;render();}});
 dialog.querySelector('[data-finder-close]').addEventListener('click',()=>dialog.close());
 // Native dialog supports Escape, focus containment, and restoration to the submit button.
 // No results are rendered until an explicit search submission.
})(typeof window==='undefined'?globalThis:window);
