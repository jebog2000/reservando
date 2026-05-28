import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/google-calendar", tags=["google-calendar"])

# Google OAuth2 credentials from environment
GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_OAUTH_REFRESH_TOKEN = os.environ.get("GOOGLE_OAUTH_REFRESH_TOKEN")

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
CALENDAR_ID = "primary"


# ---------- Pydantic Schemas ----------
class CreateEventRequest(BaseModel):
    summary: str
    description: str = ""
    start_datetime: str  # ISO format
    end_datetime: str  # ISO format
    attendee_email: Optional[str] = None
    location: Optional[str] = None


class CreateEventResponse(BaseModel):
    event_id: str
    event_link: str


class UpdateEventRequest(BaseModel):
    event_id: str
    summary: Optional[str] = None
    description: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    attendee_email: Optional[str] = None
    location: Optional[str] = None


class UpdateEventResponse(BaseModel):
    event_id: str
    event_link: str


class CancelEventRequest(BaseModel):
    event_id: str


class CancelEventResponse(BaseModel):
    message: str


# ---------- Helper Functions ----------
async def get_access_token() -> str:
    """Exchange refresh token for a new access token."""
    if not GOOGLE_OAUTH_CLIENT_ID or not GOOGLE_OAUTH_CLIENT_SECRET or not GOOGLE_OAUTH_REFRESH_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN environment variables."
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
                "refresh_token": GOOGLE_OAUTH_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
            timeout=10.0,
        )

        if response.status_code != 200:
            logger.error(f"Failed to get access token: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to obtain Google access token: {response.text}"
            )

        data = response.json()
        return data["access_token"]


def build_event_body(
    summary: Optional[str] = None,
    description: Optional[str] = None,
    start_datetime: Optional[str] = None,
    end_datetime: Optional[str] = None,
    attendee_email: Optional[str] = None,
    location: Optional[str] = None,
) -> dict:
    """Build the Google Calendar event body from provided fields."""
    body = {}

    if summary is not None:
        body["summary"] = summary
    if description is not None:
        body["description"] = description
    if start_datetime is not None:
        body["start"] = {"dateTime": start_datetime, "timeZone": "America/Sao_Paulo"}
    if end_datetime is not None:
        body["end"] = {"dateTime": end_datetime, "timeZone": "America/Sao_Paulo"}
    if location is not None:
        body["location"] = location
    if attendee_email is not None:
        body["attendees"] = [{"email": attendee_email}]

    return body


# ---------- Routes ----------
@router.post("/create-event", response_model=CreateEventResponse)
async def create_event(data: CreateEventRequest):
    """Create a Google Calendar event for a reservation."""
    logger.info(f"Creating calendar event: {data.summary}")

    access_token = await get_access_token()

    event_body = build_event_body(
        summary=data.summary,
        description=data.description,
        start_datetime=data.start_datetime,
        end_datetime=data.end_datetime,
        attendee_email=data.attendee_email,
        location=data.location,
    )

    url = f"{GOOGLE_CALENDAR_API_BASE}/calendars/{CALENDAR_ID}/events"
    params = {"sendUpdates": "all"}  # Send email invites to attendees

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json=event_body,
            params=params,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15.0,
        )

        if response.status_code not in (200, 201):
            logger.error(f"Failed to create event: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create Google Calendar event: {response.text}"
            )

        result = response.json()

    logger.info(f"Calendar event created: {result.get('id')}")

    return CreateEventResponse(
        event_id=result["id"],
        event_link=result.get("htmlLink", ""),
    )


@router.put("/update-event", response_model=UpdateEventResponse)
async def update_event(data: UpdateEventRequest):
    """Update an existing Google Calendar event."""
    logger.info(f"Updating calendar event: {data.event_id}")

    access_token = await get_access_token()

    event_body = build_event_body(
        summary=data.summary,
        description=data.description,
        start_datetime=data.start_datetime,
        end_datetime=data.end_datetime,
        attendee_email=data.attendee_email,
        location=data.location,
    )

    if not event_body:
        raise HTTPException(status_code=400, detail="No fields to update provided")

    url = f"{GOOGLE_CALENDAR_API_BASE}/calendars/{CALENDAR_ID}/events/{data.event_id}"
    params = {"sendUpdates": "all"}

    async with httpx.AsyncClient() as client:
        response = await client.patch(
            url,
            json=event_body,
            params=params,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15.0,
        )

        if response.status_code != 200:
            logger.error(f"Failed to update event: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to update Google Calendar event: {response.text}"
            )

        result = response.json()

    logger.info(f"Calendar event updated: {result.get('id')}")

    return UpdateEventResponse(
        event_id=result["id"],
        event_link=result.get("htmlLink", ""),
    )


@router.post("/cancel-event", response_model=CancelEventResponse)
async def cancel_event(data: CancelEventRequest):
    """Cancel/delete a Google Calendar event."""
    logger.info(f"Cancelling calendar event: {data.event_id}")

    access_token = await get_access_token()

    url = f"{GOOGLE_CALENDAR_API_BASE}/calendars/{CALENDAR_ID}/events/{data.event_id}"
    params = {"sendUpdates": "all"}  # Notify attendees of cancellation

    async with httpx.AsyncClient() as client:
        response = await client.delete(
            url,
            params=params,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15.0,
        )

        if response.status_code not in (200, 204):
            logger.error(f"Failed to cancel event: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to cancel Google Calendar event: {response.text}"
            )

    logger.info(f"Calendar event cancelled: {data.event_id}")

    return CancelEventResponse(message=f"Event {data.event_id} cancelled successfully")