from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("/")
def create_tenant(
    tenant: schemas.TenantCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Owner manually adds a tenant to their property."""
    check = (
        supabase.table("properties")
        .select("id")
        .eq("id", tenant.property_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=403, detail="Property not found or not yours")

    response = supabase.table("tenants").insert({
        "name":        tenant.name,
        "phone":       tenant.phone,
        "email":       tenant.email,
        "property_id": tenant.property_id
    }).execute()
    return response.data


@router.get("/")
def get_tenants(owner_id: int = Depends(auth.get_current_user_id)):
    """Owner: get all tenants in their properties (by property_id OR by agreement)."""
    try:
        # Get owner's property IDs
        props = (
            supabase.table("properties")
            .select("id")
            .eq("owner_id", owner_id)
            .execute()
        )
        prop_ids = [p["id"] for p in props.data]
        if not prop_ids:
            return []

        # Get tenants whose property_id matches
        by_property = (
            supabase.table("tenants")
            .select("*")
            .in_("property_id", prop_ids)
            .execute()
        )

        # Also get tenants who have agreements on owner's properties
        agreements = (
            supabase.table("agreements")
            .select("tenant_id")
            .in_("property_id", prop_ids)
            .execute()
        )
        tenant_ids_from_agreements = list({a["tenant_id"] for a in agreements.data})

        # Merge both sets
        seen_ids = {t["id"] for t in by_property.data}
        all_tenants = list(by_property.data)

        if tenant_ids_from_agreements:
            by_agreement = (
                supabase.table("tenants")
                .select("*")
                .in_("id", tenant_ids_from_agreements)
                .execute()
            )
            for t in by_agreement.data:
                if t["id"] not in seen_ids:
                    all_tenants.append(t)
                    seen_ids.add(t["id"])

        return all_tenants
    except Exception as e:
        print("GET TENANTS ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_id}")
def remove_tenant(
    tenant_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Owner removes a tenant — unarchives the property automatically."""
    try:
        tenant = supabase.table("tenants").select("*").eq("id", tenant_id).execute()
        if not tenant.data:
            raise HTTPException(status_code=404, detail="Tenant not found")
        t = tenant.data[0]

        print(f"REMOVE TENANT: tenant_id={tenant_id}, owner_id={owner_id}, tenant.property_id={t.get('property_id')}")

        property_id_to_unarchive = None

        if t.get("property_id"):
            prop = supabase.table("properties").select("id,owner_id").eq("id", t["property_id"]).execute()
            if prop.data:
                print(f"Property owner_id in DB: {prop.data[0]['owner_id']}, requesting owner_id: {owner_id}")
                if prop.data[0]["owner_id"] != owner_id:
                    raise HTTPException(status_code=403, detail=f"Not your property (owned by {prop.data[0]['owner_id']}, you are {owner_id})")
                property_id_to_unarchive = t["property_id"]
        else:
            # Tenant has no property_id — check via agreements
            ag = supabase.table("agreements").select("property_id").eq("tenant_id", tenant_id).execute()
            if ag.data:
                for a in ag.data:
                    prop = supabase.table("properties").select("id,owner_id").eq("id", a["property_id"]).execute()
                    if prop.data and prop.data[0]["owner_id"] == owner_id:
                        property_id_to_unarchive = a["property_id"]
                        break

        if property_id_to_unarchive:
            # Terminate active agreements
            supabase.table("agreements").update({"status": "terminated"}).eq("tenant_id", tenant_id).eq("property_id", property_id_to_unarchive).execute()
            # Unarchive the property
            supabase.table("properties").update({"status": "available"}).eq("id", property_id_to_unarchive).execute()

        supabase.table("tenants").delete().eq("id", tenant_id).execute()
        return {"success": True, "message": "Tenant removed and property is now available again"}

    except HTTPException:
        raise
    except Exception as e:
        print("REMOVE TENANT ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ── TENANT: Leave property (tenant-initiated) ─────────────────────
@router.post("/leave")
def tenant_leave_property(user_id: int = Depends(auth.get_current_user_id)):
    """
    Tenant initiates vacating their property.
    - Finds their active agreement
    - Terminates it
    - Sends a leave notification to owner
    - Does NOT immediately unarchive — owner must confirm first
    """
    try:
        user = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")
        u = user.data[0]

        # Find tenant record
        tenant = supabase.table("tenants").select("*").eq("email", u["email"]).execute()
        if not tenant.data:
            raise HTTPException(status_code=404, detail="No tenant record found")
        t = tenant.data[0]

        if not t.get("property_id"):
            raise HTTPException(status_code=400, detail="You are not assigned to any property")

        # Get property + owner info
        prop = supabase.table("properties").select("*").eq("id", t["property_id"]).execute()
        if not prop.data:
            raise HTTPException(status_code=404, detail="Property not found")
        p = prop.data[0]

        # Find active agreement
        ag = (
            supabase.table("agreements")
            .select("*")
            .eq("tenant_id", t["id"])
            .eq("property_id", t["property_id"])
            .in_("status", ["active", "pending_approval"])
            .execute()
        )

        if not ag.data:
            raise HTTPException(status_code=400, detail="No active agreement found for this property")

        agreement_id = ag.data[0]["id"]

        # Mark agreement as vacating_pending (owner needs to confirm)
        supabase.table("agreements").update({
            "status": "vacating_pending"
        }).eq("id", agreement_id).execute()

        # NOTE: Do NOT clear property_id here — only clear it when owner confirms vacate
        # This prevents the broken state if owner rejects the vacate request

        return {
            "message": "Leave request sent to owner. They will confirm and make the property available.",
            "property_title": p.get("title", ""),
            "owner_id": p.get("owner_id")
        }

    except HTTPException:
        raise
    except Exception as e:
        print("TENANT LEAVE ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-profile")
def get_my_tenant_profile(user_id: int = Depends(auth.get_current_user_id)):
    """Tenant: get their own tenant record."""
    user = supabase.table("users").select("email").eq("id", user_id).execute()
    if not user.data:
        return None
    email = user.data[0]["email"]
    tenant = supabase.table("tenants").select("*").eq("email", email).execute()
    return tenant.data[0] if tenant.data else None
