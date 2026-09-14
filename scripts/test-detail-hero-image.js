const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {loadPages}=require('./generate-pages');
const {IMAGES,renderDetailHeroImage}=require('./detail-hero-image');
const {resolvePageAsset,imageSize}=require('./utils/assets/resolve-asset');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'reports/detail-hero-photo-qa'),dist=path.join(root,'dist');
const before=JSON.parse(fs.readFileSync(path.join(dir,'before.json')));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const counts={},errors=[],images=[],oldSources=new Set();let unchanged=0;
const normalize=h=>h.replace(/<div class="image-box page-hero-media[\s\S]*?<\/div>/,'IMAGE');
for(const page of loadPages().pages){
 const html=fs.readFileSync(path.join(dist,page.slug,'index.html'),'utf8');
 const media=html.match(/<div class="image-box page-hero-media[\s\S]*?<\/div>/)?.[0]||'';
 const expected=`/images/detail/${IMAGES[page.template]}.webp`;
 if(!media.includes(`src="${expected}"`))errors.push({slug:page.slug,error:'mapping'});
 if(!media.includes(`alt="${page.keyword} 1:1 맞춤수업"`))errors.push({slug:page.slug,error:'alt'});
 if(!media.includes('loading="eager"')||!media.includes('fetchpriority="high"')||!media.includes('width="1200" height="800"'))errors.push({slug:page.slug,error:'performance attributes'});
 if(normalize(html)!==before.pages[page.slug])errors.push({slug:page.slug,error:'non-image HTML changed'});else unchanged++;
 counts[page.template]=(counts[page.template]||0)+1;
 oldSources.add(resolvePageAsset(page,root).src);
}
for(const [file,hash] of Object.entries(before.files))if(!fs.existsSync(file)||digest(fs.readFileSync(file))!==hash)errors.push({file,error:'protected file changed'});
for(const [type,name] of Object.entries(IMAGES)){
 const url=`/images/detail/${name}.webp`,source=fs.readFileSync(path.join(root,'public',url.slice(1))),built=fs.readFileSync(path.join(dist,url));
 assert.equal(digest(source),digest(built));
 images.push({type,url,...imageSize(root,url),bytes:source.length,sha256:digest(source),pages:counts[type],objectPosition:'50% 50%'});
 const page=loadPages().pages.find(p=>p.template===type);
 const fallback=renderDetailHeroImage(page,path.join(dir,'missing-image-fixture'));
 assert(fallback.includes('detail-photo-fallback'));assert(!fallback.includes('<img'));assert(!fallback.includes('.svg'));
}
assert.equal(new Set(images.map(x=>x.sha256)).size,6,'Images must be distinct');
const hubHtml=[];function readHubs(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())readHubs(f);else if(e.name.endsWith('.html'))hubHtml.push(fs.readFileSync(f,'utf8'));}}readHubs(path.join(dist,'hub'));
const audit=JSON.parse(fs.readFileSync(path.join(root,'reports/seo-audit-summary.json')));
const report={pages:Object.values(counts).reduce((a,b)=>a+b,0),unchangedOutsideImage:unchanged,images,errors,oldIllustrations:[...oldSources].map(src=>({src,hubPagesUsing:hubHtml.filter(h=>h.includes(src)).length,preserved:fs.existsSync(path.join(root,'public',src.slice(1)))})),audit,mobile390:{browserVerified:false,note:'No browser is available. Source images inspected; 1.42 aspect ratio and cover crop remove about 2.7% on each side, faces and central books remain within the frame. No actual viewport measurement.'}};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);assert.equal(report.pages,996);assert.equal(audit.errors,0);
