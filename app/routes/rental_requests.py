from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import auth
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/requests", tags=["Rental Requests"])


class RentalRequestCreate(BaseModel):
    property_id: int
    phone: str
    start_date: str
    end_date: str
    message: Optional[str] = ""


@router.post("/")
def create_request(
    req: RentalRequestCreate,
    user_id: int = Depends(auth.get_current_user_id)
):
    try:
        # Get user info
        user = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")
        u = user.data[0]

        # Get or create tenant record
        tenant_rec = supabase.table("tenants").select("*").eq("email", u["email"]).execute()
        if tenant_rec.data:
            tenant_id = tenant_rec.data[0]["id"]
            # Update phone
            if req.phone:
                supabase.table("tenants").update({
                    "phone": req.phone,
                    "property_id": req.property_id
                }).eq("id", tenant_id).execute()
        else:
            try:
                new_t = supabase.table("tenants").insert({
                    "name":        u["name"],
                    "email":       u["email"],
                    "phone":       req.phone,
                    "property_id": req.property_id
                }).execute()
                tenant_id = new_t.data[0]["id"]
            except Exception as te:
                raise HTTPException(status_code=500, detail=f"Tenant create error: {str(te)}")

        # Check for duplicate
        existing = (
            supabase.table("rental_requests")
            .select("id,status")
            .eq("tenant_id", tenant_id)
            .eq("property_id", req.property_id)
            .execute()
        )
        if existing.data:
            st = existing.data[0]["status"]
            if st == "pending":
                raise HTTPException(status_code=400, detail="You already have a pending request for this property")
            if st == "accepted":
                raise HTTPException(status_code=400, detail="Your request was already accepted")

        # Get property + owner info
        prop = supabase.table("properties").select("*").eq("id", req.property_id).execute()
        if not prop.data:
            raise HTTPException(status_code=404, detail="Property not found")
        p = prop.data[0]

        owner = supabase.table("users").select("name,phone,email").eq("id", p["owner_id"]).execute()
        owner_info = owner.data[0] if owner.data else {}

        # Insert rental request
        result = supabase.table("rental_requests").insert({
            "tenant_id":   tenant_id,
            "property_id": req.property_id,
            "start_date":  req.start_date,
            "end_date":    req.end_date,
            "phone":       req.phone,
            "message":     req.message or "",
            "status":      "pending"
        }).execute()

        return {
            "message": "Request sent! Here is the owner's contact.",
            "request": result.data[0] if result.data else {},
            "owner_contact": {
                "name":  owner_info.get("name", ""),
                "phone": owner_info.get("phone", ""),
                "email": owner_info.get("email", "")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print("CREATE REQUEST ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ── TENANT: Get my requests (with owner contact) ──────────────────
@router.get("/my")
def get_my_requests(user_id: int = Depends(auth.get_current_user_id)):
    user = supabase.table("users").select("email").eq("id", user_id).execute()
    if not user.data:
        return []
    email = user.data[0]["email"]

    tenant = supabase.table("tenants").select("id").eq("email", email).execute()
    if not tenant.data:
        return []

    tenant_ids = [t["id"] for t in tenant.data]
    requests = (
        supabase.table("rental_requests")
        .select("*")
        .in_("tenant_id", tenant_ids)
        .execute()
    )

    # Enrich with property + owner contact info
    result = []
    for r in requests.data:
        prop = supabase.table("properties").select("*").eq("id", r["property_id"]).execute()
        p = prop.data[0] if prop.data else {}
        owner = supabase.table("users").select("name,phone,email").eq("id", p.get("owner_id", 0)).execute()
        o = owner.data[0] if owner.data else {}
        result.append({
            **r,
            "property":      p,
            "owner_contact": o
        })
    return result


# ── OWNER: Get all requests for my properties ─────────────────────
@router.get("/incoming")
def get_incoming_requests(owner_id: int = Depends(auth.get_current_user_id)):
    try:
        props = supabase.table("properties").select("id").eq("owner_id", owner_id).execute()
        prop_ids = [p["id"] for p in props.data]
        if not prop_ids:
            return []

        all_requests = (
            supabase.table("rental_requests")
            .select("*")
            .in_("property_id", prop_ids)
            .execute()
        )

        result = []
        for r in all_requests.data:
            tenant = supabase.table("tenants").select("*").eq("id", r["tenant_id"]).execute()
            t = tenant.data[0] if tenant.data else {}
            if not t.get("name") and r.get("phone"):
                user_by_phone = supabase.table("users").select("name,email,phone").eq("phone", r["phone"]).execute()
                if user_by_phone.data:
                    t = {**t, "name": user_by_phone.data[0].get("name",""), "email": user_by_phone.data[0].get("email","")}
            prop = supabase.table("properties").select("*").eq("id", r["property_id"]).execute()
            p = prop.data[0] if prop.data else {}
            result.append({**r, "tenant": t, "property": p})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── OWNER: Accept a request → creates agreement ───────────────────
@router.post("/{request_id}/accept")
def accept_request(
    request_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    # Get the request
    req = supabase.table("rental_requests").select("*").eq("id", request_id).execute()
    if not req.data:
        raise HTTPException(status_code=404, detail="Request not found")
    r = req.data[0]

    # Verify this property belongs to owner
    prop = supabase.table("properties").select("*").eq("id", r["property_id"]).eq("owner_id", owner_id).execute()
    if not prop.data:
        raise HTTPException(status_code=403, detail="Not your property")
    p = prop.data[0]

    # Update request status to accepted
    supabase.table("rental_requests").update({"status": "accepted"}).eq("id", request_id).execute()

    # Auto-archive the property — it's now occupied
    supabase.table("properties").update({"status": "archived"}).eq("id", r["property_id"]).execute()

    # Create agreement with pending_approval status
    agreement = supabase.table("agreements").insert({
        "tenant_id":       r["tenant_id"],
        "property_id":     r["property_id"],
        "start_date":      r["start_date"],
        "end_date":        r["end_date"],
        "rent":            p["price"],
        "deposit":         p["price"] * 2,
        "status":          "pending_approval",
        "owner_approved":  True,    # owner already approved by accepting
        "tenant_approved": False
    }).execute()

    return {
        "message":   "Request accepted! Agreement created — waiting for tenant approval.",
        "agreement": agreement.data[0] if agreement.data else {}
    }


# ── OWNER: Reject a request ───────────────────────────────────────
@router.post("/{request_id}/reject")
def reject_request(
    request_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    req = supabase.table("rental_requests").select("*").eq("id", request_id).execute()
    if not req.data:
        raise HTTPException(status_code=404, detail="Request not found")
    r = req.data[0]

    prop = supabase.table("properties").select("id").eq("id", r["property_id"]).eq("owner_id", owner_id).execute()
    if not prop.data:
        raise HTTPException(status_code=403, detail="Not your property")

    supabase.table("rental_requests").update({"status": "rejected"}).eq("id", request_id).execute()
    return {"message": "Request rejected."}


# ── TENANT: Approve agreement ─────────────────────────────────────
@router.post("/agreements/{agreement_id}/tenant-approve")
def tenant_approve_agreement(
    agreement_id: int,
    user_id: int = Depends(auth.get_current_user_id)
):
    user = supabase.table("users").select("email").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    email = user.data[0]["email"]

    tenant = supabase.table("tenants").select("id").eq("email", email).execute()
    if not tenant.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant_id = tenant.data[0]["id"]

    ag = supabase.table("agreements").select("*").eq("id", agreement_id).eq("tenant_id", tenant_id).execute()
    if not ag.data:
        raise HTTPException(status_code=404, detail="Agreement not found")

    # Set tenant_approved = True
    updated = supabase.table("agreements").update({
        "tenant_approved": True
    }).eq("id", agreement_id).execute()

    # If owner already approved → mark active
    if ag.data[0].get("owner_approved"):
        supabase.table("agreements").update({"status": "active"}).eq("id", agreement_id).execute()
        return {"message": "Agreement fully approved! 🎉 Now ACTIVE.", "status": "active"}

    return {"message": "You approved the agreement. Waiting for owner.", "status": "pending_approval"}


# ── OWNER: Approve agreement ──────────────────────────────────────
@router.post("/agreements/{agreement_id}/owner-approve")
def owner_approve_agreement(
    agreement_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    ag = supabase.table("agreements").select("*").eq("id", agreement_id).execute()
    if not ag.data:
        raise HTTPException(status_code=404, detail="Agreement not found")

    prop = supabase.table("properties").select("id").eq("id", ag.data[0]["property_id"]).eq("owner_id", owner_id).execute()
    if not prop.data:
        raise HTTPException(status_code=403, detail="Not your property")

    supabase.table("agreements").update({"owner_approved": True}).eq("id", agreement_id).execute()

    if ag.data[0].get("tenant_approved"):
        supabase.table("agreements").update({"status": "active"}).eq("id", agreement_id).execute()
        return {"message": "Agreement fully approved! 🎉 Now ACTIVE.", "status": "active"}

    return {"message": "You approved. Waiting for tenant.", "status": "pending_approval"}


# ── OWNER: Confirm tenant vacating → unarchive property ──────────
@router.post("/confirm-vacate/{agreement_id}")
def confirm_vacate(
    agreement_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Owner confirms tenant has left → property becomes available again."""
    ag = supabase.table("agreements").select("*").eq("id", agreement_id).execute()
    if not ag.data:
        raise HTTPException(status_code=404, detail="Agreement not found")
    a = ag.data[0]

    # Verify property belongs to owner
    prop = supabase.table("properties").select("id").eq("id", a["property_id"]).eq("owner_id", owner_id).execute()
    if not prop.data:
        raise HTTPException(status_code=403, detail="Not your property")

    # Terminate agreement
    supabase.table("agreements").update({"status": "terminated"}).eq("id", agreement_id).execute()

    # Clear tenant's property_id now that leave is confirmed
    supabase.table("tenants").update({"property_id": None}).eq("id", a["tenant_id"]).execute()

    # Unarchive the property
    supabase.table("properties").update({"status": "available"}).eq("id", a["property_id"]).execute()

    return {"message": "Confirmed. Property is now available for new tenants.", "success": True}


# ── OWNER: Reject vacate (tenant stays) ──────────────────────────
@router.post("/reject-vacate/{agreement_id}")
def reject_vacate(
    agreement_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Owner rejects vacating request — keeps agreement active."""
    ag = supabase.table("agreements").select("*").eq("id", agreement_id).execute()
    if not ag.data:
        raise HTTPException(status_code=404, detail="Agreement not found")
    a = ag.data[0]

    prop = supabase.table("properties").select("id").eq("id", a["property_id"]).eq("owner_id", owner_id).execute()
    if not prop.data:
        raise HTTPException(status_code=403, detail="Not your property")

    # Revert to active
    supabase.table("agreements").update({"status": "active"}).eq("id", agreement_id).execute()

    return {"message": "Vacating request rejected. Agreement remains active.", "success": True}
