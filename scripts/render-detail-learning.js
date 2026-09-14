// Detail-only presentation. Links, schema, images and the shared template remain owned by the generator.
function renderLearningSections(page,escape) {
 const c=page.intelligence.learning;
 const names={problems:"problem",diagnosis:"diagnosis",process:"lesson","self-study":"selfstudy","student-types":"student-type","lesson-method":"mode"};
 const section=(id,title,body,soft=false)=>`<section class="section learning-section detail-${names[id]}" id="${id}"><div class="container"><div class="section-heading"><h2>${title}</h2></div>${body}</div></section>`;
 return section('problems','혹시 이런 모습이 반복되고 있나요?',`<ul class="learning-problems">${c.problems.map(p=>`<li data-problem-topic="${p.topicId}">${escape(p.text)}</li>`).join('')}</ul>`)
 +section('diagnosis','어디에서 막히고 있는지 먼저 확인합니다',`<ol class="learning-diagnosis">${c.steps.map((s,i)=>`<li data-diagnosis-topic="${s.topicId}"><span class="learning-number" aria-hidden="true">0${i+1}</span><div><h3>${escape(s.problem)}</h3><p>${escape(s.diagnosis)}</p></div></li>`).join('')}</ol>`,true)
 +section('process','그래서 수업은 이렇게 달라집니다',`<div class="learning-actions">${c.steps.map(s=>`<article data-action-topic="${s.topicId}"><h3>${escape(s.problem)}</h3><p>${escape(s.action)}</p></article>`).join('')}</div>`)
 +section('self-study','수업이 없는 날의 공부까지 연결합니다.',`<p class="learning-intro">수업에서 이해한 내용을 혼자 다시 해보는 과정도 함께 살펴봅니다. 실제로 해본 분량과 막힌 부분을 확인하며 다음 계획을 조절합니다.</p><div class="learning-coaching">${c.coaching.map((s,i)=>`<article><p class="learning-label" aria-hidden="true">0${i+1} ${["WHAT","WHEN","REVIEW","CHECK"][i]}</p><h3>${escape(s.title)}</h3><p>${escape(s.text)}</p></article>`).join('')}</div>`,true)
 +section('student-types','학년이 같아도 필요한 수업은 다릅니다.',`<dl class="learning-types">${c.studentTypes.map(s=>`<div><dt>${escape(s.title)}</dt><dd>${escape(s.text)}</dd></div>`).join('')}</dl>`)
 +section('lesson-method','학생의 상황에 맞는 방식으로 1:1 수업',`<p class="learning-intro">${escape(page.intelligence.availability)}</p><div class="learning-modes"><article><h3>방문수업</h3><p>거주 지역과 희망 일정, 강사 배정을 확인해 가능한 경우 방문수업을 진행합니다.</p></article><article><h3>화상수업</h3><p>실시간으로 교재와 학습 내용을 함께 확인하고, 이해되지 않는 부분을 질문하며 수업할 수 있습니다.</p></article></div>`,true);
}
module.exports={renderLearningSections};
