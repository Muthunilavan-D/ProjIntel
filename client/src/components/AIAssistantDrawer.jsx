import React, { useState, useEffect, useRef } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  Sparkles, 
  Send, 
  X, 
  Bot, 
  User, 
  HelpCircle, 
  AlertCircle,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { sendChatMessage } from '../services/aiService';
import AIStructuredResponse from './AIStructuredResponse';

const AIAssistantDrawer = ({ 
  isOpen, 
  onClose, 
  userRole = 'STUDENT', 
  context = {}, 
  initialPrompt = '' 
}) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);

  // Predefined role prompts
  const suggestedQuestions = {
    STUDENT: [
      'What should I work on first?',
      'Why is my project showing risk?',
      'Which tasks are overdue or pending?',
      'Summarize my current project status',
      'What is blocking my current milestone?',
      'How can I improve my project progress?'
    ],
    FACULTY: [
      'Which supervised projects require attention?',
      'Why is this project at medium/high risk?',
      'Summarize the latest weekly report',
      'Which milestones are delayed?',
      'What are the major project blockers?',
      'What should I review during our next meeting?'
    ],
    ADMIN: [
      'Which projects have high schedule risk?',
      'Which projects have overdue milestones?',
      'Which faculty members have the highest workload?',
      'How many teams have missing reports?',
      'Summarize institutional project progress',
      'Which projects require urgent review?'
    ]
  }[userRole] || [
    'Summarize current status',
    'What should be prioritized next?'
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessages = {
        STUDENT: {
          response_type: 'project_insight',
          title: 'ProjIntel AI Academic Assistant',
          summary: `Welcome to your project intelligence assistant. I have loaded active context for "${context?.title || 'Academic Project'}". Ask me about your priority tasks, milestone progress, risk indicators, or weekly updates.`,
          recommendation: {
            immediate_action: 'Select a suggested question below or enter your inquiry.',
            next_step: 'Review current milestone targets and pending high-priority tasks.',
            reason: 'Contextual AI tracking helps maintain milestone deadlines.'
          }
        },
        FACULTY: {
          response_type: 'project_insight',
          title: 'Faculty Advisory Intelligence',
          summary: `Faculty Advisory AI is active. Ready to assist with student supervision, project risk monitoring, and evaluation feedback.`,
          recommendation: {
            immediate_action: 'Select a supervised project to analyze.',
            next_step: 'Review weekly submissions and high-risk flags.',
            reason: 'Early intervention resolves milestone blockers efficiently.'
          }
        },
        ADMIN: {
          response_type: 'project_insight',
          title: 'Institutional Admin Intelligence',
          summary: `Department Administrator AI is active. Ready to assist with workload balance, department statistics, and schedule risk monitoring.`,
          recommendation: {
            immediate_action: 'Query high-risk projects or faculty allocation status.',
            next_step: 'Inspect department-wide milestone progression.',
            reason: 'Data-driven supervision optimizes faculty load and graduation timelines.'
          }
        }
      };

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessages[userRole] || welcomeMessages.STUDENT,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [isOpen, userRole, context]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || isLoading) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const chatHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content) 
        }));

      const res = await sendChatMessage({
        message: query.trim(),
        userRole,
        context,
        chatHistory
      });

      if (res.success && (res.data || res.content)) {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: res.data || res.content,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: res.error || 'Unable to format the AI response. Please try again.',
            isError: true,
            originalQuery: query.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to reach the AI service. Please verify the backend is running.',
          isError: true,
          originalQuery: query.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-drawer-overlay" onClick={onClose}>
      <div 
        className={`ai-drawer-container ${isExpanded ? 'ai-drawer-expanded' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="ai-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="brand-icon" style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <Sparkles size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ProjIntel AI Assistant
                <span className="hero-pill-badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', margin: 0 }}>
                  {userRole} Mode
                </span>
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Context-bound academic project intelligence
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button 
              className="btn-icon" 
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
              aria-label="Toggle Expand"
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button 
              className="btn-icon" 
              onClick={onClose}
              aria-label="Close Assistant"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Suggested Quick Prompts */}
        <div className="ai-suggested-prompts-bar">
          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <HelpCircle size={12} /> Suggested Questions:
          </span>
          <div className="ai-prompt-chips">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                className="ai-prompt-chip"
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Message Stream */}
        <div className="ai-drawer-body">
          {messages.map((m) => (
            <div 
              key={m.id} 
              className={`ai-message-row ${m.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="ai-avatar">
                {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div className="ai-message-bubble">
                {m.role === 'user' ? (
                  <div className="ai-message-text user-text">
                    {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                  </div>
                ) : m.isError ? (
                  <div className="ai-error-bubble">
                    <div className="ai-error-header">
                      <AlertCircle size={15} className="text-danger" />
                      <span style={{ fontWeight: 600 }}>Response Error</span>
                    </div>
                    <p className="ai-error-text">
                      {typeof m.content === 'string' ? m.content : 'Unable to format the AI response. Please try again.'}
                    </p>
                    {m.originalQuery && (
                      <button 
                        className="ai-retry-btn"
                        onClick={() => handleSendMessage(m.originalQuery)}
                        disabled={isLoading}
                      >
                        <RotateCcw size={12} /> Retry Question
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="ai-message-text structured-content">
                    <AIStructuredResponse 
                      data={m.content} 
                      rawFallback={typeof m.content === 'string' ? m.content : ''} 
                    />
                  </div>
                )}
                <span className="ai-message-time">{m.time}</span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="ai-message-row assistant-message">
              <div className="ai-avatar">
                <Bot size={15} />
              </div>
              <div className="ai-message-bubble ai-loading-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <ProjIntelSpinner size="xs" inline />
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Analyzing project data & formulating insight...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form 
          className="ai-drawer-footer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            type="text"
            className="ai-chat-input"
            placeholder={`Ask AI about ${userRole === 'STUDENT' ? 'tasks, risk, milestones, or status' : userRole === 'FACULTY' ? 'assigned projects' : 'department statistics'}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="btn-aesthetic btn-primary-glow"
            style={{ padding: '0.6rem 1.1rem' }}
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? <ProjIntelSpinner size="xs" inline /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistantDrawer;
