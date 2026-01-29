# AngeloLucaciXP

A Windows XP-style interactive portfolio built with React + Vite. It recreates a classic desktop experience with draggable windows, a taskbar, and themed apps (Yahoo Messenger chat, Contact Me, Projects, Resume, etc.).

## Features
- Windows XP inspired UI with movable/resizable windows
- Yahoo Messenger-style chat (with Buzz + emoticons)
- Contact Me window that opens your default mail client
- Portfolio apps for projects, resume, and social links

## Getting started
```bash
npm install
npm run dev
```

## Chat API (optional)
The Yahoo chat can connect to OpenAI through a small local proxy.

1) Create `.env` in the project root:
```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_PROXY_PORT=5174
```

2) Run the proxy:
```bash
npm run dev:api
```

The frontend proxies `/api` to `http://localhost:5174` via Vite.

## Scripts
- `npm run dev` - start the Vite dev server
- `npm run dev:api` - start the OpenAI proxy server
- `npm run build` - build for production
- `npm run preview` - preview the production build

## Tech stack
- React 19
- Vite 7
