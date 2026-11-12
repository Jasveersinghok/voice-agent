# Technical Notes

**Project:** Virtual Key Account Manager (KAM) Voice Agent for Snapdeal  
**Stack:** LiveKit Agents (Python), Next.js, LiveKit Cloud Inference  
**Submission type:** Take-home engineering challenge

---

## Voice AI Pipeline

```
Seller voice input
      ↓
  [Deepgram STT]  — flux-general model
  Real-time streaming transcription, ~200ms latency
      ↓
  [LiveKit TurnDetector]
  Adaptive end-of-turn detection, handles interruptions
      ↓
  [Gemma 4 31B LLM]  — via LiveKit Inference
  Reasons over conversation + tool schemas + system prompt
      ↓
  [Function Tools]  — 12 tools, mock data
  Synchronous Python functions, push events to frontend
      ↓
  [Cartesia Sonic 2 TTS]  — <100ms TTFB
  Streams audio back to seller
```

**Total latency target:** <1.5 seconds from end-of-turn to first speech byte.

---

## Model Technology Choices

### STT: Deepgram `flux-general`
Chosen for lowest word-error-rate on conversational English with South Asian accents, real-time streaming (not batch), and sub-200ms first-word latency. Alternative was AssemblyAI Universal-3, but Deepgram edges it on accent handling.

### LLM: Google `gemma-4-31b-it` (via LiveKit Inference)
LiveKit's own recommended model for voice agents. Key reasons:
1. **Latency-optimized** — served on LiveKit's own infra with low queuing
2. **Strong tool calling** — reliable structured JSON for 12-tool schema
3. **Free-tier eligible** via LiveKit Inference
4. **Open weights** — good alignment, controllable behavior
5. **Context efficient** — handles 4–6 conversation turns + tool results comfortably

Alternatives evaluated: `google/gemini-3.8-flash` (better reasoning but higher latency), `openai/gpt-4.1-mini` (good but requires separate billing).

### TTS: Cartesia `sonic-2`
Sub-100ms time-to-first-byte, natural prosody for short sentences (which our voice style rules enforce). No "robotic" artifacts on 15–25 word replies. Fish Audio was considered but Cartesia wins on latency for streaming.

### Turn Detection: LiveKit `inference.TurnDetector()`
Adaptive model trained on conversational audio. Handles: backchannels ("mm-hmm"), short pauses within a sentence, true end-of-turn. No hard VAD timeout — reduces false interruptions.

### Infrastructure: LiveKit Cloud + LiveKit Inference
One credential set (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) covers everything — STT, LLM, TTS, WebRTC room, and agent hosting. Zero data retention by default.

---

## Why Function Tools Instead of Model Memory

The brief says "numbers must come from tool results only." This is the right engineering constraint for three reasons:

1. **Verifiability.** A tool call is logged, traceable, and testable. A model that "remembers" a number from the system prompt can be right or wrong with no audit trail.
2. **Dynamism.** Tool results can change (restocking, different seller ID). Prompt-embedded numbers are stale.
3. **Testability.** Persona tests can assert `assert_no_hallucinated_numbers(reply, tool_outputs)` by checking that every 4+ digit number spoken appears in a tool result. This is not possible with memory-based approaches.
4. **Consent gates.** `execute_kam_action(seller_consented=True)` and `mark_root_cause(confirmed_by_seller=True)` are code-level preconditions — the model interprets meaning, but code owns the state transition.

---

## Assumptions (Labeled)

| Assumption | Why |
|------------|-----|
| 4 hero SKUs drive ~90 lost orders | Based on order delta (45→10, 35→12, 30→10, 20→8) = 90 |
| 14 tail OOS items are low-selling | Realistic long-tail distribution for a 60-SKU apparel store |
| 60/30/10 cancellation split | Typical Snapdeal apparel pattern; labeled as assumption in `DATA_NOTES` |
| Rs 500 avg price stable | Given explicitly in brief |
| Total gap = 130 orders, Rs 65,000 | Arithmetically derived: 400−270 = 130; 130 × 500 = 65,000 |

---

## Simulated Actions (Production Would...)

| Simulated action | Production equivalent |
|-----------------|----------------------|
| Enable auto-pause | Snapdeal Seller API: `POST /listings/auto-pause` with low-stock threshold |
| Enable dispatch alerts | Webhook subscription on dispatch SLA breach events |
| Run 7-day promo | Snapdeal Promotions API: `POST /campaigns` with SKU list + discount % |
| send_recap (WhatsApp) | Twilio / Gupshup WhatsApp Business API + message template |
| schedule_followup | CRM write (Salesforce / internal) + calendar trigger |
| escalate_to_human | Routing to live agent queue (Freshdesk / Zendesk) |

---

## Limitations

- **Mock data only.** No real API calls to Snapdeal backend.
- **No caller verification.** MVP trusts seller ID/store name. Production needs OTP or account PIN.
- **English/Hinglish.** Agent responds in English. `LANG_MODE=hinglish` enables code-switched replies but TTS voice is English-only. Full Hinglish would need Sarvam AI TTS.
- **Single session state.** `SESSION_STATE` is a module-level dict — works for one concurrent session per process. Production would use Redis or the job context's userdata.
- **No real interrupt handling on tool calls.** Long tool calls can't be interrupted mid-flight today; this is a framework limitation being addressed in livekit-agents 1.9.

---

## Next Steps (If Productionized)

1. **Proactive outbound.** Scheduled job detects >25% sales drop → auto-dispatch KAM call to seller mobile. Already supported by LiveKit SIP + dispatch rules.
2. **Full Hinglish.** Sarvam AI TTS + language-detect in STT for seamless Hindi switching.
3. **Payments/Returns flow.** Extend tools for settlement queries, return window checks.
4. **Real data integration.** Replace mock_data.py with Snapdeal Seller API calls (cached with 5-min TTL to stay off LLM critical path).
5. **Caller identity verification.** OTP to registered mobile before surfacing any account data.
6. **A/B prompt testing.** Use LiveKit simulations to compare system prompt variants at scale before shipping.

