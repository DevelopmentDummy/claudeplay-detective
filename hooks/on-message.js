// hooks/on-message.js — 매 메시지 전송 직전 실행
// 현재 방의 미조사 탐색 포인트에서 랜덤 2개를 _search_suggestions에 저장
module.exports = function({ variables, data }) {
  const patch = {};
  const phase = variables.case_phase;
  const location = variables.location;
  const room = variables.current_room;

  // 페이즈별 제어 메시지
  if (phase === 'resolved') {
    patch._phase_instruction = '사건이 해결되었다. 서사 마지막에 반드시 $PANEL:사건결과$ 토큰을 포함하여 인라인 결과 보고서를 표시하라.';
  } else {
    patch._phase_instruction = '';
  }

  // 시드 보충은 fire_ai 백그라운드가 케이스 소비 시 자동 처리 — AI 개입 불필요

  // 수사 중이고 위치가 설정된 경우만
  if (phase !== 'investigation' || !location || !room) {
    patch._search_suggestions = '';
    patch._available_rooms = '';
    patch._available_npcs = '';
    patch._available_locations = '';
    return { variables: patch };
  }

  // 이동 가능한 장소 목록 (현재 위치 제외, unlocked만)
  var caseData = data['case'] || {};
  var allLocations = caseData.locations || {};
  var locEntries = Object.entries(allLocations).filter(function(e) {
    return e[0] !== location && e[1].unlocked;
  });
  patch._available_locations = locEntries.map(function(e) {
    return e[0] + ':' + e[1].name;
  }).join(', ');

  // 현재 장소 내 이동 가능한 방 목록 (현재 방 제외, unlocked만)
  var currentLoc = allLocations[location];
  if (currentLoc && currentLoc.floor_plan) {
    var availRooms = (currentLoc.floor_plan.rooms || []).filter(function(r) {
      return r.id !== room && !r.locked;
    });
    patch._available_rooms = availRooms.map(function(r) {
      return r.id + ':' + r.name;
    }).join(', ');
  } else {
    patch._available_rooms = '';
  }

  // 현재 방에 있는 대화 가능한 NPC 목록
  if (currentLoc && currentLoc.npcs) {
    var availNpcs = Object.entries(currentLoc.npcs).filter(function(e) {
      return e[1].room === room && e[1].available;
    });
    patch._available_npcs = availNpcs.map(function(e) {
      return e[0] + ':' + e[1].name;
    }).join(', ');
  } else {
    patch._available_npcs = '';
  }

  const searchPoints = data['search-points'] || {};
  const roomKey = location + '/' + room;
  const roomData = searchPoints[roomKey];

  if (!roomData || !roomData.initialized) {
    patch._search_suggestions = '';
    return { variables: patch };
  }

  // 미조사 포인트 필터
  var uninvestigated = roomData.points.filter(function(p) { return !p.investigated; });

  if (uninvestigated.length === 0) {
    patch._search_suggestions = '';
    return { variables: patch };
  }

  // Fisher-Yates shuffle
  for (var i = uninvestigated.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = uninvestigated[i];
    uninvestigated[i] = uninvestigated[j];
    uninvestigated[j] = tmp;
  }

  // 최대 2개 선택, "id:name" 형식으로 직렬화
  var picks = uninvestigated.slice(0, 2);
  patch._search_suggestions = picks.map(function(p) { return p.id + ':' + p.name; }).join(', ');

  return { variables: patch };
};
