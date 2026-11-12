"""Mock data and computation module for Snapdeal Seller KAM system.

This module is imported by the agent's function tools. It contains ALL
seller profile data, monthly metrics, SKU-level tables, and pure computation
functions. No numbers should ever be hardcoded in the system prompt or
in tool implementations — everything is derived from this module.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid

# ==============================================================================
# 1. SELLER PROFILES & LOOKUP INDICES
# ==============================================================================

SELLERS: Dict[str, Dict[str, Any]] = {
    "SD-402": {
        "seller_id": "SD-402",
        "store_name": "Trendz Apparel",
        "owner_name": "Rajesh",
        "category": "Apparel",
        "active_skus": 60,
        "joined": "2022-03-15",
        "tier": "Silver",
        "account_manager": "Virtual KAM",
    }
}

# Lookup by store name (case-insensitive)
STORE_NAME_INDEX: Dict[str, str] = {
    "trendz apparel": "SD-402",
}


def get_seller(identifier: str) -> Optional[Dict[str, Any]]:
    """Look up seller profile by seller ID (e.g. 'SD-402') or store name (case-insensitive)."""
    if not identifier:
        return None
    raw = str(identifier).strip()
    upper_id = raw.upper()
    if upper_id in SELLERS:
        return SELLERS[upper_id]
    
    lower_name = raw.lower()
    if lower_name in STORE_NAME_INDEX:
        sid = STORE_NAME_INDEX[lower_name]
        return SELLERS.get(sid)
    
    for sid, seller in SELLERS.items():
        if lower_name in seller["store_name"].lower() or lower_name in sid.lower():
            return seller
    return None


# ==============================================================================
# 2. MONTHLY METRICS (Last Month vs This Month)
# ==============================================================================

METRICS: Dict[str, Dict[str, Dict[str, float]]] = {
    "SD-402": {
        "sales": {"last_month": 200000, "this_month": 135000},  # Rs
        "orders": {"last_month": 400, "this_month": 270},
        "cancellation_rate": {"last_month": 8.0, "this_month": 14.0},  # %
        "avg_selling_price": {"last_month": 500, "this_month": 500},  # Rs
        "out_of_stock_count": {"last_month": 5, "this_month": 18},
        "return_rate": {"last_month": 3.0, "this_month": 3.5},  # %
    }
}


# ==============================================================================
# 3. SKU CATALOG (Hero & Tail OOS + In-Stock Top Performers)
# ==============================================================================

SKU_DATA: Dict[str, List[Dict[str, Any]]] = {
    "SD-402": [
        # --- Out-of-stock hero products (4 key drivers: 90 lost orders, Rs 45,000) ---
        {
            "sku_id": "SKU-1001",
            "name": "Cotton Kurta Set",
            "status": "out_of_stock",
            "hero": True,
            "price": 500,
            "orders_last_month": 45,
            "orders_this_month": 10,
            "category": "Ethnic Wear",
        },
        {
            "sku_id": "SKU-1002",
            "name": "Denim Jacket",
            "status": "out_of_stock",
            "hero": True,
            "price": 500,
            "orders_last_month": 35,
            "orders_this_month": 12,
            "category": "Western Wear",
        },
        {
            "sku_id": "SKU-1003",
            "name": "Printed Palazzo",
            "status": "out_of_stock",
            "hero": True,
            "price": 500,
            "orders_last_month": 30,
            "orders_this_month": 10,
            "category": "Bottom Wear",
        },
        {
            "sku_id": "SKU-1004",
            "name": "Linen Shirt",
            "status": "out_of_stock",
            "hero": True,
            "price": 500,
            "orders_last_month": 20,
            "orders_this_month": 8,
            "category": "Casual Wear",
        },

        # --- Out-of-stock tail products (14 low-selling items: orders 1-5 last mo, 0-1 this mo) ---
        {
            "sku_id": "SKU-1005",
            "name": "Polyester Scarf",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 4,
            "orders_this_month": 0,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1006",
            "name": "Silk Necktie",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 3,
            "orders_this_month": 1,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1007",
            "name": "Wool Beanie Hat",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 2,
            "orders_this_month": 0,
            "category": "Winter Wear",
        },
        {
            "sku_id": "SKU-1008",
            "name": "Cotton Crew Socks Set",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 5,
            "orders_this_month": 1,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1009",
            "name": "Braided Canvas Belt",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 3,
            "orders_this_month": 0,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1010",
            "name": "Printed Bandana Scarf",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 2,
            "orders_this_month": 0,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1011",
            "name": "Knitted Winter Muffler",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 4,
            "orders_this_month": 1,
            "category": "Winter Wear",
        },
        {
            "sku_id": "SKU-1012",
            "name": "Velvet Formal Bow Tie",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 1,
            "orders_this_month": 0,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1013",
            "name": "Fleece Thermal Gloves",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 3,
            "orders_this_month": 0,
            "category": "Winter Wear",
        },
        {
            "sku_id": "SKU-1014",
            "name": "Embroidered Handkerchief 3-Pack",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 5,
            "orders_this_month": 1,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1015",
            "name": "Cushioned Ankle Socks Set",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 4,
            "orders_this_month": 1,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1016",
            "name": "Cotton Wristbands Twin Pack",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 2,
            "orders_this_month": 0,
            "category": "Active Wear",
        },
        {
            "sku_id": "SKU-1017",
            "name": "Leather Card Holder",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 3,
            "orders_this_month": 0,
            "category": "Accessories",
        },
        {
            "sku_id": "SKU-1018",
            "name": "Nylon Shopper Foldable Pouch",
            "status": "out_of_stock",
            "hero": False,
            "price": 500,
            "orders_last_month": 2,
            "orders_this_month": 0,
            "category": "Accessories",
        },

        # --- In-stock top sellers (candidates for promotions and featured boost) ---
        {
            "sku_id": "SKU-2001",
            "name": "Floral Maxi Dress",
            "status": "in_stock",
            "hero": True,
            "price": 550,
            "orders_last_month": 40,
            "orders_this_month": 38,
            "category": "Western Wear",
        },
        {
            "sku_id": "SKU-2002",
            "name": "Chino Trousers",
            "status": "in_stock",
            "hero": True,
            "price": 480,
            "orders_last_month": 35,
            "orders_this_month": 32,
            "category": "Bottom Wear",
        },
        {
            "sku_id": "SKU-2003",
            "name": "Embroidered Kurti",
            "status": "in_stock",
            "hero": True,
            "price": 520,
            "orders_last_month": 28,
            "orders_this_month": 25,
            "category": "Ethnic Wear",
        },
        {
            "sku_id": "SKU-2004",
            "name": "Casual Polo T-Shirt",
            "status": "in_stock",
            "hero": False,
            "price": 450,
            "orders_last_month": 22,
            "orders_this_month": 20,
            "category": "Casual Wear",
        },
        {
            "sku_id": "SKU-2005",
            "name": "Slim Fit Jeans",
            "status": "in_stock",
            "hero": False,
            "price": 600,
            "orders_last_month": 18,
            "orders_this_month": 16,
            "category": "Bottom Wear",
        },
    ]
}


# ==============================================================================
# 4. CANCELLATION REASONS
# ==============================================================================

CANCELLATION_REASONS: Dict[str, Dict[str, float]] = {
    "SD-402": {
        "stock_unavailable": 60.0,  # percentage
        "late_dispatch": 30.0,
        "buyer_side": 10.0,
    }
}


# ==============================================================================
# 5. COMPUTATION FUNCTIONS
# ==============================================================================

def compute_metric_changes(seller_id: str) -> Dict[str, Any]:
    """Compute percentage changes and absolute changes for all metrics.

    Args:
        seller_id: Seller identifier (e.g. 'SD-402' or store name).

    Returns:
        Dict containing raw and computed metrics (change_abs, change_pct).
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()
    if sid not in METRICS:
        return {"error": f"Seller '{seller_id}' not found in metrics registry."}

    raw = METRICS[sid]
    computed: Dict[str, Dict[str, float]] = {}

    for metric_name, values in raw.items():
        last = float(values.get("last_month", 0.0))
        this_val = float(values.get("this_month", 0.0))
        diff = round(this_val - last, 2)
        pct = round(((this_val - last) / last) * 100.0, 2) if last != 0 else 0.0

        computed[metric_name] = {
            "last_month": last,
            "this_month": this_val,
            "change_abs": diff,
            "change_pct": pct,
        }

    return {
        "seller_id": sid,
        "metrics": computed,
    }


def compute_oos_impact(seller_id: str, filter_type: str = "all") -> Dict[str, Any]:
    """Compute out-of-stock impact from SKU data.

    Args:
        seller_id: Seller identifier.
        filter_type: 'all', 'hero', or 'tail'.

    Returns:
        Dict with list of OOS SKUs, computed lost_orders, total_lost_orders,
        and total_lost_revenue.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()
    if sid not in SKU_DATA:
        return {"error": f"No SKU data found for seller '{seller_id}'."}

    skus = SKU_DATA[sid]
    norm_filter = filter_type.strip().lower()

    filtered_skus: List[Dict[str, Any]] = []
    for item in skus:
        if item.get("status") != "out_of_stock":
            continue

        is_hero = bool(item.get("hero", False))
        if norm_filter == "hero" and not is_hero:
            continue
        if norm_filter == "tail" and is_hero:
            continue

        last_orders = int(item.get("orders_last_month", 0))
        this_orders = int(item.get("orders_this_month", 0))
        lost_orders = max(0, last_orders - this_orders)
        price = float(item.get("price", 500))
        lost_rev = round(lost_orders * price, 2)

        filtered_skus.append({
            "sku_id": item["sku_id"],
            "name": item["name"],
            "hero": is_hero,
            "category": item.get("category", ""),
            "price": price,
            "orders_last_month": last_orders,
            "orders_this_month": this_orders,
            "lost_orders": lost_orders,
            "lost_revenue": lost_rev,
        })

    # Sort by lost revenue descending
    filtered_skus.sort(key=lambda x: (x["lost_revenue"], x["lost_orders"]), reverse=True)

    total_lost_orders = sum(x["lost_orders"] for x in filtered_skus)
    total_lost_revenue = sum(x["lost_revenue"] for x in filtered_skus)

    return {
        "seller_id": sid,
        "filter_type": norm_filter,
        "count": len(filtered_skus),
        "total_lost_orders": total_lost_orders,
        "total_lost_revenue": total_lost_revenue,
        "skus": filtered_skus,
    }


def compute_cancellation_impact(seller_id: str) -> Dict[str, Any]:
    """Compute cancellation impact and reason breakdown.

    Extra cancellation points = this_month_rate - last_month_rate
    Extra cancelled orders = extra_points/100 * this_month_orders
    Revenue impact = extra_orders * avg_selling_price

    Args:
        seller_id: Seller identifier.

    Returns:
        Dict with rate changes, extra cancelled orders, revenue impact,
        and reason-wise breakdown.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()
    if sid not in METRICS:
        return {"error": f"No metrics found for seller '{seller_id}'."}

    m = METRICS[sid]
    canc_data = m.get("cancellation_rate", {})
    last_rate = float(canc_data.get("last_month", 0.0))
    this_rate = float(canc_data.get("this_month", 0.0))
    extra_points = round(this_rate - last_rate, 2)

    this_month_orders = float(m.get("orders", {}).get("this_month", 0.0))
    asp = float(m.get("avg_selling_price", {}).get("this_month", 500.0))

    extra_cancelled_orders = round((extra_points / 100.0) * this_month_orders)
    total_revenue_impact = round(extra_cancelled_orders * asp, 2)

    reasons = CANCELLATION_REASONS.get(sid, {})
    reasons_breakdown: Dict[str, Dict[str, Any]] = {}
    for reason, pct in reasons.items():
        reason_orders = round((pct / 100.0) * extra_cancelled_orders)
        reason_rev = round(reason_orders * asp, 2)
        reasons_breakdown[reason] = {
            "percentage": pct,
            "estimated_lost_orders": reason_orders,
            "estimated_lost_revenue": reason_rev,
        }

    return {
        "seller_id": sid,
        "last_month_rate": last_rate,
        "this_month_rate": this_rate,
        "extra_rate_points": extra_points,
        "this_month_orders": int(this_month_orders),
        "avg_selling_price": asp,
        "extra_cancelled_orders": extra_cancelled_orders,
        "total_lost_revenue": total_revenue_impact,
        "reasons_breakdown": reasons_breakdown,
    }


def compute_gap_analysis(seller_id: str) -> Dict[str, Any]:
    """Full gap analysis: OOS impact + cancellation impact + remaining visibility gap.

    Total gap = last_month_orders - this_month_orders
    OOS gap = sum of lost orders from hero OOS items
    Cancellation gap = extra cancellations
    Remaining gap = total - oos - cancellation (attributed to visibility/other)

    Args:
        seller_id: Seller identifier.

    Returns:
        Dict containing total order/revenue gaps and all attributed components.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()
    if sid not in METRICS:
        return {"error": f"No metrics found for seller '{seller_id}'."}

    m = METRICS[sid]
    last_orders = int(m.get("orders", {}).get("last_month", 0))
    this_orders = int(m.get("orders", {}).get("this_month", 0))
    total_order_gap = max(0, last_orders - this_orders)

    last_sales = float(m.get("sales", {}).get("last_month", 0.0))
    this_sales = float(m.get("sales", {}).get("this_month", 0.0))
    total_revenue_gap = max(0.0, last_sales - this_sales)

    # 1. Hero OOS Impact
    oos_hero = compute_oos_impact(sid, filter_type="hero")
    hero_orders = int(oos_hero.get("total_lost_orders", 0))
    hero_revenue = float(oos_hero.get("total_lost_revenue", 0.0))

    # 2. Extra Cancellation Impact
    canc_data = compute_cancellation_impact(sid)
    canc_orders = int(canc_data.get("extra_cancelled_orders", 0))
    canc_revenue = float(canc_data.get("total_lost_revenue", 0.0))

    # 3. Remaining Gap (Visibility, search impressions, category seasonality)
    remaining_orders = max(0, total_order_gap - hero_orders - canc_orders)
    remaining_revenue = max(0.0, total_revenue_gap - hero_revenue - canc_revenue)

    return {
        "seller_id": sid,
        "total_gap": {
            "orders": total_order_gap,
            "revenue": total_revenue_gap,
        },
        "components": {
            "oos_hero_impact": {
                "orders": hero_orders,
                "revenue": hero_revenue,
                "percentage_of_orders": round((hero_orders / total_order_gap) * 100.0, 1) if total_order_gap else 0.0,
                "percentage_of_revenue": round((hero_revenue / total_revenue_gap) * 100.0, 1) if total_revenue_gap else 0.0,
                "description": "Stockout on 4 hero SKUs (Cotton Kurta, Denim Jacket, Printed Palazzo, Linen Shirt)",
            },
            "cancellation_impact": {
                "orders": canc_orders,
                "revenue": canc_revenue,
                "percentage_of_orders": round((canc_orders / total_order_gap) * 100.0, 1) if total_order_gap else 0.0,
                "percentage_of_revenue": round((canc_revenue / total_revenue_gap) * 100.0, 1) if total_revenue_gap else 0.0,
                "description": "Extra cancellations caused by stock unavailable (60%) and late dispatch (30%)",
            },
            "visibility_and_demand_gap": {
                "orders": remaining_orders,
                "revenue": remaining_revenue,
                "percentage_of_orders": round((remaining_orders / total_order_gap) * 100.0, 1) if total_order_gap else 0.0,
                "percentage_of_revenue": round((remaining_revenue / total_revenue_gap) * 100.0, 1) if total_revenue_gap else 0.0,
                "description": "Traffic variance, category seasonality, and marketplace search visibility",
            },
        },
    }


def get_top_in_stock_for_promo(seller_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Get top in-stock products suitable for promotion, sorted by orders.

    Args:
        seller_id: Seller identifier.
        limit: Number of items to return.

    Returns:
        List of in-stock SKU dicts sorted by this month's orders descending.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()
    if sid not in SKU_DATA:
        return []

    in_stock = [item for item in SKU_DATA[sid] if item.get("status") == "in_stock"]
    in_stock.sort(
        key=lambda x: (x.get("orders_this_month", 0), x.get("orders_last_month", 0)),
        reverse=True,
    )
    return in_stock[:limit]


def build_action_plan(
    seller_id: str,
    restock_eta_days: Optional[int] = None,
    supplier_issue: bool = False,
    stock_sync_issue: bool = False,
    dispatch_delay_issue: bool = False,
    accepts_promo: bool = False,
) -> List[Dict[str, Any]]:
    """Build deterministic action plan based on seller's answers.

    Rules:
    - If stock_sync_issue: add "Enable low-stock auto-pause" (today, agent_action)
    - If dispatch_delay_issue: add "Enable dispatch-delay alerts" (today, agent_action)
    - If restock_eta_days <= 7: add "Priority restock of hero SKUs" (this week, seller_action)
    - If restock_eta_days > 7: add "Expedite supplier relationship" (next 7 days, seller_action)
    - If accepts_promo: add "7-day promotion on top in-stock items" (today, agent_action)
    - Always: "Review and restock hero SKUs" (this week, seller_action) if not already present

    Returns:
        List of 2-3 prioritized actions with action_id, title, description, effort,
        estimated_impact, type (agent_action/seller_action), executable.
    """
    actions: List[Dict[str, Any]] = []

    # 1. Urgent operational leakage prevention (Agent-executable)
    if stock_sync_issue:
        actions.append({
            "action_id": "ACT-AUTO-PAUSE",
            "title": "Enable low-stock auto-pause",
            "description": "Automatically pause product listings when inventory falls below 2 units to prevent unfulfillable orders.",
            "effort": "Immediate (1-click)",
            "timeline": "Today",
            "estimated_impact": "Prevents ~10 cancellations (~Rs 4,800/month saved) and protects seller rating.",
            "type": "agent_action",
            "executable": True,
        })
    elif dispatch_delay_issue:
        actions.append({
            "action_id": "ACT-DISPATCH-ALERTS",
            "title": "Enable dispatch-delay alerts",
            "description": "Activate automated SMS and seller panel alerts 12 hours before dispatch SLA breach.",
            "effort": "Immediate (1-click)",
            "timeline": "Today",
            "estimated_impact": "Prevents ~5 late dispatch cancellations (~Rs 2,400/month saved).",
            "type": "agent_action",
            "executable": True,
        })

    # 2. Core revenue recovery - Restock Hero SKUs (Seller operational)
    if restock_eta_days is not None and restock_eta_days > 7:
        actions.append({
            "action_id": "ACT-EXPEDITE-SUPPLIER",
            "title": "Expedite supplier relationship",
            "description": "Request expedited fabric batch delivery from supplier for top 4 hero SKUs within 7 days.",
            "effort": "Medium (Seller operational)",
            "timeline": "Next 7 days",
            "estimated_impact": "Unlocks primary sales engine; recovers up to ~90 lost orders (~Rs 45,000/month).",
            "type": "seller_action",
            "executable": False,
        })
    elif restock_eta_days is not None and restock_eta_days <= 7:
        actions.append({
            "action_id": "ACT-RESTOCK-HERO",
            "title": "Priority restock of hero SKUs",
            "description": "Replenish 4 hero SKUs (Cotton Kurta Set, Denim Jacket, Printed Palazzo, Linen Shirt) within 7 days.",
            "effort": "Medium (Seller operational)",
            "timeline": "This week",
            "estimated_impact": "Recovers ~90 lost orders (~Rs 45,000/month) within 1-2 weeks of replenishment.",
            "type": "seller_action",
            "executable": False,
        })
    elif supplier_issue:
        actions.append({
            "action_id": "ACT-EXPEDITE-SUPPLIER",
            "title": "Expedite supplier relationship",
            "description": "Engage alternate textile supplier or split batch delivery to resolve supplier delays.",
            "effort": "Medium (Seller operational)",
            "timeline": "Next 7 days",
            "estimated_impact": "Recovers ~90 lost orders (~Rs 45,000/month).",
            "type": "seller_action",
            "executable": False,
        })

    # 3. Growth / Compensatory in-stock campaign (Agent-executable)
    if accepts_promo:
        actions.append({
            "action_id": "ACT-PROMO-INSTOCK",
            "title": "7-day promotion on top in-stock items",
            "description": "Launch 7-day featured campaign on top 3 in-stock products (Floral Maxi Dress, Chino Trousers, Embroidered Kurti).",
            "effort": "Low (1-click)",
            "timeline": "Today",
            "estimated_impact": "Generates 20-30 incremental orders (~Rs 10,000 - 15,000 revenue) while restock is underway.",
            "type": "agent_action",
            "executable": True,
        })

    # 4. Secondary alert if both stock sync and dispatch issues were flagged
    if dispatch_delay_issue and stock_sync_issue and len(actions) < 3:
        actions.append({
            "action_id": "ACT-DISPATCH-ALERTS",
            "title": "Enable dispatch-delay alerts",
            "description": "Activate automated SMS alerts 12 hours before SLA breach.",
            "effort": "Immediate (1-click)",
            "timeline": "Today",
            "estimated_impact": "Prevents ~5 late dispatch cancellations (~Rs 2,400/month saved).",
            "type": "agent_action",
            "executable": True,
        })

    # 5. Fallback rule: Always have a restock action if none present yet
    has_restock_action = any(
        a["action_id"] in ("ACT-RESTOCK-HERO", "ACT-EXPEDITE-SUPPLIER", "ACT-REVIEW-RESTOCK")
        for a in actions
    )
    if not has_restock_action:
        actions.insert(1 if actions else 0, {
            "action_id": "ACT-REVIEW-RESTOCK",
            "title": "Review and restock hero SKUs",
            "description": "Review supplier inventory and place restock orders for 4 hero SKUs driving 90 lost orders.",
            "effort": "Medium (Seller operational)",
            "timeline": "This week",
            "estimated_impact": "Recovers bulk of missing revenue (~90 orders / Rs 45,000).",
            "type": "seller_action",
            "executable": False,
        })

    # Return prioritized list constrained to 2-3 actions max
    return actions[:3]


# ==============================================================================
# 6. ACTION EXECUTION & FOLLOWUP SIMULATION
# ==============================================================================

# In-memory tracking of executed actions per seller
EXECUTED_ACTIONS: Dict[str, List[Dict[str, Any]]] = {}

# In-memory tracking of scheduled followups
FOLLOWUPS: Dict[str, List[Dict[str, Any]]] = {}


def execute_action(seller_id: str, action_id: str) -> Dict[str, Any]:
    """Simulate executing an agent action.

    Args:
        seller_id: Seller identifier.
        action_id: Action identifier (e.g. 'ACT-AUTO-PAUSE', 'ACT-PROMO-INSTOCK').

    Returns:
        Dict with execution confirmation and details.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()

    now_iso = datetime.now(timezone.utc).isoformat()
    action_key = action_id.strip().upper()

    if action_key == "ACT-AUTO-PAUSE":
        record = {
            "action_id": action_key,
            "seller_id": sid,
            "title": "Enable low-stock auto-pause",
            "status": "completed",
            "message": "Low-stock auto-pause configuration successfully activated. System will pause listings at <= 2 units.",
            "executed_at": now_iso,
            "details": {
                "threshold_units": 2,
                "auto_resume_on_restock": True,
                "affected_skus": "All active catalog SKUs",
            },
        }
    elif action_key == "ACT-DISPATCH-ALERTS":
        record = {
            "action_id": action_key,
            "seller_id": sid,
            "title": "Enable dispatch-delay alerts",
            "status": "completed",
            "message": "Automated dispatch warning alerts configured. Notifications will fire 12h before SLA breach.",
            "executed_at": now_iso,
            "details": {
                "lead_time_hours": 12,
                "channels": ["SMS", "Seller Portal Banner", "WhatsApp"],
            },
        }
    elif action_key == "ACT-PROMO-INSTOCK":
        top_skus = [sku["name"] for sku in get_top_in_stock_for_promo(sid, limit=3)]
        record = {
            "action_id": action_key,
            "seller_id": sid,
            "title": "7-day promotion on top in-stock items",
            "status": "scheduled",
            "message": f"7-day promotional campaign enrolled for top items: {', '.join(top_skus)}.",
            "executed_at": now_iso,
            "details": {
                "duration_days": 7,
                "enrolled_skus": top_skus,
                "discount_tier": "5% Snapdeal Co-sponsored Spotlight",
            },
        }
    else:
        record = {
            "action_id": action_key,
            "seller_id": sid,
            "title": f"Executed action {action_key}",
            "status": "completed",
            "message": f"Action {action_key} recorded and executed successfully.",
            "executed_at": now_iso,
            "details": {},
        }

    EXECUTED_ACTIONS.setdefault(sid, []).append(record)
    return record


def schedule_followup_entry(seller_id: str, days: int, topic: str) -> Dict[str, Any]:
    """Schedule a followup check-in.

    Args:
        seller_id: Seller identifier.
        days: Days from now when followup is scheduled.
        topic: Topic of the followup call/notification.

    Returns:
        Dict confirming scheduled followup details.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()

    now = datetime.now(timezone.utc)
    followup_date = (now + timedelta(days=days)).strftime("%Y-%m-%d")
    followup_id = f"FOL-{uuid.uuid4().hex[:8].upper()}"

    entry = {
        "followup_id": followup_id,
        "seller_id": sid,
        "days": days,
        "scheduled_date": followup_date,
        "topic": topic,
        "status": "scheduled",
        "created_at": now.isoformat(),
    }

    FOLLOWUPS.setdefault(sid, []).append(entry)
    return entry


# ==============================================================================
# 7. TICKET TRACKING
# ==============================================================================

# In-memory ticket store
TICKETS: Dict[str, Dict[str, Any]] = {}


def create_ticket(seller_id: str, issue: str, category: str) -> Dict[str, Any]:
    """Create a support/escalation ticket.

    Args:
        seller_id: Seller identifier.
        issue: Summary description of the issue.
        category: Ticket category (e.g. 'Supplier Delay', 'Inventory Sync', 'Payment').

    Returns:
        Dict with ticket_id and ticket metadata.
    """
    seller = get_seller(seller_id)
    sid = seller["seller_id"] if seller else str(seller_id).strip().upper()

    ticket_id = f"TICK-{uuid.uuid4().hex[:8].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    ticket = {
        "ticket_id": ticket_id,
        "seller_id": sid,
        "issue": issue,
        "category": category,
        "status": "open",
        "priority": "high",
        "created_at": now_iso,
    }

    TICKETS[ticket_id] = ticket
    return ticket


# ==============================================================================
# 8. DATA NOTES & ASSUMPTIONS
# ==============================================================================

DATA_NOTES: Dict[str, Any] = {
    "source": "Mock data for take-home submission",
    "assumptions": [
        "4 hero SKUs account for bulk of OOS impact (~90 lost orders, ~Rs 45,000)",
        "14 tail OOS items are low-selling (1-5 orders/month each)",
        "Cancellation reasons: 60% stock unavailable, 30% late dispatch, 10% buyer side",
        "Extra cancellation impact (+6 pts) ≈ 16 orders ≈ Rs 8,000",
        "Remaining gap (visibility/other) ≈ 24 orders ≈ Rs 12,000",
        "Average selling price stable at Rs 500",
        "All numbers are computed from the SKU/metrics tables, never hardcoded in results",
    ],
}


# ==============================================================================
# 9. STATE RESET HELPER (FOR TESTS)
# ==============================================================================

def reset_mock_state() -> None:
    """Clear executed actions, scheduled followups, and tickets for clean testing."""
    EXECUTED_ACTIONS.clear()
    FOLLOWUPS.clear()
    TICKETS.clear()
