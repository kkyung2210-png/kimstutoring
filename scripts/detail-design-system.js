const fs=require('fs'),path=require('path');
// Read the actual homepage tokens and shared chrome/button rules at build time.
// No homepage stylesheet is loaded on detail pages and no hub selectors are changed.
function sharedEditorialCss(root) {
 const source=fs.readFileSync(path.join(root,'assets/home.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 const rootRule=source.match(/\.home-editorial\s*\{([^}]*)\}/);
 if(!rootRule)throw Error('Homepage design tokens missing');
 const isShared=selector=>/^\.home-editorial\s+\.(?:he-wrap|he-header(?:-cta)?|he-nav|he-brand|he-desktop-nav|he-mobile-menu|he-button|he-text-link|site-footer)(?:\b|\s|:|\[)/.test(selector);
 function extract(css){
  let result='',cursor=0;
  while(cursor<css.length){
   const open=css.indexOf('{',cursor);if(open<0)break;
   let level=1,end=open+1;while(level&&end<css.length){if(css[end]==='{')level++;else if(css[end]==='}')level--;end++;}
   if(level)throw Error('Unbalanced homepage CSS');
   const selector=css.slice(cursor,open).trim(),body=css.slice(open+1,end-1);cursor=end;
   if(selector.startsWith('@media')){const nested=extract(body);if(nested)result+=selector+'{'+nested+'}\n';}
   else {const selected=selector.split(',').map(x=>x.trim()).filter(isShared);if(selected.length)result+=selected.join(',').replaceAll('.home-editorial','.detail-page')+'{'+body+'}\n';}
  }
  return result;
 }
 return '.detail-page{'+rootRule[1]+'}\n'+extract(source);
}
function writeDetailCss(root,outputPath){
 fs.writeFileSync(path.join(outputPath,'detail-learning.css'),sharedEditorialCss(root)+'\n'+fs.readFileSync(path.join(root,'assets/detail-learning.css'),'utf8').replace(/^\uFEFF/,''));
}
module.exports={sharedEditorialCss,writeDetailCss};
