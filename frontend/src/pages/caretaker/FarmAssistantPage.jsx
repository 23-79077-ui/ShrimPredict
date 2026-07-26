import { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { FaArrowRight, FaChartBar, FaFilePdf, FaPaperPlane, FaRobot, FaSpinner } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';

const suggestedQuestions = [
  'Show my ponds',
  'Show latest disease scans',
  'Show feed consumption',
  'Weekly summary',
  'Show harvest prediction',
  'Show low pH ponds',
  'Show today alerts',
];

const rowLabel = (row) => row.pond_name || row.title || row.disease_name || row.created_at || 'Record';

function AssistantChart({ chart }) {
  const data = useMemo(() => ({
    labels: safeArray(chart?.labels),
    datasets: [{
      label: chart?.title || 'Farm data',
      data: safeArray(chart?.data).map((value) => Number(value || 0)),
      backgroundColor: '#F59E0B',
      borderColor: '#0B2C5F',
      borderWidth: 2,
      tension: 0.35,
    }],
  }), [chart]);

  if (!chart) return null;

  return (
    <div className="mt-3 p-3 bg-white rounded-3 border">
      <div className="d-flex align-items-center gap-2 fw-bold mb-2">
        <FaChartBar className="text-primary" />
        <span>{chart.title || 'Chart'}</span>
      </div>
      {chart.type === 'line' ? <Line data={data} /> : <Bar data={data} />}
    </div>
  );
}

function exportAssistantPdf(messages) {
  const rows = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => `
      <section style="margin-bottom:18px;">
        <h2 style="font-size:15px;color:#0B2C5F;margin:0 0 6px;">${message.intent || 'Assistant Response'}</h2>
        <p style="margin:0 0 8px;line-height:1.5;">${message.answer || ''}</p>
        <strong>Recommendation:</strong>
        <p style="margin:4px 0 0;line-height:1.5;">${message.recommendation || ''}</p>
      </section>
    `).join('');

  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) return;
  popup.document.write(`
    <html>
      <head>
        <title>ShrimPredict Caretaker AI Assistant Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #10294A; padding: 28px; }
          h1 { margin: 0 0 18px; color: #0B2C5F; }
        </style>
      </head>
      <body>
        <h1>ShrimPredict Caretaker AI Assistant Report</h1>
        ${rows || '<p>No assistant responses yet.</p>'}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function FarmAssistantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      intent: 'welcome',
      answer: 'Hi. I can answer using only your ShrimPredict caretaker records: assigned ponds, disease scans, feeding logs, water readings, alerts, and harvest estimates.',
      recommendation: 'Start with a suggested question below.',
      followups: suggestedQuestions.slice(0, 4),
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
        user_id: user?.id,
      });
      setMessages((current) => [...current, { role: 'assistant', ...(response.data || {}) }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        intent: 'error',
        answer: error.response?.data?.message || 'I could not read the farm database right now.',
        recommendation: 'Check XAMPP/MySQL and try again.',
        followups: ['Show my ponds', 'Weekly summary'],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    askAssistant();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 mb-2">
            Database-only Assistant
          </div>
          <h3 className="fw-bold mb-1">Smart AI Farm Assistant</h3>
          <p className="text-muted mb-0">Ask about your assigned ponds, scans, feeding, water quality, alerts, and harvest estimates.</p>
        </div>
        <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={() => exportAssistantPdf(messages)}>
          <FaFilePdf /> Download PDF
        </button>
      </div>

      <div className="row g-4">
        <div className="col-xl-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="p-4 text-white" style={{ background: 'linear-gradient(135deg, #0B2C5F, #123E7A)' }}>
                <div className="d-flex align-items-center gap-3">
                  <span className="rounded-circle bg-warning text-dark d-flex align-items-center justify-content-center" style={{ width: 42, height: 42 }}>
                    <FaRobot />
                  </span>
                  <div>
                    <h5 className="fw-bold mb-0">ShrimPredict Assistant</h5>
                    <small className="text-white-75">Answers are generated from your farm database records.</small>
                  </div>
                </div>
              </div>

              <div className="assistant-chat-scroll p-4">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`d-flex mb-3 ${message.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div className={`assistant-message p-3 rounded-3 shadow-sm ${message.role === 'user' ? 'bg-primary text-white' : 'bg-white border'}`}>
                      <div className="fw-semibold mb-1">{message.role === 'user' ? 'You' : 'AI Farm Assistant'}</div>
                      <div style={{ lineHeight: 1.55 }}>{message.answer}</div>

                      {message.role === 'assistant' && message.recommendation && (
                        <div className="alert alert-warning mt-3 mb-0 py-2 small">
                          <strong>Recommendation:</strong> {message.recommendation}
                        </div>
                      )}

                      {message.role === 'assistant' && <AssistantChart chart={message.chart} />}

                      {message.role === 'assistant' && safeArray(message.rows).length > 0 && (
                        <div className="mt-3">
                          <div className="small fw-bold text-muted mb-2">Related Records</div>
                          <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                            {safeArray(message.rows).slice(0, 5).map((row, rowIndex) => (
                              <div key={`${rowLabel(row)}-${rowIndex}`} className="list-group-item small">
                                <strong>{rowLabel(row)}</strong>
                                <div className="text-muted">
                                  {row.status || row.risk_level || row.action_type || ''}
                                  {row.total_feed_kg !== undefined ? ` • ${Number(row.total_feed_kg || 0).toFixed(2)} kg feed` : ''}
                                  {row.estimated_harvest_kg !== undefined ? ` • ${Number(row.estimated_harvest_kg || 0).toFixed(2)} kg harvest estimate` : ''}
                                  {row.created_at ? ` • ${row.created_at}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {message.role === 'assistant' && safeArray(message.actions).length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          {safeArray(message.actions).map((action) => (
                            <button key={action.label} className="btn btn-sm btn-outline-primary" onClick={() => navigate(action.to)}>
                              {action.label} <FaArrowRight className="ms-1" />
                            </button>
                          ))}
                        </div>
                      )}

                      {message.role === 'assistant' && safeArray(message.followups).length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          {safeArray(message.followups).map((item) => (
                            <button key={item} className="btn btn-sm btn-light border" onClick={() => askAssistant(item)} disabled={loading}>
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="d-flex justify-content-start">
                    <div className="bg-white border p-3 rounded-3 shadow-sm">
                      <FaSpinner className="disease-spin text-primary me-2" />
                      Reading farm records...
                    </div>
                  </div>
                )}
              </div>

              <form className="p-3 border-top bg-white" onSubmit={handleSubmit}>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Type your question"
                  />
                  <button className="btn btn-primary d-flex align-items-center gap-2" disabled={loading || !question.trim()}>
                    <FaPaperPlane /> Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-3">Suggested Questions</h5>
              <div className="d-grid gap-2">
                {suggestedQuestions.map((item) => (
                  <button key={item} className="btn btn-outline-secondary text-start" onClick={() => askAssistant(item)} disabled={loading}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="alert alert-info mt-4 mb-0 small">
                This assistant is not a general chatbot. It answers only from ShrimPredict database records assigned to your caretaker account.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
