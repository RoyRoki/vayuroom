# Vayuroom — Implementation Plan (v2)

> **Ephemeral, no-login, privacy-first chat + audio + video calling web app**
> UI inspired by **Instagram's** dark-mode design language
> Updated with critical fixes from technical audit

---

## ⚠️ Prerequisites — What You Need Before Starting

### CLI Tools Required

| Tool | Install Command | Purpose |
|---|---|---|
| **Node.js 20+** | `brew install node` | Runtime |
| **npm** | Comes with Node | Package manager |
| **GitHub CLI (`gh`)** | `brew install gh` | Repo creation, PRs, releases |
| **Vercel CLI** | `npm i -g vercel` | Deploy & env management |
| **Firebase CLI** | `npm i -g firebase-tools` | RTDB setup & rules deploy |

### Auth & Login Required

```bash
gh auth login              # GitHub — browser OAuth
vercel login               # Vercel — browser OAuth
firebase login             # Firebase — browser OAuth
```

### Keys & Credentials You Must Provide

| Key | Where to Get It | When Needed |
|---|---|---|
| **Firebase Web Config** (7 values) | Firebase Console → Project Settings → Your Apps → Web | Phase 2 |
| `VITE_FIREBASE_API_KEY` | ↑ auto-generated | Phase 2 |
| `VITE_FIREBASE_AUTH_DOMAIN` | ↑ `projectId.firebaseapp.com` | Phase 2 |
| `VITE_FIREBASE_DATABASE_URL` | ↑ `https://projectId-default-rtdb.firebaseio.com` | Phase 2 |
| `VITE_FIREBASE_PROJECT_ID` | ↑ your project ID | Phase 2 |
| `VITE_FIREBASE_STORAGE_BUCKET` | ↑ `projectId.appspot.com` | Phase 2 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ↑ numeric sender ID | Phase 2 |
| `VITE_FIREBASE_APP_ID` | ↑ `1:xxx:web:xxx` | Phase 2 |
| **Metered.ca TURN credentials** | [metered.ca](https://www.metered.ca/stun-turn) → Free signup → API key | Phase 4 |
| `VITE_TURN_USERNAME` | Metered dashboard | Phase 4 |
| `VITE_TURN_CREDENTIAL` | Metered dashboard | Phase 4 |

> **Action Required:**
> 1. Create a Firebase project (Spark/free plan) & enable Realtime Database
> 2. Create a free Metered.ca account for TURN server credentials
> 3. Provide the keys above — I'll put them in `.env.local`

---

## Table of Contents

1. [Design System — Instagram-Inspired UI](#1-design-system--instagram-inspired-ui)
2. [Phase 1 — Project Scaffold & CLI Setup](#2-phase-1--project-scaffold--cli-setup)
3. [Phase 2 — Firebase Setup (CLI)](#3-phase-2--firebase-setup-cli)
4. [Phase 3 — Core Crypto & Room Logic](#4-phase-3--core-crypto--room-logic)
5. [Phase 4 — Signaling Layer (Firebase RTDB)](#5-phase-4--signaling-layer)
6. [Phase 5 — WebRTC Engine](#6-phase-5--webrtc-engine)
7. [Phase 6 — UI Components (Instagram Style)](#7-phase-6--ui-components)
8. [Phase 7 — Polish, Responsive & PWA](#8-phase-7--polish-responsive--pwa)
9. [Phase 8 — Deploy (Vercel CLI + GitHub CLI)](#9-phase-8--deploy)
10. [Folder Structure (Final)](#10-folder-structure-final)
11. [CLI Commands Cheat Sheet](#11-cli-commands-cheat-sheet)

---

## 1. Design System — Instagram-Inspired UI

### Color Palette (Dark Mode Primary)

```
Background Primary     : #000000  (pure black)
Background Secondary   : #121212  (cards, modals)
Background Tertiary    : #1C1C1E  (input fields, hover states)
Surface Elevated       : #262626  (dropdowns, tooltips)
Border                 : #363636  (subtle dividers)
Border Active          : #545454  (focused inputs)

Text Primary           : #F5F5F5  (main text)
Text Secondary         : #A8A8A8  (muted/secondary)
Text Tertiary          : #737373  (timestamps, hints)

Accent Blue            : #0095F6  (primary actions — Instagram blue)
Accent Blue Hover      : #1877F2  (button hover)
Accent Green           : #58C322  (online/connected status)
Accent Red             : #ED4956  (leave/hangup, errors)
Accent Orange          : #FCA326  (warnings)

Gradient Primary       : linear-gradient(45deg, #833AB4, #FD1D1D, #F77737)  (IG gradient)
Gradient Subtle        : linear-gradient(135deg, #1C1C1E, #262626)          (card backgrounds)
```

### Typography

```
Font Family            : 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
Size XS: 11px | SM: 13px | Base: 14px | MD: 16px | LG: 20px | XL: 24px | 2XL: 28px
Weights                : 300 (light) | 400 (regular) | 500 (medium) | 600 (semi) | 700 (bold)
```

### Spacing & Radius

```
Spacing Unit           : 4px base (4, 8, 12, 16, 20, 24, 32, 48, 64)
Border Radius          : 8px (buttons) | 12px (cards) | 16px (modals) | 9999px (pills/avatars)
Max Content Width      : 480px (mobile-first)
```

### Component Patterns

| Component | Instagram Reference |
|---|---|
| **Join Screen** | IG login — centered card, clean inputs, gradient CTA |
| **Chat Bubbles** | IG DM — blue (self), dark gray (other), `border-radius: 18px`, max-width 65% |
| **Input Bar** | IG composer — bottom-fixed, rounded input, send icon |
| **Video Call** | Full-screen + floating controls + PiP local video |
| **Call Controls** | Circular icon buttons, centered bottom bar |
| **Status Dots** | Green (online), pulsing yellow (connecting), gray (offline) |
| **Toasts** | Top-right dark surface, colored left border, 3s auto-dismiss |
| **Icons** | Lucide React |

### Animations

```
Default transition     : all 0.2s cubic-bezier(0.4, 0, 0.2, 1)
Message enter          : fadeInUp 0.2s ease-out
Modal enter            : scale(0.95→1) + opacity(0→1) 0.2s
Button press           : scale(0.96) on :active
Loading                : shimmer gradient animation
```

---

## 2. Phase 1 — Project Scaffold & CLI Setup

```bash
# 1. Create project
npx -y create-vite@latest ./ --template react-ts

# 2. Install dependencies
npm install firebase zustand react-hot-toast lucide-react
npm install -D @types/node

# 3. Git init + GitHub repo
git init
git add .
git commit -m "init: vite + react-ts scaffold"
gh repo create vayuroom --public --source=. --remote=origin --push
```

### Files to Create

| File | Purpose |
|---|---|
| `src/styles/variables.css` | CSS custom properties (design tokens) |
| `src/styles/global.css` | Reset, base styles, font imports |
| `src/styles/animations.css` | Keyframe animations |
| `src/styles/components.css` | Shared component styles |
| `.gitignore` | `.env.local`, `node_modules/`, `dist/` |

---

## 3. Phase 2 — Firebase Setup (CLI)

```bash
firebase login
firebase init
#  → Realtime Database
#  → Select/create project: vayuroom
#  → Rules file: database.rules.json
```

### Database Rules (`database.rules.json`)

> **FIX:** Added TTL validation — signaling data must have a `timestamp` and expires after 60 seconds. Presence uses `onDisconnect()`.

```json
{
  "rules": {
    "rooms": {
      "$roomHash": {
        ".read": true,
        ".write": true,
        "meta": {
          "maxPeers": { ".validate": "newData.val() <= 3" }
        },
        "presence": {
          "$peerId": {
            ".validate": "newData.hasChildren(['timestamp', 'displayName'])",
            "timestamp": {
              ".validate": "newData.val() > now - 30000"
            }
          }
        },
        "signals": {
          "$signalId": {
            ".validate": "newData.hasChild('timestamp') && newData.child('timestamp').val() > now - 60000"
          }
        }
      }
    }
  }
}
```

```bash
firebase deploy --only database
```

### Files to Create

| File | Purpose |
|---|---|
| `src/lib/firebase.ts` | `initializeApp()` + `getDatabase()` with env vars |
| `database.rules.json` | RTDB security rules with TTL + capacity |
| `firebase.json` | Firebase project config |
| `.env.local` | Firebase + TURN credentials |

### `.env.local`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

---

## 4. Phase 3 — Core Crypto & Room Logic

### Key Derivation Flow

```
Passphrase → PBKDF2 (600k iterations, SHA-256)
                 ├──→ AES-GCM-256 Key  (encrypt chat messages)
                 └──→ SHA-256 Hash      (Firebase room path)
```

### Files to Create

| File | Purpose |
|---|---|
| `src/lib/crypto.ts` | `deriveKey(passphrase)` → `{aesKey, roomHash}`, `encrypt()`, `decrypt()` |
| `src/lib/utils.ts` | `sha256()`, `generatePassphrase()` (diceware), `generatePeerId()`, `timestamp()` |
| `src/hooks/useCrypto.ts` | React hook wrapping crypto with loading/error state |
| `src/types/index.ts` | All TypeScript interfaces |

### Type Definitions

```typescript
export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  encrypted: string;    // base64 AES-GCM ciphertext
  iv: string;           // base64 IV (unique per message — NEVER reuse)
}

export interface Peer {
  id: string;
  displayName: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  stream?: MediaStream;
  connectionState: RTCPeerConnectionState;
}

export interface RoomState {
  roomHash: string;
  passphrase: string;
  aesKey: CryptoKey | null;
  localPeer: Peer;
  remotePeers: Map<string, Peer>;
  messages: Message[];
  connectionStatus: 'idle' | 'joining' | 'connected' | 'reconnecting' | 'failed';
  callStatus: 'none' | 'active' | 'ended';
  peerCount: number;
}

// FIX: Unified signal type instead of separate offer/answer/candidate paths
export interface Signal {
  id: string;
  type: 'offer' | 'answer' | 'candidate' | 'leave';
  senderId: string;
  targetId: string;
  payload: any;
  timestamp: number;
  politeness: number;  // for polite peer protocol (join order)
}
```

> **FIX:** Added unique IV per message, `reconnecting` state, `politeness` field for polite peer protocol.

---

## 5. Phase 4 — Signaling Layer

### Polite Peer Protocol (FIX for glare/race conditions)

```
When two peers send offers simultaneously:

1. Each peer gets a "politeness" number = their join order
2. Lower number = "impolite" peer (their offer wins)
3. Higher number = "polite" peer (drops own offer, accepts the other)

This prevents the "two offers, no answers" deadlock.
```

### Signaling Data Structure (Firebase)

```
/rooms/{roomHash}/
  ├── presence/
  │   ├── {peerId}/
  │   │   ├── displayName: "User-A3F2"
  │   │   ├── timestamp: 1708000000000
  │   │   └── order: 1                    ← join order for polite peer
  │   └── {peerId2}/...
  └── signals/
      └── {signalId}/
          ├── type: "offer" | "answer" | "candidate" | "leave"
          ├── senderId: "peer-abc"
          ├── targetId: "peer-xyz"         ← directed signals, not broadcast
          ├── payload: { sdp / candidate }
          └── timestamp: 1708000000000     ← for TTL cleanup
```

> **FIX:** Unified `/signals/` path instead of separate `/offers/`, `/answers/`, `/candidates/`. Directed signals with `targetId`. TTL timestamps on everything.

### Files to Create

| File | Purpose |
|---|---|
| `src/hooks/useSignaling.ts` | Firebase pub/sub with polite peer protocol, TTL cleanup, `onDisconnect()` |
| `src/lib/iceServers.ts` | ICE config with Metered.ca TURN (replaces dead Open Relay) |

### ICE Servers (FIX: replaced Open Relay with Metered.ca)

```typescript
export const getIceServers = (): RTCIceServer[] => [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:443',
      'turn:global.relay.metered.ca:443?transport=tcp',
    ],
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  },
];
```

### Presence Heartbeat (FIX: ghost peer prevention)

```
Every 15 seconds:
  → Write current timestamp to /presence/{myPeerId}/timestamp

On connect:
  → Set onDisconnect() to remove /presence/{myPeerId}

On reading presence:
  → Ignore peers with timestamp > 30 seconds old (stale)
```

---

## 6. Phase 5 — WebRTC Engine

### Architecture (FIX: refs for PeerConnections, not Zustand)

```
Zustand Store (reactive UI state)     React Refs (mutable, non-reactive)
┌──────────────────────────┐          ┌──────────────────────────┐
│ messages: Message[]      │          │ peerConnections:         │
│ remotePeers: Map<Peer>   │          │   Map<string, {          │
│ connectionStatus         │          │     pc: RTCPeerConnection│
│ callStatus               │          │     dc: RTCDataChannel   │
│ peerCount                │          │   }>                     │
│ localStream              │          │ localStreamRef           │
└──────────────────────────┘          └──────────────────────────┘
     ↑ UI reads from here                ↑ WebRTC callbacks use these
```

> **FIX:** `RTCPeerConnection` objects stored in `useRef`, NOT in Zustand. Prevents stale closure bugs.

### Mute/Camera Toggle (FIX: use `replaceTrack`, not renegotiation)

```typescript
// Toggle camera without renegotiation:
const toggleCamera = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;  // instant, no SDP exchange
};

// Fully disable camera (stop track, send black frame):
const disableCamera = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.stop();
  // Replace with black canvas track for remote peers
  const blackTrack = createBlackVideoTrack();
  peerConnections.forEach(({ pc }) => {
    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    sender?.replaceTrack(blackTrack);  // no renegotiation needed
  });
};
```

### Reconnection Strategy (FIX: was completely missing)

```
ICE connection state changes:
  "connected"    → ✅ all good
  "disconnected" → ⏳ wait 5s, ICE might recover
  "failed"       → 🔄 ICE restart:
                      1. pc.restartIce()
                      2. Create new offer with iceRestart: true
                      3. Send via signaling
                      4. If fails 3 times → show "reconnect" button
  "closed"       → 🗑️ cleanup, remove peer
```

### Room Capacity (FIX: cap at 3 peers for mesh)

```typescript
// Before creating a new PeerConnection:
const MAX_PEERS = 3;
if (remotePeers.size >= MAX_PEERS - 1) {
  toast.error(`Room is full (max ${MAX_PEERS} people)`);
  return;
}
```

### Files to Create

| File | Purpose |
|---|---|
| `src/hooks/useWebRTC.ts` | PeerConnection lifecycle in refs, data channels, ICE restart reconnection |
| `src/hooks/useMediaDevices.ts` | `getUserMedia`, `replaceTrack` toggling, device enumeration |
| `src/store/useRoomStore.ts` | Zustand store (UI state only, no WebRTC objects) |

---

## 7. Phase 6 — UI Components

### Screen Flow

```
┌──────────────────┐         ┌──────────────────────────────────────┐
│   Join Screen    │         │            Room Screen               │
│                  │         │  ┌────────────────────────────────┐  │
│  ┌────────────┐  │         │  │ Room Header  · 2/3 · [Leave]  │  │
│  │  Vayuroom  │  │         │  └────────────────────────────────┘  │
│  │  gradient  │  │         │  ┌────────────────────────────────┐  │
│  │   logo     │  │         │  │                                │  │
│  └────────────┘  │         │  │     Messages (scrollable)      │  │
│                  │         │  │                                │  │
│  Enter secret    │         │  │  ┌──────────┐                  │  │
│  ┌────────────┐  │         │  │  │ Hi there │ ← other          │  │
│  │  ••••••••  │  │         │  │  └──────────┘                  │  │
│  └────────────┘  │────────►│  │          ┌──────────┐          │  │
│  [strength bar]  │         │  │          │ Hey! 👋  │ → self   │  │
│                  │         │  │          └──────────┘          │  │
│  [Generate Key]  │         │  └────────────────────────────────┘  │
│  ┌────────────┐  │         │  ┌────────────────────────────────┐  │
│  │ Join Room  │  │         │  │  [💬 message...]         [➤]  │  │
│  └────────────┘  │         │  └────────────────────────────────┘  │
│  "max 3 people"  │         │  ┌────────────────────────────────┐  │
└──────────────────┘         │  │   [🎤]  [📹]    [📞 / 🔴]    │  │
                             │  └────────────────────────────────┘  │
                             └──────────────────────────────────────┘
```

### Component Files

| Component | Files | Description |
|---|---|---|
| **JoinScreen** | `.tsx` + `.css` | Passphrase input, generate key, strength meter, capacity note |
| **RoomScreen** | `.tsx` + `.css` | Main layout — header + messages + input + controls |
| **RoomHeader** | `.tsx` + `.css` | Room name, peer count / capacity, leave button, status dot |
| **MessageList** | `.tsx` + `.css` | Scrollable messages, auto-scroll, date separators |
| **MessageBubble** | `.tsx` | Single bubble — text, time, self/other styling |
| **ChatInput** | `.tsx` + `.css` | Bottom-fixed input, send on Enter, send button |
| **CallControls** | `.tsx` + `.css` | Circular buttons — mute, camera, call/hangup |
| **VideoCall** | `.tsx` + `.css` | Fullscreen remote + PiP local + floating controls |
| **StatusIndicator** | `.tsx` | Connection dot with label |
| **PassphraseStrength** | `.tsx` | Visual bar — red/yellow/green based on word count |
| **Logo** | `.tsx` | Vayuroom wordmark with IG gradient |
| **ConnectionOverlay** | `.tsx` | "Reconnecting..." overlay when ICE is restarting |

---

## 8. Phase 7 — Polish, Responsive & PWA

- [ ] Mobile-first layout (480px core, expand on desktop)
- [ ] Touch-friendly button sizes (min 44px tap target)
- [ ] Keyboard handling (Enter to send, Escape to close)
- [ ] Loading skeletons with shimmer animation
- [ ] Error toasts with descriptive messages
- [ ] Passphrase strength meter (entropy-based)
- [ ] Connection quality indicator (ICE state → color)
- [ ] Duplicate tab detection (localStorage lock)
- [ ] `onDisconnect()` cleanup for all Firebase paths
- [ ] Audio echo cancellation + noise suppression config
- [ ] Favicon + Open Graph meta tags
- [ ] Safari `getUserMedia` quirks handling

---

## 9. Phase 8 — Deploy

```bash
# Build
npm run build

# Deploy to Vercel
vercel login
vercel --prod

# Set env vars
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_AUTH_DOMAIN production
vercel env add VITE_FIREBASE_DATABASE_URL production
vercel env add VITE_FIREBASE_PROJECT_ID production
vercel env add VITE_FIREBASE_STORAGE_BUCKET production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID production
vercel env add VITE_TURN_USERNAME production
vercel env add VITE_TURN_CREDENTIAL production

# Redeploy with env vars
vercel --prod

# Verify
vercel ls
vercel open
```

---

## 10. Folder Structure (Final)

```
vayuroom/
├── public/
│   ├── favicon.ico
│   └── index.html
├── src/
│   ├── components/
│   │   ├── CallControls.tsx + .css
│   │   ├── ChatInput.tsx + .css
│   │   ├── ConnectionOverlay.tsx
│   │   ├── JoinScreen.tsx + .css
│   │   ├── Logo.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageList.tsx + .css
│   │   ├── PassphraseStrength.tsx
│   │   ├── RoomHeader.tsx + .css
│   │   ├── RoomScreen.tsx + .css
│   │   ├── StatusIndicator.tsx
│   │   ├── VideoCall.tsx + .css
│   │   └── VideoCall.css
│   ├── hooks/
│   │   ├── useCrypto.ts
│   │   ├── useMediaDevices.ts
│   │   ├── useSignaling.ts
│   │   └── useWebRTC.ts
│   ├── lib/
│   │   ├── crypto.ts
│   │   ├── firebase.ts
│   │   ├── iceServers.ts
│   │   └── utils.ts
│   ├── store/
│   │   └── useRoomStore.ts
│   ├── styles/
│   │   ├── animations.css
│   │   ├── components.css
│   │   ├── global.css
│   │   └── variables.css
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.local
├── .gitignore
├── database.rules.json
├── firebase.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── PLAN.md
├── PROJECT.md
├── STATE.md
└── README.md
```

---

## 11. CLI Commands Cheat Sheet

### GitHub CLI (`gh`)

```bash
gh auth login                                        # Authenticate
gh repo create vayuroom --public --source=. --push   # Create + push
gh repo view                                         # Repo info
gh browse                                            # Open in browser
gh release create v1.0.0 --notes "Initial release"   # Release
```

### Vercel CLI

```bash
vercel login                          # Authenticate
vercel --prod                         # Production deploy
vercel env add VAR production         # Add env var
vercel env ls                         # List env vars
vercel ls                             # List deploys
vercel logs --follow                  # Stream logs
vercel open                           # Open site
```

### Firebase CLI

```bash
firebase login                        # Authenticate
firebase init                         # Initialize
firebase deploy --only database       # Deploy rules
firebase database:get /rooms          # Debug: read data
firebase database:remove /rooms       # Debug: clear rooms
```

### Dev

```bash
npm run dev                           # Dev server :5173
npm run build                         # Prod build
npm run preview                       # Preview build
```

---

## Summary of Fixes Applied (v1 → v2)

| # | Issue | Fix |
|---|---|---|
| 1 | Open Relay TURN is dead | → Metered.ca free TURN (needs signup) |
| 2 | Mesh doesn't scale to 6 | → Capped at 3 peers |
| 3 | Signaling race conditions | → Polite peer protocol + directed signals |
| 4 | No reconnection strategy | → ICE restart with 3-attempt retry |
| 5 | IV reuse in encryption | → Unique IV per message, explicit in types |
| 6 | Camera toggle renegotiates | → `replaceTrack()` + `track.enabled` |
| 7 | Stale Firebase data | → TTL timestamps + 60s expiry in rules |
| 8 | Ghost peers in presence | → 15s heartbeat + `onDisconnect()` |
| 9 | RTCPeerConnection in Zustand | → Stored in `useRef`, not in store |
| 10 | No duplicate tab handling | → localStorage lock |
