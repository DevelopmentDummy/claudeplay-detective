// tools/archive-case.js — 사건 히스토리 아카이빙 전용 툴
// reset_case에서 호출되거나 독립 실행 가능
var fs = require('fs');
var path = require('path');

module.exports = function(ctx, args) {
  var caseData = ctx.data['case'] || {};
  if (!caseData.id) {
    return { result: { success: false, message: '아카이빙할 사건이 없습니다.' } };
  }

  var historyPath = path.join(ctx.sessionDir, 'case-history.json');
  var history = [];
  try {
    var raw = fs.readFileSync(historyPath, 'utf-8');
    history = JSON.parse(raw);
  } catch(e) {}
  if (!Array.isArray(history)) history = [];

  // 중복 방지 — 같은 id가 이미 있으면 스킵
  var exists = history.some(function(h) { return h.id === caseData.id; });
  if (exists) {
    return { result: { success: false, message: '이미 아카이빙된 사건입니다.' } };
  }

  var searchPoints = ctx.data['search-points'] || {};
  var spHits = 0, spMisses = 0;
  Object.keys(searchPoints).forEach(function(rk) {
    var room = searchPoints[rk];
    (room.points || []).forEach(function(p) {
      if (p.investigated) {
        if (p.evidence_id) spHits++;
        else spMisses++;
      }
    });
  });

  history.push({
    id: caseData.id,
    title: caseData.title,
    solvedAt: new Date().toISOString(),
    day: ctx.variables.day,
    time: ctx.variables.time,
    insight: ctx.variables.insight,
    trust: ctx.variables.trust,
    clues_found: ctx.variables.clues_found,
    clues_total: ctx.variables.clues_total,
    wrong_presents: ctx.variables.wrong_presents,
    stats: {
      ...(ctx.data['case-stats'] || {}),
      search_hits_calc: spHits,
      search_misses_calc: spMisses
    },
    evidence: caseData.evidence,
    deductions: caseData.deductions,
    suspects: caseData.suspects,
    solution: caseData.solution
  });

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');

  return { result: { success: true, message: '사건이 아카이빙되었습니다.', title: caseData.title } };
};
