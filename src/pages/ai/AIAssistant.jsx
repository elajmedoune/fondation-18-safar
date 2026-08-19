import { useRef, useState, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Wallet, Users, Calendar, Shield, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useRole } from '../../hooks/useRole.js';
import { useCampagneContext } from '../../contexts/CampagneContext.jsx';
import { aiService } from '../../services/ai.service.js';
import PageHeader from '../../components/ui/PageHeader.jsx';

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let inList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-0.5 my-2 text-sm">
          {listItems.map((item, i) => (
            <li key={i} className="text-gray-800 dark:text-gray-200">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      inList = true;
      listItems.push(trimmed);
      continue;
    }

    // Table detection: collect consecutive lines starting with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const row = lines[i].trim();
        const isSeparator = /^\|[\s\-:|]+\|$/.test(row);
        if (!isSeparator) {
          const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
          tableRows.push(cells);
        }
        i++;
      }
      i--;
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(1);
        elements.push(
          <div key={`tbl-${elements.length}`} className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  {header.map((cell, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    flushList();

    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-bold mt-4 mb-1.5 text-gray-900 dark:text-white">{renderInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-bold mt-4 mb-1.5 text-gray-900 dark:text-white">{renderInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-4 mb-1.5 text-gray-900 dark:text-white">{renderInline(trimmed.slice(2))}</h2>);
    } else if (trimmed.startsWith('---') || trimmed.startsWith('===') || trimmed.startsWith('***')) {
      elements.push(<hr key={i} className="my-3 border-gray-200 dark:border-gray-700" />);
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      elements.push(<p key={i} className="font-bold mt-3 mb-1 text-sm text-gray-900 dark:text-white">{renderInline(trimmed)}</p>);
    } else {
      elements.push(<p key={i} className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed my-1">{renderInline(trimmed)}</p>);
    }
  }

  flushList();
  return elements;
}

function renderInline(text) {
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    let nextMatch = null;
    let type = null;
    if (boldMatch && (!italicMatch || boldMatch.index <= italicMatch.index)) {
      nextMatch = boldMatch;
      type = 'bold';
    } else if (italicMatch) {
      nextMatch = italicMatch;
      type = 'italic';
    }

    if (!nextMatch) {
      parts.push(remaining);
      break;
    }

    if (nextMatch.index > 0) {
      parts.push(remaining.slice(0, nextMatch.index));
    }

    if (type === 'bold') {
      parts.push(<strong key={keyIdx++} className="font-semibold text-gray-900 dark:text-white">{nextMatch[1]}</strong>);
    } else {
      parts.push(<em key={keyIdx++} className="italic">{nextMatch[1]}</em>);
    }
    remaining = remaining.slice(nextMatch.index + nextMatch[0].length);
  }

  return parts;
}

const ROLE_SUGGESTIONS = {
  tresorier: [
    'Résumé des cotisations de la campagne',
    'Quels membres n\'ont pas encore cotisé ?',
    'Comparaison dépenses vs recettes',
    'Liste des dépenses par catégorie',
  ],
  secretaire: [
    'Liste des membres par groupe',
    'Résumé des réunions récentes',
    'Combien de membres avons-nous ?',
    'Dernières activités enregistrées',
  ],
  president: [
    'Tableau de bord complet de la campagne',
    'État des finances global',
    'Résumé de l\'activité récente',
    'Alertes et points d\'attention',
  ],
  administrateur: [
    'Vue complète de la campagne',
    'Tous les derniers ajouts',
    'Statistiques des utilisateurs',
    'Résumé complet avec recommandations',
  ],
};

const ROLE_ICONS = {
  tresorier: { icon: Wallet, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  secretaire: { icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  president: { icon: Calendar, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  administrateur: { icon: Shield, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
};

const STORAGE_KEY = 'f18s-ai-chat';

function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveMessages(msgs) {
  try {
    if (msgs.length > 0) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50)));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function AIAssistant() {
  const { user } = useAuth();
  const { rolePrincipal } = useRole();
  const { campagneActive } = useCampagneContext();
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { saveMessages(messages); }, [messages]);

  const roleConfig = ROLE_ICONS[rolePrincipal] || ROLE_ICONS.membre;
  const suggestions = ROLE_SUGGESTIONS[rolePrincipal] || ROLE_SUGGESTIONS.president;
  const RoleIcon = roleConfig.icon;

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg = { id: Date.now(), role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const reply = await aiService.sendMessage(msg, campagneActive?.id);
      const aiMsg = { id: Date.now() + 1, role: 'assistant', content: reply };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = { id: Date.now() + 1, role: 'assistant', content: `Désolé, une erreur est survenue : ${err.message}` };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <PageHeader
        title="Assistant IA"
        subtitle={campagneActive ? `Campagne ${campagneActive.nom || campagneActive.annee}` : 'Posez vos questions'}
        action={messages.length > 0 ? (
          <button onClick={() => { setMessages([]); sessionStorage.removeItem(STORAGE_KEY); }} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Nouvelle conversation">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      />

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 px-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${roleConfig.color}`}>
            <Bot className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bonjour {user?.email?.split('@')[0]} !</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Je suis votre assistant IA. {rolePrincipal === 'administrateur' ? 'Vous avez accès à toutes les données.' :
              rolePrincipal === 'tresorier' ? 'Je peux vous aider avec les finances, cotisations et dépenses.' :
              rolePrincipal === 'secretaire' ? 'Je peux vous aider avec les réunions, membres et activités.' :
              'Je peux vous aider avec le suivi de la campagne.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-left px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"
              >
                <Sparkles className="h-3 w-3 inline mr-1.5 text-primary-500" />
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-2 py-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.role === 'user'
                  ? 'bg-primary-700 text-white rounded-br-md'
                  : 'bg-white/70 dark:bg-gray-800/70 border border-gray-200/70 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm'
              }`}>
                {m.role === 'assistant' ? (
                  <div className="space-y-0">{renderMarkdown(m.content)}</div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</p>
                )}
              </div>
              {m.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 mt-1">
                  <User className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 mt-1">
                <Bot className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-white/70 dark:bg-gray-800/70 border border-gray-200/70 dark:border-gray-700/50 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Réflexion...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md px-3 py-3">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-40 transition-all shadow-sm shadow-primary-700/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
