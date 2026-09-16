const fs=require('fs'),path=require('path');
const {classifyTopic}=require('./content-intelligence');
const {imageSize}=require('./utils/assets/resolve-asset');
const {escape,imageTag}=require('./utils/assets/image-html');
const IMAGES=Object.freeze({
 elementary_korean:'elementary-korean', middle_korean:'middle-korean', high_korean:'high-korean',
 elementary_english:'elementary-english', elementary_math:'elementary-math',
 middle_english:'middle-english', middle_math:'middle-math',
 high_english:'high-english', high_math:'high-math'
});
function renderDetailHeroImage(page,root){
 const type=classifyTopic(page),name=IMAGES[type];
 if(!name)throw Error(`Missing detail Hero mapping: ${type}`);
 const src=`/images/detail/${name}.webp`,alt=`${page.keyword} 1:1 맞춤수업`;
 const file=path.join(root,'public',src.slice(1));
 // Missing files keep the same reserved space, without substituting another subject/grade.
 const content=fs.existsSync(file)?imageTag({src,...imageSize(root,src)},{alt,loading:'eager',fetchpriority:'high'}):`<span class="detail-photo-fallback" role="img" aria-label="${escape(alt)}">1:1 맞춤수업</span>`;
 return `<div class="image-box page-hero-media detail-photo detail-photo-${name}" data-detail-template="${type}">${content}</div>`;
}
module.exports={IMAGES,renderDetailHeroImage};
