const pools = require('../config/content/problem-learning');
const {createHash} = require('crypto');
function select(items,seed,count=1) {
 return items.map((item,i)=>({item,score:createHash('sha256').update(`${seed}|${i}`).digest('hex')}))
  .sort((a,b)=>a.score.localeCompare(b.score)).slice(0,count).map(x=>x.item);
}
function validatePools(config=pools) {
 const {TYPES,PROFILES,validateText}=require('./content-intelligence');
 for(const type of TYPES) {
  const p=config.profiles[type], expected=PROFILES[type];
  if(!p || p.target!==expected.target || p.subject!==expected.subject)throw Error(`${type}: learning profile contract`);
  if(p.topics.length<6 || new Set(p.topics.map(t=>t.id)).size!==p.topics.length)throw Error(`${type}: topic IDs/count`);
  if(p.topics.reduce((n,t)=>n+t.problems.length,0)<12)throw Error(`${type}: problem pool too small`);
  for(const t of p.topics)for(const text of [...t.problems,t.diagnosis,t.action]) {
   if(typeof text!=='string'||!text.trim())throw Error(`${type}/${t.id}: missing linked text`);
   validateText(type,text,`${type}/${t.id}`);
  }
  if(p.hero.length<3||p.coaching.length!==4||p.coaching.some(r=>r.length<3)||p.studentTypes.length<4||p.faqs.length<6||p.ctas.length<3)throw Error(`${type}: presentation pool missing`);
  for(const faq of p.faqs)if(!p.topics.some(t=>t.id===faq.topicId))throw Error(`${type}: FAQ topic missing`);
  validateText(type,JSON.stringify([p.hero,p.coaching,p.studentTypes,p.faqs,p.ctas,config.commonFaqs]),`${type}/presentation`);
 }
 return config;
}
let validated;
function createLearningContent(page) {
 const {classifyTopic}=require('./content-intelligence'),type=classifyTopic(page);
 const config=validated||=validatePools(),p=config.profiles[type],seed=page.slug+'|'+type;
 // Five distinct issues, three of which are followed through diagnosis and action.
 const chosen=select(p.topics,seed+'|problems',5);
 const problems=chosen.map(t=>({topicId:t.id,text:select(t.problems,seed+'|problem|'+t.id)[0]}));
 const steps=select(chosen,seed+'|diagnosis',3).map(t=>({topicId:t.id,problem:problems.find(x=>x.topicId===t.id).text,diagnosis:t.diagnosis,action:t.action}));
 const result={type,hero:select(p.hero,seed+'|hero')[0],problems,steps,
  coaching:p.coaching.map(([title,...items],i)=>({title,text:select(items,seed+'|coaching|'+i)[0]})),
  studentTypes:p.studentTypes.map(([title,text])=>({title,text})),
  faqs:[...select(p.faqs,seed+'|faq',4).map(({question,answer})=>({question,answer})),...select(config.commonFaqs.slice(0,-1),seed+'|common-faq',1),config.commonFaqs.at(-1)],
  cta:select(p.ctas,seed+'|cta')[0]};
 validateSelection(result,config);
 return result;
}
function validateSelection(content,config=pools) {
 const p=config.profiles[content.type];
 if(!p)throw Error('Unknown learning profile');
 if(content.problems.length!==5||content.steps.length!==3)throw Error('Missing learning sections');
 if(new Set(content.problems.map(x=>x.topicId)).size!==5 || new Set(content.steps.map(x=>x.topicId)).size!==3)throw Error('Duplicate learning topic');
 for(const problem of content.problems)if(!p.topics.find(t=>t.id===problem.topicId)?.problems.includes(problem.text))throw Error('problem topic mismatch');
 for(const step of content.steps) {
  const topic=p.topics.find(t=>t.id===step.topicId),problem=content.problems.find(t=>t.topicId===step.topicId);
  if(!topic||!problem||step.problem!==problem.text||step.diagnosis!==topic.diagnosis||step.action!==topic.action)throw Error('problem / diagnosis / lesson_action mismatch');
 }
 return true;
}
module.exports={createLearningContent,validatePools,validateSelection};
