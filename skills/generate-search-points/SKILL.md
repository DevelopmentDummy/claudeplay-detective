# 탐색 포인트 생성

## 트리거
AI가 `[방탐색초기화]` 이벤트를 받으면 이 스킬을 호출한다.

## 절차
1. `case.json`을 읽어 해당 location/room의 실제 points를 확인한다
2. `search-points.json`을 읽어 해당 키(`{location}/{room_id}`)가 이미 초기화되어 있는지 확인한다
3. 이미 초기화된 경우 스킬을 종료한다
4. 초기화되지 않은 경우:
   a. 해당 방의 실제 points를 search point 형식으로 변환한다 (evidence_id 유지)
   b. **이미 found: true인 증거**의 search point는 `investigated: true`로 표시한다
   c. 더미 포인트를 생성한다:
      - 0개 실제 증거: 2~4개 더미
      - N개 실제 증거: 추가 N×2 ~ N×4개 더미 (AI 재량)
   d. 모든 포인트를 섞어서 (실제+더미 랜덤 순서) 배열로 구성한다
   e. ID 형식: `sp_{location 첫2글자}{room 첫2글자}_{01,02,...}`
   f. search-points.json에 `"{location}/{room_id}"` 키로 저장한다

## 더미 포인트 생성 규칙
- 방의 테마/용도에 맞는 현실적 오브젝트를 묘사한다
- 진짜 증거와 외형적으로 구분이 불가능해야 한다
- 예시:
  - 침실: "베개 밑", "옷장 서랍", "침대 협탁", "벽면 포스터 뒤", "신발장"
  - 편집실: "모니터 뒤편", "케이블 뭉치 사이", "빈 커피컵", "벽면 메모판"
  - 경비실: "서류 정리함", "로커 위 상자", "창문턱 먼지", "쓰레기통"
- desc(설명)은 1문장으로 간결하게. 실제 포인트와 톤을 맞추라.

## 출력 형식
search-points.json에 아래 형식으로 저장:
```json
{
  "dorm/minji_room": {
    "initialized": true,
    "points": [
      {"id": "sp_domi_01", "name": "스케치북", "desc": "책상 위에 펼쳐진 스케치북.", "investigated": false, "evidence_id": "e_minji_sketch"},
      {"id": "sp_domi_02", "name": "침대 밑", "desc": "침대 프레임 아래 어두운 공간.", "investigated": false, "evidence_id": null},
      ...
    ]
  }
}
```

## 중요
- **이 스킬 실행 후에도 반드시 `<dialog_response>` 태그로 서사를 제공하라**
- 방의 분위기를 묘사하며 "여러 곳을 살펴볼 수 있을 것 같다" 등 탐색 유도
- 탐색 포인트 목록을 서사에서 직접 나열하지 마라 — 패널이 보여준다
- search-points.json 파일은 Write 도구로 직접 수정한다 (기존 키를 보존하며 새 키 추가)
