// tools/case-sync.js — 케이스 시드 동기화 도구
// 새 케이스를 extra에 추가 + 완료한 케이스를 completed에 기록
// case-seeds.json(원본 프리셋)은 절대 수정하지 않음
//
// 사용법:
//   run_tool('case-sync', { remove_id: 'closed_canvas' })
//
// 파일 구조:
//   case-seeds.json       — 원본 프리셋 (git tracked, 수정 금지)
//   case-seeds-extra.json — AI가 생성한 추가 케이스 (gitignored)
//   case-completed.json   — 완료한 케이스 ID 목록 (gitignored)
//   case-archive/         — 완료 케이스 전체 데이터 백업 (gitignored)

const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data;
    }
  } catch {}
  return fallback;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getPersonaDir(sessionDir) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(sessionDir, 'session.json'), 'utf-8'));
    if (meta.persona) {
      const sessionsDir = path.dirname(sessionDir);
      const dataDir = path.dirname(sessionsDir);
      return path.join(dataDir, 'personas', meta.persona);
    }
  } catch {}
  return null;
}

module.exports = async function(context, args) {
  const { remove_id } = args;
  const sessionDir = context.sessionDir;
  const personaDir = getPersonaDir(sessionDir);

  // --- 1. 새 케이스 읽기 (case-temp.json) ---
  let newCase = null;
  const tempPath = path.join(sessionDir, 'case-temp.json');
  try {
    if (fs.existsSync(tempPath)) {
      newCase = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
      if (!newCase.id || !newCase.title || !newCase.locations) {
        return { result: { success: false, message: 'case-temp.json이 유효한 케이스 구조가 아닙니다.' } };
      }
    }
  } catch (e) {
    return { result: { success: false, message: 'case-temp.json 읽기 실패: ' + e.message } };
  }

  if (!newCase && !remove_id) {
    return { result: { success: false, message: '할 작업이 없습니다.' } };
  }

  const results = { completed: false, archived: false, added_session: false, added_persona: false };

  // --- 2. 완료 케이스 기록 (case-completed.json) — 세션 + 페르소나 양쪽 ---
  if (remove_id) {
    // 세션 completed
    const sessionCompletedPath = path.join(sessionDir, 'case-completed.json');
    const sessionCompleted = readJson(sessionCompletedPath, []);
    if (!sessionCompleted.includes(remove_id)) {
      sessionCompleted.push(remove_id);
      writeJson(sessionCompletedPath, sessionCompleted);
    }

    // 페르소나 completed
    if (personaDir) {
      const personaCompletedPath = path.join(personaDir, 'case-completed.json');
      const personaCompleted = readJson(personaCompletedPath, []);
      if (!personaCompleted.includes(remove_id)) {
        personaCompleted.push(remove_id);
        writeJson(personaCompletedPath, personaCompleted);
      }
    }

    results.completed = true;

    // --- 3. 아카이브 (전체 데이터 백업) ---
    // 세션의 seeds + extra에서 원본 케이스 데이터 찾기
    const sessionSeeds = readJson(path.join(sessionDir, 'case-seeds.json'), []);
    const sessionExtra = readJson(path.join(sessionDir, 'case-seeds-extra.json'), []);
    const allCases = [...sessionSeeds, ...sessionExtra];
    const removedCase = allCases.find(c => c.id === remove_id);

    if (removedCase && personaDir) {
      try {
        const archiveDir = path.join(personaDir, 'case-archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const archiveFile = path.join(archiveDir, remove_id + '.json');
        if (!fs.existsSync(archiveFile)) {
          removedCase._played_at = new Date().toISOString();
          writeJson(archiveFile, removedCase);
          results.archived = true;
        }
      } catch {}
    }
  }

  // --- 4. 새 케이스 추가 (case-seeds-extra.json) — 세션 + 페르소나 양쪽 ---
  if (newCase) {
    // 세션 extra
    const sessionExtraPath = path.join(sessionDir, 'case-seeds-extra.json');
    const sessionExtra = readJson(sessionExtraPath, []);
    if (!sessionExtra.some(c => c.id === newCase.id)) {
      sessionExtra.push(newCase);
      writeJson(sessionExtraPath, sessionExtra);
      results.added_session = true;
    }

    // 페르소나 extra
    if (personaDir) {
      const personaExtraPath = path.join(personaDir, 'case-seeds-extra.json');
      const personaExtra = readJson(personaExtraPath, []);
      if (!personaExtra.some(c => c.id === newCase.id)) {
        personaExtra.push(newCase);
        writeJson(personaExtraPath, personaExtra);
        results.added_persona = true;
      }
    }

    // case-temp.json 정리
    try { fs.unlinkSync(tempPath); } catch {}
  }

  return {
    result: {
      success: true,
      remove_id: remove_id || null,
      new_case_id: newCase?.id || null,
      new_case_title: newCase?.title || null,
      ...results
    }
  };
};
