# Arena Companion

A Windows desktop companion for League of Legends Arena. It combines read-only LCU state with screen OCR to detect the shopping phase, resolve the left, center, and right augment or prismatic-item choices, and show a top recommendation popup.

> This project is for local personal use only. See [ADR-0002](./docs/adr/0002-fork-baseline.md) for baseline provenance and distribution constraints.

## Current capabilities

- Detect Arena sessions, the current champion, and visual shopping-phase signals.
- Recognize three augment choices while preserving their on-screen order.
- Recognize three prismatic-item choices.
- Read champion-specific OP.GG statistics through a disk-backed cache with explicit failure reasons.
- Show augment, champion, and combination leaderboards.
- Trigger a manual recognition refresh with `F8`.
- Support Simplified Chinese, English, and Traditional Chinese.

## Run

Requirements: Windows x64, Node.js 22, npm 10.

```powershell
npm ci
npm run dev
```

## Verify

```powershell
npm run test:unit
npm run lint
npm run type-check
npm run build
```

Start with [CONTEXT.md](./CONTEXT.md), the [architecture overview](./COMPLETE_ARCHITECTURE.md), and the [ADR index](./docs/adr/README.md).

Some inherited ARAM implementation remains as migration material. It is outside the current product scope; new work must use the Arena domain language.
