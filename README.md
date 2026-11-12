# Virtual KAM — Snapdeal Seller Voice Agent

> A real-time voice-based Key Account Manager built on LiveKit Agents. A seller calls in, the agent listens, diagnoses from live data, asks sharp questions, recommends actions, and closes with a summary.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Caller (Seller)                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │  WebRTC / Phone
┌──────────────────────▼──────────────────────────────────────────┐
│               LiveKit Cloud (snapdeal project)                   │
│  ┌────────────────────┐    ┌──────────────────────────────────┐ │
│  │  React Frontend    │    │  Python KAM Agent                │ │
│  │  (Next.js)         │◄───│  livekit-agents 1.8.11           │ │
│  │  - Call controls   │    │  ┌─────────────────────────────┐ │ │
│  │  - Live transcript │    │  │ STT: deepgram/flux-general   │ │ │
│  │  - KAM Dashboard  │    │  │ LLM: google/gemma-4-31b-it  │ │ │
│  └────────────────────┘    │  │ TTS: cartesia/sonic-2        │ │ │
│         kam_dashboard       │  │ Turn: inference.TurnDetector │ │ │
│         data packets        │  └─────────────────────────────┘ │ │
│                             │  ┌─────────────────────────────┐ │ │
│                             │  │  12 Function Tools           │ │ │
│                             │  │  mock_data.py computations  │ │ │
│                             │  └─────────────────────────────┘ │ │
│                             └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                       ▲
                       │  LiveKit Inference
                 ┌─────┴──────┐
                 │ Deepgram   │  Cartesia  │  Gemma 4 31B
                 └────────────┘
```

**Data flow per turn:**
1. Seller speaks → Deepgram STT transcribes
2. LLM (Gemma 4 31B) reasons + calls function tools
3. Tools compute from `mock_data.py`, push JSON to frontend via `kam_dashboard` data packets  
4. LLM generates reply → Cartesia TTS synthesizes → played to seller
5. Frontend dashboard fills in real-time as tools fire

---

## Model Choices

| Component | Model | Why |
|-----------|-------|-----|
| **STT** | `deepgram/flux-general` | Best-in-class WER for conversational English/Hinglish, lowest latency for South Asian accents |
| **LLM** | `google/gemma-4-31b-it` | LiveKit's recommended default: latency-optimized, open-weight, strong tool calling, free tier via Inference |
| **TTS** | `cartesia/sonic-2` | Sub-100ms TTFB, natural conversational Indian-English quality |
| **Turn Detection** | `inference.TurnDetector()` | Adaptive, interruption-aware, built-in |
| **Infra** | LiveKit Cloud (Inference) | One bill, one credential set, zero-data-retention by default |

All models are **swappable via `.env`** — see `.env.example`.

---

## Project Structure

```
KAM/
├── agent/
│   ├── src/agent.py          # KAMAgent class + 12 tools + entrypoint
│   ├── data/mock_data.py     # All seller data + computation functions
│   ├── prompts/
│   │   └── kam_system_prompt.md  # Voice persona, conversation guide, case handling
│   ├── .env                  # LiveKit credentials (not in git)
│   ├── .env.example          # Template
│   ├── livekit.toml          # Project config
│   └── pyproject.toml        # Python dependencies
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx          # Main dashboard page (1900+ lines)
│   │   ├── layout.tsx        # App layout
│   │   ├── globals.css       # Tailwind + custom animations
│   │   └── api/token/route.ts # LiveKit token endpoint
│   └── package.json
├── tests/
│   └── persona_runner.py     # 22 persona test scenarios
├── README.md
├── NOTE.md
├── DEMO_SCRIPT.md
├── DECISIONS.md
└── PERSONA_TEST_LOG.md
```

---

## Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 20+
- `uv` package manager: `pip install uv`
- LiveKit CLI v2.19+: [Install](https://docs.livekit.io/agents/start/voice-ai-quickstart/#install-the-livekit-cli)

### 1. Agent Setup

```bash
cd agent

# Create virtual environment and install deps
uv venv .venv
uv pip install -e .

# Configure credentials
cp .env.example .env
# Edit .env with your LiveKit credentials

# Run agent locally (hot reload)
lk agent dev src/agent.py
```

The agent console URL prints in the terminal. Open it to talk to the agent via browser.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (npm/yarn)
npm install

# Configure (already filled if using this repo)
cp .env.local.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Run Persona Tests

```bash
# Start the agent in a separate terminal first
cd agent && lk agent dev src/agent.py

# Then run tests
cd tests
python persona_runner.py
```

---

## Environment Variables

### Agent (`.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `LIVEKIT_URL` | — | WebSocket URL of LiveKit project |
| `LIVEKIT_API_KEY` | — | LiveKit API key |
| `LIVEKIT_API_SECRET` | — | LiveKit API secret |
| `STT_MODEL` | `deepgram/flux-general` | STT model via LiveKit Inference |
| `STT_LANGUAGE` | `en` | Language code |
| `LLM_MODEL` | `google/gemma-4-31b-it` | LLM model via LiveKit Inference |
| `TTS_MODEL` | `cartesia/sonic-2` | TTS model via LiveKit Inference |
| `TTS_VOICE` | `3b554273-4299-48b9-9aaf-eefd438e3941` | TTS voice ID (Simi - Indian Female Support Specialist) |
| `LANG_MODE` | `english` | Set to `hinglish` for Hindi/Hinglish mode |

### Frontend (`.env.local`)
| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | Same as agent (server-side) |
| `LIVEKIT_API_KEY` | For token generation |
| `LIVEKIT_API_SECRET` | For token generation |
| `NEXT_PUBLIC_LIVEKIT_URL` | Public URL for client connection |

---

## Demo & Deployment

- **LiveKit Cloud Agent ID:** `CA_2TZSqkhK3Hkb` (Region: `ap-south` — India South)
- **Status:** Deployed and Active on LiveKit Cloud (1 replica, auto-dispatch enabled)
- **LiveKit Cloud Console (Direct Voice/Text Test):**  
  [https://cloud.livekit.io/projects/d_snapdeal-y27zsbou/agents/console?agentName=kam-agent](https://cloud.livekit.io/projects/d_snapdeal-y27zsbou/agents/console?agentName=kam-agent)
- **Local Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Demo Shortcut:** Click the **"Demo Mode (SD-402)"** button on the frontend to pre-fill Rajesh's seller ID and start the call — no speech recognition failure can break the demo recording.
- **Persona Test Log:** See [PERSONA_TEST_LOG.md](file:///c:/Users/jasveer%20singh/Desktop/KAM/PERSONA_TEST_LOG.md) for detailed verification across all 22 seller personas.

---

## Assumptions

> See `data/mock_data.py` → `DATA_NOTES` for the full list.

- 4 hero SKUs account for ~90 lost orders (~₹45,000)
- 14 tail OOS SKUs are low-selling (1–5 orders/month)
- Cancellation breakdown: 60% stock unavailable, 30% late dispatch, 10% buyer-side
- Extra cancellation impact (+6 pts) ≈ 16 orders ≈ ₹8,000
- Remaining gap (visibility/other) ≈ 24 orders ≈ ₹12,000
- All numbers are computed from SKU/metrics tables — never hardcoded in prompts

---

## Limitations (Honest)

- Mock data only — no real Snapdeal backend integration
- Actions are simulated (auto-pause, promo, alerts do not execute on real systems)
- Caller identity is not cryptographically verified (no OTP/PIN for MVP)
- Hinglish mode requires `LANG_MODE=hinglish` env flag + LLM support
- No persistent storage (session state resets on agent restart)

---

## Notes for Reviewers

The `lk agent dev src/agent.py` command hot-reloads on file changes.  
The `lk agent debugger` can be used for text-mode conversation testing without spending audio credits.

