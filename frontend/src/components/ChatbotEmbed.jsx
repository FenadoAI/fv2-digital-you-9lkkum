import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Bot, Send, Loader2 } from 'lucide-react';

export default function ChatbotEmbed() {
  const { avatarId } = useParams();
  const [avatar, setAvatar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visitorId] = useState(() => {
    // Generate unique visitor ID
    const stored = localStorage.getItem('zeny_visitor_id');
    if (stored) return stored;
    const newId = 'visitor_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('zeny_visitor_id', newId);
    return newId;
  });

  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadAvatar();
  }, [avatarId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadAvatar = async () => {
    try {
      const response = await axios.get(`${API}/avatars/${avatarId}`);
      setAvatar(response.data);
      // Add welcome message
      setMessages([
        {
          role: 'avatar',
          content: `Hi! I'm ${response.data.name}. How can I help you today?`,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error loading avatar:', error);
      setMessages([
        {
          role: 'system',
          content: 'Sorry, this chatbot is not available.',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      role: 'visitor',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chat/avatar`, {
        avatar_id: avatarId,
        visitor_id: visitorId,
        message: inputMessage,
        conversation_id: conversationId
      });

      if (response.data.success) {
        setConversationId(response.data.conversation_id);
        const botMessage = {
          role: 'avatar',
          content: response.data.response,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  if (!avatar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-gray-600">Loading chatbot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl">{avatar.name}</CardTitle>
              <p className="text-sm text-purple-100">AI Assistant</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Messages Area */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'visitor' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'visitor'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : msg.role === 'system'
                      ? 'bg-red-100 text-red-800 rounded-bl-sm'
                      : 'bg-white text-gray-800 shadow-md rounded-bl-sm border border-gray-200'
                  }`}
                >
                  {msg.role === 'avatar' && (
                    <p className="text-xs font-semibold text-purple-600 mb-1">{avatar.name}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === 'visitor' ? 'text-purple-200' : 'text-gray-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-md border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-600">{avatar.name} is typing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Powered by Zeny AI
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}