from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase
from app import auth

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def get_notifications(user_id: int = Depends(auth.get_current_user_id)):
    try:
        user = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user.data:
            return []
        u = user.data[0]
        role = u.get("role", "owner")
        notifications = []

        # ── OWNER NOTIFICATIONS ────────────────────────────────────
        if role == "owner":
            props = supabase.table("properties").select("id,title").eq("owner_id", user_id).execute()
            prop_ids  = [p["id"] for p in props.data]
            prop_map  = {p["id"]: p["title"] for p in props.data}

            if prop_ids:
                # 1. New pending rental requests
                requests = (
                    supabase.table("rental_requests")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("status", "pending")
                    .execute()
                )
                for r in requests.data:
                    tenant = supabase.table("tenants").select("name,email").eq("id", r["tenant_id"]).execute()
                    tname  = tenant.data[0]["name"] if tenant.data else "A tenant"
                    notifications.append({
                        "id":      f"req_{r['id']}",
                        "type":    "request",
                        "icon":    "📬",
                        "title":   "New Rental Request",
                        "message": f"{tname} wants to rent {prop_map.get(r['property_id'], 'your property')}",
                        "time":    r.get("created_at", ""),
                        "read":    False,
                        "action":  "requests"
                    })

                # 2. Agreements where tenant approved but owner hasn't yet
                pending_approval = (
                    supabase.table("agreements")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("status", "pending_approval")
                    .eq("tenant_approved", True)
                    .eq("owner_approved", False)
                    .execute()
                )
                for ag in pending_approval.data:
                    tenant = supabase.table("tenants").select("name").eq("id", ag["tenant_id"]).execute()
                    tname  = tenant.data[0]["name"] if tenant.data else "Tenant"
                    notifications.append({
                        "id":      f"ag_approve_{ag['id']}",
                        "type":    "agreement",
                        "icon":    "📄",
                        "title":   "Agreement Needs Your Approval",
                        "message": f"{tname} signed the agreement for {prop_map.get(ag['property_id'], 'your property')}. Please approve.",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

                # 3. Tenant initiated leave (vacating_pending)
                vacating = (
                    supabase.table("agreements")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("status", "vacating_pending")
                    .execute()
                )
                for ag in vacating.data:
                    tenant = supabase.table("tenants").select("name").eq("id", ag["tenant_id"]).execute()
                    tname  = tenant.data[0]["name"] if tenant.data else "Your tenant"
                    ptitle = prop_map.get(ag["property_id"], "your property")
                    notifications.append({
                        "id":      f"vacate_{ag['id']}",
                        "type":    "vacating",
                        "icon":    "🚪",
                        "title":   "Tenant is Leaving!",
                        "message": f"{tname} wants to vacate {ptitle}. Confirm to make property available.",
                        "time":    "",
                        "read":    False,
                        "action":  "vacating",
                        "agreement_id": ag["id"]
                    })

                # 4. Newly active agreements
                active_ags = (
                    supabase.table("agreements")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("status", "active")
                    .eq("owner_approved", True)
                    .eq("tenant_approved", True)
                    .execute()
                )
                for ag in active_ags.data:
                    tenant = supabase.table("tenants").select("name").eq("id", ag["tenant_id"]).execute()
                    tname  = tenant.data[0]["name"] if tenant.data else "Tenant"
                    notifications.append({
                        "id":      f"active_{ag['id']}",
                        "type":    "active",
                        "icon":    "🎉",
                        "title":   "Agreement Active",
                        "message": f"{tname} — agreement for {prop_map.get(ag['property_id'], 'property')} is now fully active.",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

        # ── TENANT NOTIFICATIONS ───────────────────────────────────
        elif role == "tenant":
            tenant = supabase.table("tenants").select("id").eq("email", u["email"]).execute()
            if tenant.data:
                tenant_id = tenant.data[0]["id"]

                # 1. Accepted requests
                accepted = (
                    supabase.table("rental_requests")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "accepted")
                    .execute()
                )
                for r in accepted.data:
                    prop = supabase.table("properties").select("title,owner_id").eq("id", r["property_id"]).execute()
                    p = prop.data[0] if prop.data else {}
                    owner = supabase.table("users").select("name,phone").eq("id", p.get("owner_id", 0)).execute()
                    o = owner.data[0] if owner.data else {}
                    contact = f"📞 {o.get('phone','')}" if o.get("phone") else f"📧 {o.get('email','')}"
                    notifications.append({
                        "id":      f"req_acc_{r['id']}",
                        "type":    "accepted",
                        "icon":    "✅",
                        "title":   "Request Accepted!",
                        "message": f"Owner accepted your request for {p.get('title','property')}. Owner: {o.get('name','')} {contact}",
                        "time":    r.get("created_at", ""),
                        "read":    False,
                        "action":  "requests"
                    })

                # 2. Rejected requests
                rejected = (
                    supabase.table("rental_requests")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "rejected")
                    .execute()
                )
                for r in rejected.data:
                    prop = supabase.table("properties").select("title").eq("id", r["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    notifications.append({
                        "id":      f"req_rej_{r['id']}",
                        "type":    "rejected",
                        "icon":    "❌",
                        "title":   "Request Declined",
                        "message": f"Owner declined your request for {ptitle}.",
                        "time":    r.get("created_at", ""),
                        "read":    False,
                        "action":  "requests"
                    })

                # 3. Agreement needs tenant approval
                pending = (
                    supabase.table("agreements")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "pending_approval")
                    .eq("owner_approved", True)
                    .eq("tenant_approved", False)
                    .execute()
                )
                for ag in pending.data:
                    prop = supabase.table("properties").select("title").eq("id", ag["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    notifications.append({
                        "id":      f"ag_sign_{ag['id']}",
                        "type":    "agreement",
                        "icon":    "✍️",
                        "title":   "Agreement Ready to Sign",
                        "message": f"Owner approved the agreement for {ptitle}. Please review and approve.",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

                # 4. Active agreements
                active = (
                    supabase.table("agreements")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "active")
                    .execute()
                )
                for ag in active.data:
                    prop = supabase.table("properties").select("title").eq("id", ag["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    notifications.append({
                        "id":      f"ag_active_{ag['id']}",
                        "type":    "active",
                        "icon":    "🎉",
                        "title":   "Agreement Active!",
                        "message": f"Your rental agreement for {ptitle} is now active. Enjoy your stay!",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

        return notifications

    except Exception as e:
        print("NOTIFICATIONS ERROR:", str(e))
        return []
