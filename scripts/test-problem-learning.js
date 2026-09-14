const assert=require('assert');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {loadPages}=require('./generate-pages');
const {validateText,TYPES}=require('./content-intelligence');
const {validatePools,validateSelection}=require('./problem-learning');
const {parseDocument,stripTags}=require('./seo-audit/validators');
const {checkSchema}=require('./seo-audit/schema-checker');
const pools=require('../config/content/problem-learning');
const dir=path.resolve(__dirname,'../reports/detail-problem-solving-qa'),dist=path.resolve(__dirname,'../dist');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const data=loadPages(),before=JSON.parse(fs.readFileSync(path.join(dir,'before.json')));
assert.deepStrictEqual(data.pages,loadPages().pages,'Non-deterministic generation');
validatePools();
for(const type of TYPES){
 const bad=structuredClone(pools);delete bad.profiles[type];assert.throws(()=>validatePools(bad));
 const short=structuredClone(pools);short.profiles[type].topics.pop();assert.throws(()=>validatePools(short));
 const wrong=structuredClone(pools);wrong.profiles[type].topics[0].action=type.endsWith('math')?'영어 구문독해를 연습합니다.':'수학 연산을 연습합니다.';assert.throws(()=>validatePools(wrong));
 const swapped=structuredClone(data.pages.find(p=>p.template===type).intelligence.learning);swapped.steps[0].action=swapped.steps[1].action;assert.throws(()=>validateSelection(swapped),/mismatch/);
}
const errors=[],samples=[],perTemplate={},metrics={publishRows:data.pages.length,generated:0,generationFailures:0,subjectContamination:0,gradeContamination:0,topicMismatch:0,forbidden:0,faqMismatch:0,relatedMissing:0,h1Errors:0,titleErrors:0,canonicalErrors:0,schemaErrors:0,metadataChanged:0,relatedChanged:0,protectedChanged:0};
const fail=(key,slug,detail)=>{metrics[key]++;errors.push({key,slug,detail});};
const forbidden=/온라인\s*(?:과외 찾기|과외를 찾는|수업을 찾는)|찾기 목적에 맞춰|고민을 살펴보고|성적\s*상승\s*보장|단기간\s*(?:성적|점수)\s*향상|무조건\s*성적|최고의 강사진|전국\s*(?:어디서나\s*)?방문\s*(?:수업\s*)?가능|항상\s*방문|반드시\s*자기주도|합격\s*보장/;
const sectionIds=['problems','diagnosis','process','self-study','student-types','lesson-method','faq','consultation','related'];
for(const p of data.pages){
 const file=path.join(dist,p.slug,'index.html');if(!fs.existsSync(file)){fail('generationFailures',p.slug,'missing output');continue;}metrics.generated++;
 perTemplate[p.template]=(perTemplate[p.template]||0)+1;
 const doc=parseDocument(file,dist),html=doc.html,main=html.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
 const related=main.match(/<section[^>]*id="related"[\s\S]*?<\/section>/)?.[0]||'';
 const own=stripTags(main.replace(related,''));
 try{validateText(p.template,own,p.slug);}catch(e){fail(/학교급/.test(e.message)?'gradeContamination':'subjectContamination',p.slug,e.message);}
 if(p.template.startsWith('high_')&&/파닉스|초등 연산|책상에 앉을 시간을 짧게/.test(own))fail('gradeContamination',p.slug,'elementary learning focus');
 if(forbidden.test(own))fail('forbidden',p.slug,own.match(forbidden)[0]);
 try{validateSelection(p.intelligence.learning);}catch(e){fail('topicMismatch',p.slug,e.message);}
 const topicIds=n=>[...main.matchAll(new RegExp(`data-${n}-topic="([^"]+)"`,'g'))].map(m=>m[1]);
 if(JSON.stringify(topicIds('diagnosis'))!==JSON.stringify(topicIds('action'))||topicIds('action').some(x=>!topicIds('problem').includes(x)))fail('topicMismatch',p.slug,'HTML topics');
 if(doc.h1.length!==1||doc.h1[0]!==p.keyword)fail('h1Errors',p.slug,doc.h1);
 if(doc.title!==p.title||doc.title===p.keyword||doc.title.length>65)fail('titleErrors',p.slug,doc.title);
 if(doc.canonicals.length!==1||doc.canonicals[0]!==data.baseUrl+'/'+p.slug+'/')fail('canonicalErrors',p.slug,doc.canonicals);
 const schema=checkSchema(doc,data.baseUrl+'/'+p.slug+'/');if(schema.issues.some(x=>x.severity==='ERROR'))fail('schemaErrors',p.slug,schema.issues);
 const faqSection=main.match(/<section[^>]*id="faq"[\s\S]*?<\/section>/)[0];
 const visibleFaq=[...faqSection.matchAll(/<details\b[^>]*>[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<div class="faq-answer"><p>([\s\S]*?)<\/p>[\s\S]*?<\/details>/g)].map(m=>({question:stripTags(m[1]),answer:stripTags(m[2])}));
 const nodes=doc.jsonLdTexts.flatMap(t=>{const x=JSON.parse(t);return x['@graph']||[x];}),faqSchema=nodes.find(n=>n['@type']==='FAQPage');
 if(visibleFaq.length!==6||JSON.stringify(visibleFaq)!==JSON.stringify(faqSchema?.mainEntity.map(x=>({question:x.name,answer:x.acceptedAnswer.text}))))fail('faqMismatch',p.slug,'FAQ screen/schema mismatch');
 if((related.match(/<a href=/g)||[]).length!==8)fail('relatedMissing',p.slug,'Expected 5 lessons + 3 hubs');
 if(hash(related)!==before.details[p.slug].related)fail('relatedChanged',p.slug,'Related HTML changed');
 if(before.details[p.slug].title!==html.match(/<title>(.*?)<\/title>/)[1]||before.details[p.slug].canonical!==html.match(/<link[^>]*rel="canonical"[^>]*>/)[0]||before.details[p.slug].description!==html.match(/<meta name="description"[^>]*>/)[0])fail('metadataChanged',p.slug,'title/description/canonical changed');
 let previous=-1;for(const id of sectionIds){const at=main.indexOf(`id="${id}"`);assert(at>previous,`${p.slug}: section order ${id}`);previous=at;}
 assert(!/lesson-summary-section|content-examples|id="overview"|id="management"|id="fit"/.test(main),'Old duplicate sections');
 assert(html.includes('/detail-learning.css'));assert(doc.description.length>=100&&doc.description.length<=155);
 // Three provinces, including a county, selected within every template.
 if(['안양','홍천군','제주'].includes(p.region))samples.push({slug:p.slug,template:p.template,province:p.province,region:p.region,title:doc.title,h1:doc.h1[0],description:doc.description,hero:stripTags(main.match(/<p class="lead">([\s\S]*?)<\/p>/)[1]),problems:p.intelligence.learning.problems,steps:p.intelligence.learning.steps,coaching:p.intelligence.learning.coaching,studentTypes:p.intelligence.learning.studentTypes,availability:p.intelligence.availability,faqs:visibleFaq,cta:p.intelligence.learning.cta,htmlSections:sectionIds.map(id=>({id,text:stripTags(main.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))[0])}))});
}
for(const [f,digest] of Object.entries(before.protectedFiles))if(!fs.existsSync(f)||hash(fs.readFileSync(f))!==digest)fail('protectedChanged',f,'Protected output/source changed');
assert.equal(samples.length,18);for(const type of TYPES)assert.equal(samples.filter(p=>p.template===type).length,3);
const audit=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../reports/seo-audit-summary.json')));
const duplicates=xs=>xs.length-new Set(xs).size;
const normalized=data.pages.map(p=>p.description.replaceAll(p.region,'{지역}').replaceAll(p.province,'{시도}'));
const counts=Object.fromEntries(TYPES.map(type=>{const p=pools.profiles[type];return [type,{problem:p.topics.reduce((n,t)=>n+t.problems.length,0),diagnosis:p.topics.length,lesson_action:p.topics.length,selfStudy:p.coaching.reduce((n,r)=>n+r.length-1,0),faq:p.faqs.length+pools.commonFaqs.length,hero:p.hero.length,studentTypes:p.studentTypes.length,cta:p.ctas.length}]}));
const report={metrics,perTemplate,pools:counts,description:{duplicates:duplicates(data.pages.map(p=>p.description)),normalizedDuplicates:duplicates(normalized),min:Math.min(...data.pages.map(p=>p.description.length)),max:Math.max(...data.pages.map(p=>p.description.length))},audit,errors,samples,mobile:{widths:[360,390,430],sourceStructure:'single-column <=600px; no fixed-width content; unchanged shared hero/FAQ',visual:'Not verified: browser runtime has no available browser'}};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(dir,'samples.md'),samples.map(p=>`## ${p.template} — ${p.region}\n\n${p.title}\n\n${p.hero}\n\n`+p.htmlSections.map(s=>`### ${s.id}\n\n${s.text}`).join('\n\n')).join('\n\n'));
console.log(JSON.stringify({metrics,perTemplate,description:report.description,samples:samples.length,brokenLinks:audit.brokenLinks,orphanPages:audit.orphanPages,errors},null,2));
assert.equal(errors.length,0);assert.equal(metrics.generated,996);assert.equal(audit.errors,0);assert.equal(audit.brokenLinks,0);assert.equal(audit.orphanPages,0);
