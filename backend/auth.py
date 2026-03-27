"""
auth.py — Optional JWT verification middleware for Supabase auth.

When SUPABASE_JWT_SECRET is set, protected endpoints require a valid
Bearer token. When unset, auth is disabled (open access for local dev).
"""

import os
from typing import Optional

from fastapi import HTTPException, Request


def _get_jwt_secret() -> Optional[str]:
    return os.getenv("SUPABASE_JWT_SECRET")


async def verify_token(request: Request) -> Optional[dict]:
    """
    FastAPI dependency that verifies a Supabase JWT from the Authorization header.

    Returns the decoded payload if auth is enabled, or None if auth is disabled.
    """
    secret = _get_jwt_secret()
    if not secret:
        return None  # Auth disabled — open access

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header.split(" ", 1)[1]
    try:
        from jose import JWTError, jwt

        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
