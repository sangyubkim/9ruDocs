#!/usr/bin/env node
/**
 * Runs before expo start — blocks wrong cwd, wrong SDK, and root expo contamination.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileDir, '../..');
const REQUIRED_SDK_MAJOR = '54';
const REQUIRED_EXPO_VERSION = '~54.0.34';

function normalize(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readExpoVersion(baseDir) {
  const pkg = readJson(path.join(baseDir, 'node_modules', 'expo', 'package.json'));
  return pkg?.version ?? null;
}

function fail(title, lines) {
  console.error('');
  console.error(`[9ruDocs mobile] ${title}`);
  for (const line of lines) {
    console.error(line);
  }
  console.error('');
  console.error('  해결 순서:');
  console.error('    1. scripts\\upgrade-mobile-expo.bat');
  console.error('    2. cd apps\\mobile && npx expo start -c');
  console.error('    3. Play 스토어에서 Expo Go 최신(SDK 54) 업데이트');
  console.error('    4. 저장소 루트(9ruDocs)에서 npx expo 를 실행하지 마세요');
  console.error('');
  process.exit(1);
}

const cwd = normalize(process.cwd());
const expected = normalize(mobileDir);

if (cwd !== expected) {
  fail('잘못된 작업 디렉터리입니다.', [
    `  현재: ${process.cwd()}`,
    `  필요: ${mobileDir}`,
    '',
    '  cd apps/mobile',
    '  npx expo start -c',
    '',
    '  저장소 루트에서 실행하려면: npm run mobile (프로젝트 루트)',
  ]);
}

const rootPkg = readJson(path.join(repoRoot, 'package.json'));
const rootExpoSpec = rootPkg?.dependencies?.expo ?? rootPkg?.devDependencies?.expo;
if (rootExpoSpec) {
  fail('저장소 루트 package.json 에 expo 가 있습니다.', [
    `  루트 package.json: expo "${rootExpoSpec}"`,
    '  루트에는 expo 를 설치하면 안 됩니다 (SDK 55 오염 원인).',
    '',
    '  정리: npm run clean:root-expo (프로젝트 루트)',
  ]);
}

const mobilePkg = readJson(path.join(mobileDir, 'package.json'));
const mobileExpoSpec = mobilePkg?.dependencies?.expo;
if (mobileExpoSpec && mobileExpoSpec !== REQUIRED_EXPO_VERSION) {
  fail(`package.json expo 버전이 SDK ${REQUIRED_SDK_MAJOR} 와 다릅니다.`, [
    `  현재: "${mobileExpoSpec}"`,
    `  필요: "${REQUIRED_EXPO_VERSION}"`,
  ]);
}

const version = readExpoVersion(mobileDir);
if (!version) {
  fail('node_modules/expo 가 없습니다.', [
    '  cd apps/mobile',
    '  npm install',
  ]);
}

const major = version.split('.')[0];
if (major !== REQUIRED_SDK_MAJOR) {
  fail(`Expo SDK ${major} 감지 — 이 앱은 SDK ${REQUIRED_SDK_MAJOR} 고정입니다.`, [
    `  expo 패키지: ${version}`,
    `  필요: SDK ${REQUIRED_SDK_MAJOR} (${REQUIRED_EXPO_VERSION})`,
  ]);
}

const rootExpo = readExpoVersion(repoRoot);
if (rootExpo) {
  const rootMajor = rootExpo.split('.')[0];
  console.warn('');
  console.warn('[9ruDocs mobile] ⚠ 저장소 루트 node_modules 에도 expo 가 설치되어 있습니다.');
  console.warn(`  루트: expo@${rootExpo} — 루트에서 npx expo 를 쓰면 SDK ${rootMajor} 로 뜹니다.`);
  console.warn('  정리: 프로젝트 루트에서 npm run clean:root-expo');
  console.warn('');
}

console.log(`[9ruDocs mobile] Expo SDK ${REQUIRED_SDK_MAJOR} (expo@${version}) — Play 스토어 Expo Go 호환`);
