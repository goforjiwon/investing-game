# 5인 협력 심리전 투자 게임

공공재 게임(사회실험형)의 핵심 구조를 유지하면서, 친구들과 온라인에서 실리전 중심으로 즐길 수 있게 게임화한 버전입니다.

## 게임 규칙
- 5인 고정 멀티플레이
- 친구 초대 코드 기반 방 생성
- 총 7라운드
- 라운드당 20초 제한 시간
- 매 라운드 10토큰 지급
- 0~10토큰 비공개 투자(리더별 시 자동 0 처리)
- 전체 투자금 2.5배 증폭 후 5명 균등 분배
- 낙찰밸 투자별 공개
- 누적 점수 리더보드 표시

## 추가 게임화 요소
- 제한형 메시지 기능
- 라운드 시작 전 목표 기여량 선언
- 전원 5토큰 이상 투자 시 협력 보너스 전원 +2점
- 라운드 종료 후 각 플레이어는 1명에게 경고표 1개 부여
- 경고표 2개 이상 누적 플레이어는 다음 라운드 시작 토큰 -2 패널티

## 🚀 Supabase 연동 및 배포 가이드

### 1단계: Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 가입/로그인
2. "New Project" 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호, 리전 선택
4. 프로젝트 생성 완료 (1~2분 소요)

### 2단계: 데이터베이스 테이블 생성

Supabase Dashboard → SQL Editor에서 다음 SQL 실행:

```sql
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL,
  state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_room_code ON rooms(room_code);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
```

### 3단계: Realtime 활성화

Supabase Dashboard → Database → Replication:
- `rooms` 테이블의 Realtime 토글 ON

### 4단계: 환경 변수 설정

1. Supabase Dashboard → Settings → API
2. 다음 값들을 복사:
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public key** (긴 문자열)

3. `script.js` 파일에서 다음 부분 수정:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';  // Project URL로 교체
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';  // anon key로 교체
```

### 5단계: Vercel 배포 (권장)

1. GitHub 레포지토리를 Vercel에 연결
2. Vercel Dashboard → New Project → Import Git Repository
3. `investing-game` 레포 선택
4. 배포 설정:
   - **Framework Preset**: Other
   - **Build Command**: (비워둠)
   - **Output Directory**: (비워둠)
   - **Install Command**: (비워둠)
5. Deploy 클릭

### 6단계: 테스트

1. 배포된 URL 접속
2. "새 방 만들기" 클릭
3. 다른 브라우저/시크릿 모드에서 동일 URL 접속
4. "방 참가" 버튼으로 방 코드 입력
5. 5명 모이면 게임 시작!

## 로컬 개발 환경

```bash
# 간단히 로컬 서버 실행
python -m http.server 8000
# 또는
npx serve
```

브라우저에서 `http://localhost:8000` 접속

## 기술 스택

- **Frontend**: Vanilla JS (의존성 없음)
- **Realtime DB**: Supabase (PostgreSQL + Realtime)
- **Hosting**: Vercel / Netlify / GitHub Pages

## 문제 해결

### "Supabase not configured" 오류
→ `script.js`의 `SUPABASE_URL`과 `SUPABASE_ANON_KEY`를 올바르게 설정했는지 확인

### 방 참가가 안 됨
→ Supabase Dashboard → Database → Replication에서 `rooms` 테이블 Realtime이 활성화되어 있는지 확인

### 게임 중 동기화 안 됨
→ 브라우저 콘솔에서 에러 확인. Supabase Realtime 연결 상태 점검

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.
