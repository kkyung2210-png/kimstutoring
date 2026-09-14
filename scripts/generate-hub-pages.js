const fs=require('fs'),path=require('path');
const {brandTemplateValues,escapeHtml:e,renderTemplate}=require('./generate-pages');
const {makeHubSchema}=require('./generate-schema');
const {PROFILES,TYPES,availability,faqs,gradeCopy}=require('../config/tutoring-navigation');
const {CARD_COPY}=require('./render-related-lessons');
function generateHubPages({root,outputPath,data,hubIndex}) {
 const generated=[],a=(url,label)=>`<a href="${e(url)}">${e(label)}</a>`;
 const chips=items=>`<ul class="hub-link-chips">${items.map(([url,label])=>`<li>${a(url,label)}</li>`).join('')}</ul>`;
 for(const type of ['province','region','subject','target'])for(const hub of hubIndex[type]){
  const label=hub.region||hub.value;
  const cluster=data.pages.filter(p=>type==='region'?p.region===hub.region&&p.province===hub.province:p[type]===hub.value);
  if(!cluster.length)throw Error(`빈 허브 ${hub.url}`);
  const copies={
   province:[`${label} 과외 | 지역별 영어·수학 수업 찾기`,`${label} 과외 지역 찾기`,`${label}에 속한 지역에서 초등학생·중학생·고등학생 영어와 수학 수업을 찾아보세요. 지역별 페이지에서 여섯 가지 1:1 과외의 학습 방향을 비교할 수 있습니다.`],
   region:[`${label} 1:1 영어·수학 과외 | 초·중·고 수업`,`${label} 1:1 영어·수학 과외`,`${hub.province} ${label}의 초등학생·중학생·고등학생 영어와 수학 수업을 학교급과 학습 목표에 맞춰 찾아보세요. 여섯 가지 수업의 학습 방향을 비교할 수 있습니다.`],
   subject:[`${label}과외 | 초등·중등·고등 학습 방향과 지역별 수업`,`${label}과외, 학교급에 맞는 학습 방향`,`${label}과외의 초등·중등·고등 학습 차이를 확인하고 지역별 1:1 수업을 탐색하세요. ${label==='영어'?'기초 어휘와 읽기부터 문법·구문독해, 내신과 수능까지 안내합니다.':'연산과 기초개념부터 유형별 문제풀이, 내신과 수능의 풀이 전략까지 안내합니다.'}`],
   target:[`${label} 과외 | 영어·수학 학습 방향과 지역 안내`,`${label} 영어·수학 과외`,`${label}에게 필요한 영어와 수학의 학습 방향을 비교해 보세요. ${gradeCopy[label]||''} 지역별 수업과 상담 안내도 함께 확인할 수 있습니다.`],
  };
  const [title,h1,description]=copies[type];let content='';
  if(type==='province')content=`<div class="hub-page-grid">${hubIndex.region.filter(h=>h.province===hub.value).map(h=>`<article class="hub-page-card"><h3>${a(h.url,h.region+' 과외')}</h3><p>초등·중등·고등 영어·수학 수업 둘러보기</p></article>`).join('')}</div>`;
  else if(type==='region'){
   const order=['elementary_english','elementary_math','middle_english','middle_math','high_english','high_math'];
   content=`<div class="hub-page-grid">${[...cluster].sort((a,b)=>order.indexOf(a.template)-order.indexOf(b.template)).map(p=>`<article class="hub-page-card" data-template="${p.template}"><h3>${a('/'+p.slug+'/',p.keyword)}</h3><p>${e(CARD_COPY[p.template])}</p></article>`).join('')}</div>`;
  }else{
   const types=TYPES.filter(t=>type==='subject'?PROFILES[t].subject===hub.value:PROFILES[t].target===hub.value);
   content=`<div class="home-feature-grid tutoring-overview-grid">${types.map(t=>{const p=PROFILES[t];return `<article class="feature-card"><h3>${e(p.target_short+' '+p.subject)}</h3><p>${e(p.focus)}</p><p>${e(p.method)}</p></article>`;}).join('')}</div><h2>지역별 ${e(label)} 수업 찾기</h2>`;
   content+=hubIndex.province.map(province=>`<details class="tutoring-region-group"><summary>${e(province.value)}</summary><div class="hub-page-grid">${hubIndex.region.filter(h=>h.province===province.value).map(region=>{
    const local=cluster.filter(p=>p.province===region.province&&p.region===region.region).sort((a,b)=>TYPES.indexOf(a.template)-TYPES.indexOf(b.template));
    return `<article class="hub-page-card"><h3>${e(region.region)}</h3>${chips(local.map(p=>['/'+p.slug+'/',p.target+' '+p.subject+'과외']))}</article>`;
   }).join('')}</div></details>`).join('');
  }
  const navigation=[...hubIndex.subject,...hubIndex.target].filter(h=>h.url!==hub.url).map(h=>[h.url,h.value+' 과외']);
  if(type==='region'){const province=hubIndex.province.find(h=>h.value===hub.province);navigation.unshift([province.url,province.value+' 지역 찾기']);}
  const hubFaqs=[{question:`${label} 수업은 어떻게 찾나요?`,answer:type==='province'?'지역을 선택한 뒤 해당 지역의 학교급과 과목별 수업을 비교해 보세요.':type==='region'?'초등·중등·고등과 영어·수학의 여섯 가지 수업 중 학생에게 필요한 학습 방향을 확인해 보세요.':'학교급과 과목의 학습 방향을 확인한 뒤 시도별 지역 목록을 펼쳐 수업 페이지로 이동하세요.'},faqs[4],faqs[6]];
  const canonicalUrl=data.baseUrl+hub.url,breadcrumbItems=[{'@type':'ListItem',position:1,name:'홈',item:data.baseUrl+'/'}];
  if(type==='region'){const p=hubIndex.province.find(h=>h.value===hub.province);breadcrumbItems.push({'@type':'ListItem',position:2,name:p.value,item:data.baseUrl+p.url});}
  breadcrumbItems.push({'@type':'ListItem',position:breadcrumbItems.length+1,name:h1,item:canonicalUrl});
  const popularPages=type==='province'?hubIndex.region.filter(h=>h.province===hub.value).map(h=>({title:h.region+' 과외',url:data.baseUrl+h.url})):cluster.map(p=>({title:p.keyword,url:data.baseUrl+'/'+p.slug+'/'}));
  const main=`<section class="hero hub-hero"><div class="container"><nav class="breadcrumb" aria-label="현재 위치"><ol><li>${a('/','홈')}</li><li aria-current="page">${e(label)}</li></ol></nav><h1>${e(h1)}</h1><p class="lead">${e(description)}</p></div></section><section class="section"><div class="container"><h2>${type==='province'?'지역 선택':type==='region'?'학교급·과목별 6개 수업':'학습 방향 비교'}</h2>${content}</div></section><section class="section section-soft" id="process"><div class="container"><h2>수업 방식과 일정 안내</h2><p>${e(availability)}</p></div></section><section class="section" id="faq"><div class="container"><h2>${e(label)} 과외 상담 질문</h2><div class="faq-list">${hubFaqs.map(f=>`<details class="faq-item"><summary><h3>${e(f.question)}</h3></summary><div class="faq-answer"><p>${e(f.answer)}</p></div></details>`).join('')}</div></div></section><section class="section section-soft" id="related"><div class="container"><h2>다른 학습 방향 둘러보기</h2>${chips(navigation)}</div></section><section class="section" id="consultation"><div class="container"><div class="cta"><h2>${e(label)} 수업을 상담해 보세요</h2><p>현재 교재와 어려운 내용, 희망하는 수업 방식과 시간을 알려주세요.</p>${a('/#consultation','1:1 과외 상담하기')}</div></div></section>`;
  const html=renderTemplate(data.template,{...brandTemplateValues({slug:hub.url.slice(1,-1)},data.baseUrl),LANG:'ko',TITLE:e(title),DESCRIPTION:e(description),CANONICAL_URL:e(canonicalUrl),STRUCTURED_DATA:makeHubSchema({canonicalUrl,title,description,faqs:hubFaqs,breadcrumbItems,popularPages}),MAIN:main,MOBILE_CONTACT_URL:'/#consultation',NAV_LINK:'/#lessons',NAV_TEXT:'수업 찾기',FOOTER_LINK:'/',FOOTER_TEXT:'홈'});
  const folder=path.join(outputPath,'hub',type,hub.hubSlug);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'index.html'),html);generated.push({type,label,url:hub.url,canonicalUrl});
 }
 return generated;
}
module.exports={generateHubPages};
