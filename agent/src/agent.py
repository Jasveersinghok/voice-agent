"""
Virtual Key Account Manager (KAM) Voice Agent for Snapdeal Sellers.

A LiveKit Agents-based voice agent that helps sellers diagnose sales drops,
identify root causes, and take corrective actions.
"""

import json
import logging
import os
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    TurnHandlingOptions,
    function_tool,
    get_job_context,
    inference,
    room_io,
)
from livekit.agents.llm.tool_context import ToolFlag
from livekit.plugins import noise_cancellation

# Add parent dir to path so we can import data module
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from data.mock_data import (
    CANCELLATION_REASONS,
    DATA_NOTES,
    EXECUTED_ACTIONS,
    METRICS,
    SELLERS,
    SKU_DATA,
    STORE_NAME_INDEX,
    build_action_plan,
    compute_cancellation_impact,
    compute_gap_analysis,
    compute_metric_changes,
    compute_oos_impact,
    create_ticket,
    execute_action,
    get_top_in_stock_for_promo,
    schedule_followup_entry,
)

load_dotenv()

logger = logging.getLogger("kam-agent")
logger.setLevel(logging.INFO)

# Load system prompt
PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "kam_system_prompt.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else "You are a helpful Snapdeal account manager."

# Session state
SESSION_STATE = {
    "verified_seller_id": None,
    "verify_attempts": 0,
    "ticket_id": None,
    "root_cause_confirmed": False,
    "actions_proposed": [],
    "actions_executed": [],
    "silence_count": 0,
}


def reset_state():
    """Reset session state for a new call."""
    SESSION_STATE.update({
        "verified_seller_id": None,
        "verify_attempts": 0,
        "ticket_id": None,
        "root_cause_confirmed": False,
        "actions_proposed": [],
        "actions_executed": [],
        "silence_count": 0,
    })


async def push_to_frontend(event_type: str, data: dict):
    """Push event to frontend via data packet on 'kam_dashboard' topic."""
    try:
        ctx = get_job_context()
        payload = json.dumps({"type": event_type, "data": data})
        await ctx.room.local_participant.publish_data(
            payload,
            reliable=True,
            topic="kam_dashboard",
        )
        logger.info(f"Pushed to frontend: {event_type}")
    except Exception as e:
        logger.warning(f"Failed to push to frontend: {e}")


class KAMAgent(Agent):
    """Snapdeal Virtual Key Account Manager agent."""

    def __init__(self):
        super().__init__(instructions=SYSTEM_PROMPT)

    async def on_enter(self):
        """Greet the seller when the call starts."""
        self.session.generate_reply(
            instructions="Greet the seller warmly. Say you are the Snapdeal KAM Assistant and ask for their Seller ID or store name to get started."
        )

    # ─── TOOL 1: Verify Seller Identity ───────────────────────────────
    @function_tool()
    async def verify_seller_identity(
        self,
        context: RunContext,
        seller_id: str = "",
        store_name: str = "",
    ) -> dict:
        """Verify a seller's identity using their Seller ID or store name.
        Call this after the seller provides their ID or store name.
        Returns the seller's profile and baseline info, or an error if not found.

        Args:
            seller_id: The seller's ID (e.g., "SD-402"). Try this first.
            store_name: The seller's store name as a fallback lookup.
        """
        sid = seller_id.strip().upper() if seller_id else ""
        sname = store_name.strip().lower() if store_name else ""

        # Try seller_id first
        if sid and sid in SELLERS:
            SESSION_STATE["verified_seller_id"] = sid
            SESSION_STATE["verify_attempts"] = 0
            profile = SELLERS[sid].copy()
            await push_to_frontend("seller_verified", profile)
            return {
                "status": "verified",
                "profile": profile,
                "data_notes": DATA_NOTES["assumptions"][0:2],
            }

        # Try store name lookup
        if sname and sname in STORE_NAME_INDEX:
            sid = STORE_NAME_INDEX[sname]
            SESSION_STATE["verified_seller_id"] = sid
            SESSION_STATE["verify_attempts"] = 0
            profile = SELLERS[sid].copy()
            await push_to_frontend("seller_verified", profile)
            return {
                "status": "verified",
                "profile": profile,
                "data_notes": DATA_NOTES["assumptions"][0:2],
            }

        # Not found
        SESSION_STATE["verify_attempts"] += 1
        attempts = SESSION_STATE["verify_attempts"]
        if attempts >= 3:
            return {
                "status": "error",
                "message": "Could not verify seller after multiple attempts. Please escalate to a human agent.",
                "attempts": attempts,
            }
        return {
            "status": "not_found",
            "message": f"No seller found with ID '{seller_id}' or store name '{store_name}'. Ask the seller to try again.",
            "attempts": attempts,
        }

    # ─── TOOL 2: Log Seller Concern ───────────────────────────────────
    @function_tool()
    async def log_seller_concern(
        self,
        context: RunContext,
        issue: str,
        category: str,
    ) -> dict:
        """Log a seller's concern and create a support ticket.
        Call this after the seller describes their problem.

        Args:
            issue: Brief description of the seller's concern.
            category: Category like 'sales_drop', 'payments', 'listing', 'returns', 'other'.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        sid = SESSION_STATE["verified_seller_id"]
        ticket = create_ticket(sid, issue, category)
        SESSION_STATE["ticket_id"] = ticket["ticket_id"]
        await push_to_frontend("ticket_created", ticket)
        return ticket

    # ─── TOOL 3: Get Metrics ──────────────────────────────────────────
    @function_tool()
    async def get_metrics(
        self,
        context: RunContext,
        section: str = "all",
    ) -> dict:
        """Get the seller's performance metrics comparing last month to this month.
        Returns computed changes for sales, orders, cancellations, ASP, out-of-stock, returns.
        Call this to understand the seller's current situation.

        Args:
            section: Which metrics to return. Use 'all' for everything, or 'sales', 'cancellations', 'stock'.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        sid = SESSION_STATE["verified_seller_id"]
        changes = compute_metric_changes(sid)
        cancellation_impact = compute_cancellation_impact(sid)
        gap = compute_gap_analysis(sid)

        result = {
            "status": "success",
            "seller_id": sid,
            "metrics": changes,
            "cancellation_breakdown": cancellation_impact,
            "gap_analysis": gap,
        }
        await push_to_frontend("metrics_loaded", result)
        return result

    # ─── TOOL 4: Get SKU Stock ────────────────────────────────────────
    @function_tool()
    async def get_sku_stock(
        self,
        context: RunContext,
        filter: str = "out_of_stock",
    ) -> dict:
        """Get stock information for the seller's SKUs.
        Shows which products are out of stock and their impact on lost orders.

        Args:
            filter: Filter type. 'out_of_stock' for OOS items, 'hero' for hero products only, 'in_stock' for available items, 'all' for everything.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        sid = SESSION_STATE["verified_seller_id"]
        oos_data = compute_oos_impact(sid, filter_type=filter if filter in ("hero", "all") else "all")

        if filter == "in_stock":
            in_stock = [s for s in SKU_DATA.get(sid, []) if s["status"] == "in_stock"]
            return {"status": "success", "in_stock_items": in_stock, "count": len(in_stock)}

        result = {
            "status": "success",
            "oos_data": oos_data,
        }
        await push_to_frontend("sku_data_loaded", result)
        return result

    # ─── TOOL 5: Mark Root Cause ──────────────────────────────────────
    @function_tool()
    async def mark_root_cause(
        self,
        context: RunContext,
        cause_title: str,
        evidence: str,
        confirmed_by_seller: bool,
    ) -> dict:
        """Mark the identified root cause for the seller's issue.
        IMPORTANT: Only call this AFTER the seller explicitly confirms the cause.
        The confirmed_by_seller parameter MUST be true.

        Args:
            cause_title: Short title of the root cause (e.g., "Hero SKUs out of stock due to supplier delay").
            evidence: Evidence supporting this cause from data and seller input.
            confirmed_by_seller: MUST be true. Set to true only after the seller verbally confirms the cause.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        if not confirmed_by_seller:
            return {
                "status": "error",
                "message": "Cannot mark root cause without seller confirmation. Ask the seller to confirm the cause first.",
            }

        sid = SESSION_STATE["verified_seller_id"]
        gap = compute_gap_analysis(sid)
        SESSION_STATE["root_cause_confirmed"] = True

        result = {
            "status": "confirmed",
            "cause_title": cause_title,
            "evidence": evidence,
            "impact": gap,
            "data_notes": "Impact computed from SKU-level data, not hardcoded.",
        }
        await push_to_frontend("root_cause_confirmed", result)
        return result

    # ─── TOOL 6: Propose Action Plan ──────────────────────────────────
    @function_tool()
    async def propose_action_plan(
        self,
        context: RunContext,
        restock_eta_days: int,
        supplier_issue: bool,
        stock_sync_issue: bool,
        dispatch_delay_issue: bool,
        accepts_promo: bool,
    ) -> dict:
        """Generate a prioritized action plan based on the seller's situation and answers.
        The plan changes based on the seller's inputs. Call this after probing questions.

        Args:
            restock_eta_days: How many days until the seller can restock. Use 0 if unknown.
            supplier_issue: True if seller confirmed a supplier delay.
            stock_sync_issue: True if seller's stock is not syncing properly with Snapdeal.
            dispatch_delay_issue: True if seller has dispatch delay issues.
            accepts_promo: True if seller is open to running a promotion on in-stock items.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        sid = SESSION_STATE["verified_seller_id"]
        plan = build_action_plan(
            sid,
            restock_eta_days=restock_eta_days,
            supplier_issue=supplier_issue,
            stock_sync_issue=stock_sync_issue,
            dispatch_delay_issue=dispatch_delay_issue,
            accepts_promo=accepts_promo,
        )
        SESSION_STATE["actions_proposed"] = plan

        result = {
            "status": "success",
            "actions": plan,
            "note": "Present these to the seller one at a time. Ask permission before executing agent actions.",
        }
        await push_to_frontend("action_plan_proposed", result)
        return result

    # ─── TOOL 7: Execute KAM Action ──────────────────────────────────
    @function_tool()
    async def execute_kam_action(
        self,
        context: RunContext,
        action_id: str,
        seller_consented: bool,
    ) -> dict:
        """Execute a specific action from the proposed plan.
        IMPORTANT: Only call this AFTER the seller gives explicit consent.
        seller_consented MUST be true.

        Args:
            action_id: The ID of the action to execute (from the proposed plan).
            seller_consented: MUST be true. Set to true only after the seller agrees to this action.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        if not seller_consented:
            return {
                "status": "error",
                "message": "Cannot execute action without seller consent. Ask the seller for permission first.",
            }

        sid = SESSION_STATE["verified_seller_id"]
        # Check action exists in proposed plan
        proposed_ids = [a["action_id"] for a in SESSION_STATE.get("actions_proposed", [])]
        if action_id not in proposed_ids:
            return {"status": "error", "message": f"Action '{action_id}' not found in the proposed plan."}

        result = execute_action(sid, action_id)
        if result["status"] == "success":
            SESSION_STATE["actions_executed"].append(action_id)

        await push_to_frontend("action_executed", result)
        return result

    # ─── TOOL 8: Schedule Follow-up ───────────────────────────────────
    @function_tool()
    async def schedule_followup(
        self,
        context: RunContext,
        days: int,
        topic: str,
    ) -> dict:
        """Schedule a follow-up call with the seller.

        Args:
            days: Number of days from now for the follow-up (e.g., 3, 5, 7).
            topic: What the follow-up is about (e.g., "Check restock status and sales recovery").
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        sid = SESSION_STATE["verified_seller_id"]
        result = schedule_followup_entry(sid, days, topic)
        await push_to_frontend("followup_scheduled", result)
        return result

    # ─── TOOL 9: Send Recap ───────────────────────────────────────────
    @function_tool()
    async def send_recap(
        self,
        context: RunContext,
        channel: str = "whatsapp",
    ) -> dict:
        """Send a summary recap to the seller via WhatsApp or SMS (simulated).

        Args:
            channel: The channel to send on. Options: 'whatsapp' or 'sms'.
        """
        if not SESSION_STATE["verified_seller_id"]:
            return {"status": "error", "message": "Seller not verified yet. Verify the seller first."}

        sid = SESSION_STATE["verified_seller_id"]
        result = {
            "status": "sent",
            "channel": channel,
            "seller_id": sid,
            "message": f"Recap sent via {channel} to seller {sid}.",
            "simulated": True,
        }
        await push_to_frontend("recap_sent", result)
        return result

    # ─── TOOL 10: Escalate to Human ───────────────────────────────────
    @function_tool()
    async def escalate_to_human(
        self,
        context: RunContext,
        reason: str,
        summary: str,
    ) -> dict:
        """Hand off the call to a human agent with a summary.
        Use when the issue is outside your capabilities or the seller requests a human.

        Args:
            reason: Why escalation is needed (e.g., "Seller requested human agent", "Payment issue outside scope").
            summary: Brief summary of the conversation so far for the human agent.
        """
        result = {
            "status": "escalated",
            "reason": reason,
            "summary": summary,
            "seller_id": SESSION_STATE.get("verified_seller_id", "unknown"),
            "ticket_id": SESSION_STATE.get("ticket_id"),
            "simulated": True,
        }
        await push_to_frontend("escalated", result)
        return result

    # ─── TOOL 11: Render Call Summary ─────────────────────────────────
    @function_tool()
    async def render_call_summary(
        self,
        context: RunContext,
        key_issues: str,
        actions_taken: str,
        next_steps: str,
    ) -> dict:
        """Create a structured call summary for the dashboard.
        Call this near the end of the conversation.

        Args:
            key_issues: Comma-separated list of key issues identified.
            actions_taken: Comma-separated list of actions taken during the call.
            next_steps: Comma-separated list of next steps for the seller.
        """
        result = {
            "status": "rendered",
            "seller_id": SESSION_STATE.get("verified_seller_id", "unknown"),
            "key_issues": [i.strip() for i in key_issues.split(",")],
            "actions_taken": [a.strip() for a in actions_taken.split(",")],
            "next_steps": [s.strip() for s in next_steps.split(",")],
            "ticket_id": SESSION_STATE.get("ticket_id"),
        }
        await push_to_frontend("call_summary", result)
        return result

    # ─── TOOL 12: End Call ────────────────────────────────────────────
    @function_tool()
    async def end_call(
        self,
        context: RunContext,
        reason: str = "completed",
    ) -> dict:
        """End the current call session.
        Call this after the conversation is complete and all wrap-up steps are done.

        Args:
            reason: Why the call is ending. Options: 'completed', 'escalated', 'seller_requested', 'inactivity'.
        """
        result = {
            "status": "ended",
            "reason": reason,
            "seller_id": SESSION_STATE.get("verified_seller_id", "unknown"),
        }
        await push_to_frontend("call_ended", result)
        return result


# ─── Agent Server + Entrypoint ───────────────────────────────────────
server = AgentServer()


@server.rtc_session(agent_name="kam-agent")
async def entrypoint(ctx: JobContext):
    """Main entrypoint for the KAM agent."""
    reset_state()

    # Read model config from environment with defaults
    stt_model = os.getenv("STT_MODEL", "deepgram/flux-general")
    stt_lang = os.getenv("STT_LANGUAGE", "en")
    llm_model = os.getenv("LLM_MODEL", "google/gemma-4-31b-it")
    tts_model = os.getenv("TTS_MODEL", "cartesia/sonic-2")
    # Default to Cartesia Indian female voice: Simi (3b554273-4299-48b9-9aaf-eefd438e3941)
    tts_voice = os.getenv("TTS_VOICE", "3b554273-4299-48b9-9aaf-eefd438e3941").strip()
    if tts_voice.lower() in ("none", "") or tts_voice == "f786b574-dff5-4688-aa82-0776e22b7c34":
        tts_voice = "3b554273-4299-48b9-9aaf-eefd438e3941"

    tts_kwargs = {"model": tts_model, "voice": tts_voice}

    session = AgentSession(
        stt=inference.STT(model=stt_model, language=stt_lang),
        llm=inference.LLM(model=llm_model),
        tts=inference.TTS(**tts_kwargs),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
        max_tool_steps=5,
        user_away_timeout=15.0,
    )

    # Handle user inactivity (silence)
    inactivity_task: asyncio.Task | None = None

    async def check_if_user_present():
        nonlocal inactivity_task
        SESSION_STATE["silence_count"] += 1
        if SESSION_STATE["silence_count"] == 1:
            await session.generate_reply(
                instructions="The user has been silent. Gently check in: 'Are you still there? Take your time.'"
            )
            await asyncio.sleep(15)
        if SESSION_STATE["silence_count"] >= 2:
            await session.generate_reply(
                instructions="The user has been silent again. Offer to schedule a callback and end politely: 'It seems like you might be busy. I can schedule a follow-up call if you prefer. Take care!'"
            )
            session.shutdown()

    @session.on("user_state_changed")
    def on_user_state_changed(event):
        nonlocal inactivity_task
        if event.new_state == "away":
            inactivity_task = asyncio.create_task(check_if_user_present())
        else:
            SESSION_STATE["silence_count"] = 0
            if inactivity_task and not inactivity_task.done():
                inactivity_task.cancel()
                inactivity_task = None

    # Start the session
    await session.start(
        room=ctx.room,
        agent=KAMAgent(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )



if __name__ == "__main__":
    from livekit.agents.cli import run_app
    run_app(server)
