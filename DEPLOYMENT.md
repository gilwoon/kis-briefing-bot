# Deployment Notes

## Start

```powershell
cd C:\Users\keiki\develop\kis-briefing-bot
npm start
```

Default URL:

```txt
http://localhost:4173
```

Health check:

```txt
http://localhost:4173/health
```

## Required Environment

Create `.env.local` with:

```env
KIS_ENV=prod
KIS_APP_KEY=...
KIS_APP_SECRET=...
```

For mock trading or development-side KIS access:

```env
KIS_ENV=vps
```

## Windows Run Shortcut

You can launch the app with:

```txt
start-kis-briefing-bot.bat
```

## Operational Checks

1. Open `/health`
2. Confirm `status: ok`
3. Confirm `hasCredentials: true`
4. Open the main page
5. Generate a briefing
6. Confirm the UI shows `실데이터 사용 중`

## Runtime Notes

- The server throttles KIS calls to avoid per-second API limits.
- Quote responses are cached briefly.
- Daily history responses are cached longer.
- If KIS fails, the UI switches to `복구 모드` instead of hard failing.
