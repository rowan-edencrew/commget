# comm_get - 커뮤니티 중계 서버

NH투자증권 가든(Garden) 커뮤니티 서버에 로그인하여 게시글을 주기적으로 수집하고, Access-Token 없이 조회할 수 있는 중계 서버.

## 프로젝트 구조

```
comm_get/
├── server.js                        # Express 메인 서버
├── .env                             # 환경변수 설정
├── test.js                          # 로그인 검증 테스트
├── package.json
├── src/
│   ├── config/
│   │   └── database.js              # SQLite DB (토큰, 게시글 저장)
│   ├── routes/
│   │   ├── auth.js                  # 인증 API 라우트
│   │   └── posts.js                 # 게시글 중계 API 라우트
│   └── services/
│       ├── communityAuth.js         # 커뮤니티 로그인 서비스
│       └── scheduler.js             # 10분 주기 게시글 수집 스케줄러
└── data/
    └── comm_get.db                  # SQLite DB 파일 (자동 생성)
```

## 환경변수 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `NODE_ENV` | 환경 | `development` |
| `PORT` | 서버 포트 | `3000` |
| `CUST_NUM` | 고객번호 | `101834560` |
| `HASHED_USER_ID` | 앱의 `$secure.makeHashData`로 생성된 해시값 | - |

## 실행

```bash
# 의존성 설치
npm install

# 서버 시작
npm start

# 개발 모드 (자동 재시작)
npm run dev

# 로그인 테스트
npm test
```

## 동작 흐름

```
┌─────────────────────────────────────────────────────┐
│  스케줄러 (10분 간격)                                │
│                                                     │
│  1. gardenapi.nhsec.com/apiKeyPairGen → 공개키 수신   │
│  2. hashedUserId + 공개키 → RSA 암호화                │
│  3. gardenapi.nhsec.com/login → Access-Token 발급    │
│  4. proxy → /v2/lounge/postList 조회                 │
│  5. SQLite DB 저장                                   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  중계 API (Access-Token 불필요)                       │
│                                                     │
│  클라이언트 → GET /api/posts?query → DB 조회 → 응답   │
└─────────────────────────────────────────────────────┘
```

## API 엔드포인트

### 게시글 조회 (중계)

```
GET /api/posts?pageSize=6&type=0&stockCd=Z000011&channelId=0
```

Access-Token **불필요**. gardenapi와 동일한 query 파라미터 사용.

| Query | 설명 | 예시 |
|-------|------|------|
| `pageSize` | 조회할 데이터 개수 | `6` |
| `type` | 0: 최신순, 1: 인기순 | `0` |
| `stockCd` | 종목코드 | `Z000011` |
| `channelId` | 채널 ID (주식종목은 모두 0) | `0` |

응답은 gardenapi 원본과 동일한 JSON 배열 형태.

### 인증

```
POST /api/auth/login
```

Body (선택):
```json
{
  "custNum": "101834560",
  "hashedUserId": "oF4nTHZQixSwKiTj22I87yMfhDW53om0loCIc7xZudA="
}
```

```
GET /api/auth/token/:custNum    # 저장된 토큰 조회
GET /api/auth/tokens            # 전체 토큰 목록
```

### 헬스체크

```
GET /health
```

## 커뮤니티 로그인 프로세스

1. `gardenapi.nhsec.com/apiKeyPairGen` → RSA 공개키 수신
2. `HASHED_USER_ID`(앱의 `$secure.makeHashData` 결과값) → RSA 암호화
3. `gardenapi.nhsec.com/login?user_id={encrypted}&publicKey={key}` → 로그인
4. 응답 헤더에서 `access-token`, `refresh-token` 추출

| 토큰 | 만료 |
|------|------|
| Access Token | 5분 |
| Refresh Token | 3시간 |

## DB 테이블

### auth_tokens
로그인 토큰 저장. `cust_num` 기준 UPSERT.

### posts
게시글 저장. `post_id` 기준 UPSERT (중복 시 조회수/좋아요/댓글 수 갱신).

## 참고사항

- `$secure.makeHashData`는 앱 고유 해시 함수로, 단순 SHA-256이 아님. `.env`의 `HASHED_USER_ID`에 앱에서 생성한 해시값을 직접 설정해야 함.
- 스케줄러가 서버 시작 시 즉시 1회 수집 후, 이후 10분 간격으로 자동 수집.
- 응답 시간: 로그인 ~2초, postList 조회 ~1.5초 (gardenapi 기준).
