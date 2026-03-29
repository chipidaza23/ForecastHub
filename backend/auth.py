"""
auth.py — Optional JWT verification middleware for Supabase auth.

When SUPABASE_JWT_SECRET is set, protected endpoints require a valid
Bearer token. When unset, auth is disabled (open access for local dev).
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# Warn at import time if running in production without auth configured
if os.getenv("ENVIRONMENT") == "production" and not os.getenv("SUPABASE_JWT_SECRET"):
    logger.warning(
        "SUPABASE_JWT_SECRET is not set while ENVIRONMENT=production. "
        "All authenticated endpoints will reject requests."
    )


@dataclass
class AuthUser:
    user_id: str


def _get_jwt_secret() -> Optional[str]:
    return os.getenv("SUPABASE_JWT_SECRET")


async def verify_token(request: Request) -> AuthUser:
    """
    FastAPI dependency that verifies a Supabase JWT from the Authorization header.

    Returns an AuthUser with the user_id extracted from the token's 'sub' claim
    if auth is enabled, or AuthUser(user_id="default") if auth is disabled.
    In production, missing JWT secret causes a 401 error.
    """
    secret = _get_jwt_secret()
    if not secret:
        if os.getenv("ENVIRONMENT") == "production":
            raise HTTPException(
                status_code=401,
                detail="Authentication is not configured on this server",
            )
        return AuthUser(user_id="default")  # Auth disabled — open access

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header.split(" ", 1)[1]
    try:
        import jwt

        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return AuthUser(user_id=payload["sub"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
