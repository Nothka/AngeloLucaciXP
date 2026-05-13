# AngeloLucaciXP

A Windows XP-style interactive portfolio built with React + Vite. It recreates a classic desktop experience with draggable windows, a taskbar, and themed apps (Yahoo Messenger chat, Contact Me, Projects, Resume, etc.).

## Features
- Windows XP inspired UI with movable/resizable windows
- Yahoo Messenger-style chat (with Buzz + emoticons)
- Contact Me window that opens your default mail client
- Feedback app that stores ratings/comments in Firebase Firestore
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

## Firebase reviews setup (Feedback app)
1) Create a Firebase project and enable Cloud Firestore (Production or Test mode).

2) Add these variables in `.env`:
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

3) Create a `reviews` collection. Each document should include:
- `name` (string)
- `rating` (number 1-5)
- `comment` (string)
- `approved` (boolean, optional; defaults true in app)
- `createdAt` (timestamp, written by app)

4) Example Firestore security rules for public review writing:
```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if
        request.resource.data.keys().hasOnly(['name', 'rating', 'comment', 'approved', 'createdAt']) &&
        request.resource.data.name is string &&
        request.resource.data.name.size() >= 2 &&
        request.resource.data.name.size() <= 40 &&
        request.resource.data.rating is int &&
        request.resource.data.rating >= 1 &&
        request.resource.data.rating <= 5 &&
        request.resource.data.comment is string &&
        request.resource.data.comment.size() >= 3 &&
        request.resource.data.comment.size() <= 500 &&
        request.resource.data.approved == true;
      allow update, delete: if false;
    }
  }
}
```

## Scripts
- `npm run dev` - start the Vite dev server
- `npm run dev:api` - start the OpenAI proxy server
- `npm run build` - build for production
- `npm run preview` - preview the production build

## Tech stack
- React 19
- Vite 7
