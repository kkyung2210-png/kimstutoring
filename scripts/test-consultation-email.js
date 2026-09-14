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
  const previousEnvironment = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_EMAIL: process.env.CONTACT_EMAIL,
    CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
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
  } finally {
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
