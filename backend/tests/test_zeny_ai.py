"""
Test suite for Zeny AI functionality.
Tests avatar creation, document upload, chatbot conversations, and summaries.
"""

import asyncio
import base64
import sys
from pathlib import Path

import pytest
import requests

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Test configuration
BASE_URL = "http://localhost:8001/api"
TEST_TIMEOUT = 30


def test_health_check():
    """Test that the API is running"""
    response = requests.get(f"{BASE_URL}/", timeout=TEST_TIMEOUT)
    assert response.status_code == 200
    assert response.json()["message"] == "Hello World"


def test_create_avatar():
    """Test creating an AI avatar"""
    avatar_data = {
        "name": "TestBot",
        "personality_description": "A friendly and helpful AI assistant who loves to help people learn about technology."
    }

    response = requests.post(f"{BASE_URL}/avatars", json=avatar_data, timeout=TEST_TIMEOUT)
    assert response.status_code == 200, f"Failed to create avatar: {response.text}"

    data = response.json()
    assert data["name"] == avatar_data["name"]
    assert data["personality_description"] == avatar_data["personality_description"]
    assert "id" in data
    assert data["is_active"] is True

    return data["id"]


def test_get_avatars():
    """Test retrieving list of avatars"""
    response = requests.get(f"{BASE_URL}/avatars", timeout=TEST_TIMEOUT)
    assert response.status_code == 200

    avatars = response.json()
    assert isinstance(avatars, list)
    assert len(avatars) > 0


def test_upload_training_document():
    """Test uploading a training document"""
    # First create an avatar
    avatar_id = test_create_avatar()

    # Create a sample document
    document_content = """
    Product: TechWidget Pro

    Features:
    - Advanced AI processing
    - Cloud integration
    - Real-time analytics
    - 24/7 support

    Pricing: $99/month

    Support: support@techwidget.com
    """

    content_base64 = base64.b64encode(document_content.encode()).decode()

    doc_data = {
        "filename": "product_info.txt",
        "content_base64": content_base64,
        "content_type": "text/plain"
    }

    response = requests.post(
        f"{BASE_URL}/avatars/{avatar_id}/documents",
        json=doc_data,
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to upload document: {response.text}"

    data = response.json()
    assert data["filename"] == doc_data["filename"]
    assert data["avatar_id"] == avatar_id

    return avatar_id, data["id"]


def test_get_training_documents():
    """Test retrieving training documents"""
    avatar_id, doc_id = test_upload_training_document()

    response = requests.get(
        f"{BASE_URL}/avatars/{avatar_id}/documents",
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200

    documents = response.json()
    assert isinstance(documents, list)
    assert len(documents) > 0
    assert any(doc["id"] == doc_id for doc in documents)


def test_chat_with_avatar():
    """Test chatting with an AI avatar"""
    # Create avatar and upload document
    avatar_id, _ = test_upload_training_document()

    # Send a message
    chat_data = {
        "avatar_id": avatar_id,
        "visitor_id": "test_visitor_123",
        "message": "What are the features of TechWidget Pro?"
    }

    response = requests.post(
        f"{BASE_URL}/chat/avatar",
        json=chat_data,
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to chat with avatar: {response.text}"

    data = response.json()
    assert data["success"] is True
    assert "response" in data
    assert "conversation_id" in data
    assert len(data["response"]) > 0

    return avatar_id, data["conversation_id"]


def test_conversation_continuity():
    """Test that conversations maintain context"""
    avatar_id, conversation_id = test_chat_with_avatar()

    # Send a follow-up message
    chat_data = {
        "avatar_id": avatar_id,
        "visitor_id": "test_visitor_123",
        "message": "What about pricing?",
        "conversation_id": conversation_id
    }

    response = requests.post(
        f"{BASE_URL}/chat/avatar",
        json=chat_data,
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to continue conversation: {response.text}"

    data = response.json()
    assert data["success"] is True
    assert data["conversation_id"] == conversation_id
    assert len(data["response"]) > 0


def test_get_conversations():
    """Test retrieving conversations for an avatar"""
    avatar_id, conversation_id = test_chat_with_avatar()

    response = requests.get(
        f"{BASE_URL}/avatars/{avatar_id}/conversations",
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200

    conversations = response.json()
    assert isinstance(conversations, list)
    assert len(conversations) > 0
    assert any(conv["id"] == conversation_id for conv in conversations)


def test_generate_conversation_summary():
    """Test generating a summary for a conversation"""
    avatar_id, conversation_id = test_chat_with_avatar()

    response = requests.post(
        f"{BASE_URL}/conversations/{conversation_id}/summarize",
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to generate summary: {response.text}"

    data = response.json()
    assert data["success"] is True
    assert "summary" in data
    assert len(data["summary"]) > 0


def test_update_avatar():
    """Test updating an avatar"""
    avatar_id = test_create_avatar()

    update_data = {
        "name": "UpdatedBot",
        "personality_description": "An even friendlier assistant!"
    }

    response = requests.put(
        f"{BASE_URL}/avatars/{avatar_id}",
        json=update_data,
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to update avatar: {response.text}"

    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["personality_description"] == update_data["personality_description"]


def test_delete_training_document():
    """Test deleting a training document"""
    avatar_id, doc_id = test_upload_training_document()

    response = requests.delete(
        f"{BASE_URL}/documents/{doc_id}",
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to delete document: {response.text}"

    data = response.json()
    assert data["success"] is True


def test_delete_avatar():
    """Test deleting an avatar"""
    avatar_id = test_create_avatar()

    response = requests.delete(
        f"{BASE_URL}/avatars/{avatar_id}",
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 200, f"Failed to delete avatar: {response.text}"

    data = response.json()
    assert data["success"] is True


def test_chat_with_nonexistent_avatar():
    """Test that chatting with a non-existent avatar fails appropriately"""
    chat_data = {
        "avatar_id": "nonexistent_avatar_id",
        "visitor_id": "test_visitor_123",
        "message": "Hello"
    }

    response = requests.post(
        f"{BASE_URL}/chat/avatar",
        json=chat_data,
        timeout=TEST_TIMEOUT
    )
    assert response.status_code == 404


if __name__ == "__main__":
    print("Running Zeny AI tests...")
    print("\n" + "=" * 70)

    tests = [
        ("Health Check", test_health_check),
        ("Create Avatar", test_create_avatar),
        ("Get Avatars", test_get_avatars),
        ("Upload Training Document", test_upload_training_document),
        ("Get Training Documents", test_get_training_documents),
        ("Chat with Avatar", test_chat_with_avatar),
        ("Conversation Continuity", test_conversation_continuity),
        ("Get Conversations", test_get_conversations),
        ("Generate Summary", test_generate_conversation_summary),
        ("Update Avatar", test_update_avatar),
        ("Delete Training Document", test_delete_training_document),
        ("Delete Avatar", test_delete_avatar),
        ("Chat with Nonexistent Avatar", test_chat_with_nonexistent_avatar),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            print(f"\n▶ Running: {test_name}")
            test_func()
            print(f"✅ PASSED: {test_name}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAILED: {test_name}")
            print(f"   Error: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {test_name}")
            print(f"   Error: {e}")
            failed += 1

    print("\n" + "=" * 70)
    print(f"\nTest Results: {passed} passed, {failed} failed")
    print("=" * 70)

    sys.exit(0 if failed == 0 else 1)