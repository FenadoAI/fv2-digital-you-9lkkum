"""FastAPI server exposing AI agent endpoints."""

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from ai_agents.agents import AgentConfig, ChatAgent, SearchAgent


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ChatRequest(BaseModel):
    message: str
    agent_type: str = "chat"
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    success: bool
    response: str
    agent_type: str
    capabilities: List[str]
    metadata: dict = Field(default_factory=dict)
    error: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    max_results: int = 5


class SearchResponse(BaseModel):
    success: bool
    query: str
    summary: str
    search_results: Optional[dict] = None
    sources_count: int
    error: Optional[str] = None


# Zeny AI Models
class AIAvatar(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    personality_description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True


class AIAvatarCreate(BaseModel):
    name: str
    personality_description: str


class AIAvatarUpdate(BaseModel):
    name: Optional[str] = None
    personality_description: Optional[str] = None
    is_active: Optional[bool] = None


class TrainingDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar_id: str
    filename: str
    content_base64: str
    content_type: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrainingDocumentCreate(BaseModel):
    filename: str
    content_base64: str
    content_type: str


class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar_id: str
    messages: List[dict]  # [{role: 'visitor'|'avatar', content: str, timestamp: datetime}]
    visitor_id: str  # Anonymous identifier for the visitor
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    summary: Optional[str] = None


class ChatMessage(BaseModel):
    avatar_id: str
    visitor_id: str
    message: str
    conversation_id: Optional[str] = None


def _ensure_db(request: Request):
    try:
        return request.app.state.db
    except AttributeError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=503, detail="Database not ready") from exc


def _get_agent_cache(request: Request) -> Dict[str, object]:
    if not hasattr(request.app.state, "agent_cache"):
        request.app.state.agent_cache = {}
    return request.app.state.agent_cache


async def _get_or_create_agent(request: Request, agent_type: str):
    cache = _get_agent_cache(request)
    if agent_type in cache:
        return cache[agent_type]

    config: AgentConfig = request.app.state.agent_config

    if agent_type == "search":
        cache[agent_type] = SearchAgent(config)
    elif agent_type == "chat":
        cache[agent_type] = ChatAgent(config)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown agent type '{agent_type}'")

    return cache[agent_type]


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv(ROOT_DIR / ".env")

    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")

    if not mongo_url or not db_name:
        missing = [name for name, value in {"MONGO_URL": mongo_url, "DB_NAME": db_name}.items() if not value]
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    client = AsyncIOMotorClient(mongo_url)

    try:
        app.state.mongo_client = client
        app.state.db = client[db_name]
        app.state.agent_config = AgentConfig()
        app.state.agent_cache = {}
        logger.info("AI Agents API starting up")
        yield
    finally:
        client.close()
        logger.info("AI Agents API shutdown complete")


app = FastAPI(
    title="AI Agents API",
    description="Minimal AI Agents API with LangGraph and MCP support",
    lifespan=lifespan,
)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate, request: Request):
    db = _ensure_db(request)
    status_obj = StatusCheck(**input.model_dump())
    await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks(request: Request):
    db = _ensure_db(request)
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(chat_request: ChatRequest, request: Request):
    try:
        agent = await _get_or_create_agent(request, chat_request.agent_type)
        response = await agent.execute(chat_request.message)

        return ChatResponse(
            success=response.success,
            response=response.content,
            agent_type=chat_request.agent_type,
            capabilities=agent.get_capabilities(),
            metadata=response.metadata,
            error=response.error,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Error in chat endpoint")
        return ChatResponse(
            success=False,
            response="",
            agent_type=chat_request.agent_type,
            capabilities=[],
            error=str(exc),
        )


@api_router.post("/search", response_model=SearchResponse)
async def search_and_summarize(search_request: SearchRequest, request: Request):
    try:
        search_agent = await _get_or_create_agent(request, "search")
        search_prompt = (
            f"Search for information about: {search_request.query}. "
            "Provide a comprehensive summary with key findings."
        )
        result = await search_agent.execute(search_prompt, use_tools=True)

        if result.success:
            metadata = result.metadata or {}
            return SearchResponse(
                success=True,
                query=search_request.query,
                summary=result.content,
                search_results=metadata,
                sources_count=int(metadata.get("tool_run_count", metadata.get("tools_used", 0)) or 0),
            )

        return SearchResponse(
            success=False,
            query=search_request.query,
            summary="",
            sources_count=0,
            error=result.error,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Error in search endpoint")
        return SearchResponse(
            success=False,
            query=search_request.query,
            summary="",
            sources_count=0,
            error=str(exc),
        )


@api_router.get("/agents/capabilities")
async def get_agent_capabilities(request: Request):
    try:
        search_agent = await _get_or_create_agent(request, "search")
        chat_agent = await _get_or_create_agent(request, "chat")

        return {
            "success": True,
            "capabilities": {
                "search_agent": search_agent.get_capabilities(),
                "chat_agent": chat_agent.get_capabilities(),
            },
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Error getting capabilities")
        return {"success": False, "error": str(exc)}


# Zeny AI Endpoints
@api_router.post("/avatars", response_model=AIAvatar)
async def create_avatar(avatar_data: AIAvatarCreate, request: Request):
    db = _ensure_db(request)
    # For MVP, using a default user_id. In production, this would come from auth token
    avatar = AIAvatar(user_id="default_user", **avatar_data.model_dump())
    await db.ai_avatars.insert_one(avatar.model_dump())
    return avatar


@api_router.get("/avatars", response_model=List[AIAvatar])
async def get_avatars(request: Request):
    db = _ensure_db(request)
    avatars = await db.ai_avatars.find({"user_id": "default_user"}).to_list(100)
    return [AIAvatar(**avatar) for avatar in avatars]


@api_router.get("/avatars/{avatar_id}", response_model=AIAvatar)
async def get_avatar(avatar_id: str, request: Request):
    db = _ensure_db(request)
    avatar = await db.ai_avatars.find_one({"id": avatar_id, "user_id": "default_user"})
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return AIAvatar(**avatar)


@api_router.put("/avatars/{avatar_id}", response_model=AIAvatar)
async def update_avatar(avatar_id: str, avatar_update: AIAvatarUpdate, request: Request):
    db = _ensure_db(request)
    update_data = {k: v for k, v in avatar_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.ai_avatars.update_one(
        {"id": avatar_id, "user_id": "default_user"},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Avatar not found")

    updated_avatar = await db.ai_avatars.find_one({"id": avatar_id})
    return AIAvatar(**updated_avatar)


@api_router.delete("/avatars/{avatar_id}")
async def delete_avatar(avatar_id: str, request: Request):
    db = _ensure_db(request)
    result = await db.ai_avatars.delete_one({"id": avatar_id, "user_id": "default_user"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return {"success": True, "message": "Avatar deleted"}


@api_router.post("/avatars/{avatar_id}/documents", response_model=TrainingDocument)
async def upload_training_document(avatar_id: str, doc_data: TrainingDocumentCreate, request: Request):
    db = _ensure_db(request)

    # Verify avatar exists
    avatar = await db.ai_avatars.find_one({"id": avatar_id, "user_id": "default_user"})
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")

    document = TrainingDocument(avatar_id=avatar_id, **doc_data.model_dump())
    await db.training_documents.insert_one(document.model_dump())
    return document


@api_router.get("/avatars/{avatar_id}/documents", response_model=List[TrainingDocument])
async def get_training_documents(avatar_id: str, request: Request):
    db = _ensure_db(request)
    documents = await db.training_documents.find({"avatar_id": avatar_id}).to_list(100)
    return [TrainingDocument(**doc) for doc in documents]


@api_router.delete("/documents/{document_id}")
async def delete_training_document(document_id: str, request: Request):
    db = _ensure_db(request)
    result = await db.training_documents.delete_one({"id": document_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True, "message": "Document deleted"}


@api_router.post("/chat/avatar", response_model=dict)
async def chat_with_avatar(chat_msg: ChatMessage, request: Request):
    db = _ensure_db(request)

    # Get avatar and training materials
    avatar = await db.ai_avatars.find_one({"id": chat_msg.avatar_id, "is_active": True})
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found or inactive")

    # Get training documents
    documents = await db.training_documents.find({"avatar_id": chat_msg.avatar_id}).to_list(100)

    # Find or create conversation
    conversation_id = chat_msg.conversation_id
    if not conversation_id:
        conversation = Conversation(
            avatar_id=chat_msg.avatar_id,
            visitor_id=chat_msg.visitor_id,
            messages=[]
        )
        await db.conversations.insert_one(conversation.model_dump())
        conversation_id = conversation.id
    else:
        conv = await db.conversations.find_one({"id": conversation_id})
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation = Conversation(**conv)

    # Build context from training materials
    training_context = f"Personality: {avatar['personality_description']}\n\n"
    if documents:
        training_context += "Training Materials:\n"
        for doc in documents[:3]:  # Limit to first 3 documents to avoid token limits
            try:
                import base64
                content = base64.b64decode(doc['content_base64']).decode('utf-8')
                training_context += f"- {doc['filename']}: {content[:500]}...\n"
            except:
                pass

    # Get conversation history
    history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in conversation.messages[-5:]])

    # Use ChatAgent to generate response
    agent = await _get_or_create_agent(request, "chat")
    prompt = f"""You are {avatar['name']}, an AI avatar with the following personality and training:

{training_context}

Previous conversation:
{history}

Visitor: {chat_msg.message}

Respond as {avatar['name']} based on your personality and training. Be helpful and conversational."""

    result = await agent.execute(prompt)

    if not result.success:
        raise HTTPException(status_code=500, detail=result.error or "Failed to generate response")

    # Update conversation
    now = datetime.now(timezone.utc)
    conversation.messages.append({
        "role": "visitor",
        "content": chat_msg.message,
        "timestamp": now.isoformat()
    })
    conversation.messages.append({
        "role": "avatar",
        "content": result.content,
        "timestamp": now.isoformat()
    })

    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"messages": conversation.messages}}
    )

    return {
        "success": True,
        "conversation_id": conversation_id,
        "response": result.content
    }


@api_router.get("/avatars/{avatar_id}/conversations", response_model=List[Conversation])
async def get_avatar_conversations(avatar_id: str, request: Request):
    db = _ensure_db(request)
    conversations = await db.conversations.find({"avatar_id": avatar_id}).to_list(100)
    return [Conversation(**conv) for conv in conversations]


@api_router.post("/conversations/{conversation_id}/summarize")
async def summarize_conversation(conversation_id: str, request: Request):
    db = _ensure_db(request)

    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Generate summary using ChatAgent
    agent = await _get_or_create_agent(request, "chat")
    messages_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in conversation['messages']])

    prompt = f"""Summarize the following conversation between an AI avatar and a visitor. Include:
- Main topics discussed
- Key questions asked by the visitor
- Information provided by the avatar
- Overall outcome

Conversation:
{messages_text}

Provide a concise summary in 2-3 paragraphs."""

    result = await agent.execute(prompt)

    if result.success:
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"summary": result.content, "ended_at": datetime.now(timezone.utc)}}
        )
        return {"success": True, "summary": result.content}

    raise HTTPException(status_code=500, detail=result.error or "Failed to generate summary")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
