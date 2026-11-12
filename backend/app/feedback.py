"""Feedback refers to server-recorded tutor replies, preserving the original exchange."""
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from .models import ApiModel


class FeedbackRequest(ApiModel):
    reply_id: UUID
    rating: Literal["up", "down"]
    explanation: str = Field(min_length=1, max_length=4000)
    user: str = Field(min_length=1, max_length=100)

    @field_validator("explanation", "user", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
