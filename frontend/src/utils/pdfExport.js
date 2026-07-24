export function downloadDashboardPDF({ stats, feedingRecords, caretakerName, dateFilter, totalKg }) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fileName = `ShrimPredict_Dashboard_Report_${new Date().toISOString().split('T')[0]}.pdf`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 1.2cm; }
      body { -webkit-print-color-adjust: exact; }
    }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #0B2C5F;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .brand {
      font-size: 26px;
      font-weight: 800;
      color: #0B2C5F;
      letter-spacing: -0.5px;
    }
    .brand span { color: #FF7A00; }
    .report-title {
      font-size: 16px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .meta-item strong { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
    .meta-item span { font-size: 13px; font-weight: 600; color: #0f172a; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      text-align: center;
      background: #f1f5f9;
    }
    .metric-card strong { display: block; font-size: 10px; color: #475569; text-transform: uppercase; }
    .metric-card .val { font-size: 18px; font-weight: 800; color: #0B2C5F; margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
    }
    th {
      background-color: #0B2C5F;
      color: #ffffff;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer {
      margin-top: 25px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Shrim<span>Predict</span></div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Smart Shrimp Farm Monitoring & Analytics System</div>
    </div>
    <div style="text-align: right;">
      <div class="report-title">Admin Dashboard Operations Report</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Exported: ${dateStr} at ${timeStr}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><strong>Caretaker Filter</strong><span>${caretakerName}</span></div>
    <div class="meta-item"><strong>Date Filter Range</strong><span>${dateFilter}</span></div>
    <div class="meta-item"><strong>Total Records Logged</strong><span>${feedingRecords.length} entries</span></div>
  </div>

  <div class="metrics-grid">
    <div class="metric-card"><strong>Total Active Ponds</strong><div class="val">${stats.total_ponds || 0}</div></div>
    <div class="metric-card"><strong>Healthy Ponds</strong><div class="val">${stats.healthy_ponds || 0}</div></div>
    <div class="metric-card"><strong>Disease Alerts</strong><div class="val">${stats.disease_alerts || 0}</div></div>
    <div class="metric-card"><strong>Total Feed Consumed</strong><div class="val">${totalKg.toFixed(1)} kg</div></div>
  </div>

  <h4 style="font-size: 13px; margin-bottom: 6px; color: #0B2C5F; text-transform: uppercase;">Caretaker Feeding Records Summary</h4>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Caretaker Name</th>
        <th>Pond</th>
        <th>Feeding Time</th>
        <th>Product Code</th>
        <th>Amount (kg)</th>
        <th>Vitamin</th>
        <th>Log Date</th>
      </tr>
    </thead>
    <tbody>
      ${
        feedingRecords.length === 0
          ? '<tr><td colspan="8" style="text-align:center; padding: 18px; color: #64748b;">No feeding records found for the selected filter.</td></tr>'
          : feedingRecords.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${r.recorded_by_name || r.recorded_by || 'Caretaker'}</strong></td>
              <td>${r.pond_name || ('Pond #' + r.pond_id)}</td>
              <td>${r.feeding_time || '—'}</td>
              <td>${r.feed_type || r.product_code || 'Starter'}</td>
              <td><strong>${r.amount_kg} kg</strong></td>
              <td>${r.vitamin_name || 'None'}</td>
              <td>${r.record_date || (r.created_at ? r.created_at.slice(0, 10) : '—')}</td>
            </tr>
          `).join('')
      }
    </tbody>
  </table>

  <div class="footer">
    <div>ShrimPredict System • Official Admin Operations Report</div>
    <div>Confidential • Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    }
  </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // Fallback blob link
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }
}
