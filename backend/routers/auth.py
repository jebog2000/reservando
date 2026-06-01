import hashlib
import logging
import os

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.auth import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "jorge@forneriagiorgio.com")
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")
PASSWORD_SALT = os.environ.get("PASSWORD_SALT", "reservando_salt_2026")


class LoginRequest(BaseModel):
    email: str
    password: str


def verify_password(password: str, stored_hash: str) -> bool:
    computed = hashlib.sha256((PASSWORD_SALT + password).encode()).hexdigest()
    return computed == stored_hash


@router.get("/login")
async def login():
    """Return login page URL."""
    return {"redirect_url": "/login"}


@router.post("/login")
async def do_login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password."""
    email = body.email.strip().lower()
    password = body.password

    admin_email = ADMIN_EMAIL.strip().lower()

    if email != admin_email or not verify_password(password, ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")

    auth_service = AuthService(db)
    user = await auth_service.get_or_create_user(
        platform_sub=f"admin-{admin_email}",
        email=admin_email,
        name="Admin",
    )

    app_token, expires_at, _ = await auth_service.issue_app_token(user=user)

    return {
        "token": app_token,
        "expires_at": int(expires_at.timestamp()),
        "token_type": "Bearer",
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/logout")
async def logout():
    """Logout user."""
    return {"redirect_url": "/login"}
