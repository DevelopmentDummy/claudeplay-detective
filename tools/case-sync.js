// tools/case-sync.js — 케이스 시드 동기화 도구
// 새 케이스 주입 + 사용된 케이스 제거를 세션과 페르소나 양쪽에 원자적으로 처리
//
// 사용법 (AI 또는 패널에서):
//   run_tool('case-sync', { remove_id: 'closed_canvas' })
//
// 동작:
//   1. case-temp.json이 있으면 새 케이스로 읽음
//   2. 세션 case-seeds.json에서 remove_id 제거 + 새 케이스 append
//   3. 페르소나 원본 case-seeds.json에도 동일 처리
//   4. case-temp.json 정리

const fs = require('fs');
const path = require('path');

module.exports = async function(context, args) {
  const { remove_id } = args;
  const sessionDir = context.sessionDir;

  // --- 1. 새 케이스 읽기 (case-temp.json) ---
  let newCase = null;
  const tempPath = path.join(sessionDir, 'case-temp.json');
  try {
    if (fs.existsSync(tempPath)) {
      newCase = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
      // 유효성 기본 체크
      if (!newCase.id || !newCase.title || !newCase.locations) {
        return { result: { success: false, message: 'case-temp.json이 유효한 케이스 구조가 아닙니다.' } };
      }
    }
  } catch (e) {
    return { result: { success: false, message: 'case-temp.json 읽기 실패: ' + e.message } };
  }

  if (!newCase && !remove_id) {
    return { result: { success: false, message: 'case-temp.json이 없고 remove_id도 없습니다. 할 작업이 없습니다.' } };
  }

  // --- 2. 세션 case-seeds.json 처리 ---
  const sessionSeedsPath = path.join(sessionDir, 'case-seeds.json');
  let sessionSeeds = [];
  try {
    if (fs.existsSync(sessionSeedsPath)) {
      sessionSeeds = JSON.parse(fs.readFileSync(sessionSeedsPath, 'utf-8'));
      if (!Array.isArray(sessionSeeds)) sessionSeeds = [];
    }
  } catch { sessionSeeds = []; }

  let removedFromSession = false;
  let removedCase = null;
  if (remove_id) {
    removedCase = sessionSeeds.find(c => c.id === remove_id) || null;
    const before = sessionSeeds.length;
    sessionSeeds = sessionSeeds.filter(c => c.id !== remove_id);
    removedFromSession = sessionSeeds.length < before;
  }

  // --- 플레이한 케이스 아카이브 (페르소나 원본 case-archive/ 폴더에 개별 파일로 보관) ---
  if (removedCase) {
    try {
      const sessionMeta = JSON.parse(fs.readFileSync(path.join(sessionDir, 'session.json'), 'utf-8'));
      const personaName = sessionMeta.persona;
      if (personaName) {
        const sessionsDir = path.dirname(sessionDir);
        const dataDir = path.dirname(sessionsDir);
        const archiveDir = path.join(dataDir, 'personas', personaName, 'case-archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

        const archiveFile = path.join(archiveDir, removedCase.id + '.json');
        if (!fs.existsSync(archiveFile)) {
          removedCase._played_at = new Date().toISOString();
          fs.writeFileSync(archiveFile, JSON.stringify(removedCase, null, 2), 'utf-8');
        }
      }
    } catch { /* 아카이브 실패해도 진행 */ }
  }

  let addedToSession = false;
  if (newCase) {
    // 중복 방지
    if (!sessionSeeds.some(c => c.id === newCase.id)) {
      sessionSeeds.push(newCase);
      addedToSession = true;
    }
  }

  fs.writeFileSync(sessionSeedsPath, JSON.stringify(sessionSeeds, null, 2), 'utf-8');

  // --- 3. 페르소나 원본 case-seeds.json 처리 ---
  let personaSeedsPath = null;
  let removedFromPersona = false;
  let addedToPersona = false;

  try {
    // session.json에서 페르소나 이름 읽기
    const sessionMeta = JSON.parse(fs.readFileSync(path.join(sessionDir, 'session.json'), 'utf-8'));
    const personaName = sessionMeta.persona;

    if (personaName) {
      // 세션 디렉토리 기준으로 페르소나 경로 추론
      // sessions/{session-dir} → personas/{persona-name}
      const sessionsDir = path.dirname(sessionDir);
      const dataDir = path.dirname(sessionsDir);
      personaSeedsPath = path.join(dataDir, 'personas', personaName, 'case-seeds.json');

      let personaSeeds = [];
      try {
        if (fs.existsSync(personaSeedsPath)) {
          personaSeeds = JSON.parse(fs.readFileSync(personaSeedsPath, 'utf-8'));
          if (!Array.isArray(personaSeeds)) personaSeeds = [];
        }
      } catch { personaSeeds = []; }

      if (remove_id) {
        const before = personaSeeds.length;
        personaSeeds = personaSeeds.filter(c => c.id !== remove_id);
        removedFromPersona = personaSeeds.length < before;
      }

      if (newCase && !personaSeeds.some(c => c.id === newCase.id)) {
        personaSeeds.push(newCase);
        addedToPersona = true;
      }

      fs.writeFileSync(personaSeedsPath, JSON.stringify(personaSeeds, null, 2), 'utf-8');
    }
  } catch (e) {
    // 페르소나 동기화 실패해도 세션은 이미 처리됨
    return {
      result: {
        success: true,
        warning: '페르소나 원본 동기화 실패: ' + e.message,
        session: { removed: removedFromSession, added: addedToSession, total: sessionSeeds.length },
        persona: { error: e.message }
      }
    };
  }

  // --- 4. case-temp.json 정리 ---
  if (newCase) {
    try { fs.unlinkSync(tempPath); } catch {}
  }

  return {
    result: {
      success: true,
      removed_id: remove_id || null,
      new_case_id: newCase?.id || null,
      new_case_title: newCase?.title || null,
      session: { removed: removedFromSession, added: addedToSession, total: sessionSeeds.length },
      persona: { removed: removedFromPersona, added: addedToPersona, path: personaSeedsPath }
    }
  };
};
