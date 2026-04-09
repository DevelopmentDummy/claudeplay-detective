// tools/list-cases.js — 의뢰함 케이스 목록 간결 조회
// case-seeds.json에서 메타 정보만 추출하여 반환 (전체 데이터 로드 불필요)

const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const seedsPath = path.join(context.sessionDir, 'case-seeds.json');

  let seeds = [];
  try {
    if (fs.existsSync(seedsPath)) {
      seeds = JSON.parse(fs.readFileSync(seedsPath, 'utf-8'));
      if (!Array.isArray(seeds)) seeds = [];
    }
  } catch { seeds = []; }

  const list = seeds.map(c => ({
    id: c.id,
    title: c.title,
    difficulty: c.difficulty,
    summary: (c.summary || '').slice(0, 80),
    locations: Object.keys(c.locations || {}).length,
    suspects: (c.suspects || []).length
  }));

  return {
    result: {
      count: list.length,
      cases: list
    }
  };
};
