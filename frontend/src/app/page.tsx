"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant } from "livekit-client";

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================

type CallState = "idle" | "connecting" | "connected" | "ended";

interface SellerProfile {
  seller_id: string;
  name?: string;
  owner_name?: string;
  store_name: string;
  category: string;
  tier: string;
  joined?: string;
  joined_date?: string;
  active_skus?: number;
  phone?: string;
  email?: string;
  city?: string;
  fulfillment_model?: string;
  account_manager?: string;
}

interface SupportTicket {
  ticket_id: string;
  seller_id: string;
  issue: string;
  category: string;
  status?: string;
  priority?: string;
  created_at?: string;
}

interface MetricItem {
  last_month: number;
  this_month: number;
  change_pct?: number;
  change_abs?: number;
  formatted_last?: string;
  formatted_this?: string;
}

interface MetricsPayload {
  seller_id?: string;
  metrics: {
    sales?: MetricItem;
    orders?: MetricItem;
    cancellations?: MetricItem & { last_month_rate?: number; this_month_rate?: number };
    cancellation_rate?: MetricItem;
    asp?: MetricItem;
    oos_skus?: MetricItem;
    out_of_stock_count?: MetricItem;
    returns?: MetricItem;
  };
  cancellation_breakdown?: {
    total_cancelled?: number;
    seller_cancelled?: number;
    buyer_cancelled?: number;
    primary_reason?: string;
    extra_cancelled_orders?: number;
    reasons_breakdown?: Record<
      string,
      {
        percentage: number;
        estimated_lost_orders: number;
        estimated_lost_revenue: number;
      }
    >;
  };
  gap_analysis?: {
    sales_drop_value?: number;
    sales_drop_pct?: number;
    orders_drop?: number;
    oos_revenue_impact?: number;
    cancellation_revenue_impact?: number;
    unexplained_gap?: number;
    primary_driver?: string;
    secondary_driver?: string;
    components?: any;
    total_gap?: any;
  };
}

interface RootCausePayload {
  status?: string;
  cause_title: string;
  evidence: string;
  impact?: {
    total_gap?: { orders?: number; revenue?: number };
    components?: {
      oos_hero_impact?: { orders?: number; revenue?: number; percentage_of_revenue?: number };
      cancellation_impact?: { orders?: number; revenue?: number; percentage_of_revenue?: number };
      visibility_and_demand_gap?: { orders?: number; revenue?: number };
    };
    sales_drop_value?: number;
    sales_drop_pct?: number;
    oos_revenue_impact?: number;
    cancellation_revenue_impact?: number;
    primary_driver?: string;
    secondary_driver?: string;
  };
  data_notes?: string;
}

interface ActionPlanItem {
  action_id: string;
  title: string;
  description: string;
  effort?: string;
  timeline?: string;
  estimated_impact?: string;
  type: "agent_action" | "seller_action" | string;
  executable?: boolean;
  status?: "pending" | "executed";
  executed_at?: string;
  execution_detail?: string;
}

interface FollowupPayload {
  seller_id?: string;
  followup_date?: string;
  days_from_now?: number;
  days?: number;
  topic?: string;
  calendar_entry?: string;
}

interface CallSummaryPayload {
  seller_id: string;
  ticket_id?: string;
  key_issues: string[];
  actions_taken: string[];
  next_steps: string[];
}

interface TranscriptEntry {
  id: string;
  role: "agent" | "user" | "system";
  text: string;
  time: string;
}

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================

export default function KAMDashboardPage() {
  // Call & Connection State
  const [callState, setCallState] = useState<CallState>("idle");
  const [roomName, setRoomName] = useState<string>("");
  const [sellerIdInput, setSellerIdInput] = useState<string>("SD-402");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [manualInput, setManualInput] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dashboard Data States (Populated via kam_dashboard topic)
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [rootCause, setRootCause] = useState<RootCausePayload | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlanItem[]>([]);
  const [followup, setFollowup] = useState<FollowupPayload | null>(null);
  const [callSummary, setCallSummary] = useState<CallSummaryPayload | null>(null);
  const [recapNotification, setRecapNotification] = useState<string | null>(null);
  const [escalationNotice, setEscalationNotice] = useState<string | null>(null);

  // Transcript State
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "initial-system",
      role: "system",
      text: "System initialized. Click 'Start Call' or 'Demo Mode' to begin the diagnostic session with the Snapdeal Virtual KAM Assistant.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // LiveKit Refs
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Call duration timer
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Add message to transcript
  const addTranscript = useCallback((role: "agent" | "user" | "system", text: string) => {
    if (!text || text.trim() === "") return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setTranscript((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role,
        text,
        time,
      },
    ]);
  }, []);

  // Update or append transcript segment
  const handleTranscriptionSegment = useCallback(
    (segmentId: string, role: "agent" | "user", text: string, isFinal: boolean) => {
      if (!text || text.trim() === "") return;
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setTranscript((prev) => {
        const existingIdx = prev.findIndex((m) => m.id === segmentId);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            text,
            role,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              id: segmentId,
              role,
              text,
              time,
            },
          ];
        }
      });
    },
    []
  );

  // Route event from 'kam_dashboard' data packets
  const handleDashboardEvent = useCallback(
    (eventType: string, data: any) => {
      console.log(`[KAM Event Received]: ${eventType}`, data);

      switch (eventType) {
        case "seller_verified": {
          setSellerProfile(data);
          addTranscript(
            "system",
            `✓ Seller identity verified: ${data.name || data.owner_name || "Seller"} (${data.store_name}) - Tier: ${data.tier}`
          );
          showToast(`Seller ${data.seller_id} Verified Successfully`);
          break;
        }
        case "ticket_created": {
          setTicket(data);
          addTranscript("system", `📋 Support Ticket Created: ${data.ticket_id} (${data.category})`);
          showToast(`Support Ticket ${data.ticket_id} Logged`);
          break;
        }
        case "metrics_loaded": {
          setMetrics(data);
          addTranscript("system", `📊 Diagnostic metrics loaded for Seller ${data.seller_id || "SD-402"}.`);
          showToast("Performance Metrics & Gap Analysis Loaded");
          break;
        }
        case "sku_data_loaded": {
          // SKU data processed
          break;
        }
        case "root_cause_confirmed": {
          setRootCause(data);
          addTranscript("system", `🎯 Root Cause Confirmed: ${data.cause_title}`);
          showToast("Root Cause Confirmed & Correlated with Metrics");
          break;
        }
        case "action_plan_proposed": {
          const actions = Array.isArray(data.actions) ? data.actions : [];
          setActionPlan(
            actions.map((act: any) => ({
              ...act,
              status: act.status || "pending",
            }))
          );
          addTranscript("system", `⚡ Corrective Action Plan generated (${actions.length} prioritized actions).`);
          showToast(`Generated ${actions.length} Strategic Actions`);
          break;
        }
        case "action_executed": {
          const actionId = data.action_id;
          setActionPlan((prev) =>
            prev.map((act) =>
              act.action_id === actionId
                ? {
                    ...act,
                    status: "executed",
                    executed_at: data.executed_at || new Date().toISOString(),
                    execution_detail: data.detail || data.action_name,
                  }
                : act
            )
          );
          addTranscript("system", `✅ Action Executed: ${data.action_name || actionId} - ${data.detail || "Success"}`);
          showToast(`Action ${actionId} Executed!`);
          break;
        }
        case "followup_scheduled": {
          setFollowup(data);
          addTranscript(
            "system",
            `📅 Follow-up Call Scheduled in ${data.days_from_now || data.days} days: ${data.topic || "Review status"}`
          );
          showToast("Follow-up Call Scheduled");
          break;
        }
        case "recap_sent": {
          setRecapNotification(data.message || `Recap sent via ${data.channel}`);
          addTranscript("system", `📲 Recap Sent via ${data.channel?.toUpperCase() || "WHATSAPP"}`);
          showToast(`Recap Sent via ${data.channel?.toUpperCase()}`);
          break;
        }
        case "escalated": {
          setEscalationNotice(`Handed off to Tier-2: ${data.reason}`);
          addTranscript("system", `⚠️ Call Escalated: ${data.reason} (${data.summary})`);
          showToast("Call Escalated to Human Support");
          break;
        }
        case "call_summary": {
          setCallSummary(data);
          addTranscript("system", `📄 Structured Call Summary generated.`);
          showToast("Call Summary Generated");
          break;
        }
        case "call_ended": {
          setCallState("ended");
          addTranscript("system", `⏹️ Call session ended (${data.reason || "completed"}).`);
          showToast("Session Ended");
          break;
        }
        default:
          console.log("Unhandled event type:", eventType, data);
      }
    },
    [addTranscript]
  );

  // Connect to LiveKit Room
  const startCall = async (prefillSellerId?: string) => {
    try {
      const targetSellerId = prefillSellerId || sellerIdInput || "SD-402";
      setCallState("connecting");
      addTranscript("system", `Requesting session token for Seller ${targetSellerId}...`);

      const resp = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: `seller-${targetSellerId.toLowerCase()}-${Date.now().toString().slice(-4)}`,
          agentName: "kam-agent",
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${resp.status}`);
      }

      const { token, url, roomName: returnedRoomName } = await resp.json();
      setRoomName(returnedRoomName);
      addTranscript("system", `Connecting to LiveKit room: ${returnedRoomName}...`);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      roomRef.current = room;

      // Handle remote audio playback
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.autoplay = true;
          audioElement.play().catch((e) => {
            console.warn("Autoplay blocked, starting audio context:", e);
            room.startAudio();
          });
          if (audioContainerRef.current) {
            audioContainerRef.current.appendChild(audioElement);
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
      });

      // Handle speaking state indicators
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const isAgentTalking = speakers.some((s) => s.identity.includes("agent") || !s.isLocal);
        const isLocalTalking = speakers.some((s) => s.isLocal);
        setIsAgentSpeaking(isAgentTalking);
        setIsUserSpeaking(isLocalTalking);
      });

      // Handle Data Packets on 'kam_dashboard' and 'lk-transcription'
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant, kind, topic) => {
        try {
          const text = new TextDecoder().decode(payload);
          if (topic === "kam_dashboard") {
            const parsed = JSON.parse(text);
            handleDashboardEvent(parsed.type, parsed.data);
          } else if (topic === "lk-transcription") {
            const parsed = JSON.parse(text);
            const role = participant?.isLocal ? "user" : "agent";
            addTranscript(role, parsed.text || text);
          }
        } catch (err) {
          console.warn("Failed to process data packet:", err);
        }
      });

      // Handle Transcription Events
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        for (const segment of segments) {
          const role = participant?.isLocal ? "user" : "agent";
          handleTranscriptionSegment(segment.id, role, segment.text, segment.final);
        }
      });

      // Handle Disconnection
      room.on(RoomEvent.Disconnected, () => {
        setCallState("ended");
        addTranscript("system", "Disconnected from LiveKit room.");
      });

      // Connect and activate mic
      await room.connect(url, token);
      await room.startAudio().catch(() => {});
      await room.localParticipant.setMicrophoneEnabled(true);

      setCallState("connected");
      setIsMuted(false);
      addTranscript("system", "Connected! Speaking and audio channel active.");
      showToast("Live Call Connected with Virtual KAM");
    } catch (err: any) {
      console.error("LiveKit connection failure:", err);
      setCallState("idle");
      addTranscript("system", `⚠️ Connection failed: ${err.message || "Unknown error"}. Check LiveKit credentials.`);
      showToast("Connection failed. Check console.");
    }
  };

  // Toggle Mute
  const toggleMute = async () => {
    if (roomRef.current && roomRef.current.localParticipant) {
      const nextMuted = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      showToast(nextMuted ? "Microphone Muted" : "Microphone Active");
    }
  };

  // End Call
  const endCall = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setCallState("ended");
    showToast("Call Ended");
  };

  // Restart / Reset
  const resetAll = () => {
    endCall();
    setSellerProfile(null);
    setTicket(null);
    setMetrics(null);
    setRootCause(null);
    setActionPlan([]);
    setFollowup(null);
    setCallSummary(null);
    setRecapNotification(null);
    setEscalationNotice(null);
    setCallDuration(0);
    setCallState("idle");
    setTranscript([
      {
        id: "reset-system",
        role: "system",
        text: "Session reset. Ready to start new Virtual KAM call.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Demo Mode: Pre-fill SD-402 and auto-start call
  const startDemoMode = () => {
    setSellerIdInput("SD-402");
    startCall("SD-402");
  };

  // Manual speech / chat submission (for bulletproof demo resilience)
  const sendManualMessage = async (textToSend?: string) => {
    const text = textToSend || manualInput;
    if (!text.trim()) return;

    addTranscript("user", text.trim());
    setManualInput("");

    if (roomRef.current && roomRef.current.localParticipant) {
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            text: text.trim(),
            timestamp: Date.now(),
            seller_id: sellerIdInput,
          })
        );
        await roomRef.current.localParticipant.publishData(payload, {
          reliable: true,
          topic: "lk-transcription",
        });
      } catch (e) {
        console.warn("Failed to publish user transcript data packet:", e);
      }
    }
  };

  // Step-by-Step Simulated Walkthrough (Allows testing all dashboard cards instantly)
  const simulateWalkthrough = () => {
    setCallState("connected");

    // 1. Seller Verified
    setTimeout(() => {
      handleDashboardEvent("seller_verified", {
        seller_id: "SD-402",
        name: "Rajesh Kumar",
        owner_name: "Rajesh",
        store_name: "Trendz Apparel",
        category: "Apparel & Ethnic Wear",
        tier: "Silver Tier",
        active_skus: 60,
        joined_date: "2022-03-15",
        phone: "+91-98765-43210",
        email: "rajesh@trendzapparel.in",
        city: "Jaipur, Rajasthan",
        fulfillment_model: "Snapdeal Plus (Fulfilled by Snapdeal)",
      });
      addTranscript("user", "Hello, my Seller ID is SD-402 from Trendz Apparel.");
      addTranscript(
        "agent",
        "Hello Rajesh! Welcome back. I have located your Trendz Apparel account. How can I assist you with your store today?"
      );
    }, 600);

    // 2. Ticket Created
    setTimeout(() => {
      handleDashboardEvent("ticket_created", {
        ticket_id: "TKT-" + Math.floor(100000 + Math.random() * 900000),
        seller_id: "SD-402",
        issue: "Sudden 32.5% sales drop over the last 30 days and increased customer cancellations",
        category: "sales_drop",
        status: "open",
        priority: "High Priority",
        created_at: new Date().toLocaleTimeString(),
      });
      addTranscript("user", "We noticed our sales have dropped heavily this month and orders are going down.");
      addTranscript(
        "agent",
        "I understand your concern. Let me immediately log Ticket TKT-849201 and pull your comprehensive store metrics to diagnose the root cause."
      );
    }, 1800);

    // 3. Metrics Loaded
    setTimeout(() => {
      handleDashboardEvent("metrics_loaded", {
        status: "success",
        seller_id: "SD-402",
        metrics: {
          sales: {
            last_month: 200000,
            this_month: 135000,
            change_abs: -65000,
            change_pct: -32.5,
            formatted_last: "₹2,00,000",
            formatted_this: "₹1,35,000",
          },
          orders: {
            last_month: 400,
            this_month: 270,
            change_abs: -130,
            change_pct: -32.5,
          },
          cancellations: {
            last_month: 32,
            this_month: 38,
            last_month_rate: 8.0,
            this_month_rate: 14.0,
            change_pct: 75.0,
          },
          cancellation_rate: {
            last_month: 8.0,
            this_month: 14.0,
            change_pct: 75.0,
          },
          oos_skus: {
            last_month: 5,
            this_month: 18,
            change_pct: 260.0,
          },
          out_of_stock_count: {
            last_month: 5,
            this_month: 18,
            change_pct: 260.0,
          },
        },
        cancellation_breakdown: {
          total_cancelled: 38,
          seller_cancelled: 24,
          buyer_cancelled: 14,
          primary_reason: "Seller: Out of stock inventory sync delay",
          extra_cancelled_orders: 16,
          reasons_breakdown: {
            "Stock unavailable": { percentage: 60, estimated_lost_orders: 10, estimated_lost_revenue: 4800 },
            "Late dispatch": { percentage: 30, estimated_lost_orders: 5, estimated_lost_revenue: 2400 },
            "Customer request": { percentage: 10, estimated_lost_orders: 1, estimated_lost_revenue: 500 },
          },
        },
        gap_analysis: {
          sales_drop_value: 65000,
          sales_drop_pct: -32.5,
          orders_drop: 130,
          oos_revenue_impact: 45000,
          cancellation_revenue_impact: 7700,
          unexplained_gap: 12300,
          primary_driver: "Out-of-stock on 4 hero SKUs accounts for ~69.2% of the missing sales",
          secondary_driver: "Spike in seller-side cancellations from 8% to 14% (~11.8% of missing sales)",
        },
      });
      addTranscript(
        "agent",
        "Looking at your numbers, your sales dropped from ₹2,00,000 to ₹1,35,000. The primary driver is that 4 of your top hero SKUs went out of stock, causing 90 lost orders and ₹45,000 in missed revenue. Additionally, cancellations jumped from 8% to 14% due to delayed stock sync."
      );
    }, 3200);

    // 4. Root Cause Confirmed
    setTimeout(() => {
      handleDashboardEvent("root_cause_confirmed", {
        status: "confirmed",
        cause_title: "Hero SKUs out of stock due to fabric supplier delay & unpaused listings",
        evidence:
          "4 hero SKUs (Cotton Kurta Set, Denim Jacket, Printed Palazzo, Linen Shirt) lost 90 orders worth ₹45,000. Seller confirmed fabric shipment was delayed by 6 days.",
        impact: {
          total_gap: { orders: 130, revenue: 65000 },
          components: {
            oos_hero_impact: { orders: 90, revenue: 45000, percentage_of_revenue: 69.2 },
            cancellation_impact: { orders: 16, revenue: 7700, percentage_of_revenue: 11.8 },
            visibility_and_demand_gap: { orders: 24, revenue: 12300 },
          },
          primary_driver: "Out-of-stock on Hero SKUs (Cotton Kurta Set, Denim Jacket, Printed Palazzo)",
          secondary_driver: "Inventory sync lag triggering auto-cancellations",
        },
      });
      addTranscript("user", "Yes, exactly! Our fabric supplier in Sanganer had a machine breakdown and delayed delivery.");
      addTranscript(
        "agent",
        "Thank you for confirming that, Rajesh. I have locked in the root cause and built a tailored 3-step action recovery plan."
      );
    }, 4600);

    // 5. Action Plan Proposed
    setTimeout(() => {
      handleDashboardEvent("action_plan_proposed", {
        status: "success",
        actions: [
          {
            action_id: "ACT-AUTO-PAUSE",
            title: "Enable Low-Stock Auto-Pause",
            description:
              "Automatically pause product listings when inventory falls below 2 units to prevent unfulfillable orders and cancellation penalties.",
            effort: "Immediate (1-click)",
            timeline: "Today",
            estimated_impact: "Prevents ~10 cancellations (~₹4,800 saved) & protects seller rating",
            type: "agent_action",
            executable: true,
            status: "pending",
          },
          {
            action_id: "ACT-RESTOCK-HERO",
            title: "Priority Restock of 4 Hero SKUs",
            description:
              "Replenish top 4 hero SKUs (Cotton Kurta, Denim Jacket, Printed Palazzo, Linen Shirt) with supplier within 7 days.",
            effort: "Medium (Seller Action)",
            timeline: "This Week",
            estimated_impact: "Recovers ~90 lost orders (~₹45,000/month) upon arrival",
            type: "seller_action",
            executable: false,
            status: "pending",
          },
          {
            action_id: "ACT-PROMO-INSTOCK",
            title: "7-Day Flash Promotion on In-Stock SKUs",
            description:
              "Feature top 3 in-stock items (Floral Maxi Dress, Chino Trousers, Embroidered Kurti) on category banner with 5% boost.",
            effort: "Immediate (1-click)",
            timeline: "Today",
            estimated_impact: "Generates 20-30 incremental orders (~₹12,000 revenue) while restock is pending",
            type: "agent_action",
            executable: true,
            status: "pending",
          },
        ],
      });
      addTranscript(
        "agent",
        "I have prepared three immediate actions: First, I can enable low-stock auto-pause right now to stop unfulfillable orders. May I have your permission to execute that?"
      );
    }, 6000);

    // 6. Action Executed
    setTimeout(() => {
      handleDashboardEvent("action_executed", {
        action_id: "ACT-AUTO-PAUSE",
        action_name: "Enable Low-Stock Auto-Pause",
        detail: "Low-stock threshold set to 2 units on Snapdeal Plus panel. Unfulfillable order prevention activated.",
        status: "success",
        executed_at: new Date().toLocaleTimeString(),
      });
      addTranscript("user", "Yes please, go ahead and enable auto-pause!");
      addTranscript(
        "agent",
        "Done! Low-stock auto-pause is now live on your account. I have also marked your hero SKUs for priority supplier restock."
      );
    }, 7400);

    // 7. Follow-up Scheduled & Recap
    setTimeout(() => {
      handleDashboardEvent("followup_scheduled", {
        seller_id: "SD-402",
        days_from_now: 5,
        days: 5,
        followup_date: new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        topic: "Check supplier fabric delivery status and monitor cancellation recovery",
        calendar_entry: "CAL-SD402-RESTOCK-CHECK",
      });
      handleDashboardEvent("recap_sent", {
        channel: "WhatsApp",
        message: "Summary checklist and ticket details dispatched to Rajesh (+91-98765-43210).",
      });
      addTranscript(
        "agent",
        "I have scheduled a follow-up call with you in 5 days to ensure the fabric arrived and check your restock progress."
      );
    }, 8800);

    // 8. Call Summary
    setTimeout(() => {
      handleDashboardEvent("call_summary", {
        seller_id: "SD-402",
        ticket_id: "TKT-849201",
        key_issues: [
          "Sales decreased by 32.5% (₹65,000 drop) driven by 4 hero SKUs running out of stock.",
          "Cancellation rate rose from 8.0% to 14.0% due to stock sync delays from supplier fabric shortage.",
          "Lost ~90 orders totaling ₹45,000 on core listings.",
        ],
        actions_taken: [
          "Logged High-Priority Ticket TKT-849201 for seller Rajesh Kumar.",
          "Executed Low-Stock Auto-Pause (threshold: 2 units) to eliminate out-of-stock buyer cancellations.",
          "Dispatched instant WhatsApp recap containing SKU restock checklist.",
        ],
        next_steps: [
          "Seller to expedite fabric delivery with Sanganer textile supplier by Thursday.",
          "Replenish minimum 30 units each for Cotton Kurta, Denim Jacket, and Printed Palazzo.",
          "Virtual KAM automated follow-up call scheduled in 5 days for recovery verification.",
        ],
      });
      addTranscript(
        "agent",
        "Here is your complete resolution summary. You can copy or download it directly from your dashboard. Thank you for partnering with Snapdeal, and have a wonderful day!"
      );
    }, 10200);
  };

  // Copy Summary to Clipboard
  const copySummaryToClipboard = () => {
    if (!callSummary) return;
    const text = [
      `==================================================`,
      ` SNAPDEAL VIRTUAL KAM — CALL RESOLUTION SUMMARY `,
      `==================================================`,
      `Seller ID: ${callSummary.seller_id}`,
      `Ticket ID: ${callSummary.ticket_id || "N/A"}`,
      `Date: ${new Date().toLocaleString()}`,
      ``,
      `--- KEY ISSUES IDENTIFIED ---`,
      ...callSummary.key_issues.map((i, idx) => `${idx + 1}. ${i}`),
      ``,
      `--- ACTIONS TAKEN DURING CALL ---`,
      ...callSummary.actions_taken.map((a, idx) => `${idx + 1}. ${a}`),
      ``,
      `--- NEXT STEPS FOR SELLER ---`,
      ...callSummary.next_steps.map((s, idx) => `${idx + 1}. ${s}`),
      `==================================================`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    showToast("Summary copied to clipboard!");
  };

  // Download Summary as .txt
  const downloadSummaryText = () => {
    if (!callSummary) return;
    const text = [
      `SNAPDEAL VIRTUAL KAM — CALL RESOLUTION SUMMARY`,
      `Generated: ${new Date().toISOString()}`,
      `Seller ID: ${callSummary.seller_id}`,
      `Store: ${sellerProfile?.store_name || "Trendz Apparel"}`,
      `Ticket ID: ${callSummary.ticket_id || "N/A"}`,
      `----------------------------------------------------`,
      `1. KEY ISSUES:`,
      ...callSummary.key_issues.map((i) => ` - ${i}`),
      ``,
      `2. ACTIONS TAKEN:`,
      ...callSummary.actions_taken.map((a) => ` - ${a}`),
      ``,
      `3. NEXT STEPS:`,
      ...callSummary.next_steps.map((s) => ` - ${s}`),
      `----------------------------------------------------`,
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Snapdeal_KAM_Summary_${callSummary.seller_id}_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Summary file downloaded");
  };

  // ==============================================================================
  // RENDER UI
  // ==============================================================================

  return (
    <div className="min-h-screen bg-[#0d0e1c] text-slate-100 flex flex-col font-sans">
      {/* Remote audio tracks container */}
      <div
        ref={audioContainerRef}
        style={{ position: "fixed", top: -1000, left: -1000, width: 1, height: 1, opacity: 0.01, pointerEvents: "none" }}
        aria-hidden="true"
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#e40046] text-white px-5 py-3 rounded-xl shadow-2xl shadow-red-500/20 border border-red-400/30 animate-bounce text-sm font-medium">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── TOP HEADER ── */}
      <header className="h-16 border-b border-white/10 bg-[#121324]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#e40046] flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-red-500/30">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">Snapdeal</span>
                <span className="text-[11px] font-semibold bg-red-500/20 text-[#ff4d79] px-2 py-0.5 rounded-full border border-red-500/30">
                  Virtual KAM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none">Seller Performance & Recovery Intelligence</p>
            </div>
          </div>

          <div className="hidden md:block h-6 w-px bg-white/10" />

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            {callState === "idle" && (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-300">Idle</span>
              </>
            )}
            {callState === "connecting" && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-amber-300">Connecting to LiveKit...</span>
              </>
            )}
            {callState === "connected" && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-semibold">Live Call Active</span>
                <span className="text-slate-400 ml-1 font-mono text-[11px]">({formatSeconds(callDuration)})</span>
              </>
            )}
            {callState === "ended" && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-rose-300">Call Ended</span>
              </>
            )}
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3">
          {/* Quick Simulation Trigger */}
          <button
            onClick={simulateWalkthrough}
            title="Instantly test all dashboard cards with simulated data flow"
            className="hidden lg:flex items-center gap-1.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600/50 px-3 py-1.5 rounded-lg transition-all"
          >
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Simulate Flow</span>
          </button>

          {/* Reset State */}
          <button
            onClick={resetAll}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded hover:bg-white/5 transition"
            title="Reset Dashboard State"
          >
            Reset
          </button>

          {/* Demo Mode Button */}
          <button
            onClick={startDemoMode}
            disabled={callState === "connected" || callState === "connecting"}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-red-600 to-[#e40046] hover:from-red-500 hover:to-[#ff195e] text-white px-3.5 py-1.5 rounded-lg shadow-md shadow-red-500/20 border border-red-400/40 transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Demo Mode (SD-402)</span>
          </button>
        </div>
      </header>

      {/* ── MAIN TWO-PANEL CONTENT ── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* ══════════════════════════════════════════════════════════════════════
            LEFT PANEL: CALL CONTROLS + TRANSCRIPT (Col 5 / 12)
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="lg:col-span-5 border-r border-white/10 bg-[#0f1021] flex flex-col h-[calc(100vh-4rem)]">
          {/* Call Controls Card */}
          <div className="p-5 border-b border-white/10 bg-[#14162b]/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#e40046]" />
                Call Terminal
              </h2>
              {roomName && (
                <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {roomName.slice(0, 18)}...
                </span>
              )}
            </div>

            {/* IDLE STATE: Seller ID selector and Start Call */}
            {callState === "idle" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Seller ID / Store Lookup</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sellerIdInput}
                      onChange={(e) => setSellerIdInput(e.target.value)}
                      placeholder="e.g. SD-402"
                      className="flex-1 bg-[#1a1c38] border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#e40046] transition"
                    />
                    <button
                      onClick={() => setSellerIdInput("SD-402")}
                      className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-2 rounded-lg border border-white/10 transition"
                    >
                      SD-402
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => startCall()}
                    className="flex items-center justify-center gap-2 bg-[#e40046] hover:bg-[#c7003c] text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-red-500/25 transition-all active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <span>Start Call</span>
                  </button>

                  <button
                    onClick={startDemoMode}
                    className="flex items-center justify-center gap-2 bg-[#252849] hover:bg-[#2e325c] text-slate-200 font-semibold py-2.5 px-4 rounded-xl border border-white/15 transition-all active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 text-[#ff4d79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Demo Mode</span>
                  </button>
                </div>
              </div>
            )}

            {/* CONNECTING STATE */}
            {callState === "connecting" && (
              <div className="py-6 flex flex-col items-center justify-center space-y-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-[#e40046]/30 border-t-[#e40046] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#e40046]" />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-300">Connecting to LiveKit Voice Agent...</p>
                <p className="text-xs text-slate-500 font-mono">Negotiating audio channels and room tokens</p>
                <button
                  onClick={resetAll}
                  className="text-xs text-slate-400 hover:text-white underline pt-1"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* CONNECTED STATE: Audio visualizer & Call controls */}
            {callState === "connected" && (
              <div className="space-y-4">
                {/* Visualizer & Speaking status */}
                <div className="bg-[#181a33] p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isAgentSpeaking
                            ? "bg-blue-600/30 text-blue-400 border border-blue-400/50 animate-ring-pulse"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {isAgentSpeaking ? "Virtual KAM Speaking..." : isUserSpeaking ? "You are Speaking..." : "Call in progress"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">Duration: {formatSeconds(callDuration)}</div>
                    </div>
                  </div>

                  {/* Frequency Visualizer Bars */}
                  <div className="flex items-end gap-1 h-8 px-2 py-1 bg-black/30 rounded-lg">
                    <div
                      className={`w-1 bg-[#e40046] rounded-full transition-all ${
                        isAgentSpeaking || isUserSpeaking ? "h-6 animate-voice-1" : "h-1.5 opacity-40"
                      }`}
                    />
                    <div
                      className={`w-1 bg-[#ff2a6d] rounded-full transition-all ${
                        isAgentSpeaking || isUserSpeaking ? "h-8 animate-voice-2" : "h-2 opacity-40"
                      }`}
                    />
                    <div
                      className={`w-1 bg-[#05d9e8] rounded-full transition-all ${
                        isAgentSpeaking || isUserSpeaking ? "h-5 animate-voice-3" : "h-1.5 opacity-40"
                      }`}
                    />
                    <div
                      className={`w-1 bg-[#005679] rounded-full transition-all ${
                        isAgentSpeaking || isUserSpeaking ? "h-7 animate-voice-4" : "h-2.5 opacity-40"
                      }`}
                    />
                    <div
                      className={`w-1 bg-[#e40046] rounded-full transition-all ${
                        isAgentSpeaking || isUserSpeaking ? "h-4 animate-voice-5" : "h-1 opacity-40"
                      }`}
                    />
                  </div>
                </div>

                {/* Mute & End buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition ${
                      isMuted
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                        : "bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-200"
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                        <span>Unmute Mic</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
                          />
                        </svg>
                        <span>Mute Mic</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={endCall}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-600/90 hover:bg-red-700 text-white font-semibold text-sm shadow-md shadow-red-600/20 transition active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                      />
                    </svg>
                    <span>End Call</span>
                  </button>
                </div>
              </div>
            )}

            {/* ENDED STATE */}
            {callState === "ended" && (
              <div className="p-4 bg-slate-900/60 rounded-xl border border-white/10 text-center space-y-3">
                <div className="text-sm font-medium text-slate-200">Call session concluded ({formatSeconds(callDuration)})</div>
                <p className="text-xs text-slate-400">Diagnosis and action recommendations are preserved on the dashboard.</p>
                <button
                  onClick={resetAll}
                  className="bg-[#e40046] hover:bg-[#c7003c] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Start New Diagnostic Call
                </button>
              </div>
            )}
          </div>

          {/* Quick Speech Cheatsheet (Helper buttons for demo) */}
          <div className="px-5 py-2.5 bg-[#121324] border-b border-white/10 flex items-center gap-1.5 overflow-x-auto text-xs text-slate-400">
            <span className="font-semibold text-slate-300 text-[11px] whitespace-nowrap">Click to Say:</span>
            <button
              onClick={() => sendManualMessage("Seller ID SD-402, store name Trendz Apparel")}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] whitespace-nowrap transition border border-white/5"
            >
              "SD-402"
            </button>
            <button
              onClick={() => sendManualMessage("Our sales have dropped drastically this month and orders are down")}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] whitespace-nowrap transition border border-white/5"
            >
              "Sales drop"
            </button>
            <button
              onClick={() => sendManualMessage("Yes, our fabric supplier had a machine delay")}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] whitespace-nowrap transition border border-white/5"
            >
              "Confirm cause"
            </button>
            <button
              onClick={() => sendManualMessage("Yes, please go ahead and enable the low stock auto-pause")}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] whitespace-nowrap transition border border-white/5"
            >
              "Approve action"
            </button>
            <button
              onClick={() => sendManualMessage("Please schedule a follow up call in 5 days")}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] whitespace-nowrap transition border border-white/5"
            >
              "Follow-up"
            </button>
          </div>

          {/* Transcript Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Live Transcript</div>
            {transcript.map((msg) => {
              if (msg.role === "system") {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="inline-block px-3 py-1 text-[11px] text-slate-400 bg-white/5 rounded-full border border-white/5">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isAgent = msg.role === "agent";
              return (
                <div key={msg.id} className={`flex flex-col ${isAgent ? "items-start" : "items-end"} space-y-1`}>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                    <span className={`font-semibold ${isAgent ? "text-blue-400" : "text-slate-300"}`}>
                      {isAgent ? "Virtual KAM Assistant" : "Seller"}
                    </span>
                    <span>•</span>
                    <span className="text-[10px] font-mono">{msg.time}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isAgent
                        ? "bg-[#1b2142] text-slate-100 rounded-tl-sm border border-blue-500/20 shadow-md shadow-blue-900/10"
                        : "bg-[#2d3152] text-white rounded-tr-sm border border-slate-600/30"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>

          {/* Optional Direct Input Bar */}
          <div className="p-3 border-t border-white/10 bg-[#14162b]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendManualMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type a message or response..."
                className="flex-1 bg-[#1c1f3d] border border-white/15 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#e40046] transition"
              />
              <button
                type="submit"
                className="bg-[#e40046] hover:bg-[#c7003c] text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
              >
                Send
              </button>
            </form>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT PANEL: DYNAMIC KAM DIAGNOSTIC & ACTION DASHBOARD (Col 7 / 12)
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="lg:col-span-7 bg-[#0d0e1c] p-6 overflow-y-auto h-[calc(100vh-4rem)] space-y-6">
          {/* Header & Status Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                KAM Diagnostic & Recovery Suite
              </h1>
              <p className="text-xs text-slate-400">
                Real-time seller telemetry, gap analysis, and one-click operational executions
              </p>
            </div>

            {/* Notification Pills */}
            <div className="flex items-center gap-2">
              {recapNotification && (
                <span className="text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Recap Dispatched
                </span>
              )}
              {escalationNotice && (
                <span className="text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full">
                  Tier-2 Human Escalation
                </span>
              )}
            </div>
          </div>

          {/* ── CARD A: SELLER VERIFIED BADGE ── */}
          {sellerProfile ? (
            <div className="bg-[#16172e] border border-emerald-500/40 rounded-2xl p-5 shadow-xl transition-all duration-500 ease-out">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white tracking-tight">
                        {sellerProfile.store_name}
                      </h2>
                      <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        Verified ✓
                      </span>
                      <span className="text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        {sellerProfile.tier}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Owner: <span className="text-slate-200 font-medium">{sellerProfile.name || sellerProfile.owner_name}</span> • ID:{" "}
                      <span className="text-slate-200 font-mono font-medium">{sellerProfile.seller_id}</span> • Category:{" "}
                      <span className="text-slate-200">{sellerProfile.category}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                  <div>City: <span className="text-slate-200">{sellerProfile.city || "Jaipur, RJ"}</span></div>
                  <div>Model: <span className="text-slate-200">{sellerProfile.fulfillment_model || "Snapdeal Plus"}</span></div>
                </div>
              </div>
            </div>
          ) : (
            /* Locked State Placeholder */
            <div className="bg-[#141529]/60 border border-dashed border-white/10 rounded-2xl p-4 flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-400">Seller Identity Locked</div>
                  <div className="text-xs text-slate-500">Awaiting caller verification (Seller ID or Store Name)</div>
                </div>
              </div>
              <span className="text-xs font-mono bg-white/5 px-2.5 py-1 rounded">Pending Verification</span>
            </div>
          )}

          {/* ── CARD B: TICKET CARD ── */}
          {ticket && (
            <div className="bg-[#16172e] border border-blue-500/30 rounded-2xl p-5 shadow-xl transition-all duration-500 ease-out">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
                    {ticket.ticket_id}
                  </span>
                  <span className="text-xs font-medium text-slate-400 capitalize">
                    Category: {ticket.category?.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    {ticket.priority || "High Priority"}
                  </span>
                  <span className="text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                    {ticket.status?.toUpperCase() || "OPEN"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-200 font-medium">"{ticket.issue}"</p>
            </div>
          )}

          {/* ── CARD C: METRIC CARDS & ALERTS ── */}
          {metrics ? (
            <div className="space-y-4 transition-all duration-500 ease-out">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Performance Metrics (Last Month vs This Month)
                </h3>
                <span className="text-[11px] text-slate-500">Snapshot period: 30 days comparison</span>
              </div>

              {/* 4 Metric Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* 1. Sales */}
                <div className="bg-[#16172e] border border-white/10 rounded-2xl p-4 shadow-lg">
                  <span className="text-xs text-slate-400 font-medium">Sales Revenue</span>
                  <div className="mt-1 text-lg font-bold text-white">
                    {metrics.metrics.sales?.formatted_this ||
                      `₹${metrics.metrics.sales?.this_month?.toLocaleString() || "1,35,000"}`}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Was: {metrics.metrics.sales?.formatted_last || `₹${metrics.metrics.sales?.last_month?.toLocaleString() || "2,00,000"}`}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>{metrics.metrics.sales?.change_pct || -32.5}%</span>
                  </div>
                </div>

                {/* 2. Orders */}
                <div className="bg-[#16172e] border border-white/10 rounded-2xl p-4 shadow-lg">
                  <span className="text-xs text-slate-400 font-medium">Total Orders</span>
                  <div className="mt-1 text-lg font-bold text-white">
                    {metrics.metrics.orders?.this_month || 270}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Was: {metrics.metrics.orders?.last_month || 400} orders
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>{metrics.metrics.orders?.change_pct || -32.5}%</span>
                  </div>
                </div>

                {/* 3. Cancellation Rate */}
                <div className="bg-[#16172e] border border-white/10 rounded-2xl p-4 shadow-lg">
                  <span className="text-xs text-slate-400 font-medium">Cancellation Rate</span>
                  <div className="mt-1 text-lg font-bold text-rose-400">
                    {metrics.metrics.cancellation_rate?.this_month || metrics.metrics.cancellations?.this_month_rate || 14.0}%
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Target &lt; 5.0% (Was: {metrics.metrics.cancellation_rate?.last_month || metrics.metrics.cancellations?.last_month_rate || 8.0}%)
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>+{metrics.metrics.cancellation_rate?.change_pct || 75}%</span>
                  </div>
                </div>

                {/* 4. Out of Stock */}
                <div className="bg-[#16172e] border border-white/10 rounded-2xl p-4 shadow-lg">
                  <span className="text-xs text-slate-400 font-medium">OOS SKUs</span>
                  <div className="mt-1 text-lg font-bold text-amber-400">
                    {metrics.metrics.oos_skus?.this_month || metrics.metrics.out_of_stock_count?.this_month || 18} SKUs
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Was: {metrics.metrics.oos_skus?.last_month || metrics.metrics.out_of_stock_count?.last_month || 5} SKUs
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>+{metrics.metrics.oos_skus?.change_pct || 260}%</span>
                  </div>
                </div>
              </div>

              {/* Two Alert Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Alert 1: High Cancellations */}
                <div className="bg-[#1e1722] border border-amber-500/30 rounded-2xl p-4 shadow-lg flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">High Cancellations Alert (14.0%)</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {metrics.cancellation_breakdown?.primary_reason ||
                        "60% of cancellations due to Out of Stock listings not paused in time."}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-400/90 font-medium">
                      <span>Seller-side: {metrics.cancellation_breakdown?.seller_cancelled ?? 24} orders</span>
                      <span>•</span>
                      <span>Buyer-side: {metrics.cancellation_breakdown?.buyer_cancelled ?? 14} orders</span>
                    </div>
                  </div>
                </div>

                {/* Alert 2: Stock Issues */}
                <div className="bg-[#1f1620] border border-rose-500/30 rounded-2xl p-4 shadow-lg flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-rose-300">Critical Stockout on Hero SKUs</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      4 hero products out of stock drove an estimated{" "}
                      <span className="font-semibold text-rose-300">90 lost orders (~₹45,000 revenue impact)</span>.
                    </p>
                    <div className="mt-2 text-[11px] text-rose-400/90 font-medium">
                      Accounts for ~69.2% of total sales reduction this month
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Locked State Placeholder */
            <div className="bg-[#141529]/60 border border-dashed border-white/10 rounded-2xl p-4 flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-400">Diagnostic Metrics Locked</div>
                  <div className="text-xs text-slate-500">Awaiting seller concern intake and database metric load</div>
                </div>
              </div>
              <span className="text-xs font-mono bg-white/5 px-2.5 py-1 rounded">Locked</span>
            </div>
          )}

          {/* ── CARD D: ROOT CAUSE CARD ── */}
          {rootCause ? (
            <div className="bg-[#16172e] border border-emerald-500/40 rounded-2xl p-5 shadow-xl transition-all duration-500 ease-out">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Root Cause Diagnosis Confirmed</h3>
                </div>
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Confirmed by Seller ✓
                </span>
              </div>

              <div className="bg-[#121324] rounded-xl p-4 border border-white/5 space-y-2">
                <div className="text-sm font-bold text-white">{rootCause.cause_title}</div>
                <p className="text-xs text-slate-300 leading-relaxed">{rootCause.evidence}</p>

                {/* Impact telemetry chips */}
                <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/5 rounded-lg p-2">
                    <span className="text-slate-400 text-[11px] block">OOS Hero Impact</span>
                    <span className="font-bold text-rose-400 font-mono">
                      ~₹{rootCause.impact?.components?.oos_hero_impact?.revenue?.toLocaleString() || "45,000"}
                    </span>
                    <span className="text-slate-500 text-[10px] block">
                      ({rootCause.impact?.components?.oos_hero_impact?.percentage_of_revenue || 69.2}% of gap)
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-lg p-2">
                    <span className="text-slate-400 text-[11px] block">Cancellation Leakage</span>
                    <span className="font-bold text-amber-400 font-mono">
                      ~₹{rootCause.impact?.components?.cancellation_impact?.revenue?.toLocaleString() || "7,700"}
                    </span>
                    <span className="text-slate-500 text-[10px] block">
                      ({rootCause.impact?.components?.cancellation_impact?.percentage_of_revenue || 11.8}% of gap)
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-lg p-2">
                    <span className="text-slate-400 text-[11px] block">Total Order Gap</span>
                    <span className="font-bold text-white font-mono">
                      {rootCause.impact?.total_gap?.orders || 130} orders
                    </span>
                    <span className="text-slate-500 text-[10px] block">
                      ~₹{rootCause.impact?.total_gap?.revenue?.toLocaleString() || "65,000"} monthly drop
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Locked State Placeholder */
            <div className="bg-[#141529]/60 border border-dashed border-white/10 rounded-2xl p-4 flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-400">Root Cause Confirmation Locked</div>
                  <div className="text-xs text-slate-500">Requires diagnostic probing and explicit seller confirmation</div>
                </div>
              </div>
              <span className="text-xs font-mono bg-white/5 px-2.5 py-1 rounded">Locked</span>
            </div>
          )}

          {/* ── CARD E: ACTION PLAN CARDS ── */}
          {actionPlan.length > 0 ? (
            <div className="space-y-3.5 transition-all duration-500 ease-out">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Targeted Action Plan ({actionPlan.length} Interventions)
                </h3>
                <span className="text-[11px] text-slate-500">Requires verbal consent prior to agent execution</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {actionPlan.map((action) => {
                  const isExecuted = action.status === "executed";
                  const isAgentAction = action.type === "agent_action";

                  return (
                    <div
                      key={action.action_id}
                      className={`bg-[#16172e] rounded-2xl p-4 border transition-all ${
                        isExecuted
                          ? "border-emerald-500/50 shadow-lg shadow-emerald-500/5"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                              isAgentAction
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {isAgentAction ? (
                              <>
                                <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Agent Action
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Seller Action
                              </>
                            )}
                          </span>

                          <span className="text-[11px] font-medium bg-white/5 text-slate-300 px-2 py-0.5 rounded border border-white/10">
                            {action.timeline || action.effort || "This Week"}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isExecuted ? (
                            <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Executed ✓
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                              Pending Consent
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white tracking-tight">{action.title}</h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{action.description}</p>

                      {/* Estimated Impact */}
                      {action.estimated_impact && (
                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span>Impact: {action.estimated_impact}</span>
                        </div>
                      )}

                      {/* Execution timestamp note if completed */}
                      {isExecuted && action.execution_detail && (
                        <div className="mt-2 text-[11px] font-mono text-emerald-300/80 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                          {action.execution_detail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Locked State Placeholder */
            <div className="bg-[#141529]/60 border border-dashed border-white/10 rounded-2xl p-4 flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-400">Action Plan Locked</div>
                  <div className="text-xs text-slate-500">Generated dynamically based on confirmed root cause and seller operational inputs</div>
                </div>
              </div>
              <span className="text-xs font-mono bg-white/5 px-2.5 py-1 rounded">Locked</span>
            </div>
          )}

          {/* ── CARD F: FOLLOW-UP CHIP / BANNER ── */}
          {followup && (
            <div className="bg-[#161a33] border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg transition-all duration-500 ease-out">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Automated Follow-up Scheduled</span>
                    <span className="text-[11px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                      In {followup.days_from_now || followup.days} days ({followup.followup_date})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{followup.topic}</p>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded">
                Calendar Entry Synced
              </span>
            </div>
          )}

          {/* ── CARD G: POST-CALL SUMMARY PANEL ── */}
          {callSummary && (
            <div className="bg-[#16172e] border border-white/15 rounded-2xl p-5 shadow-2xl space-y-4 transition-all duration-500 ease-out">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#e40046] flex items-center justify-center text-white font-bold text-sm shadow">
                    📋
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Structured Call Summary</h3>
                    <p className="text-[11px] text-slate-400">
                      Ticket {callSummary.ticket_id} • Seller {callSummary.seller_id}
                    </p>
                  </div>
                </div>

                {/* Actions: Copy & Download */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={copySummaryToClipboard}
                    className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 px-3 py-1.5 rounded-lg transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                    <span>Copy Summary</span>
                  </button>

                  <button
                    onClick={downloadSummaryText}
                    className="flex items-center gap-1.5 text-xs bg-[#e40046] hover:bg-[#c7003c] text-white font-semibold px-3 py-1.5 rounded-lg shadow-md shadow-red-500/20 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>Download as Text</span>
                  </button>
                </div>
              </div>

              {/* Summary Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. Key Issues */}
                <div className="bg-[#121324] p-3.5 rounded-xl border border-white/5 space-y-2">
                  <span className="font-bold text-rose-300 uppercase tracking-wider text-[11px] block">
                    📌 Key Issues
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {callSummary.key_issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. Actions Taken */}
                <div className="bg-[#121324] p-3.5 rounded-xl border border-white/5 space-y-2">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    ⚡ Actions Taken
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {callSummary.actions_taken.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 3. Next Steps */}
                <div className="bg-[#121324] p-3.5 rounded-xl border border-white/5 space-y-2">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    📋 Next Steps
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {callSummary.next_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-blue-400 mt-0.5">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
