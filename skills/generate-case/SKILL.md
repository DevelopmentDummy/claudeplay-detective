---
name: generate-case
description: 백그라운드에서 새 사건 케이스를 생성하고 case-sync 도구로 시드를 동기화한다. fire_ai에 의해 호출됨.
allowed-tools: Read, Write, Edit, Glob, mcp__claude_play__run_tool
---

# 사건 케이스 생성 (백그라운드)

이 스킬은 fire_ai에 의해 백그라운드에서 호출된다. 대화 응답(`<dialog_response>`)이 필요 없다.

## 절차

### 1단계: 기존 사건 확인
`case-seeds.json`을 읽어 현재 어떤 사건이 있는지 확인한다. 카테고리, 테마, 배경 장소가 겹치지 않도록 한다.

### 2단계: 구조 참조
`case-example.json`을 읽어 JSON 구조와 품질 기준을 파악한다.

### 3단계: 새 케이스 설계 & 생성
기존과 겹치지 않는 완전히 새로운 사건 데이터를 case-example.json과 동일한 구조로 생성한다.

### 4단계: case-temp.json에 저장
생성한 케이스를 `case-temp.json`에 Write한다. case-seeds.json을 직접 편집하지 마라.

```
Write → case-temp.json
```

### 5단계: case-sync 도구 실행
`case-sync` 도구를 호출하여 세션과 페르소나 양쪽의 case-seeds.json을 원자적으로 업데이트한다.

```
mcp__claude_play__run_tool({
  tool: "case-sync",
  args: { remove_id: "{이번에 소비된 케이스 ID — fire_ai 프롬프트에서 전달받음}" }
})
```

이 도구가 하는 일:
- case-temp.json에서 새 케이스를 읽음
- 세션 case-seeds.json에서 remove_id를 제거하고 새 케이스를 추가
- 페르소나 원본 case-seeds.json에도 동일 처리
- case-temp.json 정리

### 6단계: 완료
case-sync의 result를 확인하고 종료.

## 품질 기준
- 장소 3개 이상, 각 장소에 floor_plan (cols, rows, rooms, doors)
- 각 room에 `description` 필드 포함 (1~2문장, 분위기/감각적 묘사. AI가 방 진입 시 서사 묘사에 활용):
  ```json
  {
    "id": "pharmacy",
    "name": "약품 창고 (현장)",
    "description": "형광등 불빛 아래 금속 선반이 줄지어 서 있다. 소독약 냄��가 코를 찌르고, 바닥에는 경찰 테이프 자국이 남아 있다.",
    ...
  }
  ```
- 증거 14개 이상 (물리, 디지털, 문서 골고루)
- NPC 3명 이상, 각 NPC에 증언 3개 이상
- 모순(contradiction) 6개 이상 — 각 모순은 특정 증거로 반박 가능
- 추리(deduction) 5개 이상 — 증거 조합으로 해금
- 용의자 3명 이상 — 각자 그럴듯한 동기와 알리바이
- 해금 체인(unlocks) 5개 이상 — 논리적 진행 순서
- Red herring 증거 2개 이상
- 반전 요소 1개 이상
- 감정적 여운을 남기는 서사적 맥락

## 사건 다양성 규칙
기존 사건의 카테고리를 확인하고 겹치지 않게:
- 살인 (독살, 밀실, 교살, 추락사, ...)
- 실종/납치
- 도난/절도
- 사기/횡령
- 사이버 범죄
- 방화
- 협박/스토킹
배경도 다양하게: 레스토랑, 갤러리, 대학, 저택, 병원, 호텔, 선박, 공장, ...

## ⚠️ 주의사항
- case-seeds.json을 직접 편집하지 마라 — 반드시 case-sync 도구를 사용하라
- case-temp.json에 유효한 JSON을 저장하라
- 이 스킬은 백그라운드 실행이므로 `<dialog_response>`가 필요 없다
