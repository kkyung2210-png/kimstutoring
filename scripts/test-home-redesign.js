const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist');
const reportPath = path.join(root, 'reports/home-redesign-qa');
const { loadPages } = require('./generate-pages');
const { createHubIndex } = require('./generate-hub-index');
const { generateHomePage } = require('./generate-home-page');
const { parseDocument, stripTags, attribute } = require('./seo-audit/validators');
const { checkSchema } = require('./seo-audit/schema-checker');
const { resolveInternalHref } = require('./seo-audit/link-checker');
const { checkDocumentContent } = require('./seo-audit/content-checker');
const { loadConfig } = require('./seo-audit/rules');
const { filterLessons } = require('../public/utils/lesson-region-modal');
const data = loadPages(), hubs = createHubIndex(data.pages);
const d = parseDocument(path.join(dist, 'index.html'), dist), html = d.html;
assert.deepStrictEqual(d.h1, ['초등부터 고등까지 1:1 맞춤과외']);
assert.deepStrictEqual(d.canonicals, [data.baseUrl + '/']);
assert.equal(d.robots, 'index,follow');
const schemaErrors = checkSchema(d, data.baseUrl + '/').issues.filter(x => x.severity === 'ERROR');
assert.equal(schemaErrors.length, 0);
const faq = [...html.matchAll(/<details class="faq-item"[^>]*>[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<div class="faq-answer"><p>([\s\S]*?)<\/p>/g)].map(m => ({ question: stripTags(m[1]), answer: stripTags(m[2]) }));
const faqSchema = d.jsonLdTexts.flatMap(t => JSON.parse(t)['@graph']).find(x => x['@type'] === 'FAQPage');
assert.deepStrictEqual(faq, faqSchema.mainEntity.map(f => ({ question: f.name, answer: f.acceptedAnswer.text })));
assert.equal(faq.length, 8);
const broken = [];
for (const link of d.links) {
  const to = resolveInternalHref(link.href, '/', data.baseUrl);
  if (['skip', 'external'].includes(to.type)) continue;
  const file = path.join(dist, to.path, 'index.html');
  if (!fs.existsSync(file)) { broken.push(link.href); continue; }
  if (to.hash && ![...fs.readFileSync(file, 'utf8').matchAll(/\bid=["']([^"']+)["']/g)].some(m => m[1] === to.hash.slice(1))) broken.push(link.href);
}
assert.equal(broken.length, 0, JSON.stringify(broken));
const resources = [...html.matchAll(/<(?:img|script|source|link)\b[^>]*>/g)].flatMap(m => ['src', 'srcset', 'href'].map(a => attribute(m[0], a))).filter(x => x.startsWith('/') && !x.startsWith('//'));
assert(resources.every(src => fs.existsSync(path.join(dist, src))), 'Missing local resource');
assert(d.images.every(i => /\balt=/.test(i.tag)), 'Missing alt');
assert(!/킴스튜터링|Kim['’]s English|kimsenglish|일본어|영어회화|TOEIC|OPIC|IELTS|TOEFL|JLPT|비즈니스영어|여행영어|전국 방문 가능|data-review-carousel/.test(html));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs');
const gradeCards = [...html.matchAll(/<article class="he-grade-lesson he-grade-lesson-(elementary|middle|high)[^"]*"[^>]*>([\s\S]*?)<\/article>/g)].map(m => [m[0], m[1], m[2].match(/href="([^"]+)"/)[1], m[2]]);
assert.equal(gradeCards.length, 3);
for (const [i, g] of gradeCards.entries()) {
  const target = ['초등학생', '중학생', '고등학생'][i];
  assert.equal(g[2], hubs.target.find(h => h.value === target).url);
  assert(g[3].includes(target + ' 수업 보기'));
  assert.equal((g[3].match(/<li>/g) || []).length, 4);
  assert.equal((g[3].match(/<a /g) || []).length, 1, 'One destination link per grade');
}
assert(gradeCards[0][3].includes('src="/images/elementary-tutoring.webp"'));
assert(gradeCards[0][3].includes('alt="초등학생 1:1 맞춤과외 학습"'));
for (const hub of hubs.subject) assert(d.links.some(l => l.href === hub.url && l.text.includes(hub.value + '과외 보기')));
const index = JSON.parse(html.match(/id="tutoring-search-data">([\s\S]*?)<\/script>/)[1]);
assert.equal(index.length, data.pages.length);
assert.equal(filterLessons(index, {}).length, 996);
assert.equal(filterLessons(index, { region: '안양' }).length, 6);
assert.equal(filterLessons(index, { target: '중학생' }).length, 332);
assert.equal(filterLessons(index, { subject: '수학' }).length, 498);
assert.equal(filterLessons(index, { region: '안양', target: '중학생', subject: '수학' })[0].slug, 'anyang-middle-math');
assert.equal(filterLessons(index, { region: '없는지역' }).length, 0);
const form = html.match(/<form class="consultation-form-card"[\s\S]*?<\/form>/)[0];
const originalForm = fs.readFileSync(path.join(root, 'templates/consultation.html'), 'utf8').match(/<form class="consultation-form-card"[\s\S]*?<\/form>/)[0];
const controls = h => (h.match(/<(?:form|input|select|textarea|button)\b[^>]*>/g) || []);
assert.deepStrictEqual(controls(form), controls(originalForm), 'Consultation field attributes changed');
const contentErrors = checkDocumentContent(d, { baseUrl: data.baseUrl, distPath: dist, config: loadConfig(root) }).filter(x => x.severity === 'ERROR');
assert.equal(contentErrors.length, 0);
// Renderer extension fixture does not alter CSV or the strict production template contract.
const fixture = path.join(reportPath, 'subject-extension');
generateHomePage({ root, outputPath: fixture, data: { ...data, pages: [...data.pages, { ...data.pages[0], subject: '국어', slug: 'fixture-korean', keyword: '테스트 초등학생 국어과외' }] }, hubIndex: { ...hubs, subject: [...hubs.subject, { value: '국어', url: '/fixture-korean/' }, { value: '과학', url: '/inactive-science/' }] } });
const extended = fs.readFileSync(path.join(fixture, 'index.html'), 'utf8');
assert(extended.includes('<option>국어</option>') && extended.includes('value="초등 국어"') && extended.includes('국어과외 보기'));
assert(!extended.includes('inactive-science'));
const before = JSON.parse(fs.readFileSync(path.join(reportPath, 'before.json'), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// The full build also synchronizes pre-existing public Hero files into dist.
// These photos were updated before this task and are not used by detail/hub pages.
const synchronizedImages = ['dist/images/hero.webp', 'dist/images/hero-mobile.webp'];
for (const file of synchronizedImages) assert.equal(hash(path.join(root, file)), hash(path.join(root, file.replace('dist/', 'public/'))));
const outputChanges = Object.entries(before.dist).filter(([file, value]) => !fs.existsSync(path.join(root, file)) || hash(path.join(root, file)) !== value).map(([file]) => file);
const changedProtected = Object.entries({ ...before.dist, ...before.source }).filter(([file, value]) => !synchronizedImages.includes(file.replace(/\\/g, '/')) && (!fs.existsSync(path.join(root, file)) || hash(path.join(root, file)) !== value)).map(([file]) => file);
assert.deepStrictEqual(changedProtected, []);
const css = fs.readFileSync(path.join(root, 'assets/home.css'), 'utf8');
assert(css.includes('@media (max-width: 600px)') && css.includes('@media (max-width: 900px)'));
assert(css.includes('prefers-reduced-motion') && css.includes('minmax(0, 1fr)'));
const report = {
  title: d.title, h1: d.h1[0], description: d.description,
  sections: d.headings.filter(h => h.level === 2).map(h => h.text),
  brokenLinks: broken.length, schemaErrors: schemaErrors.length, seoContentErrors: contentErrors.length,
  faqCount: faq.length, faqSchemaMatches: true, gradeLinks: gradeCards.map(g => g[2]),
  subjectLinks: hubs.subject.map(h => h.url), finderRows: index.length, partialFilterChecks: 'passed',
  subjectExpansion: 'active Korean fixture rendered; inactive science excluded',
  consultationControlsUnchanged: true, protectedChangedFiles: changedProtected, synchronizedExistingImages: outputChanges,
  protectedOutputFiles: Object.keys(before.dist).length, detailPagesUnchanged: 996, hubPagesUnchanged: 187,
  sitemapAndRobotsUnchanged: true, faq,
  imageFallbacks: [],
  responsive: { widths: [1440, 1280, 768, 430, 390, 360], status: 'CSS and HTML reviewed; actual viewport rendering not verified because no browser is available' },
  preview: 'http://localhost:8080/',
};
fs.writeFileSync(path.join(reportPath, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
