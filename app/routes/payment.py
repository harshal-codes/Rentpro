from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/")
def create_payment(
    payment: schemas.PaymentCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    response = (
        supabase.table("payments")
        .insert({
            "tenant_id": payment.tenant_id,
            "amount":    payment.amount,
            "date":      str(payment.date),
            "status":    payment.status
        })
        .execute()
    )
    return response.data


@router.get("/")
def get_payments(owner_id: int = Depends(auth.get_current_user_id)):
    """Owner: payments for tenants in their properties."""
    props = (
        supabase.table("properties")
        .select("id")
        .eq("owner_id", owner_id)
        .execute()
    )
    prop_ids = [p["id"] for p in props.data]
    if not prop_ids:
        return []

    tenants = (
        supabase.table("tenants")
        .select("id")
        .in_("property_id", prop_ids)
        .execute()
    )
    tenant_ids = [t["id"] for t in tenants.data]
    if not tenant_ids:
        return []

    response = (
        supabase.table("payments")
        .select("*")
        .in_("tenant_id", tenant_ids)
        .execute()
    )
    return response.data


@router.get("/my")
def get_my_payments(user_id: int = Depends(auth.get_current_user_id)):
    """Tenant: payments linked to their tenant record."""
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
        supabase.table("payments")
        .select("*")
        .in_("tenant_id", tenant_ids)
        .execute()
    )
    return response.data
