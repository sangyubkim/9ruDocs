#!/usr/bin/env node
/**
 * Runs before expo start — blocks wrong cwd and wrong SDK.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileDir, '../..');
const REQUIRED_SDK_MAJOR = '54';

function normalize(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

function readExpoVersion(baseDir) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'node_modules', 'expo', 'package.json'), 'utf8')
    );
    return pkg.version;
  } catch {
    return null;
  }
}

const cwd = normalize(process.cwd());
const expected = normalize(mobileDir);

if (cwd !== expected) {
  console.error('');
  console.error('[9ruDocs mobile] 잘못된 작업 디렉터리입니다.');
  console.error(`  현재: ${process.cwd()}`);
  console.error(`  필요: ${mobileDir}`);
  console.error('');
  console.error('  cd apps/mobile');
  console.error('  npx expo start -c');
  console.error('');
  console.error('  저장소 루트에서 실행하려면: npm run mobile (프로젝트 루트)');
  console.error('');
  process.exit(1);
}

const version = readExpoVersion(mobileDir);
if (!version) {
  console.error('[9ruDocs mobile] node_modules/expo 없음. npm install 후 다시 시도하세요.');
  process.exit(1);
}

const major = version.split('.')[0];
if (major !== REQUIRED_SDK_MAJOR) {
  console.error('');
  console.error(`[9ruDocs mobile] Expo SDK ${major} 감지 — 이 앱은 SDK ${REQUIRED_SDK_MAJOR} 고정입니다.`);
  console.error(`  expo 패키지: ${version}`);
  console.error('  scripts\\upgrade-mobile-expo.bat 실행 후 다시 시도하세요.');
  console.error('');
  process.exit(1);
}

const rootExpo = readExpoVersion(repoRoot);
if (rootExpo) {
  const rootMajor = rootExpo.split('.')[0];
  console.warn('');
  console.warn('[9ruDocs mobile] ⚠ 저장소 루트에도 expo 가 설치되어 있습니다.');
  console.warn(`  루트: expo@${rootExpo} — 루트에서 npx expo 를 쓰면 SDK ${rootMajor} 로 뜹니다.`);
  console.warn('  정리: 프로젝트 루트에서 npm run clean:root-expo');
  console.warn('');
}

console.log(`[9ruDocs mobile] Expo SDK ${REQUIRED_SDK_MAJOR} (expo@${version}) — Play 스토어 Expo Go 호환`);
