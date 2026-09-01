"""WhatsApp diffusion bot using Twilio WhatsApp Business API."""

import logging
from dataclasses import dataclass
from typing import Any, Self

import httpx

logger = logging.getLogger(__name__)


@dataclass
class WhatsAppConfig:
    """Configuration for the WhatsApp diffusion bot."""

    account_sid: str = ""
    auth_token: str = ""
    from_number: str = ""
    base_url: str = "https://api.twilio.com/2010-04-01"


@dataclass
class DiffusionResult:
    """Result of a WhatsApp diffusion operation."""

    message_id: str
    success: bool
    status: str = "pending"
    error: str | None = None
    recipient: str = ""


class WhatsAppDiffusionBot:
    """Bot for diffusing promotional offers to WhatsApp contacts.

    Uses Twilio WhatsApp Business API for programmatic messaging.
    Supports single messages, broadcast diffusion, and template messages.

    Example:
        bot = WhatsAppDiffusionBot(
            account_sid="AC...",
            auth_token="token",
            from_number="whatsapp:+14155238886",
        )
        result = await bot.send_diffusion("+521234567890", "🔥 OFERTA 2x800")
    """

    def __init__(self, config: WhatsAppConfig | None = None) -> None:
        self.config = config or WhatsAppConfig()
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the Twilio HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(base_url=self.config.base_url)
        return self._client

    async def send_message(
        self,
        to: str,
        message: str,
        media_url: str | None = None,
    ) -> DiffusionResult:
        """Send a WhatsApp message to a single recipient.

        Args:
            to: Recipient phone number in E.164 format (e.g., +521234567890).
            message: The message text.
            media_url: Optional media URL to send with the message.

        Returns:
            DiffusionResult with message ID and status.
        """
        client = await self._get_client()
        logger.info("Sending WhatsApp message to %s", to)

        data: dict[str, Any] = {
            "From": self.config.from_number,
            "To": to,
            "Body": message,
        }
        if media_url:
            data["MediaUrl"] = media_url

        try:
            response = await client.post(
                f"/Accounts/{self.config.account_sid}/Messages.json",
                data=data,
                auth=(self.config.account_sid, self.config.auth_token),
            )
            response.raise_for_status()
            result_data: dict[str, Any] = response.json()
            return DiffusionResult(
                message_id=result_data.get("sid", ""),
                success=True,
                status="sent",
                recipient=to,
            )
        except httpx.HTTPStatusError as e:
            logger.error("WhatsApp API error: %s", e)
            return DiffusionResult(
                message_id="",
                success=False,
                status="failed",
                error=str(e),
                recipient=to,
            )

    async def broadcast_diffusion(
        self,
        recipients: list[str],
        message: str,
        media_url: str | None = None,
    ) -> list[DiffusionResult]:
        """Broadcast a diffusion message to multiple recipients.

        Args:
            recipients: List of phone numbers in E.164 format.
            message: The message text to send.
            media_url: Optional media URL.

        Returns:
            List of DiffusionResult for each recipient.
        """
        results: list[DiffusionResult] = []
        for recipient in recipients:
            result = await self.send_message(recipient, message, media_url)
            results.append(result)
            logger.info(
                "Broadcast to %s: %s",
                recipient,
                result.status,
            )
        return results

    async def send_template_message(
        self,
        to: str,
        template_name: str,
        template_params: list[str] | None = None,
    ) -> DiffusionResult:
        """Send a pre-approved template message.

        Template messages must be approved by Meta before use.

        Args:
            to: Recipient phone number in E.164 format.
            template_name: The name of the approved template.
            template_params: Optional parameters for the template.

        Returns:
            DiffusionResult with message ID and status.
        """
        client = await self._get_client()
        logger.info("Sending WhatsApp template %s to %s", template_name, to)

        data: dict[str, Any] = {
            "From": self.config.from_number,
            "To": to,
            "Type": "template",
            "Template": {
                "Name": template_name,
            },
        }
        if template_params:
            data["Template"]["Parameters"] = template_params

        try:
            response = await client.post(
                f"/Accounts/{self.config.account_sid}/Messages.json",
                data=data,
                auth=(self.config.account_sid, self.config.auth_token),
            )
            response.raise_for_status()
            result_data: dict[str, Any] = response.json()
            return DiffusionResult(
                message_id=result_data.get("sid", ""),
                success=True,
                status="sent",
                recipient=to,
            )
        except httpx.HTTPStatusError as e:
            logger.error("WhatsApp template API error: %s", e)
            return DiffusionResult(
                message_id="",
                success=False,
                status="failed",
                error=str(e),
                recipient=to,
            )

    async def get_message_status(self, message_id: str) -> DiffusionResult:
        """Check the delivery status of a sent message.

        Args:
            message_id: The message SID.

        Returns:
            DiffusionResult with current delivery status.
        """
        client = await self._get_client()
        response = await client.get(
            f"/Accounts/{self.config.account_sid}/Messages/{message_id}.json",
            auth=(self.config.account_sid, self.config.auth_token),
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return DiffusionResult(
            message_id=message_id,
            success=data.get("status") == "delivered",
            status=data.get("status", "unknown"),
            recipient=data.get("to", ""),
        )

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.close()
