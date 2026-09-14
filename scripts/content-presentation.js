const {classifyTopic, validateText, PROFILES} = require('./content-intelligence');
const pools = require('../config/content/descriptions.json');
const {createHash} = require('crypto');

function validateDescriptionPools(config = pools) {
  for (const type of Object.keys(PROFILES)) {
    for (const [name, minimum] of Object.entries({openings:6, goals:6, lessons:6, modes:4})) {
      const values = config.templates?.[type]?.[name];
      if (!Array.isArray(values) || new Set(values).size < minimum) throw Error(`${type}/${name}: description 전용 풀 부족`);
      for (const value of values) {
        validateText(type, value, `description/${name}`);
        if (/{{(?!region}}|target}}|target_short}}|subject}})/.test(value)) throw Error('description 변수 오류');
      }
    }
  }
  return config;
}
validateDescriptionPools();

// CSV remains semantic source data. Only complete sentences enter presentation slots.
function sentence(value) {
  let text = String(value || '').trim().replace(/^핵심 고민은\s*[“"]/, '').replace(/[”"]입니다\.?$/, '');
  text = text.replace(/어려움이 있음[.]?$/, '어려움이 있습니다.').replace(/어려움[.]?$/, '어렵습니다.')
    .replace(/막막함[.]?$/, '막막합니다.').replace(/오래 걸림[.]?$/, '오래 걸립니다.')
    .replace(/부담스러워함[.]?$/, '부담스러워합니다.').replace(/반복됨[.]?$/, '반복됩니다.')
    .replace(/습관 형성[.]?$/, '습관을 기르는 데 초점을 둡니다.')
    .replace(/능력 향상[.]?$/, '능력을 기를 수 있도록 연습합니다.')
    .replace(/지도[.]?$/, '지도합니다.');
  return /[.!?]$/.test(text) ? text : text + '.';
}
function presentFields(page, fields) {
  const type = classifyTopic(page);
  // Audience sentences are independently authored; the original intent still seeds selection and is validated by the loader.
  const audiences = {
    elementary_english:'기초 어휘와 짧은 문장 읽기를 익히며 꾸준히 복습하려는 학생',
    middle_english:'문법과 독해를 보완하면서 내신·서술형·수행평가를 함께 준비하려는 학생',
    high_english:'구문독해와 지문 분석을 보완하며 내신과 모의고사·수능을 준비하려는 학생',
    elementary_math:'연산과 기초개념을 익히고 문제를 차근차근 풀어보려는 학생',
    middle_math:'개념을 문제에 적용하며 내신·서술형과 오답관리를 함께 준비하려는 학생',
    high_math:'취약단원을 보완하고 풀이 전략을 점검하며 내신과 모의고사·수능을 준비하려는 학생',
  };
  const method = fields.method.replace(/^지역과 일정에 따라 1:1 방문수업 또는 화상수업으로 진행하며[,]?\s*/, '');
  return {...fields, intent:audiences[type], concern:sentence(fields.concern), method:sentence(method), result:sentence(fields.result)};
}
function makeDescription(page, context) {
  const type = classifyTopic(page), pool = pools.templates[type];
  const semanticSeed = [page.slug, type, page.searchIntent, page.summary, page.lessonFocus, page.lessonMethod, page.lessonResult].join('|');
  const variables = {...context, region:page.region, target:page.target, subject:page.subject};
  const render = text => text.replace(/{{(\w+)}}/g, (_, key) => variables[key]);
  // Independent salts prevent correlated slot choices. Retry only for length, never substitute another type.
  for (let attempt=0; attempt<256; attempt++) {
    const text = ['openings','goals','lessons','modes'].map(name => {
      const choices=pool[name];
      const hash = createHash('sha256').update(`${semanticSeed}|${name}|${attempt}`).digest().readUInt32BE(0);
      return render(choices[hash%choices.length]);
    }).join(' ');
    if (text.length>=100 && text.length<=155) { validateText(type,text,'description'); return text; }
  }
  throw Error(`${page.slug}: 100–155자 description 조합 실패`);
}
module.exports={presentFields,makeDescription,validateDescriptionPools};
