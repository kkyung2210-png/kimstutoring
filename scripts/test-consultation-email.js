"use strict";
const { URL } = require('node:url');

const {SITE_URL}=require('../config/site');
const brand=require('../config/brand');
const assert = require("node:assert/strict");
const { handler, _private } = require("../netlify/functions/consultation-email");

async function run() {
  const valid = {
    phone: "010-2568-6630",
    lesson: "중등 영어",
    message: "문법과 독해 상담을 받고 싶습니다.",
    privacyConsent: "yes",
    sourcePage: SITE_URL + "/anyang-middle-english/",
    botField: "",
  };

  assert.equal(_private.validate(valid), "");
  assert.match(_private.validate({ ...valid, phone: "123" }), /연락처/);
  assert.equal((await handler({ httpMethod: "GET", headers: {} })).statusCode, 405);

  const previousFetch = global.fetch;
  const previousError = console.error;
  const logs = [];
  console.error = value => logs.push(String(value));
  const previousEnvironment = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_EMAIL: process.env.CONTACT_EMAIL,
    CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
    URL: process.env.URL,
    SITE_NAME: process.env.SITE_NAME,
    DEPLOY_URL: process.env.DEPLOY_URL,
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    NETLIFY: process.env.NETLIFY,
    CONTEXT: process.env.CONTEXT,
  };
  let request;

  try {
    process.env.RESEND_API_KEY = "test-key-not-a-real-secret";
    process.env.CONTACT_EMAIL = "owner@gmail.com";
    process.env.CONTACT_FROM_EMAIL = brand.englishName + " <consultation@" + new URL(SITE_URL).hostname + ">";
    global.fetch = async function (url, options) {
      request = { url, options };
      return { ok: true, status: 200, text: async function () { return "{}"; } };
    };

    const result = await handler({
      httpMethod: "POST",
      headers: { origin: SITE_URL, "user-agent": "Test Browser" },
      body: JSON.stringify(valid),
    });
    assert.equal(result.statusCode, 200);
    for (const origin of ['https://kimsenglish.co.kr', SITE_URL+'.evil.example']) assert.equal((await handler({httpMethod:'POST',headers:{origin},body:JSON.stringify(valid)})).statusCode,403);
    assert.equal(request.url, "https://api.resend.com/emails");

    const email = JSON.parse(request.options.body);
    assert.deepEqual(email.to, ["owner@gmail.com"]);
    assert.equal(email.subject, `[${brand.name}] 새로운 상담 신청`);
    assert.equal("cc" in email, false);
    assert.equal("bcc" in email, false);
    assert.equal("reply_to" in email, false);
    assert.match(email.text, /010-2568-6630/);
    assert.match(email.text, /Test Browser/);
    assert.match(email.text, /anyang-middle-english/);

    request = null;
    const spam = await handler({
      httpMethod: "POST",
      headers: { origin: SITE_URL },
      body: JSON.stringify({ ...valid, botField: "spam" }),
    });
    assert.equal(spam.statusCode, 200);
    assert.equal(request, null);

    for(const lesson of ['초등 영어','초등 수학','중등 영어','중등 수학','고등 영어','고등 수학']) assert.equal(_private.validate({...valid,lesson}), '');
    assert.match(_private.validate({...valid,privacyConsent:''}), /동의/);
    assert.match(_private.validate({...valid,lesson:''}), /희망 수업/);
    assert.match(_private.validate({...valid,message:''}), /문의/);
    process.env.URL='https://tutoring-test-site.netlify.app';
    process.env.SITE_NAME='tutoring-test-site';
    process.env.NETLIFY='true';process.env.CONTEXT='production';
    for(const origin of [SITE_URL,SITE_URL.replace('https://','https://www.'),process.env.URL])assert.equal(_private.isAllowedOrigin(origin),true);
    process.env.URL=SITE_URL;
    assert.equal(_private.isAllowedOrigin('https://tutoring-test-site.netlify.app'),true);
    for(const origin of ['https://unrelated.netlify.app','http://localhost:8080',SITE_URL+'.evil.example'])assert.equal(_private.isAllowedOrigin(origin),false);

    for(const name of ['RESEND_API_KEY','CONTACT_EMAIL','CONTACT_FROM_EMAIL']){
      const value=process.env[name];delete process.env[name];request=null;
      assert.equal((await handler({httpMethod:'POST',headers:{origin:SITE_URL},body:JSON.stringify(valid)})).statusCode,503);
      assert.equal(request,null);assert(JSON.parse(logs.at(-1)).missing.includes(name));process.env[name]=value;
    }
    global.fetch=async()=>({ok:false,status:403,text:async()=>JSON.stringify({name:'validation_error',message:'PRIVATE_PROVIDER_TEXT'})});
    const rejected=await handler({httpMethod:'POST',headers:{origin:SITE_URL},body:JSON.stringify(valid)});
    assert.equal(rejected.statusCode,502);assert.equal(JSON.parse(logs.at(-1)).providerError,'validation_error');
    assert(!rejected.body.includes('PRIVATE_PROVIDER_TEXT'));assert(!logs.join('').includes('PRIVATE_PROVIDER_TEXT'));
    global.fetch=async()=>{throw new Error('PRIVATE_NETWORK_TEXT');};
    assert.equal((await handler({httpMethod:'POST',headers:{origin:SITE_URL},body:JSON.stringify(valid)})).statusCode,502);
    assert(!logs.join('').includes('PRIVATE_NETWORK_TEXT'));assert(!logs.join('').includes('test-key-not-a-real-secret'));assert(!logs.join('').includes(valid.phone));

    // Execute the actual frontend submit handler against the actual Function, with only Resend mocked.
    const frontend=require('../public/utils/consultation-form');
    for(const responseOk of [true,false]){
      const events={},field=value=>({value,type:'text',tagName:'INPUT',setAttribute(){},addEventListener(){},focus(){}});
      const form={dataset:{},elements:{phone:field(valid.phone),lesson:field(valid.lesson),message:field(valid.message),privacyConsent:{...field(''),checked:true,type:'checkbox'},sourcePage:field(''),submittedAt:field(''),'bot-field':field('')},addEventListener(name,fn){events[name]=fn;},reset(){this.didReset=true;}};
      const button={disabled:false,textContent:''},status={focus(){}};
      form.querySelector=selector=>selector==='[data-submit-button]'?button:selector==='[data-form-status]'?status:{textContent:''};
      let posted;
      global.fetch=async()=>({ok:responseOk,status:responseOk?200:403,text:async()=>'{"name":"validation_error"}'});
      frontend.init({querySelectorAll:()=>[form]},{location:{href:SITE_URL+'/'},fetch:async(url,options)=>{posted={url,options};const result=await handler({httpMethod:options.method,headers:{origin:SITE_URL},body:options.body});return {ok:result.statusCode===200};}});
      await events.submit({preventDefault(){}});
      assert.equal(posted.url,'/.netlify/functions/consultation-email');assert.equal(posted.options.method,'POST');assert.equal(posted.options.headers['Content-Type'],'application/json');
      const body=JSON.parse(posted.options.body);for(const key of ['phone','lesson','message','privacyConsent'])assert.equal(body[key],valid[key]);
      assert.equal(button.disabled,false);assert.equal(Boolean(form.didReset),responseOk);assert.match(status.textContent,responseOk ? /신청이 완료/ : /신청에 실패/);
    }
  } finally {
    console.error = previousError;
    global.fetch = previousFetch;
    Object.keys(previousEnvironment).forEach(function (name) {
      if (previousEnvironment[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnvironment[name];
    });
  }

  console.log("Consultation email tests passed.");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
