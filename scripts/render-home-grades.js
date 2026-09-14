const content = require('../config/home-grade-content');

function renderHomeGrades(targets, photo, escape) {
  return targets.map((target, i) => {
    const grade = content[target.value];
    if (!grade) throw new Error(`Homepage grade content missing: ${target.value}`);
    return `<article class="he-grade-lesson he-grade-lesson-${grade.key}${i % 2 ? ' he-grade-lesson-reverse' : ''}" aria-labelledby="grade-title-${grade.key}"><header class="he-grade-lesson-heading"><p class="he-label">${grade.label}</p><h3 id="grade-title-${grade.key}">${escape(target.value)}</h3><p>${escape(grade.summary)}</p></header><div class="he-grade-lesson-layout"><figure class="he-grade-lesson-photo">${photo(`/images/${grade.key}-tutoring.webp`, `${target.value} 1:1 맞춤과외 학습`)}</figure><ol class="he-grade-areas">${grade.areas.map(([title, description], n) => `<li><span class="he-number">0${n + 1}</span><h4>${escape(title)}</h4><p>${escape(description)}</p></li>`).join('')}</ol></div><a class="he-text-link he-grade-lesson-link" href="${escape(target.url)}">${escape(target.value)} 수업 보기 <span aria-hidden="true">→</span></a></article>`;
  }).join('');
}
module.exports = { renderHomeGrades };
