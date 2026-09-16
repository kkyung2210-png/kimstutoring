const {presentFields, makeDescription: descriptionFromPools} = require('./content-presentation');
// 외부 패키지 없이 Node.js 기본 기능만 사용하는 정적 페이지 생성기입니다.
const fs = require("fs");
const path = require("path");
const { makeJsonLd, makePageSchema } = require("./generate-schema");
const { PROFILES, TYPES, validateText, classifyTopic, createPageContent } = require("./content-intelligence");
const brandAssets = require("../config/brand-assets");
const { SITE_URL } = require("../config/site");
const {
  config: assetConfig, resolveCtaAsset, resolveEntry, resolveFeatureAsset, resolveHeroAsset,
  resolveLogoAsset, resolveOgAsset, resolvePageAsset, resolveProcessAsset, resolveSubjectAsset,
} = require("./utils/assets/resolve-asset");
const { renderImageBox, renderLogo, renderOgTags, renderPicture } = require("./utils/assets/image-html");

const root = path.resolve(__dirname, "..");
const csvPath = path.join(root, "pages.csv");
const templatePath = path.join(root, "templates", "page.html");
const productionUrl = SITE_URL;
// 모든 경로 선택은 config/brand-assets.js와 공통 resolver에서 처리합니다.

const CONTENT_TEMPLATE_TYPES = new Set(TYPES);
const CONTENT_TONES = new Set(['친근형','신뢰형','전문형','목표달성형','차분형','코칭형']);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

/** 확인된 연령대와 수강기간만 조합하며, 값이 없으면 보조 줄을 만들지 않습니다. */
function reviewDetailsHtml(review) {
  const details = [review.ageGroup, review.duration].map((value) => String(value || "").trim()).filter(Boolean);
  return details.length ? `<small class="review-details">${details.map(escapeHtml).join(" · ")}</small>` : "";
}

function normalizeSlug(value) {
  const slug = String(value || "").trim().replace(/^\/+|\/+$/g, "").replace(/^pages\//i, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(slug)) throw new Error(`사용할 수 없는 slug입니다: ${slug}`);
  return slug;
}

function renderTemplate(template, values) {
  return template.replace(/{{([A-Z0-9_]+)}}/g, (match, key) => {
    if (!(key in values)) throw new Error(`템플릿 값이 없습니다: ${key}`);
    return values[key];
  });
}

/** 공통 템플릿에서 사용할 로고·아이콘·OG 태그를 한 설정에서 가져옵니다. */
function brandTemplateValues(page = null, baseUrl = productionUrl) {
  const faviconIco = resolveEntry(root, assetConfig.favicon.ico);
  const faviconSvg = resolveEntry(root, assetConfig.favicon.svg);
  const appleTouch = resolveEntry(root, assetConfig.favicon.appleTouch);
  const faviconTags = [
    faviconIco.src ? `<link rel="icon" href="${escapeHtml(faviconIco.src)}">` : "",
    faviconSvg.src ? `<link rel="alternate icon" href="${escapeHtml(faviconSvg.src)}" type="image/svg+xml">` : "",
    appleTouch.src ? `<link rel="apple-touch-icon" href="${escapeHtml(appleTouch.src)}">` : "",
    assetConfig.favicon.manifest ? `<link rel="manifest" href="${escapeHtml(assetConfig.favicon.manifest)}">` : "",
  ].filter(Boolean).join("\n  ");
  return {
    BRAND_NAME: brandAssets.name,
    PHONE_NUMBER: require('../config/brand').phone,
    PHONE_HREF: require('../config/brand').phoneHref,
    BRAND_ENGLISH_NAME: require('../config/brand').englishName,
    COPYRIGHT_YEAR: String(new Date().getFullYear()),
    BRAND_LOGO_MARK: renderLogo(resolveLogoAsset("mark", root)),
    BRAND_LOGO_FULL: renderLogo(resolveLogoAsset("default", root)),
    BRAND_FAVICON_TAGS: faviconTags,
    OG_IMAGE_TAGS: renderOgTags(resolveOgAsset(page, root), baseUrl),
  };
}

function makeBaseUrl(domain) {
  const cleanDomain = String(domain || productionUrl).trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(cleanDomain) ? cleanDomain : `https://${cleanDomain}`;
}

function firstValue(object, ...keys) {
  for (const key of keys) {
    if (object[key] !== undefined && String(object[key]).trim() !== "") return String(object[key]).trim();
  }
  return "";
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inferSuffix(raw, detailKeyword, keyword) {
  const explicit = firstValue(raw, "suffix", "접미어");
  if (explicit) return explicit;
  const candidates = ["과외", "수업", "레슨", "준비", "교육"];
  return candidates.find((candidate) => String(keyword).includes(`${detailKeyword} ${candidate}`) || String(keyword).includes(`${detailKeyword}${candidate}`)) || "";
}

function normalizeTone(value) {
  const tone = String(value || "").trim();
  return CONTENT_TONES.has(tone) ? tone : "차분형";
}

function normalizeContentTemplate(page) { return classifyTopic(page); }

function normalizePage(raw, index) {
  const province = firstValue(raw, "province", "시도");
  const region = firstValue(raw, "region", "지역");
  const target = firstValue(raw, "target", "대상");
  const detailKeyword = firstValue(raw, "detail_keyword", "세부키워드", "subject");
  const keyword = firstValue(raw, "keyword", "최종키워드", "title") || `${region} ${target} ${detailKeyword}`.replace(/\s+/g, " ").trim();
  const title = firstValue(raw, "title") || keyword;
  return {
    ...raw,
    _source: raw,
    id: firstValue(raw, "id") || String(index + 1),
    domain: firstValue(raw, "domain") || productionUrl,
    slug: normalizeSlug(firstValue(raw, "slug")),
    status: firstValue(raw, "status") || "publish",
    language: firstValue(raw, "language") || "ko",
    province,
    region,
    target,
    subject: firstValue(raw, "subject") || detailKeyword,
    detailKeyword,
    suffix: inferSuffix(raw, detailKeyword, keyword),
    category: firstValue(raw, "category", "분류"),
    keyword,
    title,
    providedDescription: firstValue(raw, "description"),
    legacyDescription: firstValue(raw, "description"),
    searchIntent: firstValue(raw, "search_intent", "검색의도"),
    summary: firstValue(raw, "summary", "핵심고민"),
    lessonFocus: firstValue(raw, "lesson_focus", "수업초점"),
    lessonMethod: firstValue(raw, "lesson_method", "수업방식"),
    lessonResult: firstValue(raw, "lesson_result", "기대변화"),
    rawTone: firstValue(raw, "tone", "톤"),
    tone: normalizeTone(firstValue(raw, "tone", "톤")),
    template: firstValue(raw, "template", "본문템플릿"),
  };
}

function validateFinalContent(page) {
  classifyTopic(page);
  const required = {
    search_intent: page.searchIntent, summary: page.summary, lesson_focus: page.lessonFocus,
    lesson_method: page.lessonMethod, lesson_result: page.lessonResult, tone: page.rawTone,
  };
  for (const [name, value] of Object.entries(required)) {
    if (!String(value || "").trim()) throw new Error(`${page.slug}: ${name} 값이 비어 있습니다.`);
  }
  const template = page.template;
  if (!CONTENT_TEMPLATE_TYPES.has(template)) throw new Error(`${page.slug}: template 값이 올바르지 않습니다.`);
  if (CONTENT_TEMPLATE_TYPES.has(page.searchIntent.toLowerCase())) {
    throw new Error(`${page.slug}: search_intent에 template 이름이 들어 있습니다.`);
  }
}

function humanizeSourcePhrase(value) {
  return String(value || "")
    .replace(/차분하고 분명한 안내입니다[.]?/g, "")
    .replace(/체계적으로/g, "꼼꼼하게")
    .replace(/단계적으로/g, "하나씩")
    .replace(/효율적으로/g, "집중해서")
    .replace(/부담 없이/g, "자연스럽게")
    .replace(/쉽게 익힐 수 있습니다/g, "충분히 익힐 때까지 연습합니다")
    .replace(/수업 초점은/g, "수업에서는")
    .replace(/기대 변화는/g, "수업 후에는")
    .replace(/먼저 확인해 보세요/g, "함께 살펴봅니다")
    .replace(/안내합니다/g, "말씀드립니다")
    .replace(/\s+/g, " ")
    .trim();
}

function makeContentContext(page) {
 const type=classifyTopic(page), profile=PROFILES[type];
 const fields={intent:page.searchIntent,concern:page.summary,focus:page.lessonFocus,method:page.lessonMethod,result:page.lessonResult};
 // A transition goal is presentation context, not a high-school lesson for middle-school students.
 if(type==='middle_korean') fields.result=fields.result.replace('고등 국어 학습에 필요한 기본기','다음 국어 학습에 필요한 기본기');
 for(const [name,text] of Object.entries(fields))validateText(type,text,page.slug+'/'+name);
 for(const [name,text] of Object.entries(page))if(/^(faq_|cta_|keyword$|title$)/.test(name))validateText(type,text,page.slug+'/'+name);
 return {province:page.province,city:page.region,region:[page.province,page.region].filter(Boolean).join(' '),target:page.target,target_short:profile.target_short,audience:page.target,service:page.subject+'과외',...presentFields(page,Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,humanizeSourcePhrase(v)]))),tone:page.tone};
}
function makeTitle(page) {
 const p=PROFILES[classifyTopic(page)],focus=p.focus.split('·').slice(0,3).join('·');
 const endings=[focus+' 1:1 맞춤수업',p.target_short+' '+page.subject+' 학습 계획과 상담',focus+' 학습 방향'];
 return page.keyword+' | '+endings[stableHash(page.slug+'|title')%endings.length];
}
function makeDescription(page,context) { return descriptionFromPools(page,context);
}
function pageConsultationLabel(page){return stableHash(page.slug+'|cta')%2===0?'1:1 맞춤과외 상담하기':'수업 방식과 일정 문의';}

function makeFaqs(page, context) {
  const generated = page.intelligence.faqs;
  return generated.map((faq, index) => ({
    question: firstValue(page, `faq_question_${index + 1}`) || faq.question,
    answer: firstValue(page, `faq_answer_${index + 1}`) || faq.answer,
  }));
}

function templateLabel(type){const p=PROFILES[type];if(!p)throw Error('알 수 없는 template '+type);return p.target_short+' '+p.subject;}
function duplicateCount(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
}

/** pages.csv를 한 번 읽어 모든 빌드 단계가 함께 사용할 페이지 데이터로 만듭니다. */
function loadPages({ csvText: suppliedCsvText } = {}) {
  for (const requiredFile of suppliedCsvText === undefined ? [csvPath, templatePath] : [templatePath]) {
    if (!fs.existsSync(requiredFile)) throw new Error(`필요한 파일을 찾을 수 없습니다: ${requiredFile}`);
  }

  const csvText = String(suppliedCsvText === undefined ? fs.readFileSync(csvPath, "utf8") : suppliedCsvText).replace(/^\uFEFF/, "");
  const [headerRow, ...dataRows] = parseCsv(csvText);
  const headers = headerRow.map((header) => header.trim());
  if (!headers.includes("slug")) throw new Error("pages.csv에 slug 열이 없습니다.");

  const pages = dataRows
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])))
    .map(normalizePage)
    .filter((page) => page.status.toLowerCase() === "publish")
    .map((page) => {
      validateFinalContent(page);
      const content = makeContentContext(page);
      const contentTemplate = normalizeContentTemplate(page);
      const generatedDescription = makeDescription(page, content);
      const preparedPage = {
        ...page,
        content,
        contentTemplate,
        title: makeTitle(page),
        description: generatedDescription,
        h1: page.keyword || page.title,
      };
      return { ...preparedPage, intelligence: createPageContent(preparedPage, content) };
    });

  const ids = new Set();
  const slugs = new Set();
  for (const page of pages) {
    if (ids.has(page.id)) throw new Error(`중복 id가 있습니다: ${page.id}`);
    if (slugs.has(page.slug.toLowerCase())) throw new Error(`중복 slug가 있습니다: ${page.slug}`);
    ids.add(page.id);
    slugs.add(page.slug.toLowerCase());
  }

  return {
    pages,
    template: fs.readFileSync(templatePath, "utf8"),
    // CSV의 과거 domain 값과 관계없이 현재 운영 주소를 사용합니다.
    baseUrl: makeBaseUrl(productionUrl),
    duplicateResults: {
      title: duplicateCount(pages.map((page) => page.title)),
      description: duplicateCount(pages.map((page) => page.description)),
      h1: duplicateCount(pages.map((page) => page.h1)),
    },
  };
}

/** 지역별 페이지와 메인페이지만 생성합니다. */
function generatePages({ outputPath, data = loadPages(), pageSlugs = null, generateHome = true, relatedIndex, hubIndex }) {
  const { pages, template, baseUrl } = data;
  relatedIndex ||= require('./generate-related-index').createRelatedIndex(pages);
  hubIndex ||= require('./generate-hub-index').createHubIndex(pages);
  const pagesBySlug = new Map(pages.map(page=>[page.slug,page]));
  const {renderRelatedLessons} = require('./render-related-lessons');
  fs.mkdirSync(outputPath, { recursive: true });
  require('./detail-design-system').writeDetailCss(root,outputPath);

const selectedPages = pageSlugs ? pages.filter((page) => pageSlugs.has(page.slug)) : pages;
for (const [index, page] of selectedPages.entries()) {
  const context = page.content;
  const faqs = makeFaqs(page, context);
  const faqHtml = faqs.map((faq, faqIndex) => `<details class="faq-item"${faqIndex === 0 ? " open" : ""}><summary><h3>${escapeHtml(faq.question)}</h3></summary><div class="faq-answer"><p>${escapeHtml(faq.answer)}</p></div></details>`).join("");
  const canonicalUrl = `${baseUrl}/${page.slug}/`;
  const categoryName = templateLabel(page.contentTemplate);
  const locationName = [page.province, page.region].filter(Boolean).join(" ");
  const breadcrumbItems = [{ "@type": "ListItem", position: 1, name: "홈", item: `${baseUrl}/` }];
  if (page.province) breadcrumbItems.push({ "@type": "ListItem", position: 2, name: page.province });
  breadcrumbItems.push({ "@type": "ListItem", position: breadcrumbItems.length + 1, name: page.title, item: canonicalUrl });
  const breadcrumbMiddle = page.province ? `<li>${escapeHtml(page.province)}</li>` : "";
  const structuredData = makePageSchema({ canonicalUrl, page, locationName, context, baseUrl, faqs, breadcrumbItems });
  const contactUrl = "/#consultation";
  const eyebrow = [page.province, page.region, page.target || "전체 대상", categoryName].filter(Boolean).map(escapeHtml).join(" · ");
  const pageMedia = require('./detail-hero-image').renderDetailHeroImage(page,root);
  const consultationLabel = pageConsultationLabel(page);
  const main = `<section class="detail-hero"><div class="container"><nav class="breadcrumb" aria-label="현재 위치"><ol><li><a href="/">홈</a></li>${breadcrumbMiddle}<li aria-current="page">${escapeHtml(page.title)}</li></ol></nav><div class="detail-hero-layout"><div><p class="eyebrow">1:1 맞춤과외 · ${eyebrow}</p><h1>${escapeHtml(page.h1)}</h1><p class="lead">${escapeHtml(page.intelligence.learning.hero)}</p><div class="detail-actions"><a class="button" href="${contactUrl}">${consultationLabel}</a><a class="button button-secondary" href="#process">수업 진행 방법 보기</a></div></div><aside class="detail-hero-visual" aria-label="수업 신뢰 정보">${pageMedia}<h2>${escapeHtml(page.region)} ${escapeHtml(context.service)} 수업 전 확인할 내용</h2><ul class="detail-trust"><li>학생별 1:1 학습 지도</li><li>현재 수준에 맞춘 수업</li><li>학습 목표와 취약 내용 점검</li><li>방문·화상 가능 방식은 상담 후 안내</li></ul></aside></div></div></section>
  ${require('./render-detail-learning').renderLearningSections(page,escapeHtml)}
  <section class="section detail-faq" id="faq"><div class="container"><div class="section-heading"><p class="section-kicker">자주 묻는 질문</p><h2>${escapeHtml(page.region)} ${escapeHtml(context.service)} 수업 전 자주 묻는 질문</h2></div><div class="faq-list">${faqHtml}</div>${page.updated_at ? `<p class="updated">마지막 내용 확인: ${escapeHtml(page.updated_at)}</p>` : ""}</div></section>
  <section class="section detail-cta" id="consultation"><div class="container"><div class="detail-cta-content"><h2>${escapeHtml(firstValue(page, "cta_title") || page.intelligence.cta.title)}</h2><p>${escapeHtml(page.intelligence.cta.text)}</p><div class="page-cta-actions"><a class="button" href="${contactUrl}">${consultationLabel}</a><a class="button button-kakao" href="https://open.kakao.com/o/strVhSJi" target="_blank" rel="noopener noreferrer">카톡으로 수업 문의</a><a class="button button-secondary" href="${escapeHtml(require('../config/brand').phoneHref)}">전화로 수업 문의</a></div></div></div></section>
  `;
  const detailTemplate = template.replace('맞춤 회화 과외','초·중·고 맞춤 과외').replace('영어 · 일본어 · TOEIC · OPIC · IELTS','초등 · 중등 · 고등 영어·수학');
  validateText(page.template,main.replace(/<[^>]*>/g,' '),page.slug+'/rendered main');
  const html = renderTemplate(detailTemplate.replace('<body>','<body class="detail-page">').replace(/<header class="site-header">[\s\S]*?<\/header>/,require('./render-editorial-header').renderEditorialHeader(escapeHtml)).replace('</head>','<link rel="stylesheet" href="/detail-learning.css"></head>'), {
    ...brandTemplateValues(page, baseUrl),
    LANG: escapeHtml(page.language), TITLE: escapeHtml(page.title), DESCRIPTION: escapeHtml(page.description),
    CANONICAL_URL: escapeHtml(canonicalUrl), STRUCTURED_DATA: structuredData,
    NAV_LINK: "/#lessons", NAV_TEXT: "다른 지역 보기", MAIN: main.replace(/class="button button-secondary"/g,'class="he-text-link"').replace(/class="button button-kakao"/g,'class="he-text-link"').replace(/class="button"/g,'class="he-button"') + renderRelatedLessons(page,pagesBySlug,relatedIndex,hubIndex,escapeHtml),
    MOBILE_CONTACT_URL: contactUrl,
    FOOTER_LINK: "/", FOOTER_TEXT: "메인으로 돌아가기",
  });
  const pageFolder = path.join(outputPath, page.slug);
  fs.mkdirSync(pageFolder, { recursive: true });
  fs.writeFileSync(path.join(pageFolder, "index.html"), html, "utf8");
  if ((index + 1) % 500 === 0) console.log(`진행: ${index + 1}개 생성`);
}

if (!generateHome) return data;

require('./generate-home-page').generateHomePage({root,outputPath,data,hubIndex});
  return data;
}

module.exports = {
  parseCsv,
  brandTemplateValues,
  escapeHtml,
  generatePages,
  loadPages,
  reviewDetailsHtml,
  renderTemplate,
};
