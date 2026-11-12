# Key Engineering Decisions

Five decisions I'd explain live to a technical interviewer.

---

## 1. LiveKit Inference Over Provider Plugins

**Decision:** Use `inference.STT()`, `inference.LLM()`, `inference.TTS()` instead of installing Deepgram, OpenAI, or Cartesia plugins separately.

**Why:** One credential set covers everything — no `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `CARTESIA_API_KEY`. Switching models is a one-line env change, not a dependency upgrade. For this take-home, that cut setup friction to zero and kept the architecture readable. In production, the same approach works as long as the needed models are on Inference (they are — I verified the current model list via `lk docs`).

**Trade-off:** If a model I need isn't on Inference, I'd add a provider plugin. I checked — all three choices (Deepgram, Gemma, Cartesia) are available.

---

## 2. Numbers From Tools Only — Never the System Prompt

**Decision:** The system prompt contains zero business numbers. Every figure the agent speaks comes from a tool result.

**Why:** This is both a correctness requirement and a testability strategy. The persona test runner implements `assert_no_hallucinated_numbers(reply, tool_outputs)`: it extracts every 4+ digit number from the agent's reply and verifies each one appears in the tool's JSON output. This check is impossible to implement reliably if numbers can legitimately come from the prompt. It also means data updates (different seller, different month) flow through cleanly — no prompt editing required.

**Trade-off:** Every piece of data needs a tool. This adds 2-3 tool calls per session, which adds latency. Mitigation: `get_metrics` returns everything at once (gap analysis, cancellation breakdown, all metrics), so a single call covers Stage 3 of the conversation.

---

## 3. Deterministic `build_action_plan()` — Not LLM Reasoning

**Decision:** `propose_action_plan` calls a pure Python function with explicit if/else rules, not "ask the LLM to figure out the plan."

**Why:** The plan must change visibly and predictably when the seller's answers change. If the seller says "I already fixed stock sync," the plan drops the auto-pause action. If `accepts_promo=False`, the promo action disappears. With a deterministic function, I can write `assert plan_changes_when_answers_change()` as a unit test. With LLM-generated plans, that assertion is nondeterministic. The recruiter asked for this behavior explicitly — determinism is the only way to guarantee it.

**Trade-off:** Rules-based logic is less flexible than a reasoning LLM. If the scenario is very unusual, the plan might miss edge cases. For 2-3 actions covering the main levers (stock, dispatch, promo), rules are sufficient.

---

## 4. `confirm_by_seller` and `seller_consented` as Hard Code Gates

**Decision:** `mark_root_cause` raises an error unless `confirmed_by_seller=True`. `execute_kam_action` raises an error unless `seller_consented=True`. These are code preconditions, not prompt instructions.

**Why:** "The model interprets meaning; your code owns the state transition." If I only put "ask permission before executing" in the prompt, the model could call `execute_kam_action` during an on_enter greeting if it confuses context. The code gate is a hard stop — it returns `{"status": "error", "message": "Cannot execute..."}`, which the model reads and handles by actually asking permission. The persona test `assert_no_consent_violation` verifies this boundary is never crossed.

**Trade-off:** More verbose tool definitions. Worth it for the correctness guarantee.

---

## 5. Data Packets Over RPC for Dashboard Updates

**Decision:** Agent pushes JSON events to the frontend using `publish_data()` on topic `kam_dashboard`. Frontend listens with `room.on(RoomEvent.DataReceived, ...)`.

**Why:** Tools run sequentially during a conversation turn. After each tool, we want the dashboard to update immediately — no polling, no request-response overhead. `publish_data` is fire-and-forget from the agent side, adding <1ms to tool execution. The frontend receives and routes events by `type` field (e.g., `seller_verified`, `metrics_loaded`, `action_executed`). RPC would work too but adds round-trip overhead for something that doesn't need a response. Data packets on a named topic are simpler and appropriate here.

**Trade-off:** Data packets are unreliable by default (lossy). I use `reliable=True` for dashboard events since we care about every update. For high-frequency streaming (transcripts), lossy would be fine.

