const assert = require('assert');
const { loadPages } = require('./generate-pages');
const { loadContentConfig, validateText } = require('./content-intelligence');
function validate() {
  loadContentConfig();
  const first = loadPages();
  const second = loadPages();
  assert.deepStrictEqual(first.pages, second.pages, '콘텐츠 선택이 deterministic하지 않습니다.');
  for (const page of first.pages) {
    validateText(page.template, JSON.stringify({title:page.title,description:page.description,content:page.content,intelligence:page.intelligence}), page.slug);
  }
  console.log(`콘텐츠 검사 통과: ${first.pages.length}개 (template/target/subject, 토픽, deterministic)`);
}
if (require.main === module) {
  if (process.argv.includes('--sample')) require('./test-tutoring-content').test();
  else validate();
}
module.exports = { validate };
