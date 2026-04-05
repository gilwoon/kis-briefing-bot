# KIS Briefing Bot

관심종목을 입력하면 KIS 실시간 시세를 바탕으로 시장 톤, 톱픽, 리스크 종목, 종목별 브리핑 카드를 보여주는 서버 앱입니다.

현재 버전은 Node 서버가 정적 파일과 `/api/briefing` API를 함께 제공하며, KIS 키가 있으면 실시간 시세를 조회합니다. 호출 실패 시에는 서비스가 완전히 깨지지 않도록 샘플 데이터로 자동 전환합니다.

배포 주소:

- `https://kis-briefing-bot.vercel.app`
- 헬스 체크: `https://kis-briefing-bot.vercel.app/health`

## 포함된 기능

- 관심종목 입력
- KIS 실시간 시세 기반 브리핑 카드 렌더링
- 오늘의 시장 톤 요약
- 톱픽과 리스크 종목 자동 계산
- 추세, RSI, 거래량, 등락률 기반 규칙형 설명
- 실데이터 사용 여부와 마지막 갱신 시각 표시
- 수동 새로고침과 1분 자동 갱신
- KIS 호출 스로틀과 캐시

## 파일 구조

```txt
kis-briefing-bot/
  index.html
  styles.css
  app.js
  data/
    mock-market-data.js
    symbol-directory.js
  server/
    server.mjs
  .env.example
  .gitignore
  package.json
  start-kis-briefing-bot.bat
  DEPLOYMENT.md
```

## 실행

```powershell
cd kis-briefing-bot
npm start
```

기본 포트는 `4173` 이며 `http://localhost:4173` 에 접속하면 됩니다.

Windows에서 바로 실행하려면:

```txt
start-kis-briefing-bot.bat
```

## 배포

- Production: `https://kis-briefing-bot.vercel.app`
- Health: `https://kis-briefing-bot.vercel.app/health`

## 환경변수

`.env.local` 파일을 만들고 다음 값을 넣으세요.

```env
KIS_ENV=prod
KIS_APP_KEY=...
KIS_APP_SECRET=...
```

모의 환경이면 `KIS_ENV=vps` 를 사용하면 됩니다.

## 현재 동작 방식

1. 브라우저가 `/api/briefing` 으로 종목 리스트를 전송합니다.
2. 서버가 KIS 토큰을 발급받고 현재가와 일별 시세를 조회합니다.
3. 서버가 거래량 배수, RSI, 이동평균선, 추세 점수를 계산합니다.
4. 클라이언트가 규칙 기반 브리핑 문장과 카드 UI를 렌더링합니다.
5. KIS 키가 없거나 호출이 실패하면 샘플 데이터로 자동 전환합니다.

## API 예시

```txt
POST /api/briefing
{
  "symbols": ["005930", "000660", "035420"]
}
```

## KIS 연동 시 주의

- `app key`, `app secret`, 토큰은 서버 환경변수로만 관리
- 프론트엔드에 비밀키 노출 금지
- 처음에는 조회 전용 흐름부터 시작
- 주문 기능은 이 프로젝트 범위에서 제외

## 현재 KIS 연동 범위

`server/server.mjs` 는 아래 흐름을 구현합니다.

- 접근토큰 발급
- 국내주식 현재가 조회
- 국내주식 일별 시세 조회
- RSI, 거래량 배수, 20일선, 60일선, 추세 점수 계산
- 브라우저에 브리핑용 JSON 반환

## 운영 메모

- KIS 호출은 초당 제한을 피하도록 서버에서 간격을 두고 요청합니다.
- 현재가 응답은 짧게 캐시하고, 일봉 응답은 더 길게 캐시합니다.
- 실시간 시세 호출이 실패하면 UI는 `복구 모드`로 전환됩니다.
- 상태 확인용 엔드포인트는 `/health` 입니다.

공식 문서 기준으로 사용한 대표 경로는 다음입니다.

- `/oauth2/tokenP`
- `/uapi/domestic-stock/v1/quotations/inquire-price`
- `/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`
