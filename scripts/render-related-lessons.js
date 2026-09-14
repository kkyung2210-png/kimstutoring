const {classifyTopic,validateText} = require('./content-intelligence');
const CARD_COPY = Object.freeze({
  elementary_english:'기초 어휘·문장 이해·읽기',
  middle_english:'문법·독해·학교별 내신',
  high_english:'구문독해·내신·모의고사·수능',
  elementary_math:'연산·기초개념·문제 이해',
  middle_math:'개념·유형별 문제풀이·내신',
  high_math:'내신·모의고사·수능·취약단원',
});
function renderRelatedLessons(page, pagesBySlug, relatedIndex, hubIndex, escapeHtml) {
  const slugs=relatedIndex[page.slug]?.localLessons;
  if(!Array.isArray(slugs))throw Error(`${page.slug}: 관련 수업 인덱스 누락`);
  if(slugs.length>5 || new Set(slugs).size!==slugs.length)throw Error(`${page.slug}: 관련 링크 개수/중복 오류`);
  const cards=slugs.map(slug=>{
    const destination=pagesBySlug.get(slug);
    if(!destination || slug===page.slug || destination.region!==page.region || destination.province!==page.province)throw Error(`${page.slug}: 잘못된 관련 목적지 ${slug}`);
    const type=classifyTopic(destination), description=CARD_COPY[type];
    if(!description)throw Error(`${slug}: 카드 설명 누락`);
    validateText(type,description+' '+destination.keyword,`${slug}/related card`);
    return `<li data-related-template="${type}"><a href="/${escapeHtml(slug)}/">${escapeHtml(destination.keyword)}</a><p>${escapeHtml(description)}</p></li>`;
  }).join('');
  const hubs=[
    ['region',hub=>hub.province===page.province&&hub.region===page.region,`${page.region} 과외 전체 보기`],
    ['subject',hub=>hub.value===page.subject,`${page.subject}과외 수업 보기`],
    ['target',hub=>hub.value===page.target,`${page.target} 과외 보기`],
  ].map(([type,match,label])=>{
    const matches=(hubIndex[type]||[]).filter(match);
    if(matches.length!==1 || !matches[0].url.startsWith(`/hub/${type}/`))throw Error(`${page.slug}: ${type} 허브 누락 또는 중복`);
    return `<li><a href="${escapeHtml(matches[0].url)}">${escapeHtml(label)}</a></li>`;
  }).join('');
  return `<section class="section internal-links-section tutoring-related" id="related" aria-labelledby="related-title"><div class="container"><h2 id="related-title">관련 수업 둘러보기</h2><p>같은 지역에서 다른 학교급이나 과목의 수업을 비교해 보세요.</p><ul class="tutoring-related-list">${cards}</ul><nav aria-label="지역·과목·학교급별 수업"><ul class="tutoring-hub-links">${hubs}</ul></nav></div></section>`;
}
module.exports={renderRelatedLessons,CARD_COPY};
