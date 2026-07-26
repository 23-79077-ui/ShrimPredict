import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { FaArrowRight, FaPaperPlane, FaRobot, FaSpinner, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { safeArray } from '../services/api';

const suggestedQuestions = [
  'Weekly summary',
  'What is the status of my ponds?',
  'What feeding times are still pending?',
  'Show latest disease scans',
  'Show harvest prediction',
];

const rowTitle = (row) => row.pond_name || row.feeding_time || row.title || row.disease_name || row.created_at || 'Record';

function rowSummary(row) {
  const parts = [];
  if (row.status) parts.push(`Status: ${row.status}`);
  if (row.feeding_time && row.pond_name) parts.push(`Time: ${row.feeding_time}`);
  if (row.risk_level) parts.push(`Risk: ${row.risk_level}`);
  if (row.temperature !== undefined) parts.push(`Temp: ${row.temperature} C`);
  if (row.ph_level !== undefined) parts.push(`pH: ${row.ph_level}`);
  if (row.total_feed_kg !== undefined) parts.push(`${Number(row.total_feed_kg || 0).toFixed(2)} kg feed`);
  if (row.estimated_harvest_kg !== undefined) parts.push(`${Number(row.estimated_harvest_kg || 0).toFixed(2)} kg harvest est.`);
  if (row.created_at) parts.push(row.created_at);
  return parts.join(' • ');
}

function ChatChart({ chart }) {
  const data = useMemo(() => ({
    labels: safeArray(chart?.labels),
    datasets: [{
      label: chart?.title || 'Farm data',
      data: safeArray(chart?.data).map((value) => Number(value || 0)),
      backgroundColor: '#F59E0B',
      borderColor: '#0B2C5F',
      borderWidth: 2,
    }],
  }), [chart]);

  if (!chart) return null;

  return (
    <div className="assistant-head-chart">
      <div className="small fw-bold mb-2">{chart.title || 'Chart'}</div>
      <Bar data={data} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
    </div>
  );
}

export default function CaretakerAssistantChatHead() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      answer: 'Hi. Ask me about your assigned ponds, feeding logs, disease scans, alerts, water quality, or harvest estimates.',
      recommendation: 'I only use ShrimPredict database records.',
      followups: suggestedQuestions.slice(0, 3),
    },
  ]);

  const askAssistant = async (text = question) => {
    const cleanText = String(text || '').trim();
    if (!cleanText || loading) return;

    setQuestion('');
    setLoading(true);
    setMessages((current) => [...current, { role: 'user', answer: cleanText }]);

    try {
      const response = await api.post('/farm_assistant.php', {
        question: cleanText,
        user_id: user?.id || 0,
      });
      setMessages((current) => [...current, { role: 'assistant', ...(response.data || {}) }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        answer: error.response?.data?.message || 'I could not read the farm database right now.',
        recommendation: 'Check XAMPP/MySQL and try again.',
        followups: ['Weekly summary', 'Show my ponds'],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    askAssistant();
  };

  return (
    <div className="caretaker-chat-head">
      {open && (
        <div className="caretaker-chat-window">
          <div className="caretaker-chat-header">
            <div className="d-flex align-items-center gap-2">
              <span className="caretaker-chat-avatar"><FaRobot /></span>
              <div>
                <div className="fw-bold">Smart AI Farm Assistant</div>
                <small>Live caretaker records only</small>
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-light rounded-circle" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <FaTimes />
            </button>
          </div>

          <div className="caretaker-chat-body">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`caretaker-chat-row ${message.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="caretaker-chat-bubble">
                  <div>{message.answer}</div>
                  {message.role === 'assistant' && (
                    <div className="caretaker-chat-scope">Live data from your assigned ponds and submitted records</div>
                  )}
                  {message.role === 'assistant' && message.recommendation && (
                    <div className="caretaker-chat-note">{message.recommendation}</div>
                  )}
                  {message.role === 'assistant' && <ChatChart chart={message.chart} />}
                  {message.role === 'assistant' && safeArray(message.rows).length > 0 && (
                    <div className="caretaker-chat-records">
                      {safeArray(message.rows).slice(0, 4).map((row, rowIndex) => (
                        <div key={`${rowTitle(row)}-${rowIndex}`} className="caretaker-chat-record">
                          <strong>{rowTitle(row)}</strong>
                          <span>{rowSummary(row)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.role === 'assistant' && safeArray(message.actions).length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {safeArray(message.actions).slice(0, 2).map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            setOpen(false);
                            navigate(action.to);
                          }}
                        >
                          {action.label} <FaArrowRight className="ms-1" />
                        </button>
                      ))}
                    </div>
                  )}
                  {message.role === 'assistant' && safeArray(message.followups).length > 0 && (
                    <div className="caretaker-chat-chips">
                      {safeArray(message.followups).slice(0, 4).map((item) => (
                        <button key={item} type="button" onClick={() => askAssistant(item)} disabled={loading}>
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="caretaker-chat-row assistant">
                <div className="caretaker-chat-bubble">
                  <FaSpinner className="disease-spin text-primary me-2" />
                  Reading records...
                </div>
              </div>
            )}
          </div>

          <form className="caretaker-chat-input" onSubmit={submit}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask anything..."
            />
            <button type="submit" disabled={loading || !question.trim()} aria-label="Send question">
              <FaPaperPlane />
            </button>
          </form>
        </div>
      )}

      <button type="button" className="caretaker-chat-button" aria-label="Open AI assistant" onClick={() => setOpen((value) => !value)}>
        {open ? <FaTimes /> : <FaRobot />}
      </button>
    </div>
  );
}
