---
name: update-panels
description: 패널 HTML을 수정할 때 사용. 패널 구조 변경이 필요한 경우에만 호출한다
allowed-tools: Read, Write, Edit, Glob
---

# 패널 수정

## 절차
1. `/frontend-design` 스킬을 사용하여 패널을 수정하라
2. `panel-spec.md`를 먼저 읽어 기술 규칙을 확인하라
3. 수정할 패널 파일을 읽고 변경사항을 적용한다

## 패널 목록
- `panels/01-사건현황.html` — 사건 진행 상황, 신뢰도/통찰력 게이지 (dock-right)
- `panels/02-증거함.html` — 수집된 증거 카드 목록 (right)
- `panels/03-현장지도.html` — 장소 평면도 + 조사 포인트 + NPC (modal)
- `panels/04-증언록.html` — 증언 목록 + 추궁/증거제시 UI (modal)
- `panels/05-인물파일.html` — 인물 프로필 + 관계도 (modal)
- `panels/06-의뢰함.html` — 사건 시드 선택 서류철 UI (modal)
- `panels/07-추리보드.html` — 단서 연결 추리 UI (modal)
- `panels/08-하율메모.html` — 하율 상황 요약 (dock)

## 규칙
- 다크 테마: 배경 #0a0e1a~#121829, 텍스트 #e0ddd4, 액센트 #c8a44e (골드)
- Shadow DOM 렌더링 — 인라인 이벤트 핸들러 금지
- Handlebars: variables.json → {{변수명}}, 데이터 파일 → {{파일명.키}}
- 엔진 호출: __panelBridge.runTool('engine', { action: '...' })
- 엔진 result 구조를 반드시 engine.js에서 확인 후 참조
