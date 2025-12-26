"""FastAPI application with OpenAI-compatible chat completions endpoint."""

import json
import logging
import time
import uuid
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from .config import get_settings
from .engine import get_crm_engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CRM Query Backend",
    description="OpenAI-compatible API for CRM database queries using LlamaIndex",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# OpenAI-Compatible Models
# ============================================================================


class ChatMessage(BaseModel):
    """OpenAI chat message format."""

    role: str = Field(..., description="The role of the message author (system, user, assistant)")
    content: str = Field(..., description="The content of the message")


class ChatCompletionRequest(BaseModel):
    """OpenAI chat completion request format."""

    model: str = Field(default="crm-sql-engine", description="Model ID to use")
    messages: list[ChatMessage] = Field(..., description="List of messages in the conversation")
    temperature: Optional[float] = Field(default=0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(default=None, description="Maximum tokens to generate")
    stream: Optional[bool] = Field(default=False, description="Whether to stream the response")
    user: Optional[str] = Field(default=None, description="User identifier")


class ChatCompletionChoice(BaseModel):
    """OpenAI chat completion choice."""

    index: int
    message: ChatMessage
    finish_reason: str


class ChatCompletionUsage(BaseModel):
    """OpenAI token usage."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """OpenAI chat completion response format."""

    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage


class ModelInfo(BaseModel):
    """OpenAI model info."""

    id: str
    object: str = "model"
    created: int
    owned_by: str


class ModelsResponse(BaseModel):
    """OpenAI models list response."""

    object: str = "list"
    data: list[ModelInfo]


# ============================================================================
# Segment Models
# ============================================================================


class SegmentGenerateRequest(BaseModel):
    """Request to generate a segment from description."""

    description: str = Field(..., description="Natural language description of the segment")


class SegmentGenerateResponse(BaseModel):
    """Response with generated segment."""

    name: str
    sql: str


class SegmentExecuteRequest(BaseModel):
    """Request to execute a segment SQL."""

    sql: str = Field(..., description="SQL query to execute")


# ============================================================================
# Endpoints
# ============================================================================


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    engine = get_crm_engine()
    db_healthy = engine.health_check()
    return {
        "status": "healthy" if db_healthy else "unhealthy",
        "database": "connected" if db_healthy else "disconnected",
    }


@app.get("/v1/models")
async def list_models() -> ModelsResponse:
    """List available models (OpenAI-compatible)."""
    return ModelsResponse(
        data=[
            ModelInfo(
                id="crm-sql-engine",
                created=int(time.time()),
                owned_by="crm-backend",
            )
        ]
    )


@app.post("/v1/chat/completions", response_model=None)
async def chat_completions(request: ChatCompletionRequest):
    """
    OpenAI-compatible chat completions endpoint.

    This endpoint processes natural language queries about CRM data
    using LlamaIndex NLSQLTableQueryEngine.
    """
    # Extract the last user message as the query
    user_messages = [m for m in request.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message provided")

    query = user_messages[-1].content
    logger.info(f"Received query: {query}")

    engine = get_crm_engine()
    request_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created = int(time.time())

    if request.stream:
        return EventSourceResponse(
            stream_response(engine, query, request_id, created, request.model),
            media_type="text/event-stream",
        )

    # Non-streaming response
    try:
        response_text = await engine.query(query)

        return ChatCompletionResponse(
            id=request_id,
            created=created,
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatMessage(role="assistant", content=response_text),
                    finish_reason="stop",
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=len(query.split()),
                completion_tokens=len(response_text.split()),
                total_tokens=len(query.split()) + len(response_text.split()),
            ),
        )
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def stream_response(
    engine, query: str, request_id: str, created: int, model: str
) -> AsyncGenerator[str, None]:
    """Generate streaming SSE response in OpenAI format."""
    try:
        async for chunk in engine.query_streaming(query):
            data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": chunk},
                        "finish_reason": None,
                    }
                ],
            }
            # EventSourceResponse adds "data: " prefix automatically
            yield json.dumps(data)

        # Send final chunk with finish_reason
        final_data = {
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }
            ],
        }
        yield json.dumps(final_data)
        yield "[DONE]"

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        error_data = {"error": str(e)}
        yield json.dumps(error_data)


# ============================================================================
# Segment Endpoints
# ============================================================================


@app.post("/api/segments/generate", response_model=SegmentGenerateResponse)
async def generate_segment(request: SegmentGenerateRequest):
    """Generate a customer segment SQL from natural language description."""
    engine = get_crm_engine()

    try:
        result = await engine.generate_segment(request.description)
        return SegmentGenerateResponse(name=result["name"], sql=result["sql"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Segment generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/segments/execute")
async def execute_segment(request: SegmentExecuteRequest):
    """Execute a segment SQL query and return matching customers."""
    engine = get_crm_engine()

    try:
        rows = await engine.execute_segment_sql(request.sql)
        return {"customers": rows, "count": len(rows)}
    except Exception as e:
        logger.error(f"Segment execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Entry Point
# ============================================================================


def main():
    """Run the server."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
