from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import (
    user,
    property,
    tenant,
    agreement,
    payment,
    rental_requests,
    notifications,
    photos
)

app = FastAPI(
    title="Property Rental Management System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user.router)
app.include_router(property.router)
app.include_router(tenant.router)
app.include_router(agreement.router)
app.include_router(payment.router)
app.include_router(rental_requests.router)
app.include_router(notifications.router)
app.include_router(photos.router)

@app.get("/")
def root():
    return {
        "message": "Rental Management System API Running 🚀"
    }

@app.get("/health")
def health():
    return {"status": "ok"}