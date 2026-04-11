// tools/list-cases.js — 의뢰함 케이스 목록 조회
// (seeds + extra) - completed 로 필터링하여 플레이 가능한 케이스만 반환

const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return fallback;
}

module.exports = async function(context) {
  const dir = context.sessionDir;

  const seeds = readJson(path.join(dir, 'case-seeds.json'), []);
  const extra = readJson(path.join(dir, 'case-seeds-extra.json'), []);
  const completed = new Set(readJson(path.join(dir, 'case-completed.json'), []));

  const all = [...seeds, ...extra].filter(c => !completed.has(c.id));

  const list = all.map(c => ({
    id: c.id,
    title: c.title,
    difficulty: c.difficulty,
    summary: (c.summary || '').slice(0, 80),
    locations: Object.keys(c.locations || {}).length,
    suspects: (c.suspects || []).length,
    source: seeds.some(s => s.id === c.id) ? 'preset' : 'generated'
  }));

  return {
    result: {
      count: list.length,
      completed_count: completed.size,
      cases: list
    }
  };
};
