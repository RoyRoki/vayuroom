6 / 6
Vayuroom Project Documentation
Project Name: Vayuroom
Tagline: Ephemeral, no-login, privacy-first chat + audio + video calling web app using shared secret room keys
Core Principles:

Zero user accounts or persistent identities
No message / call history saved on server or (ideally) client
End-to-end encrypted (WebRTC native + optional data-channel layer)
Connections only via shared secret (room key / passphrase)
Fully static frontend + free-tier backend services
Designed for very small groups (2–6 people), short sessions
Built for learning / personal use — not production at scale
Deployment Target Stack (100% free tiers – 2026 reality)

Hosting / CDN / Domains → Vercel Hobby plan
Version Control & CI/CD → GitHub (public or private repo)
Signaling Server → Firebase Realtime Database (Spark plan)
STUN / TURN (ICE servers) → Google public STUN + Open Relay Project (Metered.ca) free TURN (20 GB/mo)
1. Project Goals & Non-Goals
Goals
Users enter/paste a shared secret → instantly join same "room"
1:1 and small group text chat
1:1 and small group audio call
1:1 video call (group video possible but quality degrades fast)
Everything disappears when last user leaves tab
No tracking, no analytics, no user profiling
Mobile + desktop browser support (Chrome/Edge/Firefox/Safari)
Non-Goals (out of scope for v1 free-tier version)
File sharing
Screen sharing
Large groups (>6–8 people)
Persistent rooms / scheduled meetings
Push notifications
Very long calls (>1–2 hours per day total)
Self-hosted signaling / TURN
Password recovery / key management UI
2. Threat Model & Security Promises
Promises we can realistically keep (with strong keys):

Server cannot read chat messages or see/hear media
No persistent logs of who talked to whom (only short-lived signaling metadata)
No stored user data whatsoever
What we cannot prevent:

Weak shared secret → brute-force / guess → anyone can join
Network-level observer sees IP addresses + connection times
Browser / OS / user can screenshot / record locally
Signaling provider (Firebase) sees metadata (join/leave timestamps, IPs)
TURN relay provider sees encrypted traffic volume & timing
→ Security ≈ strength of shared passphrase + out-of-band sharing method

3. High-Level Architecture
┌─────────────────────────────┐
                │        Vercel               │
                │   Static SPA (React/Vite)   │
                │   your-vayuroom.vercel.app  │
                └───────────────┬─────────────┘
                                │ HTTP / HTTPS
                  ┌─────────────┴─────────────┐
                  │                           │
      ┌─────────────────────┐     ┌───────────────────────┐
      │ Shared Secret       │     │ Firebase RTDB         │
      │ (4–7 words or       │◄───►│ (ephemeral signaling) │
      │  20+ random chars)  │     │ path = sha256(key)    │
      └─────────────────────┘     └───────────┬───────────┘
                                              │ WebSocket
                                     ┌────────┴────────┐
                                     │                 │
                           ┌─────────▼─────────┐ ┌─────▼─────┐
                           │  WebRTC           │ │  WebRTC   │
                           │  PeerConnection   │ │  Peer     │
                           │  (audio/video +   │ │  Connection│
                           │   data channel)   │ └───────────┘
                           └───────────────────┘
                                     │ DTLS-SRTP (E2EE)
                                     ▼
                          End-to-end encrypted media & messages
4. Tech Stack – Free Tier Only
Layer	Technology	Free Tier Limits (approx. 2026)	Rationale / Warnings
Frontend	React 19 + Vite	—	Fast HMR, small bundle
Build & Deploy	Vercel Hobby	100 GB bandwidth/mo, 1M function invocations, 100 GB-h function duration	Excellent DX, auto HTTPS
Version Control	GitHub	Unlimited public/private repos	Free Actions for CI
Signaling	Firebase Realtime Database (Spark)	100 simultaneous connections, 1 GB stored, 10 GB downloaded/mo	Easiest pub/sub for offers/answers/candidates
Crypto	Web Crypto API (SubtleCrypto)	Unlimited	Native, audited
Key Derivation	PBKDF2 + SHA-256 → AES-GCM-256	—	High iterations (600k+)
STUN servers	Google public	Unlimited	Reliable fallback
TURN servers	Open Relay (openrelay.metered.ca)	20 GB relayed traffic / month	Best free TURN option
State (client)	React + Zustand / useState	—	No IndexedDB → no persistence
5. Folder Structure (Recommended)
vayuroom/
├── public/
│   ├── favicon.ico
│   └── index.html
├── src/
│   ├── components/
│   │   ├── JoinRoomForm.tsx
│   │   ├── RoomHeader.tsx
│   │   ├── ChatInput.tsx
│   │   ├── MessageList.tsx
│   │   ├── CallControls.tsx
│   │   ├── LocalVideo.tsx
│   │   └── RemoteVideos.tsx
│   ├── hooks/
│   │   ├── useWebRTC.ts          ← core WebRTC logic
│   │   ├── useSignaling.ts       ← Firebase listener + sender
│   │   └── useCrypto.ts          ← key derivation + encrypt/decrypt
│   ├── lib/
│   │   ├── firebase.ts           ← initializeApp + getDatabase
│   │   ├── iceServers.ts         ← exported array of free ICE servers
│   │   └── utils.ts              ← sha256, random words, etc.
│   ├── pages/
│   │   └── index.tsx             ← main entry (Join → Room)
│   ├── store/
│   │   └── useRoomStore.ts       ← Zustand or context
│   ├── types/
│   │   └── index.ts              ← Message, Peer, etc.
│   └── App.tsx
├── .env.local                # VITE_FIREBASE_xxx keys (never commit!)
├── .gitignore
├── firebase.json             # optional – if using Firebase Hosting later
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
6. Development Tasks – Step by Step
Phase 1 – Setup & Boilerplate (1–3 days)
Create GitHub repository → vayuroom
npx create-vite@latest vayuroom --template react-ts
cd vayuroom && npm install
Create Firebase project → Spark plan
Enable Realtime Database
Copy web config → .env.local
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_DATABASE_URL=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
npm install firebase zustand react-hot-toast qrcode.react (optional QR)
Initialize Firebase in src/lib/firebase.ts
Phase 2 – Room Joining & Key Hashing (2–4 days)
Build JoinRoomForm.tsx
Input field + "Generate random key" button (5–7 diceware words)
Big warning banner about key strength
QR code display (qrcode.react)
Compute room path = rooms/${await sha256(key)}
Redirect / show room UI when user submits valid key
Phase 3 – Signaling with Firebase (3–6 days)
Create useSignaling.ts hook
Listen to /rooms/${roomHash}/offers, /answers, /candidates
Send own offer / answer / ICE candidates
Use onValue, push, set, remove
Auto-cleanup: remove own data on unmount / disconnect
Phase 4 – WebRTC Core (5–10 days – hardest part)
useWebRTC.ts hook
Get user media (audio + video optional)
Create RTCPeerConnection with free ICE servers
Handle ontrack, onicecandidate, oniceconnectionstatechange
Data channel for chat messages (RTCDataChannel)
Encrypt chat messages with AES-GCM derived from shared key
Phase 5 – UI & Controls (4–7 days)
Local + remote video elements
Mute / camera toggle buttons
Hang up / leave room
Chat message list + input
Show connection status (connecting / connected / failed)
Phase 6 – Polish & Security Warnings (2–4 days)
Add loading states, error toasts
Mobile responsive design
Very visible passphrase strength meter / recommendation
Session-only storage (no IndexedDB persistence)
Phase 7 – Deploy & Test
npm run build
vercel CLI → link to project
Auto-deploy on every push (GitHub → Vercel)
Test with 2–3 devices / different networks
Monitor Firebase usage in console
7. Important Warnings & Limits Summary
Firebase Spark → max ~100 simultaneous connections → suitable for <20–30 active rooms
Open Relay TURN → 20 GB/mo → ~50–150 hours of group relayed calls (most calls are P2P)
Vercel Hobby → 100 GB bandwidth/mo → plenty for static SPA + signaling
Weak keys → entire security collapses → educate users heavily
8. Next Steps after MVP
Add screen sharing (getDisplayMedia)
Improve group call layout (grid / active speaker)
Optional: switch to self-hosted signaling if free limits hit
Add copy-to-clipboard room link with embedded key (but warn!)
Good luck with Vayuroom!
Start small, test early, focus on clean WebRTC connection flow first.