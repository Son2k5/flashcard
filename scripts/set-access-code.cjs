// Mã mới chỉ đi qua stdin, không xuất ra terminal và không lưu bản thô.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const file = path.join(__dirname, '../index.html');
function update(code) {
  if (code.length < 8 || code.length > 200) throw Error('Mã cần từ 8 đến 200 ký tự.');
  const html = fs.readFileSync(file, 'utf8');
  const pattern = /const ACCESS_HASH='[a-f0-9]{64}';/;
  if (!pattern.test(html)) throw Error('Không tìm thấy ACCESS_HASH trong index.html.');
  const hash = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  fs.writeFileSync(file, html.replace(pattern, `const ACCESS_HASH='${hash}';`), 'utf8');
  console.log('\n✔ Đã cập nhật ACCESS_HASH vào index.html.');
  console.log(`📌 Mã SHA-256 để lưu vào file .env (ACCESS_HASH):`);
  console.log(`ACCESS_HASH=${hash}`);
  console.log('\nLưu ý: Không commit mã thô vào Git. Hãy cập nhật vào file .env hoặc biến môi trường Vercel.');
}
function finish(code) { try { update(code); } catch (e) { console.error(e.message); process.exitCode=1; } }
if (process.stdin.isTTY) {
  process.stdout.write('Nhập mã mới (8–200 ký tự, không hiển thị): ');
  process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();let input='';
  process.stdin.on('data',chunk=>{
    if(chunk.includes('\u0003')){process.stdin.setRawMode(false);process.stdin.pause();process.exitCode=1;return;}
    if(/[\r\n]/.test(chunk)){input+=chunk.split(/[\r\n]/)[0];process.stdin.setRawMode(false);process.stdin.pause();finish(input);return;}
    if(chunk==='\u007f'||chunk==='\b')input=Array.from(input).slice(0,-1).join('');else input+=chunk;
  });
} else {
  let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>input+=chunk);
  process.stdin.on('end',()=>finish(input.replace(/\r?\n$/,'')));
}
