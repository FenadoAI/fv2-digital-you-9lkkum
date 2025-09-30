import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, MY_HOMEPAGE_URL } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';
import { Toaster } from './ui/toaster';
import { Bot, Plus, FileText, MessageSquare, Trash2, Copy, ExternalLink } from 'lucide-react';

export default function Dashboard() {
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form states
  const [newAvatar, setNewAvatar] = useState({ name: '', personality_description: '' });
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    loadAvatars();
  }, []);

  useEffect(() => {
    if (selectedAvatar) {
      loadDocuments(selectedAvatar.id);
      loadConversations(selectedAvatar.id);
    }
  }, [selectedAvatar]);

  const loadAvatars = async () => {
    try {
      const response = await axios.get(`${API}/avatars`);
      setAvatars(response.data);
      if (response.data.length > 0 && !selectedAvatar) {
        setSelectedAvatar(response.data[0]);
      }
    } catch (error) {
      toast({ title: 'Error loading avatars', description: error.message, variant: 'destructive' });
    }
  };

  const createAvatar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/avatars`, newAvatar);
      setAvatars([...avatars, response.data]);
      setSelectedAvatar(response.data);
      setNewAvatar({ name: '', personality_description: '' });
      setCreateDialogOpen(false);
      toast({ title: 'Avatar created successfully!' });
    } catch (error) {
      toast({ title: 'Error creating avatar', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const deleteAvatar = async (avatarId) => {
    if (!window.confirm('Are you sure you want to delete this avatar?')) return;
    try {
      await axios.delete(`${API}/avatars/${avatarId}`);
      setAvatars(avatars.filter(a => a.id !== avatarId));
      if (selectedAvatar?.id === avatarId) {
        setSelectedAvatar(avatars[0] || null);
      }
      toast({ title: 'Avatar deleted' });
    } catch (error) {
      toast({ title: 'Error deleting avatar', description: error.message, variant: 'destructive' });
    }
  };

  const loadDocuments = async (avatarId) => {
    try {
      const response = await axios.get(`${API}/avatars/${avatarId}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const uploadDocument = async () => {
    if (!uploadFile || !selectedAvatar) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target.result.split(',')[1];
        await axios.post(`${API}/avatars/${selectedAvatar.id}/documents`, {
          filename: uploadFile.name,
          content_base64: base64Content,
          content_type: uploadFile.type
        });
        loadDocuments(selectedAvatar.id);
        setUploadFile(null);
        toast({ title: 'Document uploaded successfully!' });
      };
      reader.readAsDataURL(uploadFile);
    } catch (error) {
      toast({ title: 'Error uploading document', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const deleteDocument = async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`);
      loadDocuments(selectedAvatar.id);
      toast({ title: 'Document deleted' });
    } catch (error) {
      toast({ title: 'Error deleting document', description: error.message, variant: 'destructive' });
    }
  };

  const loadConversations = async (avatarId) => {
    try {
      const response = await axios.get(`${API}/avatars/${avatarId}/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const generateSummary = async (conversationId) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/conversations/${conversationId}/summarize`);
      loadConversations(selectedAvatar.id);
      toast({ title: 'Summary generated!', description: response.data.summary.substring(0, 100) + '...' });
    } catch (error) {
      toast({ title: 'Error generating summary', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const copyEmbedCode = () => {
    const embedUrl = `${MY_HOMEPAGE_URL}/chat/${selectedAvatar.id}`;
    const embedCode = `<iframe src="${embedUrl}" width="400" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    toast({ title: 'Embed code copied to clipboard!' });
  };

  const openChatDemo = () => {
    window.open(`${MY_HOMEPAGE_URL}/chat/${selectedAvatar.id}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <Toaster />

      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Zeny AI</h1>
                <p className="text-sm text-gray-500">AI Avatars for Your Website</p>
              </div>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Avatar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New AI Avatar</DialogTitle>
                  <DialogDescription>
                    Give your AI avatar a name and personality
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={createAvatar} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Avatar Name</Label>
                    <Input
                      id="name"
                      value={newAvatar.name}
                      onChange={(e) => setNewAvatar({ ...newAvatar, name: e.target.value })}
                      placeholder="e.g., Alex Support Bot"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="personality">Personality Description</Label>
                    <Textarea
                      id="personality"
                      value={newAvatar.personality_description}
                      onChange={(e) => setNewAvatar({ ...newAvatar, personality_description: e.target.value })}
                      placeholder="Describe how your avatar should behave, its tone, expertise, etc."
                      rows={6}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Creating...' : 'Create Avatar'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar - Avatar List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Avatars</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {avatars.map((avatar) => (
                  <div
                    key={avatar.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedAvatar?.id === avatar.id
                        ? 'bg-purple-100 border-2 border-purple-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    onClick={() => setSelectedAvatar(avatar)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-600" />
                        <span className="font-medium text-sm">{avatar.name}</span>
                      </div>
                      {avatar.is_active && (
                        <Badge variant="success" className="text-xs">Active</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAvatar(avatar.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                ))}
                {avatars.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No avatars yet. Create your first one!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-3">
            {selectedAvatar ? (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="training">Training</TabsTrigger>
                  <TabsTrigger value="conversations">Conversations</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedAvatar.name}</CardTitle>
                      <CardDescription>Avatar Details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-gray-700 font-semibold">Personality</Label>
                        <p className="mt-2 text-gray-600 bg-gray-50 p-4 rounded-lg">
                          {selectedAvatar.personality_description}
                        </p>
                      </div>
                      <div className="pt-4 border-t">
                        <Label className="text-gray-700 font-semibold mb-3 block">Embed on Your Website</Label>
                        <div className="flex gap-2">
                          <Button onClick={copyEmbedCode} variant="outline" className="flex-1">
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Embed Code
                          </Button>
                          <Button onClick={openChatDemo} className="flex-1 bg-purple-600 hover:bg-purple-700">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Test Chat
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Share URL: {MY_HOMEPAGE_URL}/chat/{selectedAvatar.id}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="text-2xl font-bold text-blue-600">{documents.length}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Training Documents</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-green-600" />
                            <span className="text-2xl font-bold text-green-600">{conversations.length}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Conversations</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Training Tab */}
                <TabsContent value="training" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload Training Documents</CardTitle>
                      <CardDescription>
                        Upload documents to train your AI avatar. Supported formats: PDF, TXT, DOC
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          onChange={(e) => setUploadFile(e.target.files[0])}
                          accept=".txt,.pdf,.doc,.docx"
                        />
                        <Button onClick={uploadDocument} disabled={!uploadFile || loading}>
                          Upload
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Training Documents ({documents.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-gray-600" />
                              <div>
                                <p className="font-medium text-sm">{doc.filename}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(doc.uploaded_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteDocument(doc.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {documents.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-8">
                            No training documents yet. Upload some to get started!
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Conversations Tab */}
                <TabsContent value="conversations" className="space-y-4">
                  {conversations.map((conv) => (
                    <Card key={conv.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Conversation {conv.id.substring(0, 8)}
                            </CardTitle>
                            <CardDescription>
                              {new Date(conv.started_at).toLocaleString()}
                              {conv.ended_at && ` - ${new Date(conv.ended_at).toLocaleString()}`}
                            </CardDescription>
                          </div>
                          {!conv.summary && (
                            <Button
                              onClick={() => generateSummary(conv.id)}
                              disabled={loading}
                              size="sm"
                            >
                              Generate Summary
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {conv.summary && (
                          <div className="bg-blue-50 p-4 rounded-lg mb-4">
                            <Label className="text-blue-900 font-semibold">Summary</Label>
                            <p className="text-sm text-blue-800 mt-2">{conv.summary}</p>
                          </div>
                        )}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {conv.messages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                msg.role === 'visitor'
                                  ? 'bg-gray-100 ml-8'
                                  : 'bg-purple-100 mr-8'
                              }`}
                            >
                              <p className="text-xs font-semibold text-gray-600 mb-1">
                                {msg.role === 'visitor' ? 'Visitor' : selectedAvatar.name}
                              </p>
                              <p className="text-sm text-gray-800">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {conversations.length === 0 && (
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-gray-500">
                          No conversations yet. Share your chatbot link to start receiving conversations!
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg">No avatar selected</p>
                    <p className="text-sm mt-2">Create an avatar to get started</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}