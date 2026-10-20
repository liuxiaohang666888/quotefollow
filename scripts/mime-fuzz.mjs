#!/usr/bin/env node
/**
 * MIME 解析器病态输入 fuzz（审查报告 L12：lib/mime.ts 建议补 fuzz 测试防病态回溯）
 *
 * 离线运行，不读任何生产密钥、不连任何网络：
 *   node scripts/mime-fuzz.mjs
 *
 * 判定标准：
 *   1. 不抛异常（任何输入都必须被优雅处理）
 *   2. 单例解析耗时有上限（默认 2000ms，超出视为病态回溯/复杂度爆炸）
 *
 * Node >= 22.18 可直接 import .ts（类型剥离）；旧版本用：
 *   node --experimental-strip-types scripts/mime-fuzz.mjs
 */

import { parseMimeMessage, decodeRfc2047, sanitizeMimeNoise } from '../lib/mime.ts';

const TIME_BUDGET_MS = 2000;
const ROUNDS = 300;

// 确定性伪随机（可复现）：简单 LCG
let seed = 20261020;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function randInt(max) {
  return Math.floor(rand() * max);
}
function pick(arr) {
  return arr[randInt(arr.length)];
}

const ALPHABET = 'ABCabc012 <>=?"\';:\r\n\t()[]{}.,/-_@*&%$#!+~`^|\\';
function randomString(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[randInt(ALPHABET.length)];
  return s;
}

const ADVERSARIAL_CASES = [
  // 深层嵌套 multipart（递归深度攻击）
  (() => {
    let raw = 'Content-Type: text/plain\r\n\r\nleaf';
    for (let i = 0; i < 60; i++) {
      raw = `Content-Type: multipart/mixed; boundary="b${i}"\r\n\r\n--b${i}\r\n${raw}\r\n--b${i}--`;
    }
    return raw;
  })(),
  // 永远不闭合的 boundary
  'Content-Type: multipart/mixed; boundary="never"\r\n\r\n--never\r\n' + 'x'.repeat(50000),
  // 空 boundary / 畸形 boundary 声明
  'Content-Type: multipart/mixed; boundary=""\r\n\r\n--\r\nbody',
  'Content-Type: multipart/mixed\r\n\r\n--noboundarydeclared\r\nbody',
  // 超长头部行 + 无空行
  'X-Long: ' + 'a'.repeat(200000) + '\r\n',
  // 只有 CR 或只有 LF 的换行
  'From: a@b.com\rSubject: hi\rContent-Type: text/plain\r\rbody',
  'From: a@b.com\nSubject: hi\nContent-Type: text/plain\n\nbody',
  // QP/Base64 病态片段
  'Content-Type: text/plain\r\nContent-Transfer-Encoding: base64\r\n\r\n' + '='.repeat(50000),
  'Content-Type: text/plain\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n' + '=F'.repeat(30000),
  // RFC2047 编码词病态片段
  'Subject: =?utf-8?B?' + 'A'.repeat(50000) + '?=',
  'Subject: =?utf-8?Q?' + '=E4=BD'.repeat(30000) + '?=',
  'Subject: =?bogus-charset?X?!!!?= =?utf-8?B?4pyT?=',
  // 空输入
  '',
  // 纯随机字节流（latin1 范围，模拟乱码邮件）
  randomString(20000),
  // HTML 陷阱（走 html→text 剥离路径）
  '<html><body>' + '<div onclick="alert(1)">'.repeat(5000) + '</body></html>',
  '<script>' + 'a'.repeat(100000) + '</script>',
];

function fuzzRound(i) {
  // 一半跑对抗用例，一半跑随机变异用例
  let raw;
  if (i % 2 === 0) {
    raw = ADVERSARIAL_CASES[randInt(ADVERSARIAL_CASES.length)];
  } else {
    const base = pick(ADVERSARIAL_CASES);
    const cut = randInt(base.length + 1);
    raw = base.slice(0, cut) + randomString(randInt(500)) + base.slice(cut);
  }

  const started = Date.now();
  const mime = parseMimeMessage(raw);
  if (mime && mime.headers) {
    decodeRfc2047(mime.headers.subject || '');
    decodeRfc2047(mime.headers.from || '');
  }
  if (mime && mime.text) sanitizeMimeNoise(mime.text);
  if (mime && mime.html) sanitizeMimeNoise(mime.html);
  const elapsed = Date.now() - started;
  if (elapsed > TIME_BUDGET_MS) {
    throw new Error(`slow parse: ${elapsed}ms (round ${i})`);
  }
  return elapsed;
}

let maxMs = 0;
let failures = 0;
for (let i = 0; i < ROUNDS; i++) {
  try {
    const ms = fuzzRound(i);
    if (ms > maxMs) maxMs = ms;
  } catch (e) {
    failures++;
    console.error(`✗ round ${i} FAILED:`, e.message);
    if (failures > 5) {
      console.error('too many failures, aborting');
      process.exit(1);
    }
  }
}

console.log(`mime fuzz: ${ROUNDS} rounds, max parse time ${maxMs}ms, failures ${failures}`);
if (failures > 0) process.exit(1);
console.log('✓ mime fuzz passed');
