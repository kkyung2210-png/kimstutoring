const fs = require('fs');
const path = require('path');
const PROFILES = require('../config/content/profiles.json');
const TYPES = ['elementary_english','middle_english','high_english','elementary_math','middle_math','high_math','elementary_korean','middle_korean','high_korean'];
const CONTRACT = Object.fromEntries(TYPES.map(type => { const [level,subject] = type.split('_'); return [type,{target:({elementary:'초등학생',middle:'중학생',high:'고등학생'})[level],subject:({english:'영어',math:'수학',korean:'국어'})[subject]}]; }));
// Tags describe pedagogy, not URLs. Text detectors catch mislabeled CSV/config content as a second layer.
const TOPICS = {
 korean_literacy: /국어|문해력|문학|비문학|화법|작문/,
 english_basics: /영어|어휘|문법|문장 이해|단어|주어(?:와|를|의|\s)|동사/,
 english_reading: /구문독해|구문 해석|구문을|지문|독해/,
 math_arithmetic: /연산|자리값|검산/,
 math_concepts: /수학|계산|식과 답|(?:^|\s)식을|알맞은 식|단원|풀이 전략/,
 school_assessment: /내신|서술형|수행평가|시험 범위/,
 college_exam: /수능|모의고사/,
 study_habits: /복습|학습 습관/,
 legacy_service: /일본어|토익|오픽|아이엘츠|토플|텝스|지텔프|\b(?:TOEIC|OPIC|IELTS|TOEFL|TEPS|JLPT|JPT|EJU)\b|(?:비즈니스|여행)\s*영어|영어회화|영어\s+회화\s*(?:과외|전문|상담|수업\s*신청)/i,
};
const ALLOWED = {
 elementary_korean:['korean_literacy','study_habits'],
 middle_korean:['korean_literacy','study_habits','school_assessment'],
 high_korean:['korean_literacy','study_habits','school_assessment','college_exam'],
 elementary_english:['english_basics','study_habits'],
 middle_english:['english_basics','english_reading','school_assessment','study_habits'],
 high_english:['english_basics','english_reading','school_assessment','college_exam','study_habits'],
 elementary_math:['math_arithmetic','math_concepts','study_habits'],
 middle_math:['math_arithmetic','math_concepts','school_assessment','study_habits'],
 high_math:['math_arithmetic','math_concepts','school_assessment','college_exam','study_habits'],
};
function stableHash(value) { let hash=2166136261; for(const c of String(value)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0; }
function classifyTopic(page) {
 const type=page.template;
 const contract=CONTRACT[type];
 if(!contract || page.target!==contract.target || page.subject!==contract.subject) throw Error(`${page.slug || 'page'}: template/target/subject 불일치 (${type}/${page.target}/${page.subject})`);
 return type;
}
function validateText(type,value,label='content') {
 if(!ALLOWED[type]) throw Error(`알 수 없는 template: ${type}`);
 if(type.endsWith('_korean') && /영어|영단어|영문법|구문독해|수학|연산|수식 계산|계산 실수|방정식 풀이/.test(String(value))) throw Error(`${label}: 국어에 다른 과목 혼입`);
 const text=String(value || '').replace(/{{[a-z_]+}}/g,'');
 for(const [topic,pattern] of Object.entries(TOPICS)) if(!(type.endsWith('_korean') && ['english_basics','english_reading'].includes(topic)) && pattern.test(text) && !ALLOWED[type].includes(topic)) throw Error(`${label}: ${type}에 허용되지 않은 토픽 ${topic}`);
 for(const [level,pattern] of Object.entries({elementary:/초등(?:학생)?/,middle:/중학생|중등/,high:/고등(?:학생)?/})) if(!type.startsWith(level+'_') && pattern.test(text)) throw Error(`${label}: 다른 학교급 ${level} 혼입`);
 if(/전국 어디서나 온라인|온라인 전용|항상 방문 가능|(?:해당 지역|[가-힣]+은) 방문수업이 (?:가능|불가능)합니다/.test(text)) throw Error(`${label}: 수업 가능 여부 확정 표현`);
 if(/성적을 확실히|등급 상승을 보장|단기간에 점수가 향상/.test(text)) throw Error(`${label}: 학습 성과 보장 표현`);
 return true;
}
function validateConfig(config) {
 const fields={intro:['text'],lesson:['text'],benefit:['text'],examples:['text'],faq:['question','answer'],cta:['title','text','label']};
 for(const [name,required] of Object.entries(fields)) {
  const groups=config[name]?.templates;
  if(!groups || Object.keys(groups).some(k=>!TYPES.includes(k))) throw Error(`${name}: template 그룹 오류`);
  for(const type of TYPES) {
   const pool=groups[type]; const min=name==='faq'?4:name==='examples'?2:1;
   if(!Array.isArray(pool)||pool.length<min) throw Error(`${name}/${type}: 전용 콘텐츠 부족 (최소 ${min})`);
   for(const item of pool) {
    if(!Array.isArray(item.topics)||!item.topics.length||item.topics.some(t=>!ALLOWED[type].includes(t))) throw Error(`${name}/${type}: topics 불일치`);
    for(const field of required){if(typeof item[field]!=='string'||!item[field].trim())throw Error(`${name}/${type}: ${field} 누락`);validateText(type,item[field],`${name}/${field}`);renderText(item[field],Object.fromEntries(VARIABLES.map(k=>[k,''])));}
   }
  }
 }
 if(!Array.isArray(config.common?.availability)||config.common.availability.length<3)throw Error('공통 수업 안내 풀 부족');
 for(const text of config.common.availability) {
  if(!/방문/.test(text)||!/화상/.test(text)||!/상담/.test(text)||!/배정/.test(text))throw Error('공통 수업 안내 조건 누락');
  TYPES.forEach(t=>validateText(t,text,'common'));
 }
 return config;
}
const VARIABLES=['province','region','subject','target','target_short','audience','keyword','service','intent','concern','focus','method','result','tone','availability'];
function renderText(text,variables){return text.replace(/{{([a-z_]+)}}/g,(m,k)=>{if(!(k in variables))throw Error(`알 수 없는 변수 ${m}`);return variables[k];}).replace(/\s+/g,' ').trim();}
function loadContentConfig(directory=path.resolve(__dirname,'../config/content')) {
 const config=Object.fromEntries(['intro','lesson','benefit','faq','cta','examples','common'].map(name=>[name,JSON.parse(fs.readFileSync(path.join(directory,name+'.json'),'utf8'))]));
 return validateConfig(config);
}
let cached;
function choose(pool,seed,count=1){if(pool.length<count)throw Error('전용 콘텐츠 부족');return pool.map((item,i)=>({item,score:stableHash(seed+'|'+i+'|'+JSON.stringify(item))})).sort((a,b)=>a.score-b.score).slice(0,count).map(x=>x.item);}
function createPageContent(page,context,config) {
 const type=classifyTopic(page); config=config?validateConfig(config):(cached ||= loadContentConfig());
 const seed=[page.slug,type,page.target,page.subject,page.searchIntent,page.tone].join('|');
 const availability=choose(config.common.availability,seed+'|availability')[0];
 const variables={...context,province:page.province,region:page.region,subject:page.subject,target:page.target,target_short:PROFILES[type].target_short,audience:page.target,keyword:page.keyword,availability};
 const render=item=>Object.fromEntries(Object.entries(item).filter(([k])=>k!=='topics').map(([k,v])=>[k,renderText(v,variables)]));
 const select=(name,count=1)=>choose(config[name].templates[type],seed+'|'+name,count).map(render);
 const result={intro:select('intro')[0].text,lesson:select('lesson')[0].text,benefit:select('benefit')[0].text,examples:select('examples',2).map(x=>x.text),faqs:select('faq',4),cta:select('cta')[0],availability};
 result.learning=require('./problem-learning').createLearningContent(page);
 result.faqs=result.learning.faqs; result.cta={...result.cta,...result.learning.cta};
 validateText(type,JSON.stringify(result),'generated content');return Object.freeze(result);
}
for(const type of TYPES){const p=PROFILES[type];if(!p||p.target!==CONTRACT[type].target||p.subject!==CONTRACT[type].subject)throw Error(`프로필 불일치 ${type}`);validateText(type,JSON.stringify(p),type);}
module.exports={PROFILES,TYPES,classifyTopic,createPageContent,loadContentConfig,validateConfig,validateText,stableHash};
