const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TYPES, PROFILES, loadContentConfig, validateConfig, validateText } = require('./content-intelligence');
const { loadPages, generatePages, escapeHtml } = require('./generate-pages');
const { makeSitemap } = require('./copy-static-files');
const { copyAssets } = require('./copy-assets');
const { parseDocument } = require('./seo-audit/validators');
const { checkSchema } = require('./seo-audit/schema-checker');
const { checkDocumentContent } = require('./seo-audit/content-checker');
const { loadConfig } = require('./seo-audit/rules');
const HEADER = 'id,domain,slug,status,language,province,region,subject,target,keyword,title,description,search_intent,summary,lesson_focus,lesson_method,lesson_result,tone,template';
function fixtureRows() {
 return TYPES.map((type,i)=>{const p=PROFILES[type],keyword=`안양 ${p.target} ${p.subject}과외`;return [i+1,'https://example.invalid',`anyang-${type.replace('_','-')}`,'publish','ko','경기도','안양',p.subject,p.target,keyword,keyword,'CSV 설명은 새 메타 생성 규칙으로 대체됩니다.',`${p.target}의 현재 수준에 맞는 1:1 ${p.subject}과외 찾기`,p.concern,p.focus,p.method,p.result,'코칭형',type];});
}
function csv(rows) {return HEADER+'\n'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');}
function test({outputPath}={}) {
 const {validateDescriptionPools}=require('./content-presentation');
 const descriptions=require('../config/content/descriptions.json');
 for(const type of TYPES)for(const slot of ['openings','goals','lessons','modes']){
  const bad=structuredClone(descriptions);bad.templates[type][slot]=[];
  assert.throws(()=>validateDescriptionPools(bad),/풀 부족/);
 }
 const live=loadPages().pages, repeat=loadPages().pages;
 assert.deepStrictEqual(live.map(p=>p.description),repeat.map(p=>p.description));
 for(const page of live){
  assert(page.description.length>=100&&page.description.length<=155);
  assert(!/온라인\s*(?:과외|수업)|찾기 목적에 맞춰|고민을 살펴보고|(?:형성|향상|지도)(?:[.]| 목적)/.test(JSON.stringify([page.content,page.intelligence])));
 }
 assert.throws(()=>validateText('high_math','등급 상승을 보장합니다.'),/보장 표현/);
 const raw=fixtureRows(), data=loadPages({csvText:csv(raw)}), again=loadPages({csvText:csv(raw)});
 assert.equal(data.pages.length,6);assert.deepStrictEqual(data.pages,again.pages);
 const config=loadContentConfig();
 for(const kind of ['intro','lesson','benefit','faq','cta','examples'])for(const type of TYPES){const bad=structuredClone(config);delete bad[kind].templates[type];assert.throws(()=>validateConfig(bad),/콘텐츠 부족/);}
 for(const [type,text] of [['elementary_math','중학생 내신'],['elementary_math','수능'],['elementary_math','구문독해'],['middle_english','연산'],['middle_english','수능 수학'],['middle_english','JLPT']])assert.throws(()=>validateText(type,text),/토픽|학교급/);
 assert.doesNotThrow(()=>validateText('middle_english','영어 회화 표현을 문장 이해와 연결해 봅니다.'));
 const wrong=fixtureRows();wrong[0][8]='중학생';assert.throws(()=>loadPages({csvText:csv(wrong)}),/불일치/);
 const old=fixtureRows();old[0][18]='conversation';assert.throws(()=>loadPages({csvText:csv(old)}),/불일치/);
 const contaminated=fixtureRows();contaminated[3][14]='연산과 JLPT';assert.throws(()=>loadPages({csvText:csv(contaminated)}),/토픽/);
 const tagged=structuredClone(config);tagged.faq.templates.middle_english[0].topics=['math_arithmetic'];assert.throws(()=>validateConfig(tagged),/topics/);
 const mislabeled=structuredClone(config);mislabeled.faq.templates.elementary_math[0].answer='수능 대비';assert.throws(()=>validateConfig(mislabeled),/토픽/);
 for(const service of ['일본어','영어회화','일본어회화','토익','토익스피킹','오픽','아이엘츠','토플','텝스','지텔프','JLPT','JPT','EJU','비즈니스영어','여행영어'])assert.throws(()=>validateText('high_english',service+' 수업 신청'),/legacy_service/);
 // Test CSV escaping/quoted fields through the production loader.
 const special=fixtureRows();special[0][13]='짧은 글의 "뜻", 이해 <확인> & 복습';assert(loadPages({csvText:csv(special)}).pages[0].content.concern.includes('<확인>'));
 const overview=[], seoChecks=[];
 if(outputPath){
  fs.mkdirSync(outputPath,{recursive:true});generatePages({outputPath,data,generateHome:false});copyAssets({root:path.resolve(__dirname,'..'),outputPath});
  fs.copyFileSync(path.resolve(__dirname,'../assets/style.css'),path.join(outputPath,'style.css'));
  fs.cpSync(path.resolve(__dirname,'../public/images'),path.join(outputPath,'images'),{recursive:true});
  fs.cpSync(path.resolve(__dirname,'../public/utils'),path.join(outputPath,'utils'),{recursive:true});
 }
 for(const page of data.pages){
  assert.equal(page.h1,page.keyword);assert.notEqual(page.title,page.keyword);assert(page.title.startsWith(page.keyword+' | '));assert(page.title.length<=65);assert(page.description.length>=70&&page.description.length<=160);
  assert.equal(page.content.target_short,PROFILES[page.template].target_short);
  assert.equal(page.intelligence.faqs.length,6);assert.equal(page.intelligence.examples.length,2);
  validateText(page.template,JSON.stringify({title:page.title,description:page.description,content:page.content,intelligence:page.intelligence}));
  if(outputPath){
   const html=fs.readFileSync(path.join(outputPath,page.slug,'index.html'),'utf8');
   assert(html.includes('<title>'+escapeHtml(page.title)+'</title>'));assert(html.includes('<h1>'+escapeHtml(page.h1)+'</h1>'));assert(html.includes('content="'+escapeHtml(page.description)+'"'));
   const document=parseDocument(path.join(outputPath,page.slug,'index.html'),outputPath);
   const schemaCheck=checkSchema(document,data.baseUrl+'/'+page.slug+'/');
   const issues=checkDocumentContent(document,{baseUrl:data.baseUrl,distPath:outputPath,config:loadConfig(path.resolve(__dirname,'..')),searchItem:page});
   assert.equal(schemaCheck.issues.filter(x=>x.severity==='ERROR').length,0);
   assert.equal(issues.filter(x=>x.severity==='ERROR').length,0);
   seoChecks.push({slug:page.slug,schema:schemaCheck,content:issues});
   const main=html.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];validateText(page.template,main.replace(/<section[^>]*id="related"[^>]*>[\s\S]*?<\/section>/,'').replace(/<[^>]*>/g,' '));
   for(const section of ['problems','diagnosis','process','self-study','student-types','lesson-method','faq','consultation'])assert(main.includes('id="'+section+'"'));
   for(const text of [page.intelligence.learning.hero,...page.intelligence.learning.problems.map(p=>p.text),...page.intelligence.learning.steps.flatMap(s=>[s.diagnosis,s.action]),page.intelligence.cta.title,...page.intelligence.faqs.flatMap(f=>[f.question,f.answer])])assert(main.includes(escapeHtml(text)),text);
   assert(!/일본어|TOEIC|OPIC|IELTS|JLPT|온라인 전용|항상 방문 가능/.test(html));assert(!/{{[A-Z_a-z]+}}/.test(html));
   const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);const faq=schema['@graph'].find(x=>x['@type']==='FAQPage');assert.deepEqual(faq.mainEntity.map(x=>({question:x.name,answer:x.acceptedAnswer.text})),page.intelligence.faqs);
   assert(schema['@graph'].some(x=>x['@type']==='Service'));assert(html.includes('href="'+data.baseUrl+'/'+page.slug+'/"'));
  }
  overview.push({template:page.template,slug:page.slug,title:page.title,h1:page.h1,description:page.description,descriptionLength:page.description.length,faq:page.intelligence.faqs,cta:page.intelligence.cta,checks:'passed'});
 }
 const sitemap=makeSitemap({pages:data.pages,baseUrl:data.baseUrl});data.pages.forEach(p=>assert(sitemap.includes('/'+p.slug+'/')));
 if(outputPath)fs.writeFileSync(path.join(outputPath,'seo-checks.json'),JSON.stringify(seoChecks,null,2)+'\n');
 if(outputPath)fs.writeFileSync(path.join(outputPath,'validation.json'),JSON.stringify({scope:'six detail samples only; home/hubs/full audit not built',pages:overview},null,2)+'\n');
 console.log('PASS: six templates; deterministic content; exact contracts; missing pools fail; topic contamination; CSV/HTML escaping; metadata; sections; FAQ/schema; CTA; sitemap.');
 return data;
}
if(require.main===module)test({outputPath:path.resolve(__dirname,'../reports/tutoring-sample')});
module.exports={test,fixtureRows,csv};
