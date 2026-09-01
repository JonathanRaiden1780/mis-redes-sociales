"""API endpoints for WhatsApp diffusion via Twilio."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.server.core.social_clients.whatsapp import WhatsAppDiffusionBot, WhatsAppConfig
from src.server.models.database import DiffusionHistory

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


class SendMessageRequest(BaseModel):
    """Request to send a WhatsApp message."""
    campaign_id: int
    to: str
    message: Optional[str] = None


class SendBroadcastRequest(BaseModel):
    """Request to send a broadcast."""
    campaign_id: int
    recipients: list[str]
    message: Optional[str] = None


class SendResponse(BaseModel):
    """Response from send operation."""
    success: bool
    message_id: str = ""
    status: str = "pending"
    error: str = ""


# Global bot instance (configured via environment variables)
_bot: Optional[WhatsAppDiffusionBot] = None


def _get_bot() -> Optional[WhatsAppDiffusionBot]:
    """Get or create the WhatsApp bot."""
    global _bot
    if _bot is None:
        import os
        config = WhatsAppConfig(
            account_sid=os.getenv("TWILIO_ACCOUNT_SID", ""),
            auth_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
            from_number=os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886"),
        )
        if not config.account_sid or not config.auth_token:
            return None
        _bot = WhatsAppDiffusionBot(config)
    return _bot


def _get_db():
    """Get a database session."""
    from src.server.database import SessionLocal
    return SessionLocal()


@router.post("/send", response_model=SendResponse)
async def send_message(request: SendMessageRequest) -> SendResponse:
    """Send a WhatsApp message to a single recipient."""
    bot = _get_bot()
    if bot is None:
        return SendResponse(
            success=False,
            error="Twilio no configurado. Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN.",
        )
    
    try:
        # Get campaign message if not provided
        message = request.message
        if not message:
            db = _get_db()
            try:
                from src.server.models.database import Campaign
                campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
                if not campaign:
                    raise HTTPException(status_code=404, detail="Campaign not found")
                message = campaign.diffusion_message or campaign.amplified_prompt
            finally:
                db.close()
        
        result = await bot.send_message(request.to, message)
        
        # Save to history
        db = _get_db()
        try:
            history = DiffusionHistory(
                campaign_id=request.campaign_id,
                message=message,
                recipients=[request.to],
                status="sent" if result.success else "failed",
                message_id=result.message_id,
                error=result.error or "",
            )
            db.add(history)
            db.commit()
        finally:
            db.close()
        
        return SendResponse(
            success=result.success,
            message_id=result.message_id,
            status="sent" if result.success else "failed",
            error=result.error or "",
        )
    except Exception as e:
        return SendResponse(success=False, error=str(e))


@router.post("/broadcast", response_model=dict)
async def broadcast(request: SendBroadcastRequest) -> dict:
    """Send a broadcast to multiple recipients."""
    bot = _get_bot()
    if bot is None:
        return {
            "success": False,
            "error": "Twilio no configurado. Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN.",
        }
    
    try:
        # Get campaign message if not provided
        message = request.message
        if not message:
            db = _get_db()
            try:
                from src.server.models.database import Campaign
                campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
                if not campaign:
                    raise HTTPException(status_code=404, detail="Campaign not found")
                message = campaign.diffusion_message or campaign.amplified_prompt
            finally:
                db.close()
        
        results = await bot.broadcast_diffusion(request.recipients, message)
        
        # Save to history
        db = _get_db()
        try:
            success_count = sum(1 for r in results if r.success)
            history = DiffusionHistory(
                campaign_id=request.campaign_id,
                message=message,
                recipients=request.recipients,
                status="sent" if success_count == len(request.recipients) else "partial",
                message_id=",".join(r.message_id for r in results if r.success),
                error=",".join(r.error for r in results if r.error),
            )
            db.add(history)
            db.commit()
        finally:
            db.close()
        
        return {
            "success": True,
            "total": len(request.recipients),
            "sent": success_count,
            "failed": len(request.recipients) - success_count,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/config")
async def get_config() -> dict:
    """Get WhatsApp configuration status."""
    import os
    return {
        "configured": bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN")),
        "account_sid": os.getenv("TWILIO_ACCOUNT_SID", "")[:8] + "..." if os.getenv("TWILIO_ACCOUNT_SID") else "",
        "from_number": os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886"),
    }


@router.get("/history/{campaign_id}")
async def get_history(campaign_id: int) -> dict:
    """Get diffusion history for a campaign."""
    db = _get_db()
    try:
        history = db.query(DiffusionHistory).filter(DiffusionHistory.campaign_id == campaign_id).all()
        return {"history": [h.to_dict() for h in history]}
    finally:
        db.close()