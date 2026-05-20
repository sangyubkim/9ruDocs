#!/usr/bin/env node
/**
 * Repo root must NOT contain expo — only apps/mobile does.
 * Stale root node_modules (often SDK 55) breaks "npx expo" from 9ruDocs/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootModules = path.join(rootDir, 'node_modules');
const expoPkgPath = path.join(rootModules, 'expo', 'package.json');
const checkOnly = process.argv.includes('--check-only');
const REQUIRED_SDK_MAJOR = '54';

function readRootExpo() {
  try {
    const pkg = JSON.parse(fs.readFileSync(expoPkgPath, 'utf8'));
    const major = String(pkg.version).split('.')[0];
    return { version: pkg.version, major };
  } catch {
    return null;
  }
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

const expo = readRootExpo();
if (!expo) {
  process.exit(0);
}

const lines = [
  '',
  '[9ruDocs] 루트(9ruDocs) node_modules 에 expo 가 설치되어 있습니다.',
  `  감지: expo@${expo.version} (SDK ${expo.major})`,
  '  원인: 저장소 루트에서 npx expo / npm install expo 를 실행한 적이 있음.',
  '  결과: 루트에서 npx expo start → SDK 55 번들 또는 "Expo Go 버전" 오류.',
  '  참고: 루트 node_modules 가 없어도 npx expo 는 npm 최신(55)을 받을 수 있음 → expo-mobile.bat 사용.',
  '',
  '  해결: apps/mobile 에서만 실행하세요.',
  '    cd apps/mobile',
  '    npx expo start -c',
  '',
  '  또는: scripts\\upgrade-mobile-expo.bat',
  '',
];

if (expo.major !== REQUIRED_SDK_MAJOR) {
  lines.splice(
    3,
    0,
    `  ⚠ 프로젝트는 SDK ${REQUIRED_SDK_MAJOR} 고정 — 루트의 SDK ${expo.major} 는 반드시 제거해야 합니다.`
  );
}

if (checkOnly) {
  console.error(lines.join('\n'));
  console.error('  자동 정리: npm run clean:root-expo');
  process.exit(1);
}

console.warn(lines.join('\n'));
console.warn('  → 루트 node_modules 삭제 중...');
try {
  rmDir(rootModules);
  const lock = path.join(rootDir, 'package-lock.json');
  if (fs.existsSync(lock)) {
    fs.unlinkSync(lock);
    console.warn('  → 루트 package-lock.json 도 삭제했습니다.');
  }
  console.warn('  → 완료. 이제 npm run mobile 또는 cd apps/mobile 후 npx expo start');
} catch (err) {
  console.error('  삭제 실패:', err.message);
  process.exit(1);
}
