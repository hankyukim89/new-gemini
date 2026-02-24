import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { TopBar } from './components/TopBar';
import { PersonaManager } from './components/PersonaManager';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';
import { useChatStore } from './store/useChatStore';
import { usePersonaStore } from './store/usePersonaStore';
import { useSettingsStore } from './store/useSettingsStore';
import { PLAYGROUND_MODELS } from './services/geminiService';

export default function App() {
  const { sessions, addSession } = useChatStore();
  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize a session if none exist
  useEffect(() => {
    // Check inside the effect to avoid dependency loop issues if addSession changes state immediately
    if (useChatStore.getState().sessions.length === 0) {
      addSession();
    }
  }, [addSession]);

  // Force API Key if it's currently empty in storage
  useEffect(() => {
    const { apiKey, setApiKey } = useSettingsStore.getState();
    if (!apiKey || apiKey === '') {
      setApiKey('AIzaSyD4VGA1UWipL-Sy9_Y-yDOiGsHrlohmpRA');
    }
  }, []);

  // Model Migration Logic: Ensure active persona uses a valid model
  const { personas, activePersonaId, updatePersona } = usePersonaStore();

  useEffect(() => {
    const activePersona = personas.find(p => p.id === activePersonaId);
    if (activePersona) {
      const currentModel = activePersona.config.model;
      const isValid = PLAYGROUND_MODELS.some(m => m.id === currentModel);

      if (!isValid) {
        console.warn(`Model ${currentModel} is invalid/deprecated. Migrating to gemini-3.0-flash.`);
        updatePersona(activePersona.id, {
          config: { ...activePersona.config, model: 'gemini-3.0-flash' }
        });
      }
    }
  }, [activePersonaId, personas, updatePersona]);

  return (
    <div className="flex h-screen w-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <TopBar
          onOpenPersonaManager={() => setIsPersonaManagerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <div className="flex-1 flex flex-col min-h-0">
          <ChatArea />
        </div>
      </div>

      {/* Modals at Root Level to avoid stacking contexts */}
      <PersonaManager
        isOpen={isPersonaManagerOpen}
        onClose={() => setIsPersonaManagerOpen(false)}
      />

      {isSettingsOpen && (
        <GlobalSettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
