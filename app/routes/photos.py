from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import JSONResponse
from app.database import supabase
from app import auth
import uuid
import os

router = APIRouter(prefix="/photos", tags=["Photos"])

BUCKET      = "property-images"
SUPABASE_URL = os.getenv("SUPABASE_URL")


@router.get("/thumbnails")
def get_thumbnails(ids: str = Query(..., description="Comma-separated property IDs")):
    """Get thumbnails for multiple properties in one call — prevents rate limiting."""
    try:
        prop_ids = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
        if not prop_ids:
            return {}

        # Get one thumbnail per property
        photos = (
            supabase.table("property_photos")
            .select("property_id, url, is_thumbnail")
            .in_("property_id", prop_ids)
            .execute()
        )

        result = {}
        # First pass: thumbnails
        for ph in photos.data:
            pid = ph["property_id"]
            if ph["is_thumbnail"]:
                result[pid] = ph["url"]

        # Second pass: first photo fallback
        for ph in photos.data:
            pid = ph["property_id"]
            if pid not in result:
                result[pid] = ph["url"]

        return result
    except Exception as e:
        print("THUMBNAILS ERROR:", str(e))
        return {}


@router.post("/{property_id}")
async def upload_photo(
    property_id: int,
    file: UploadFile = File(...),
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Owner uploads a photo for a property."""
    try:
        # Verify property belongs to owner
        prop = supabase.table("properties").select("id").eq("id", property_id).eq("owner_id", owner_id).execute()
        if not prop.data:
            raise HTTPException(status_code=403, detail="Not your property")

        # Validate file type
        allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP images allowed")

        # Read file content
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

        # Generate unique filename
        ext      = file.filename.split(".")[-1].lower()
        filename = f"property_{property_id}/{uuid.uuid4()}.{ext}"

        # Upload to Supabase Storage
        res = supabase.storage.from_(BUCKET).upload(
            path=filename,
            file=content,
            file_options={"content-type": file.content_type}
        )

        # Get public URL
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"

        # Save URL to property_photos table
        photo = supabase.table("property_photos").insert({
            "property_id": property_id,
            "url":         public_url,
            "filename":    filename,
            "is_thumbnail": False
        }).execute()

        return {
            "success":    True,
            "message":    "Photo uploaded successfully",
            "url":        public_url,
            "photo_id":   photo.data[0]["id"] if photo.data else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print("UPLOAD ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{property_id}")
def get_photos(property_id: int):
    """Get all photos for a property (public)."""
    try:
        photos = (
            supabase.table("property_photos")
            .select("*")
            .eq("property_id", property_id)
            .order("is_thumbnail", desc=True)
            .execute()
        )
        return photos.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{photo_id}/set-thumbnail")
def set_thumbnail(
    photo_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Set a photo as the thumbnail for the property."""
    try:
        # Get the photo
        photo = supabase.table("property_photos").select("*").eq("id", photo_id).execute()
        if not photo.data:
            raise HTTPException(status_code=404, detail="Photo not found")
        p = photo.data[0]

        # Verify owner
        prop = supabase.table("properties").select("id").eq("id", p["property_id"]).eq("owner_id", owner_id).execute()
        if not prop.data:
            raise HTTPException(status_code=403, detail="Not your property")

        # Unset all thumbnails for this property
        supabase.table("property_photos").update({"is_thumbnail": False}).eq("property_id", p["property_id"]).execute()

        # Set this as thumbnail
        supabase.table("property_photos").update({"is_thumbnail": True}).eq("id", photo_id).execute()

        return {"success": True, "message": "Thumbnail set"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{photo_id}")
def delete_photo(
    photo_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Delete a photo."""
    try:
        photo = supabase.table("property_photos").select("*").eq("id", photo_id).execute()
        if not photo.data:
            raise HTTPException(status_code=404, detail="Photo not found")
        p = photo.data[0]

        # Verify owner
        prop = supabase.table("properties").select("id").eq("id", p["property_id"]).eq("owner_id", owner_id).execute()
        if not prop.data:
            raise HTTPException(status_code=403, detail="Not your property")

        # Delete from storage
        try:
            supabase.storage.from_(BUCKET).remove([p["filename"]])
        except Exception:
            pass  # If storage delete fails, still remove DB record

        # Delete from DB
        supabase.table("property_photos").delete().eq("id", photo_id).execute()

        return {"success": True, "message": "Photo deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
