// tools/engine.js — 탐정 사무소 사건 수사 엔진
// 중앙 디스패처: 수사 액션 처리

const ACTIONS = {
  // === 사건 관리 ===
  reset_case(ctx, args) {
    // Archive current case to case-history
    const caseData = ctx.data['case'] || {};
    const caseStats = ctx.data['case-stats'] || {};
    const history = ctx.data['case-history'] || [];
    let newHistory = [...history];

    if (caseData.id) {
      newHistory.push({
        id: caseData.id,
        title: caseData.title,
        difficulty: caseData.difficulty,
        summary: caseData.summary,
        evidence: caseData.evidence || {},
        deductions: caseData.deductions || {},
        suspects: caseData.suspects || [],
        solution: caseData.solution || {},
        trust: ctx.variables.trust,
        insight: ctx.variables.insight,
        wrong_presents: ctx.variables.wrong_presents,
        day: ctx.variables.day,
        time: ctx.variables.time,
        stats: caseStats,
        solvedAt: new Date().toISOString()
      });
    }

    // Close investigation modals
    const modals = ctx.variables.__modals || {};
    const resetModals = {};
    Object.keys(modals).forEach(key => { resetModals[key] = false; });
    return {
      variables: {
        case_phase: 'idle',
        case_title: '',
        location: '',
        current_room: '',
        day: 1,
        _time_raw: advanceTime(ctx.variables.time, 30),
        clues_found: 0,
        clues_total: 0,
        wrong_presents: 0,
        insight: 0,
        hayul_note: '아직 진행 중인 사건이 없습니다.',
        __modals: resetModals
      },
      data: {
        "case.json": { id: null, title: null, status: 'idle', summary: null, difficulty: null, locations: {}, evidence: {}, testimonies: {}, deductions: {}, suspects: [], solution: null, unlocks: [] },
        "case-history.json": newHistory,
        "case-stats.json": {},
        "hayul-notes.json": { "entries": [] }
      },
      result: { success: true, message: '사건이 초기화되었습니다.' }
    };
  },

  add_note(ctx, args) {
    const { text } = args;
    if (!text) return { result: { success: false, message: '메모 내용이 없습니다.' } };
    const notesData = ctx.data['hayul-notes'] || {};
    const notes = Array.isArray(notesData.entries) ? notesData.entries : [];
    const location = ctx.variables.location || '';
    const room = ctx.variables.current_room || '';
    const time = ctx.variables.time || '';
    const caseData = ctx.data['case'] || {};
    var locationName = location;
    var roomName = room;
    var loc = (caseData.locations || {})[location];
    if (loc) {
      locationName = loc.name || location;
      var rooms = loc.floor_plan?.rooms || [];
      var roomObj = rooms.find(function(r) { return r.id === room; });
      if (roomObj) roomName = roomObj.name || room;
    }
    var entry = {
      id: 'n_' + (notes.length + 1),
      text: text,
      time: time,
      location: locationName,
      room: roomName
    };
    return {
      data: { "hayul-notes.json": { entries: [entry].concat(notes) } },
      result: { success: true, entry: entry }
    };
  },

  accept_case(ctx, args) {
    const { case_id } = args;
    const baseSeeds = Array.isArray(ctx.data['case-seeds']) ? ctx.data['case-seeds'] : [];
    const extraSeeds = Array.isArray(ctx.data['case-seeds-extra']) ? ctx.data['case-seeds-extra'] : [];
    const completed = new Set(Array.isArray(ctx.data['case-completed']) ? ctx.data['case-completed'] : []);
    const allSeeds = [...baseSeeds, ...extraSeeds].filter(c => !completed.has(c.id));

    if (allSeeds.length === 0) {
      return { result: { success: false, message: '수임 가능한 사건이 없습니다.' } };
    }

    const caseData = allSeeds.find(c => c.id === case_id);
    if (!caseData) {
      return { result: { success: false, message: `사건 '${case_id}'을(를) 찾을 수 없습니다.` } };
    }

    // seeds에서 제거하지 않음 — case-sync가 백그라운드에서 일괄 처리

    // Count total evidence
    const cluesTotal = Object.keys(caseData.evidence || {}).length;

    // Find first unlocked location
    const firstLoc = Object.entries(caseData.locations || {})
      .find(([_, loc]) => loc.unlocked);
    const firstLocId = firstLoc ? firstLoc[0] : '';
    const firstRoom = firstLoc && firstLoc[1].floor_plan?.rooms?.[0]?.id || '';

    return {
      variables: {
        case_phase: 'investigation',
        case_title: caseData.title,
        day: 1,
        _time_raw: advanceTime(ctx.variables.time, 120),
        clues_found: 0,
        clues_total: cluesTotal,
        wrong_presents: 0,
        insight: 0,
        location: firstLocId,
        current_room: firstRoom,
        __modals: { '증거품탐색': true, '하율메모': true }
      },
      data: {
        "case.json": caseData
      },
      result: {
        success: true,
        case_id: caseData.id,
        case_title: caseData.title,
        summary: caseData.summary,
        difficulty: caseData.difficulty,
        first_location: firstLoc ? firstLoc[1].name : null,
        clues_total: cluesTotal,
        suspects_count: (caseData.suspects || []).length
      }
    };
  },

  // === 이동 ===
  move_location(ctx, args) {
    const { location_id } = args;
    const caseData = ctx.data['case'] || {};
    const loc = caseData.locations?.[location_id];

    if (!loc) {
      return { result: { success: false, message: '존재하지 않는 장소입니다.' } };
    }
    if (!loc.unlocked) {
      return { result: { success: false, message: `${loc.name}은(는) 아직 접근할 수 없습니다.`, locked: true } };
    }

    const firstRoom = loc.floor_plan?.rooms?.[0]?.id || '';
    const _tr = advanceTime(ctx.variables.time, 120);

    const searchPoints = ctx.data['search-points'] || {};
    const roomKey = location_id + '/' + firstRoom;
    const needsInit = !searchPoints[roomKey]?.initialized;

    return {
      variables: {
        location: location_id,
        current_room: firstRoom,
        _time_raw: _tr
      },
      result: {
        success: true,
        location_name: loc.name,
        address: loc.address,
        first_room: firstRoom,
        available_rooms: (loc.floor_plan?.rooms || []).filter(r => !r.locked).map(r => ({ id: r.id, name: r.name })),
        npcs: Object.entries(loc.npcs || {}).filter(([_, n]) => n.available).map(([id, n]) => ({ id, name: n.name, room: n.room })),
        needs_search_init: needsInit,
        search_init_event: needsInit
          ? '[방탐색초기화] location=' + location_id + ', room_id=' + firstRoom + ', room_name=' + (loc.floor_plan?.rooms?.[0]?.name || firstRoom)
          : null
      }
    };
  },

  move_room(ctx, args) {
    const { room_id } = args;
    const caseData = ctx.data['case'] || {};
    const loc = caseData.locations?.[ctx.variables.location];
    if (!loc) return { result: { success: false, message: '현재 장소 정보가 없습니다.' } };

    const room = loc.floor_plan?.rooms?.find(r => r.id === room_id);
    if (!room) return { result: { success: false, message: '존재하지 않는 방입니다.' } };
    if (room.locked) {
      return { result: { success: false, message: `${room.name}은(는) 잠겨 있습니다.`, locked: true, unlock_hint: room.unlock_evidence } };
    }

    const points = Object.entries(loc.points || {})
      .filter(([_, p]) => p.room === room_id)
      .map(([id, p]) => ({ id, name: p.name, type: p.type, found: p.found }));

    const npcs = Object.entries(loc.npcs || {})
      .filter(([_, n]) => n.room === room_id && n.available)
      .map(([id, n]) => ({ id, name: n.name, talked: n.talked }));

    // Check search-points initialization
    const searchPoints = ctx.data['search-points'] || {};
    const roomKey = ctx.variables.location + '/' + room_id;
    const needsInit = !searchPoints[roomKey]?.initialized;

    const _tr = advanceTime(ctx.variables.time, 30);

    return {
      variables: { current_room: room_id, _time_raw: _tr },
      result: {
        success: true,
        room_name: room.name,
        points,
        npcs,
        crime_scene: room.crime_scene || false,
        needs_search_init: needsInit,
        search_init_event: needsInit
          ? '[방탐색초기화] location=' + ctx.variables.location + ', room_id=' + room_id + ', room_name=' + room.name
          : null
      }
    };
  },

  // === 수사 ===
  investigate(ctx, args) {
    const { point_id } = args;
    const caseData = ctx.data['case'] || {};
    const loc = caseData.locations?.[ctx.variables.location];
    if (!loc) return { result: { success: false, message: '현재 장소 정보가 없습니다.' } };

    const point = loc.points?.[point_id];
    if (!point) return { result: { success: false, message: '존재하지 않는 조사 포인트입니다.' } };
    if (point.found) return { result: { success: false, message: '이미 조사한 포인트입니다.', already_found: true } };

    // 포인트 조사 완료
    const updatedPoints = { ...loc.points, [point_id]: { ...point, found: true } };
    const updatedLoc = { ...loc, points: updatedPoints };
    let updatedLocations = { ...caseData.locations, [ctx.variables.location]: updatedLoc };

    // 증거 추가
    let evidenceUpdate = {};
    const evidence = caseData.evidence?.[point.evidence_id];
    if (evidence) {
      evidenceUpdate.evidence = { ...caseData.evidence, [point.evidence_id]: { ...evidence, found: true } };
    }

    const newCluesFound = ctx.variables.clues_found + 1;

    // 해금 체크
    const unlockResults = checkUnlocks(caseData, { type: 'evidence_found', id: point.evidence_id }, updatedLocations);
    if (unlockResults.changed) {
      updatedLocations = unlockResults.locations;
    }

    return {
      variables: {
        clues_found: newCluesFound,
        insight: Math.min(ctx.variables.insight_max, ctx.variables.insight + 5),
        __popups: [{ template: 'clue-found', duration: 3000, vars: { clueName: point.name } }]
      },
      data: {
        "case.json": {
          locations: updatedLocations,
          ...evidenceUpdate
        }
      },
      result: {
        success: true,
        point_name: point.name,
        point_type: point.type,
        evidence: evidence ? {
          id: point.evidence_id,
          name: evidence.name,
          description: evidence.description,
          type: evidence.type
        } : null,
        unlocked: unlockResults.unlocked,
        clues_found: newCluesFound,
        clues_total: ctx.variables.clues_total
      }
    };
  },

  search_point(ctx, args) {
    const { sp_id } = args;
    const searchPoints = ctx.data['search-points'] || {};
    const roomKey = ctx.variables.location + '/' + ctx.variables.current_room;
    const room = searchPoints[roomKey];

    if (!room || !room.initialized) {
      return { result: { success: false, message: '이 방의 탐색 포인트가 아직 준비되지 않았습니다.' } };
    }

    const pointIdx = room.points.findIndex(p => p.id === sp_id);
    if (pointIdx === -1) {
      return { result: { success: false, message: '존재하지 않는 탐색 포인트입니다.' } };
    }

    const point = room.points[pointIdx];
    if (point.investigated) {
      return { result: { success: false, message: '이미 조사한 포인트입니다.', already_investigated: true } };
    }

    // Mark as investigated
    const updatedPoints = [...room.points];
    updatedPoints[pointIdx] = { ...point, investigated: true };
    const updatedRoom = { ...room, points: updatedPoints };

    var _tr = advanceTime(ctx.variables.time, 5);

    // Dummy — no evidence
    if (!point.evidence_id) {
      var dummyStats = incStat(ctx, 'search_attempts');
      dummyStats.search_misses = (dummyStats.search_misses || 0) + 1;
      return {
        variables: { _time_raw: _tr },
        data: {
          "search-points.json": { ...searchPoints, [roomKey]: updatedRoom },
          "case-stats.json": dummyStats
        },
        result: {
          success: true,
          is_evidence: false,
          point_name: point.name,
          point_desc: point.desc
        }
      };
    }

    // Real evidence
    const caseData = ctx.data['case'] || {};
    const loc = caseData.locations?.[ctx.variables.location];
    const casePointEntry = Object.entries(loc?.points || {})
      .find(([_, p]) => p.evidence_id === point.evidence_id);

    if (!casePointEntry) {
      var fallbackStats = incStat(ctx, 'search_attempts');
      fallbackStats.search_misses = (fallbackStats.search_misses || 0) + 1;
      return {
        data: {
          "search-points.json": { ...searchPoints, [roomKey]: updatedRoom },
          "case-stats.json": fallbackStats
        },
        result: { success: true, is_evidence: false, point_name: point.name, point_desc: point.desc }
      };
    }

    const [casePointId, casePoint] = casePointEntry;
    const updatedCasePoints = { ...loc.points, [casePointId]: { ...casePoint, found: true } };
    let updatedLoc = { ...loc, points: updatedCasePoints };
    let updatedLocations = { ...caseData.locations, [ctx.variables.location]: updatedLoc };

    let evidenceUpdate = {};
    const evidence = caseData.evidence?.[point.evidence_id];
    if (evidence) {
      evidenceUpdate.evidence = { ...caseData.evidence, [point.evidence_id]: { ...evidence, found: true } };
    }

    const newCluesFound = ctx.variables.clues_found + 1;
    const unlockResults = checkUnlocks(caseData, { type: 'evidence_found', id: point.evidence_id }, updatedLocations);
    if (unlockResults.changed) {
      updatedLocations = unlockResults.locations;
    }

    var hitStats = incStat(ctx, 'search_attempts');
    hitStats.search_hits = (hitStats.search_hits || 0) + 1;

    return {
      variables: {
        clues_found: newCluesFound,
        insight: Math.min(ctx.variables.insight_max, ctx.variables.insight + 5),
        __popups: [{ template: 'clue-found', duration: 3000, vars: { clueName: evidence?.name || point.name } }],
        _time_raw: _tr,
        ...(unlockResults.changed ? { _unlock_ver: (ctx.variables._unlock_ver || 0) + 1 } : {})
      },
      data: {
        "search-points.json": { ...searchPoints, [roomKey]: updatedRoom },
        "case.json": { locations: updatedLocations, ...evidenceUpdate },
        "case-stats.json": hitStats
      },
      result: {
        success: true,
        is_evidence: true,
        point_name: point.name,
        point_desc: point.desc,
        evidence: evidence ? { id: point.evidence_id, name: evidence.name, description: evidence.description, type: evidence.type } : null,
        unlocked: unlockResults.unlocked,
        clues_found: newCluesFound,
        clues_total: ctx.variables.clues_total
      }
    };
  },

  // === 대화/증언 ===
  talk_to(ctx, args) {
    const { npc_id } = args;
    const caseData = ctx.data['case'] || {};
    const loc = caseData.locations?.[ctx.variables.location];
    if (!loc) return { result: { success: false, message: '현재 장소 정보가 없습니다.' } };

    const npc = loc.npcs?.[npc_id];
    if (!npc) return { result: { success: false, message: '해당 인물을 찾을 수 없습니다.' } };
    if (!npc.available) return { result: { success: false, message: `${npc.name}에게 접근할 수 없습니다.` } };

    // NPC talked 표시
    const updatedNpcs = { ...loc.npcs, [npc_id]: { ...npc, talked: true } };
    const updatedLoc = { ...loc, npcs: updatedNpcs };

    // 해당 NPC의 증언
    const testimony = Object.entries(caseData.testimonies || {})
      .find(([_, t]) => t.witness === npc_id);

    const _tr = advanceTime(ctx.variables.time, 15);

    return {
      variables: {
        insight: Math.min(ctx.variables.insight_max, ctx.variables.insight + 3),
        _time_raw: _tr
      },
      data: {
        "case.json": {
          locations: { ...caseData.locations, [ctx.variables.location]: updatedLoc }
        }
      },
      result: {
        success: true,
        npc_name: npc.name,
        npc_role: npc.role,
        testimony: testimony ? { id: testimony[0], witness_name: testimony[1].witness_name, statements: testimony[1].statements } : null,
        first_meeting: !npc.talked,
      }
    };
  },

  press(ctx, args) {
    const { testimony_id, statement_id } = args;
    const caseData = ctx.data['case'] || {};
    const testimony = caseData.testimonies?.[testimony_id];
    if (!testimony) return { result: { success: false, message: '존재하지 않는 증언입니다.' } };

    const stmtIdx = testimony.statements.findIndex(s => s.id === statement_id);
    if (stmtIdx === -1) return { result: { success: false, message: '존재하지 않는 발언입니다.' } };

    const stmt = testimony.statements[stmtIdx];
    if (stmt.pressed) return { result: { success: false, message: '이미 추궁한 발언입니다.', already_pressed: true } };

    const updatedStmts = [...testimony.statements];
    updatedStmts[stmtIdx] = { ...stmt, pressed: true };

    // 추궁으로 새 발언 추가
    if (stmt.press_adds) {
      updatedStmts.splice(stmtIdx + 1, 0, ...stmt.press_adds);
    }

    const updatedTestimony = { ...testimony, statements: updatedStmts };
    var pressStats = incStat(ctx, 'press_count');

    return {
      variables: {
        insight: Math.min(ctx.variables.insight_max, ctx.variables.insight + 2)
      },
      data: {
        "case.json": {
          testimonies: { ...caseData.testimonies, [testimony_id]: updatedTestimony }
        },
        "case-stats.json": pressStats
      },
      result: {
        success: true,
        witness_name: testimony.witness_name,
        statement_text: stmt.text,
        press_result: stmt.press_result || '추가 정보를 얻지 못했다.',
        new_statements: stmt.press_adds || [],
        insight_gained: 2
      }
    };
  },

  present(ctx, args) {
    const { testimony_id, statement_id, evidence_id } = args;
    const caseData = ctx.data['case'] || {};
    const testimony = caseData.testimonies?.[testimony_id];
    if (!testimony) return { result: { success: false, message: '존재하지 않는 증언입니다.' } };

    const stmt = testimony.statements.find(s => s.id === statement_id);
    if (!stmt) return { result: { success: false, message: '존재하지 않는 발언입니다.' } };

    const evidence = caseData.evidence?.[evidence_id];
    if (!evidence || !evidence.found) return { result: { success: false, message: '해당 증거를 보유하고 있지 않습니다.' } };

    // 모순 판정
    const isCorrect = stmt.contradiction && stmt.contradiction.evidence_id === evidence_id;

    if (isCorrect) {
      const updatedStmts = testimony.statements.map(s =>
        s.id === statement_id ? { ...s, contradicted: true } : s
      );
      const updatedTestimony = { ...testimony, statements: updatedStmts };

      // 해금 체크
      const unlockResults = checkUnlocks(caseData, { type: 'contradiction_found', testimony_id, statement_id }, caseData.locations);

      var correctStats = incStat(ctx, 'present_attempts');
      correctStats.present_correct = (correctStats.present_correct || 0) + 1;

      return {
        variables: {
          insight: Math.min(ctx.variables.insight_max, ctx.variables.insight + 15),
          __popups: [{ template: 'objection', duration: 3000 }],
          ...(unlockResults.changed ? { _unlock_ver: (ctx.variables._unlock_ver || 0) + 1 } : {})
        },
        data: {
          "case.json": {
            testimonies: { ...caseData.testimonies, [testimony_id]: updatedTestimony },
            ...(unlockResults.changed ? { locations: unlockResults.locations } : {})
          },
          "case-stats.json": correctStats
        },
        result: {
          success: true,
          correct: true,
          witness_name: testimony.witness_name,
          statement_text: stmt.text,
          evidence_name: evidence.name,
          reveal: stmt.contradiction.reveal,
          insight_gained: 15,
          unlocked: unlockResults.unlocked
        }
      };
    } else {
      const newWrong = ctx.variables.wrong_presents + 1;
      const failed = newWrong >= ctx.variables.wrong_presents_max;

      var wrongStats = incStat(ctx, 'present_attempts');
      wrongStats.present_wrong = (wrongStats.present_wrong || 0) + 1;

      return {
        variables: {
          wrong_presents: newWrong,
          trust: Math.max(0, ctx.variables.trust - 15),
          __popups: [{ template: 'wrong-answer', duration: 2500 }]
        },
        data: {
          "case-stats.json": wrongStats
        },
        result: {
          success: true,
          correct: false,
          witness_name: testimony.witness_name,
          statement_text: stmt.text,
          evidence_name: evidence.name,
          wrong_count: newWrong,
          max_wrong: ctx.variables.wrong_presents_max,
          failed,
          trust_lost: 15
        }
      };
    }
  },

  // === 추리 ===
  deduce(ctx, args) {
    const { evidence_ids } = args;
    if (!Array.isArray(evidence_ids) || evidence_ids.length < 2) {
      return { result: { success: false, message: '두 개 이상의 증거를 연결해야 합니다.' } };
    }

    const caseData = ctx.data['case'] || {};
    const deductions = caseData.deductions || {};

    const sortedIds = [...evidence_ids].sort();
    const match = Object.entries(deductions).find(([_, d]) => {
      if (d.unlocked) return false;
      const required = [...d.required_evidence].sort();
      return required.length === sortedIds.length && required.every((v, i) => v === sortedIds[i]);
    });

    if (!match) {
      var failDeduceStats = incStat(ctx, 'deduce_attempts');
      failDeduceStats.deduce_fail = (failDeduceStats.deduce_fail || 0) + 1;
      return {
        variables: {
          __popups: [{ template: 'wrong-answer', duration: 2000 }]
        },
        data: {
          "case-stats.json": failDeduceStats
        },
        result: { success: false, message: '이 증거들 사이에서 새로운 연결점을 찾지 못했다.' }
      };
    }

    const [dedId, ded] = match;
    const updatedDeductions = { ...deductions, [dedId]: { ...ded, unlocked: true } };

    const unlockResults = checkUnlocks(caseData, { type: 'deduction_unlocked', id: dedId }, caseData.locations);

    var successDeduceStats = incStat(ctx, 'deduce_attempts');
    successDeduceStats.deduce_success = (successDeduceStats.deduce_success || 0) + 1;

    return {
      variables: {
        insight: Math.min(ctx.variables.insight_max, ctx.variables.insight + 10),
        __popups: [{ template: 'clue-found', duration: 3000, vars: { clueName: ded.name } }],
        ...(unlockResults.changed ? { _unlock_ver: (ctx.variables._unlock_ver || 0) + 1 } : {})
      },
      data: {
        "case.json": {
          deductions: updatedDeductions,
          ...(unlockResults.changed ? { locations: unlockResults.locations } : {})
        },
        "case-stats.json": successDeduceStats
      },
      result: {
        success: true,
        deduction_name: ded.name,
        deduction_description: ded.description,
        insight_gained: 10,
        unlocked: unlockResults.unlocked
      }
    };
  },

  // === 범인 지목 ===
  // --- 범인 지목: 2단계 시스템 ---
  // 1단계: accuse — 용의자 선택 + 자격 검증 (insight + 핵심증거 + 추리)
  // 2단계: prove — 핵심 증거를 순서대로 제시해야 최종 해결

  accuse(ctx, args) {
    const { suspect_id } = args;
    const caseData = ctx.data['case'] || {};
    const evidence = caseData.evidence || {};
    const deductions = caseData.deductions || {};
    const solution = caseData.solution || {};
    const keyEvidence = solution.key_evidence || [];

    // 조건 1: 통찰력
    if (ctx.variables.insight < 80) {
      return { result: { success: false, message: '아직 충분한 통찰력이 모이지 않았습니다. (80 이상 필요)', current_insight: ctx.variables.insight } };
    }

    // 조건 2: 핵심 증거 최소 3개 이상 발견
    const foundKeyCount = keyEvidence.filter(eid => evidence[eid]?.found).length;
    if (foundKeyCount < 3) {
      return { result: { success: false, message: '핵심 증거가 부족합니다. 더 조사하세요.', found_key: foundKeyCount, required: 3 } };
    }

    // 조건 3: 추리(deduction) 최소 3개 이상 해금
    const unlockedDedCount = Object.values(deductions).filter(d => d.unlocked).length;
    if (unlockedDedCount < 3) {
      return { result: { success: false, message: '아직 충분한 추리가 완성되지 않았습니다.', unlocked: unlockedDedCount, required: 3 } };
    }

    const isCorrect = solution.culprit === suspect_id;
    const suspect = caseData.suspects?.find(s => s.id === suspect_id);

    if (isCorrect) {
      // 맞았으면 confrontation 페이즈로 전환
      // 핵심 증거 전체 (미발견 포함)를 required_proofs로 사용
      const allKeyEvidence = [...keyEvidence];
      // 셔플
      for (var i = allKeyEvidence.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = allKeyEvidence[i];
        allKeyEvidence[i] = allKeyEvidence[j];
        allKeyEvidence[j] = tmp;
      }
      // 첫 타겟 선택
      const firstTarget = allKeyEvidence[0];
      const firstTargetEv = evidence[firstTarget];

      return {
        variables: {
          case_phase: 'confrontation',
          __modals: { '범인지목': false, '하율메모': false, '증거품탐색': false, '이의제기': true },
          _phase_instruction: '[이의제기 시작] ⚠️ 범인이 반드시 저항해야 한다. 범인은 여유를 보이며 거짓말/주장을 한다.\n이 주장은 [' + (firstTargetEv?.name || firstTarget) + '] 증거로 반박 가능해야 한다.\n대상 증거: ' + (firstTargetEv?.name || firstTarget) + '\n증거 설명: ' + (firstTargetEv?.description || '') + '\n⚠️ 절대로 대상 증거의 내용을 AI가 서사에서 먼저 공개하지 마라. 범인의 거짓말만 제시하고, 그것을 깨뜨리는 것은 플레이어의 몫이다.'
        },
        data: {
          "case.json": {
            _confrontation: {
              suspect_id,
              suspect_name: suspect?.name,
              required_proofs: allKeyEvidence,
              current_target: firstTarget,
              current_target_name: firstTargetEv?.name || firstTarget,
              current_target_desc: firstTargetEv?.description || '',
              target_found: !!firstTargetEv?.found,
              presented: [],
              round: 0,
              hits: 0,
              misses: 0,
              max_rounds: 5,
              hits_to_win: 3,
              round_history: []
            }
          }
        },
        result: {
          success: true,
          correct: true,
          culprit_name: suspect?.name,
          phase: 'confrontation',
          current_target: firstTarget,
          current_target_name: firstTargetEv?.name || firstTarget,
          current_target_desc: firstTargetEv?.description || '',
          target_found: !!firstTargetEv?.found,
          message: '이제 증거로 증명하라.'
        }
      };
    } else {
      return {
        variables: {
          trust: Math.max(0, ctx.variables.trust - 20),
          wrong_presents: Math.min(ctx.variables.wrong_presents_max, ctx.variables.wrong_presents + 1)
        },
        result: {
          success: true,
          correct: false,
          accused_name: suspect?.name,
          trust_lost: 20
        }
      };
    }
  },

  // 2단계: 범인지목 — 5라운드 중 3히트로 승리
  // _confrontation: { rounds: 5, hits: 0, misses: 0, round: 1, presented: [], ... }
  prove(ctx, args) {
    const { evidence_id } = args;
    const caseData = ctx.data['case'] || {};
    const confrontation = caseData._confrontation;
    const MAX_ROUNDS = 5;
    const HITS_TO_WIN = 3;

    if (!confrontation) {
      return { result: { success: false, message: '논파가 진행 중이 아닙니다.' } };
    }

    const evidence = caseData.evidence || {};
    const ev = evidence[evidence_id];
    if (!ev || !ev.found) {
      return { result: { success: false, message: '해당 증거를 보유하고 있지 않습니다.' } };
    }

    // 적중한 증거만 재제시 불가 (빗나간 증거는 재사용 가능)
    if ((confrontation.hit_targets || []).includes(evidence_id)) {
      return { result: { success: false, message: '이미 적중한 증거입니다.' } };
    }

    // 현재 타겟과 비교하여 hit/miss 판정
    const isHit = evidence_id === confrontation.current_target;
    const newPresented = [...confrontation.presented, evidence_id];
    const newRound = confrontation.round + 1;
    const newHits = confrontation.hits + (isHit ? 1 : 0);
    const newMisses = confrontation.misses + (isHit ? 0 : 1);
    const newRoundHistory = [...(confrontation.round_history || []), isHit ? 'hit' : 'miss'];

    // 다음 타겟 선택 (아직 hit되지 않은 핵심 증거 중 랜덤)
    const hitTargets = isHit
      ? [...(confrontation.hit_targets || []), confrontation.current_target]
      : (confrontation.hit_targets || []);
    const remainingTargets = confrontation.required_proofs.filter(function(eid) {
      return !hitTargets.includes(eid);
    });
    var nextTarget = null;
    var nextTargetName = '';
    var nextTargetDesc = '';
    var nextTargetFound = false;
    if (remainingTargets.length > 0) {
      nextTarget = remainingTargets[Math.floor(Math.random() * remainingTargets.length)];
      var nextEv = evidence[nextTarget];
      nextTargetName = nextEv?.name || nextTarget;
      nextTargetDesc = nextEv?.description || '';
      nextTargetFound = !!nextEv?.found;
    }

    // 승리 판정: 3히트 달성
    if (newHits >= HITS_TO_WIN) {
      return {
        variables: {
          case_phase: 'resolved',
          __popups: [{ template: 'case-solved', duration: 5000 }],
          __modals: { '범인지목': false, '이의제기': false },
          _phase_instruction: ''
        },
        data: {
          "case.json": {
            _confrontation: { ...confrontation, presented: newPresented, round: newRound, hits: newHits, misses: newMisses, hit_targets: hitTargets, round_history: newRoundHistory, current_target: null, completed: true, result: 'win' }
          }
        },
        result: {
          success: true,
          correct: isHit,
          completed: true,
          won: true,
          evidence_name: ev.name,
          culprit_name: confrontation.suspect_name,
          method: caseData.solution?.method,
          motive: caseData.solution?.motive,
          hits: newHits,
          misses: newMisses,
          round: newRound
        }
      };
    }

    // 패배 판정: 5라운드 소진 또는 수학적으로 불가능
    const roundsLeft = MAX_ROUNDS - newRound;
    const maxPossibleHits = newHits + roundsLeft;
    if (newRound >= MAX_ROUNDS || maxPossibleHits < HITS_TO_WIN) {
      return {
        variables: {
          trust: Math.max(0, ctx.variables.trust - 30),
          case_phase: 'investigation',
          __popups: [{ template: 'wrong-answer', duration: 3000 }],
          __modals: { '범인지목': false, '이의제기': false, '하율메모': true, '증거품탐색': true },
          _phase_instruction: ''
        },
        data: {
          "case.json": {
            _confrontation: { ...confrontation, presented: newPresented, round: newRound, hits: newHits, misses: newMisses, hit_targets: hitTargets, round_history: newRoundHistory, current_target: null, completed: true, result: 'lose' }
          }
        },
        result: {
          success: true,
          correct: isHit,
          completed: true,
          won: false,
          evidence_name: ev.name,
          hits: newHits,
          misses: newMisses,
          round: newRound,
          message: '논파에 실패했다.'
        }
      };
    }

    // 진행 중 — 다음 타겟 정보 포함
    var hitMissLabel = isHit ? '적중' : '빗나감';
    var phaseInstr = nextTarget
      ? '[이의제기 ' + hitMissLabel + ' → 다음 라운드] ⚠️ 범인이 반드시 저항해야 한다. 적중이었더라도 완전히 무너지지 않는다. 범인은 동요하면서도 다른 논점으로 화제를 돌리며 새로운 거짓말/주장을 한다.\n이 주장은 [' + nextTargetName + '] 증거로 반박 가능해야 한다.\n대상 증거: ' + nextTargetName + '\n증거 설명: ' + nextTargetDesc + '\n⚠️ 절대로 대상 증거의 내용을 AI가 서사에서 먼저 공개하지 마라. 범인의 거짓말만 제시하고, 그것을 깨뜨리는 것은 플레이어의 몫이다.'
      : '';
    return {
      variables: {
        __popups: isHit ? [{ template: 'objection', duration: 2500 }] : [{ template: 'wrong-answer', duration: 2000 }],
        ...(isHit ? {} : { trust: Math.max(0, ctx.variables.trust - 5) }),
        _phase_instruction: phaseInstr
      },
      data: {
        "case.json": {
          _confrontation: {
            ...confrontation,
            presented: newPresented,
            round: newRound,
            hits: newHits,
            misses: newMisses,
            hit_targets: hitTargets,
            round_history: newRoundHistory,
            current_target: nextTarget,
            current_target_name: nextTargetName,
            current_target_desc: nextTargetDesc,
            target_found: nextTargetFound
          }
        }
      },
      result: {
        success: true,
        correct: isHit,
        completed: false,
        evidence_name: ev.name,
        hits: newHits,
        misses: newMisses,
        round: newRound,
        rounds_left: MAX_ROUNDS - newRound,
        next_target_name: nextTargetName,
        next_target_desc: nextTargetDesc,
        next_target_found: nextTargetFound
      }
    };
  },

  // === 장소/영역 해금 ===
  unlock_area(ctx, args) {
    const { location_id, room_id } = args;
    const caseData = ctx.data['case'] || {};

    if (location_id) {
      const loc = caseData.locations?.[location_id];
      if (!loc) return { result: { success: false, message: '존재하지 않는 장소입니다.' } };
      if (loc.unlocked) return { result: { success: false, message: '이미 해금된 장소입니다.' } };

      return {
        data: {
          "case.json": {
            locations: { ...caseData.locations, [location_id]: { ...loc, unlocked: true } }
          }
        },
        result: { success: true, type: 'location', name: loc.name }
      };
    }

    if (room_id) {
      const loc = caseData.locations?.[ctx.variables.location];
      if (!loc) return { result: { success: false, message: '현재 장소 정보가 없습니다.' } };
      const room = loc.floor_plan?.rooms?.find(r => r.id === room_id);
      if (!room) return { result: { success: false, message: '존재하지 않는 방입니다.' } };

      const updatedRooms = loc.floor_plan.rooms.map(r =>
        r.id === room_id ? { ...r, locked: false } : r
      );
      const updatedLoc = { ...loc, floor_plan: { ...loc.floor_plan, rooms: updatedRooms } };

      return {
        data: {
          "case.json": {
            locations: { ...caseData.locations, [ctx.variables.location]: updatedLoc }
          }
        },
        result: { success: true, type: 'room', name: room.name }
      };
    }

    return { result: { success: false, message: '해금 대상을 지정해주세요.' } };
  },

  // === 조회 전용 액션 (읽기만, 상태 변경 없음) ===

  case_overview(ctx, args) {
    const c = ctx.data['case'] || {};
    if (!c.id) return { result: { success: false, message: '진행 중인 사건이 없습니다.' } };
    return {
      result: {
        success: true,
        title: c.title,
        difficulty: c.difficulty,
        summary: c.summary,
        suspects: (c.suspects || []).map(s => ({ id: s.id, name: s.name })),
        locations: Object.entries(c.locations || {}).map(([id, loc]) => ({
          id, name: loc.name, type: loc.type, address: loc.address, unlocked: loc.unlocked
        }))
      }
    };
  },

  room_info(ctx, args) {
    const c = ctx.data['case'] || {};
    const locId = ctx.variables.location;
    const loc = c.locations?.[locId];
    if (!loc) return { result: { success: false, message: '현재 장소 정보가 없습니다.' } };
    const roomId = args.room_id || ctx.variables.current_room;
    const room = loc.floor_plan?.rooms?.find(r => r.id === roomId);
    if (!room) return { result: { success: false, message: '방을 찾을 수 없습니다.' } };

    const npcs = Object.entries(loc.npcs || {})
      .filter(([_, n]) => n.room === roomId && n.available)
      .map(([id, n]) => ({ id, name: n.name, role: n.role }));

    return {
      result: {
        success: true,
        room_id: roomId,
        room_name: room.name,
        crime_scene: room.crime_scene || false,
        description: room.description || null,
        npcs,
        hint: room.description ? null : '방 분위기는 이름과 장소 유형을 참고하여 직접 묘사하라.'
      }
    };
  },

  found_evidence(ctx, args) {
    const evidence = ctx.data['case']?.evidence || {};
    const found = Object.entries(evidence)
      .filter(([_, e]) => e.found)
      .map(([id, e]) => ({ id, name: e.name, type: e.type, description: e.description }));
    return { result: { success: true, evidence: found, count: found.length } };
  },

  npc_profile(ctx, args) {
    const c = ctx.data['case'] || {};
    const npcId = args.npc_id;
    if (!npcId) return { result: { success: false, message: 'npc_id를 지정해주세요.' } };

    // NPC 찾기
    let npcData = null;
    let npcLocId = null;
    for (const [locId, loc] of Object.entries(c.locations || {})) {
      if (loc.npcs?.[npcId]) { npcData = loc.npcs[npcId]; npcLocId = locId; break; }
    }
    if (!npcData) return { result: { success: false, message: 'NPC를 찾을 수 없습니다.' } };

    // 증언 (대화한 경우에만)
    const testimony = Object.values(c.testimonies || {}).find(t => t.witness === npcId);
    let statements = [];
    if (npcData.talked && testimony) {
      statements = testimony.statements.map(s => ({
        id: s.id,
        text: s.text,
        pressed: s.pressed,
        press_result: s.pressed ? s.press_result : null
        // contradiction 정보는 절대 포함하지 않는다
      }));
    }

    return {
      result: {
        success: true,
        id: npcId,
        name: npcData.name,
        role: npcData.role,
        room: npcData.room,
        talked: npcData.talked,
        statements
      }
    };
  },

  unlocked_deductions(ctx, args) {
    const deductions = ctx.data['case']?.deductions || {};
    const unlocked = Object.entries(deductions)
      .filter(([_, d]) => d.unlocked)
      .map(([id, d]) => ({ id, name: d.name, description: d.description }));
    const total = Object.keys(deductions).length;
    return { result: { success: true, deductions: unlocked, unlocked_count: unlocked.length, total } };
  }
};

// === 유틸리티 ===

function incStat(ctx, key) {
  var stats = { ...(ctx.data['case-stats'] || {}) };
  stats[key] = (stats[key] || 0) + 1;
  return stats;
}

function timeToMinutes(timeStr) {
  var map = {
    '오전 8시': 480, '오전 8시 30분': 510, '오전 9시': 540, '오전 9시 30분': 570,
    '오전 10시': 600, '오전 10시 30분': 630, '오전 11시': 660, '오전 11시 30분': 690,
    '정오': 720, '오후 12시 30분': 750,
    '오후 1시': 780, '오후 1시 30분': 810,
    '오후 2시': 840, '오후 2시 30분': 870,
    '오후 3시': 900, '오후 3시 30분': 930,
    '오후 4시': 960, '오후 4시 30분': 990,
    '오후 5시': 1020, '오후 5시 30분': 1050,
    '오후 6시': 1080, '오후 6시 30분': 1110,
    '저녁 7시': 1140, '저녁 7시 30분': 1170,
    '저녁 8시': 1200, '저녁 8시 30분': 1230,
    '밤 9시': 1260, '밤 9시 30분': 1290,
    '밤 10시': 1320
  };
  return map[timeStr] !== undefined ? map[timeStr] : 600;
}

function minutesToTime(mins) {
  mins = Math.min(1320, Math.max(480, mins));
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  var mStr = m >= 30 ? ' 30분' : '';
  mins = h * 60 + (m >= 30 ? 30 : 0); // snap to 30min
  if (h < 12) return '오전 ' + h + '시' + mStr;
  if (h === 12 && m < 30) return '정오';
  if (h === 12) return '오후 12시 30분';
  if (h < 18) return '오후 ' + (h - 12) + '시' + mStr;
  if (h < 20) return '저녁 ' + (h - 12) + '시' + mStr;
  return '밤 ' + (h - 12) + '시' + mStr;
}

function advanceTime(currentTime, minutes) {
  var cur = timeToMinutes(currentTime);
  var nxt = cur + minutes;
  return nxt > 1320 ? 600 : nxt; // 밤 10시 초과 → 오전 10시(600분)
}

function checkUnlocks(caseData, trigger, currentLocations) {
  const unlocks = caseData.unlocks || [];
  const result = { locations: { ...currentLocations }, unlocked: [], changed: false };

  for (const unlock of unlocks) {
    if (!unlock.trigger || !unlock.action) continue;

    let matches = false;
    const t = unlock.trigger;
    if (t.type === trigger.type) {
      if (trigger.type === 'evidence_found' && t.id === trigger.id) matches = true;
      if (trigger.type === 'deduction_unlocked' && t.id === trigger.id) matches = true;
      if (trigger.type === 'contradiction_found' && t.testimony_id === trigger.testimony_id && t.statement_id === trigger.statement_id) matches = true;
    }

    if (matches) {
      const a = unlock.action;
      result.changed = true;

      if (a.type === 'unlock_location' && result.locations[a.location]) {
        result.locations[a.location] = { ...result.locations[a.location], unlocked: true };
        result.unlocked.push({ type: 'location', name: result.locations[a.location].name });
      }
      if (a.type === 'unlock_room' && result.locations[a.location]) {
        const loc = result.locations[a.location];
        const updatedRooms = loc.floor_plan.rooms.map(r =>
          r.id === a.room ? { ...r, locked: false } : r
        );
        result.locations[a.location] = { ...loc, floor_plan: { ...loc.floor_plan, rooms: updatedRooms } };
        result.unlocked.push({ type: 'room', name: updatedRooms.find(r => r.id === a.room)?.name });
      }
      if (a.type === 'unlock_npc' && result.locations[a.location]) {
        const loc = result.locations[a.location];
        const updatedNpcs = { ...loc.npcs, [a.npc]: { ...loc.npcs[a.npc], available: true } };
        result.locations[a.location] = { ...loc, npcs: updatedNpcs };
        result.unlocked.push({ type: 'npc', name: updatedNpcs[a.npc]?.name });
      }
    }
  }

  return result;
}

// === 메인 디스패처 ===
module.exports = async function(context, args) {
  const { action, params: _wrapped, ...rest } = args;
  // Support both flat ({ action, key: val }) and wrapped ({ action, params: { key: val } }) styles
  const params = (_wrapped && typeof _wrapped === 'object') ? _wrapped : rest;
  const handler = ACTIONS[action];
  if (!handler) {
    return { result: { success: false, message: `알 수 없는 액션: ${action}` } };
  }
  const result = handler(context, params);
  if (!result?.variables) return result;

  // 시간 변경 후처리: _time_raw → time 문자열 + _time_message
  const rawTime = result.variables._time_raw;
  if (rawTime != null && context.variables.case_phase !== 'confrontation') {
    const oldMins = timeToMinutes(context.variables.time || '오전 10시');
    const newMins = typeof rawTime === 'number' ? rawTime : timeToMinutes(rawTime);
    result.variables.time = minutesToTime(newMins);
    delete result.variables._time_raw;
    const parts = [];

    // 날짜 전환 체크 (밤 10시 넘어서 오전으로 돌아간 경우)
    if (newMins < oldMins) {
      result.variables.day = (context.variables.day || 1) + 1;
      result.variables._meal_state = 0;
      parts.push('Day ' + result.variables.day + ' — 다음 날이 되었다.');
    }

    // 끼니 체크
    const mealState = result.variables._meal_state !== undefined
      ? result.variables._meal_state
      : (context.variables._meal_state || 0);
    if (mealState === 0 && newMins >= 720) {
      result.variables._meal_state = 1;
      parts.push('점심시간이다. 밥을 먹어야 한다.');
    } else if (mealState === 1 && newMins >= 1080) {
      result.variables._meal_state = 0;
      parts.push('저녁시간이다. 밥을 먹어야 한다.');
    }

    result.variables._time_message = parts.join(' ');
  } else if (result.variables) {
    result.variables._time_message = '';
  }

  return result;
};
