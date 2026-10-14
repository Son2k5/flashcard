/**
 * Đồng bộ cấu hình từ file .env hoặc biến môi trường process.env vào assets/js/app.js
 * Hỗ trợ chạy khi build (Vercel / CI) hoặc chạy cục bộ khi thay đổi .env.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const appPath = path.join(rootDir, 'assets/js/app.js');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  } catch (err) {
    console.warn(`[sync-env] Không thể đọc file .env: ${err.message}`);
    return {};
  }
}

function sync() {
  const fileEnv = parseEnvFile(envPath);

  // Ưu tiên biến môi trường hệ thống (CI / Vercel), sau đó mới tới file .env
  const accessCode = process.env.ACCESS_CODE || fileEnv.ACCESS_CODE;
  let accessHash = process.env.ACCESS_HASH || fileEnv.ACCESS_HASH;
  const accessKey = process.env.ACCESS_KEY || fileEnv.ACCESS_KEY;
  const storeKey = process.env.STORE_KEY || fileEnv.STORE_KEY;

  if (accessCode && !accessHash) {
    accessHash = crypto.createHash('sha256').update(accessCode, 'utf8').digest('hex');
    console.log('[sync-env] Đã tự động tạo SHA-256 ACCESS_HASH từ ACCESS_CODE.');
  }

  if (!fs.existsSync(appPath)) {
    console.error('[sync-env] Lỗi: Không tìm thấy assets/js/app.js');
    process.exit(1);
  }

  let source = fs.readFileSync(appPath, 'utf8');
  let changed = false;

  if (accessHash) {
    const cleanHash = accessHash.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(cleanHash)) {
      console.error('[sync-env] Lỗi: ACCESS_HASH phải là chuỗi SHA-256 hợp lệ gồm 64 ký tự hex.');
      process.exit(1);
    }
    const hashPattern = /const ACCESS_HASH='[a-f0-9]{64}';/;
    if (hashPattern.test(source)) {
      const currentHash = source.match(hashPattern)[0];
      const targetStatement = `const ACCESS_HASH='${cleanHash}';`;
      if (currentHash !== targetStatement) {
        source = source.replace(hashPattern, targetStatement);
        console.log(`[sync-env] ✔ Đã cập nhật ACCESS_HASH (${cleanHash.slice(0, 8)}...) vào assets/js/app.js.`);
        changed = true;
      } else {
        console.log('[sync-env] ℹ ACCESS_HASH trong assets/js/app.js đã trùng khớp với cấu hình.');
      }
    } else {
      console.warn('[sync-env] ⚠ Không tìm thấy khai báo `const ACCESS_HASH=...` trong assets/js/app.js để thay thế.');
    }
  } else {
    console.log('[sync-env] ℹ Không có ACCESS_HASH hay ACCESS_CODE mới trong môi trường/.env. Giữ nguyên hash hiện tại.');
  }

  if (accessKey) {
    const keyPattern = /ACCESS_KEY\s*=\s*(['"])[^'"]+\1;?/;
    if (keyPattern.test(source)) {
      const current = source.match(keyPattern)[0];
      const target = `ACCESS_KEY = ${JSON.stringify(accessKey)};`;
      if (!current.includes(accessKey)) {
        source = source.replace(keyPattern, target);
        console.log(`[sync-env] ✔ Đã cập nhật ACCESS_KEY='${accessKey}'.`);
        changed = true;
      }
    }
  }

  if (storeKey) {
    const storePattern = /STORE_KEY\s*=\s*StorageModel\.metaKey/;
    // Giữ nguyên liên kết StorageModel.metaKey hoặc cập nhật nếu có pattern cố định
  }

  if (changed) {
    fs.writeFileSync(appPath, source, 'utf8');
    console.log('[sync-env] 🎉 Đã lưu cập nhật cấu hình vào assets/js/app.js thành công!');
  } else {
    console.log('[sync-env] Mọi cấu hình đã đồng bộ.');
  }
}

sync();
