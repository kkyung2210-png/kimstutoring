const brand = require('../config/brand');
const subjectContent = require('../config/home-subject-content');
const fs = require('fs'), path = require('path');
const { renderHomeGrades } = require('./render-home-grades');
const { getHomeContent } = require('../config/home-content');
const { makeJsonLd } = require('./generate-schema');
const { resolveHeroAsset, imageSize } = require('./utils/assets/resolve-asset');
const { renderPicture } = require('./utils/assets/image-html');

// Homepage-only layout. Shared templates, data contracts and client behavior stay intact.
function generateHomePage({ root, outputPath, data, hubIndex }) {
  const { escapeHtml: e, renderTemplate, brandTemplateValues } = require('./generate-pages');
  const arrow = '<span aria-hidden="true">↗</span>';
  const targets = ['초등학생', '중학생', '고등학생'].map(value => hubIndex.target.find(h => h.value === value)).filter(Boolean);
  const activeSubjects = new Set(data.pages.map(p => p.subject));
  const subjectHubs = hubIndex.subject.filter(h => activeSubjects.has(h.value)).sort((a, b) => {
    const order = ['영어', '수학', '국어'];
    const rank = value => order.includes(value) ? order.indexOf(value) : order.length;
    return rank(a.value) - rank(b.value) || a.value.localeCompare(b.value, 'ko');
  });
  const { subjectNames, subjectDescription, steps, faqs, coaching } = getHomeContent(subjectHubs);
  const hero = resolveHeroAsset(root);
  const availableImage = (file, fallback) => fs.existsSync(path.join(root, 'public', file)) ? '/' + file : fallback;
  const photo = (src, alt, cls = '') => {
    const { width, height } = imageSize(root, src);
    return `<img class="${e(cls)}" src="${e(src)}" alt="${e(alt)}" width="${width}" height="${height}" loading="lazy" decoding="async">`;
  };
  const grades = renderHomeGrades(targets, photo, e);
  // Optional presentation metadata; additional active subjects have a generic layout fallback.
  const subjectDesign = {
    영어: { label: 'ENGLISH', image: '/images/english-tutoring.webp', alt: '영어 독해와 학습을 진행하는 1:1 영어과외', copy: '단어 하나에서,\n지문을 읽는 힘까지.', position: 'he-photo-right' },
    국어: { label: 'KOREAN', fullImage: true, image: '/images/korean-tutoring.webp', alt: '국어 글 읽기와 표현을 연습하는 1:1 맞춤수업', copy: '읽는 것에서,\n이해하고 표현하는 힘으로.', position: 'he-photo-right' },
    수학: { label: 'MATHEMATICS', image: '/images/math-tutoring.webp', alt: '수학 문제풀이와 오답학습을 진행하는 수학과외', copy: '답을 찾는 것에서,\n풀이를 이해하는 것으로.', position: '' },
  };
  const subjects = subjectHubs.map((h, i) => {
    const s = subjectDesign[h.value] || { label: 'SUBJECT', image: hero.desktop.src, copy: '지금 필요한 배움부터,\n학생의 속도에 맞게.', position: 'he-photo-right' };
    const detail = subjectContent[h.value];
    const lessons = detail ? '<ol class="he-subject-lessons">' + detail.lessons.map(([title, text], n) => `<li><span class="he-subject-number">0${n + 1}</span><div><h4>${e(title)}</h4><p>${e(text)}</p></div></li>`).join('') + '</ol>' : '';
    const stages = detail ? '<dl class="he-subject-stages" aria-label="학년별 수업 중심">' + detail.stages.map(([target, text]) => `<div><dt>${e(target)}</dt><dd>${e(text)}</dd></div>`).join('') + '</dl>' : '';
    return `<article class="he-subject-row${i % 2 ? ' he-subject-reverse' : ''}"><div class="he-subject-copy he-subject-heading"><p class="he-label">${s.label}</p><h3>${e(h.value)}</h3><p class="he-subject-statement">${e(s.copy).replace('\n', '<br>')}</p></div><div class="he-subject-photo${s.fullImage ? ' he-subject-photo-full' : ''}">${fs.existsSync(path.join(root,'public',s.image)) ? photo(s.image, s.alt || '교재를 살펴보며 함께 공부하는 모습', s.position) : '<div class="he-subject-placeholder" role="img" aria-label="국어 수업 이미지 준비 중"><p>읽고, 이해하고,<br>자신의 말로 표현합니다.</p></div>'}</div><div class="he-subject-copy he-subject-detail"><p>${e(detail?.description || subjectDescription(h.value))}</p>${lessons}${stages}<a class="he-text-link" href="${e(h.url)}">${e(h.value)}과외 보기 ${arrow}</a></div></article>`;
  }).join('');
  const availablePairs = new Set(data.pages.map(p => p.target + '|' + p.subject));
  const shortTarget = { 초등학생: '초등', 중학생: '중등', 고등학생: '고등' };
  const lessonOptions = targets.flatMap(t => subjectHubs.filter(h => availablePairs.has(t.value + '|' + h.value)).map(h => {
    const name = shortTarget[t.value] + ' ' + h.value;
    return `<option value="${e(name)}">${e(name)}</option>`;
  })).join('');
  const index = data.pages.map(({ slug, keyword, province, region, target, subject }) => ({ slug, keyword, province, region, target, subject }));
  const learningSteps = [
    ['현재 수준 확인', '지금 사용하는 교재와 학습 상황을 살펴봅니다.'],
    ['취약 부분 파악', '개념과 적용 사이에서 어려운 지점을 확인합니다.'],
    ['학습 방향 설정', '학생에게 필요한 학습 순서와 분량을 함께 정합니다.'],
    ['1:1 수업', '이해하는 속도에 맞춰 설명하고 충분히 연습합니다.'],
    ['복습과 오답관리', '틀린 이유를 되짚고 배운 내용을 다시 확인합니다.'],
  ];
  const consultation = fs.readFileSync(path.join(root, 'templates/consultation.html'), 'utf8')
    .replace('나에게 맞는 수업,<br>무료 상담으로 시작해보세요.', '어디서부터 공부해야 할지<br>고민이라면')
    .replace('희망하는 수업과 현재 고민을 남겨주시면<br>확인 후 순차적으로 연락드리겠습니다.', '현재 학습 상황과 어려운 부분을 알려주세요.<br>학생에게 필요한 학습 방향과 수업 방법을 함께 상담합니다.')
    .replace('</div><form', `<p class="he-consult-phone">전화 상담 <a href="${e(brand.phoneHref)}">${e(brand.phone)}</a></p></div><form`)
    .replace('무료 상담 신청하기</button>', '무료 상담 신청 <span aria-hidden="true">→</span></button>')
    .replace(/(<select id="consultation-lesson"[^>]*>)[\s\S]*?<\/select>/, (_, start) => start + '<option value="">희망 수업을 선택해 주세요</option>' + lessonOptions + '</select>');
  const main = `
  <section class="he-hero"><div class="he-wrap he-hero-grid">
    <div class="he-hero-copy"><p class="he-eyebrow">학생마다 다른 공부,<br>수업도 달라야 하니까</p><h1>초등부터 고등까지<br>1:1 맞춤과외</h1><p class="he-lead">${e(subjectNames)} 기초부터 학교별 내신과 시험 대비까지,<br>학생의 현재 실력과 학습 목표에 맞춰<br>1:1 맞춤수업을 진행합니다.</p><div class="he-actions"><a class="he-button" href="#consultation">무료 상담 신청 <span aria-hidden="true">→</span></a><a class="he-phone-secondary" href="${e(brand.phoneHref)}">전화 상담</a><a class="he-text-link" href="#lessons">맞춤 수업 찾기 ${arrow}</a></div></div>
    <figure class="he-hero-figure">${renderPicture({ desktop: hero.desktop, mobile: hero.mobile, className: 'he-hero-photo', alt: '학생과 선생님의 1:1 맞춤과외 수업' })}<figcaption><span>나의 속도로, 나의 가능성으로.</span><span>Kim's Tutoring</span></figcaption></figure>
  </div><ol class="he-wrap he-principles"><li><span>01</span><p>학생별 학습 설계</p></li><li><span>02</span><p>1:1 맞춤수업</p></li><li><span>03</span><p>학습 과정 관리</p></li></ol></section>
  <section class="he-section he-cream" id="grades"><div class="he-wrap"><div class="he-heading"><p class="he-label">LEARNING STAGES</p><h2>학년별 수업</h2><p>초등부터 고등까지 학년과 학습 목표에 맞춘 1:1 수업을 살펴보세요.</p></div><div class="he-grade-lessons">${grades}</div></div></section>
  <section class="he-section" id="subjects"><div class="he-wrap"><div class="he-heading"><p class="he-label">OUR SUBJECTS</p><h2>기본을 탄탄하게.<br>배움은 더 깊게.</h2></div>${subjects}</div></section>
  <section class="he-section he-coaching he-cream" id="study-coaching" aria-labelledby="study-coaching-title"><div class="he-wrap"><div class="he-coaching-layout"><div class="he-heading he-coaching-intro"><p class="he-label">STUDY COACHING</p><p class="he-coaching-name">자기주도학습 코칭</p><h2 id="study-coaching-title">${e(coaching.title).replace('\n', '<br>')}</h2><p>${e(coaching.introduction)}</p><p>${e(coaching.context)}</p><p class="he-coaching-concern">${e(coaching.concern)}</p></div><ol class="he-coaching-list">${coaching.items.map(([key, title, description], i) => `<li><div class="he-coaching-index"><span class="he-number">0${i + 1}</span><span class="he-label">${e(key)}</span></div><h3>${e(title)}</h3><p>${e(description)}</p></li>`).join('')}</ol></div><div class="he-coaching-foot"><p class="he-coaching-emphasis">${e(coaching.emphasis)}</p><p>${e(coaching.individual)}</p></div></div></section>
  <section class="he-section he-blue" id="approach"><div class="he-wrap he-two-col"><div class="he-heading"><p class="he-label">A PLAN FOR ONE</p><h2 class="he-statement">학생마다<br>막히는 부분은<br>다릅니다.</h2><p>그래서 수업의 출발점도 달라야 합니다.<br>지금 필요한 배움을 함께 찾습니다.</p></div><ol class="he-learning-flow">${learningSteps.map(([a, b], i) => `<li><span class="he-number">0${i + 1}</span><div><h3>${a}</h3><p>${b}</p></div></li>`).join('')}</ol></div></section>
  <section class="he-section" id="lesson-method"><div class="he-wrap"><div class="he-heading"><p class="he-label">WAYS TO LEARN</p><h2>학생에게 맞는 방식으로<br>1:1 수업</h2></div><div class="he-modes"><article class="he-mode"><div class="he-mode-photo">${photo('/images/visit-tutoring.webp', '학생의 집에서 진행하는 1:1 방문과외')}</div><div class="he-mode-copy"><span class="he-label">IN PERSON</span><h3>마주 앉아, 차근차근.<small>방문수업</small></h3><p>지역과 일정, 강사 배정을 확인해 가능한 경우 1:1 방문수업으로 진행합니다.</p></div></article><article class="he-mode he-mode-video"><div class="he-mode-photo">${photo('/images/video-tutoring.webp', '노트북으로 진행하는 실시간 1:1 화상과외')}</div><div class="he-mode-copy"><span class="he-label">LIVE ONLINE</span><h3>익숙한 공간에서, 함께.<small>화상수업</small></h3><p>이동 부담 없이 원하는 장소에서 실시간 1:1 화상수업으로 진행할 수 있습니다.</p></div></article></div><p class="he-method-note">방문수업 가능 여부는 지역과 일정, 강사 배정에 따라 상담 후 안내합니다.</p></div></section>
  <section class="he-section he-cream" id="lessons"><div class="he-wrap"><div class="he-heading"><p class="he-label">FIND YOUR TUTORING</p><h2>우리동네 1:1 과외수업</h2><p>지역과 학년, 과목을 선택해<br>원하는 1:1 과외수업을 확인해보세요.</p></div><form class="tutoring-finder he-finder" data-tutoring-finder><label><span>01 · 지역</span><input name="region" type="search" placeholder="예: 안양, 수원" autocomplete="off" list="home-region-options"></label><datalist id="home-region-options">${[...new Set(data.pages.map(p => p.province + ' ' + p.region))].map(region => `<option value="${e(region)}"></option>`).join('')}</datalist><label><span>02 · 학년</span><select name="target"><option value="">전체 학년</option>${targets.map(h => `<option>${e(h.value)}</option>`).join('')}</select></label><label><span>03 · 과목</span><select name="subject"><option value="">전체 과목</option>${subjectHubs.map(h => `<option>${e(h.value)}</option>`).join('')}</select></label><div class="he-finder-actions"><button type="submit" class="he-button">맞춤 수업 보기 <span aria-hidden="true">→</span></button><button type="reset" class="he-text-link">조건 초기화</button></div></form><script type="application/json" id="tutoring-search-data">${JSON.stringify(index).replace(/</g, '\\u003c')}</script><noscript><p>검색 기능을 사용하려면 JavaScript를 켜주세요. 학년별 수업·과목별 과외 링크에서도 수업을 찾을 수 있습니다.</p></noscript></div></section>
  <section class="he-section" id="process"><div class="he-wrap"><div class="he-heading"><p class="he-label">GETTING STARTED</p><h2>처음 상담부터,<br>꾸준한 학습까지.</h2></div><ol class="he-timeline">${steps.map(([a, b], i) => `<li><span class="he-number">0${i + 1}</span><h3>${a}</h3><p>${b}</p></li>`).join('')}</ol></div></section>
  <section class="he-section he-faq" id="faq"><div class="he-wrap he-two-col"><div class="he-heading"><p class="he-label">QUESTIONS & ANSWERS</p><h2>궁금한 점을<br>확인해보세요.</h2></div><div class="faq-list">${faqs.map(f => `<details class="faq-item"><summary><h3>${e(f.question)}</h3></summary><div class="faq-answer"><p>${e(f.answer)}</p></div></details>`).join('')}</div></div></section>
  ${consultation}
  <dialog class="he-finder-dialog" data-finder-dialog aria-labelledby="finder-dialog-title"><div class="he-finder-dialog-heading"><h2 id="finder-dialog-title">맞춤 수업 검색 결과</h2><button type="button" class="he-text-link" data-finder-close aria-label="검색 결과 닫기">닫기 ×</button></div><p data-finder-dialog-status role="status" aria-live="polite"></p><ul class="he-finder-dialog-list" data-finder-dialog-results></ul><nav class="he-finder-dialog-pages" aria-label="검색 결과 페이지"><button type="button" class="he-text-link" data-finder-prev>이전</button><span data-finder-page></span><button type="button" class="he-text-link" data-finder-next>다음</button></nav></dialog>`;
  const title = brand.name + ' | 초등부터 고등까지 1:1 맞춤과외';
  const description = brand.name + '는 초등학생부터 고등학생까지 현재 실력과 목표에 맞춘 ' + subjectNames + ' 1:1 수업을 안내합니다. 방문 또는 화상수업은 지역·일정·강사 배정을 확인해 상담하며, 무료 상담으로 학습 방향을 함께 정합니다.';
  const schema = makeJsonLd({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', name: brand.name, alternateName: brand.englishName, url: data.baseUrl + '/', inLanguage: 'ko' },
    { '@type': 'Organization', name: brand.name, alternateName: brand.englishName, url: data.baseUrl + '/' },
    { '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
  ] });
  const header = require('./render-editorial-header').renderEditorialHeader(e,{home:true});
  const template = data.template.replace('<body>', '<body class="home-editorial">')
    .replace(/<header class="site-header">[\s\S]*?<\/header>/, header)
    .replace('</head>', '<link rel="stylesheet" href="/home.css">\n</head>');
  fs.mkdirSync(outputPath, { recursive: true });
  fs.copyFileSync(path.join(root, 'assets/home.css'), path.join(outputPath, 'home.css'));
  fs.writeFileSync(path.join(outputPath, 'index.html'), renderTemplate(template, {
    ...brandTemplateValues(null, data.baseUrl), LANG: 'ko', TITLE: e(title), DESCRIPTION: e(description),
    CANONICAL_URL: e(data.baseUrl + '/'), STRUCTURED_DATA: schema, MAIN: main,
    MOBILE_CONTACT_URL: '#consultation', NAV_LINK: '#lessons', NAV_TEXT: '수업 찾기', FOOTER_LINK: '/', FOOTER_TEXT: '홈',
  }));
}
module.exports = { generateHomePage };
