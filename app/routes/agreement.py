from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/agreements", tags=["Agreements"])


@router.post("/")
def create_agreement(
    agreement: schemas.AgreementCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    # Verify property belongs to owner
    check = (
        supabase.table("properties")
        .select("id")
        .eq("id", agreement.property_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=403, detail="Property not found or not yours")

    response = (
        supabase.table("agreements")
        .insert({
            "tenant_id":   agreement.tenant_id,
            "property_id": agreement.property_id,
            "start_date":  str(agreement.start_date),
            "end_date":    str(agreement.end_date),
            "rent":        agreement.rent,
            "deposit":     agreement.deposit
        })
        .execute()
    )
    return response.data


@router.get("/")
def get_agreements(owner_id: int = Depends(auth.get_current_user_id)):
    """Return agreements for this owner's properties — enriched with tenant & property names."""
    try:
        props = (
            supabase.table("properties")
            .select("id,title,location")
            .eq("owner_id", owner_id)
            .execute()
        )
        prop_ids  = [p["id"] for p in props.data]
        prop_map  = {p["id"]: p for p in props.data}
        if not prop_ids:
            return []

        agreements = (
            supabase.table("agreements")
            .select("*")
            .in_("property_id", prop_ids)
            .execute()
        )

        # Enrich each agreement with tenant name and property title
        result = []
        for ag in agreements.data:
            tenant = supabase.table("tenants").select("id,name,email,phone").eq("id", ag["tenant_id"]).execute()
            t = tenant.data[0] if tenant.data else {}
            p = prop_map.get(ag["property_id"], {})
            result.append({
                **ag,
                "tenant_name":    t.get("name", ""),
                "tenant_email":   t.get("email", ""),
                "tenant_phone":   t.get("phone", ""),
                "property_title": p.get("title", ""),
                "property_location": p.get("location", "")
            })
        return result
    except Exception as e:
        print("GET AGREEMENTS ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my")
def get_my_agreements(user_id: int = Depends(auth.get_current_user_id)):
    """Tenant: return agreements by email match with full status."""
    user = (
        supabase.table("users")
        .select("email")
        .eq("id", user_id)
        .execute()
    )
    if not user.data:
        return []

    email = user.data[0]["email"]
    tenant = (
        supabase.table("tenants")
        .select("id")
        .eq("email", email)
        .execute()
    )
    if not tenant.data:
        return []

    tenant_ids = [t["id"] for t in tenant.data]
    response = (
        supabase.table("agreements")
        .select("*")
        .in_("tenant_id", tenant_ids)
        .execute()
    )
    return response.data
