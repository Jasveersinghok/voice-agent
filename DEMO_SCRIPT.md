# DEMO SCRIPT — 90-Second Recording

**Scenario:** Seller Rajesh calls in because his sales dropped. We walk through the full KAM flow in 90 seconds.

---

## Setup Before Recording

1. Agent running: Either live on LiveKit Cloud (already deployed and active!), OR locally via `cd agent && lk agent dev src/agent.py`
2. Frontend running: `cd frontend && npm run dev` → open `localhost:3000`
3. Have a second device/mic ready, OR use the browser mic
4. Click **"Demo Mode (SD-402)"** button — pre-fills the seller ID

---

## Script (Speak naturally — this is a guide, not a transcript)

### [0:00–0:12] Call Start + Verify

**You click "Start Call"**

> *Agent greets warmly*: "Hello, welcome to Snapdeal support. I'm your KAM Assistant. Could I get your Seller ID or store name?"

**You say:** "My seller ID is SD-402"

> *Agent reads back and confirms*: "Let me confirm — SD-402. Is that right?"

**You say:** "Yes"

> *Agent*: "Great, I've verified your account Rajesh, Trendz Apparel. ✅ [Dashboard: Verified badge appears]"

---

### [0:12–0:25] Concern + Ticket + Data

**You say:** "My sales have dropped a lot this month, I'm worried"

> *Agent logs concern, pulls metrics*: "I've noted your concern and I'm pulling up your numbers now. I can see your sales are down quite significantly this month, though your average selling price is holding steady — so pricing isn't the issue. I also see two other signals..."

> "[Dashboard: Ticket card + Metric cards appear]"

---

### [0:25–0:40] Probe — with Interruption

> *Agent*: "It looks like 18 of your products went out of stock this month, up from 5. And your cancellation rate also went up. Are your top-selling products among the ones that went out of stock?"

**You say:** "Yes, my cotton kurta and denim jacket are both—"

**[DELIBERATE INTERRUPTION — speak over agent if it's talking]**

**You say (interrupting):** "—actually, yes, those are my two best sellers and they've been out of stock for 3 weeks"

> *Agent stops, listens, responds*: "That makes sense. So the main issue is stock-out on your hero products. Is it a supplier delay, or is stock not syncing with Snapdeal?"

**You say:** "It's a supplier delay, should be back in about 7 days"

> *Agent confirms root cause*: "So the main cause is a supplier delay affecting your top products — does that sound right to you?"

**You say:** "Yes exactly"

> "[Dashboard: Root cause card appears — Confirmed ✅]"

---

### [0:40–1:05] Recommendations + Execute Actions

> *Agent proposes plan*: "Based on what you've told me, I have three things. First, I can enable low-stock auto-pause right now — that stops unfulfillable orders and protects your seller rating. Second, restocking those hero items this week is the biggest lever — that's something only you can do. Third, while you restock, I can run a 7-day promotion on your in-stock top sellers — the discount comes from your margin. Want me to go ahead with the auto-pause?"

**You say:** "Yes do the auto-pause"

> *Agent*: "Done — auto-pause is enabled." "[Dashboard: Action card flips to Executed ✅]"

> *Agent*: "And the promotion?"

**You say:** "Yes, run that too"

> *Agent*: "Great, 7-day promotion launched on Floral Maxi Dress, Chino Trousers, and Embroidered Kurti." "[Dashboard: Second action card flips ✅]"

---

### [1:05–1:25] Close + Summary

> *Agent*: "Let me wrap up. The main issue was your 4 hero SKUs going out of stock due to a supplier delay, losing roughly 90 orders. I've enabled auto-pause and launched a promotion. Your next step is to restock those 4 items within 7 days. I'll follow up with you in a week."

> *Agent*: "I'll send you a recap on WhatsApp. Is there anything else I can help with?"

**You say:** "No, that's great, thank you"

> *Agent*: "Take care Rajesh. Good luck with the restock!"

> "[Dashboard: Follow-up chip + Post-call summary panel appear. 'Copy Summary' button visible]"

---

## What to Show During Recording

- Dashboard filling in real-time as agent talks (no manual clicks)
- Action cards flipping from "Pending" to "Executed ✅"
- Interruption: agent stops mid-sentence and listens
- Final summary panel with share button

**Total time target: 85–95 seconds**

