---
name: update-state
description: 탐정 사건 수사 중 상태 변수(신뢰도, 통찰력, 사건 페이즈, 위치, 시간 등)를 갱신할 때 사용
allowed-tools: Read, Edit
---

# 상태 변수 갱신

## 변수 목록과 변경 규칙

### 관계 변수
- `trust` (0~100, max: `trust_max`): 하율의 신뢰도
  - 올바른 추리/배려 시 +3~10
  - 하율 의견 존중 시 +3~5
  - 무모한 행동 시 -5~10
  - 증거 제시 오답은 엔진이 자동 -15 처리

### 수사 변수
- `insight` (0~100, max: `insight_max`): 통찰력 게이지
  - 증거 +5, 대화 +3, 추궁 +2, 모순 발견 +15, 추리 연결 +10 (엔진 자동)
  - 80 이상이면 범인 지목 가능
- `clues_found` / `clues_total`: 단서 진행도 (엔진 자동)
- `wrong_presents` (0~3): 오답 횟수 (엔진 자동)

### 상황 변수
- `case_phase`: idle / investigation / confrontation / resolved
- `location`: 현재 장소 ID (엔진 자동)
- `current_room`: 현재 방 ID (엔진 자동)
- `time`: 시간대 문자열 (엔진 자동)
- `day`: 사건 경과일
- `case_title`: 현재 사건 제목

### UI/서사 변수
- `hayul_note`: 하율 메모 패널 표시 텍스트
- `__modals`: 모달 상태

## 절차
1. `variables.json`을 읽는다
2. 상황에 맞는 변수를 갱신한다
3. 변경된 필드만 업데이트한다
4. JSON 유효성을 확인한다

## 규칙
- 엔진 자동 처리 변수(clues_found, wrong_presents, insight 수사 증감, location, current_room, time)는 직접 수정하지 않는다
- trust는 엔진(오답)과 AI(대화 상황) 양쪽에서 변경 가능
- hayul_note는 사건 진행 시 하율의 현재 생각/정리를 반영한다
- case_phase 전환: investigation→confrontation은 insight≥80일 때만
