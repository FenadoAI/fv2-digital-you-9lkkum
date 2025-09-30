import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ChatbotEmbed from "./components/ChatbotEmbed";

// BACKEND URL
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001';
export const API = `${API_BASE}/api`;

// THIS IS WHERE OUR WEBSITE IS HOSTED
export const MY_HOMEPAGE_URL = API_BASE?.match(/-([a-z0-9]+)\./)?.[1]
  ? `https://${API_BASE?.match(/-([a-z0-9]+)\./)?.[1]}.previewer.live`
  : window.location.origin;

console.log(`MY_HOMEPAGE_URL: ${MY_HOMEPAGE_URL}`);

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat/:avatarId" element={<ChatbotEmbed />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
