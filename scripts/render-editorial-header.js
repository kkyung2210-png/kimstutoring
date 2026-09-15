const brand=require('../config/brand');
function renderEditorialHeader(e,{home=false}={}) {
 const prefix=home?'':'/',arrow='<span aria-hidden="true">↗</span>';
 const nav=`<a href="${prefix}#lessons">지역별 과외</a><a href="${prefix}#grades">학년별 수업</a><a href="${prefix}#subjects">과목별 과외</a><a href="${prefix}#approach">과외 안내</a>`;
 return `<header class="he-header"><div class="he-wrap he-nav"><a class="he-brand" href="/" aria-label="${e(brand.name)} 메인"><strong>${e(brand.name)}</strong><small>${e(brand.englishName)}</small></a><nav class="he-desktop-nav" aria-label="주요 메뉴">${nav}</nav><a class="he-header-phone" href="${e(brand.phoneHref)}" aria-label="전화 상담 ${e(brand.phone)}">전화 상담</a><a class="he-header-cta" href="${prefix}#consultation">상담 신청 ${arrow}</a><details class="he-mobile-menu"><summary>메뉴 <span aria-hidden="true">＋</span></summary><nav aria-label="모바일 주요 메뉴">${nav}</nav></details></div></header>`;
}
module.exports={renderEditorialHeader};
