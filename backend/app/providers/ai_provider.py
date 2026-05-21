import asyncio
import hashlib
import random
from typing import Protocol, NamedTuple, Optional
from app.core.config import settings

class GenerationResult(NamedTuple):
    success: bool
    result_url: Optional[str]
    error: Optional[str]

class AIProvider(Protocol):
    async def generate(self, prompt: str, round_context: str) -> GenerationResult:
        ...

class MockAIProvider:
    async def generate(self, prompt: str, round_context: str) -> GenerationResult:
        normalized_prompt = prompt.lower().strip()
        
        # Determine if we should simulate a failure
        should_fail = "fail" in normalized_prompt or random.random() < settings.MOCK_AI_FAILURE_RATE
        
        # Determine if we should simulate a timeout
        should_timeout = "timeout" in normalized_prompt or random.random() < settings.MOCK_AI_TIMEOUT_RATE
        
        # Simulate generation delay
        if should_timeout:
            # Sleep longer than the watchdog timeout (e.g. 20s) to trigger timeout
            await asyncio.sleep(20.0)
            return GenerationResult(
                success=False,
                result_url=None,
                error="Generation timed out"
            )
            
        await asyncio.sleep(settings.MOCK_AI_DELAY_SECONDS)
        
        if should_fail:
            return GenerationResult(
                success=False,
                result_url=None,
                error="Safety filters triggered or internal AI generator error"
            )
            
        # Success state: Use Picsum Photos with md5 of prompt as seed for deterministic gorgeous images
        prompt_hash = hashlib.md5(prompt.encode("utf-8")).hexdigest()
        result_url = f"https://picsum.photos/seed/{prompt_hash}/500/500"
        
        return GenerationResult(
            success=True,
            result_url=result_url,
            error=None
        )

# Factory to get configured AI Provider
def get_ai_provider() -> AIProvider:
    # Future extension: if settings.OPENAI_API_KEY is configured, return OpenAIProvider
    return MockAIProvider()
class_name = "AIProvider"
