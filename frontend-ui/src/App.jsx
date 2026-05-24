import { useState, useEffect } from "react";
import jsPDF from "jspdf";

const API_BASE = "https://mdr-ai.onrender.com";

export default function App() {
  const savedLogin = localStorage.getItem("logged_in") === "true";
  const savedUser = localStorage.getItem("mdr_user") || "";

  const [isLoggedIn, setIsLoggedIn] = useState(savedLogin);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState(savedUser);
  const [password, setPassword] = useState("");

  const [activePage, setActivePage] = useState("dashboard");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  const workspace = "Nordic MedTech QA Workspace";
  const userName = email || "guest";
  const displayName = email ? email.split("@")[0] : "Guest";
  const historyKey = `mdr_history_${userName}`;

  useEffect(() => {
    const saved = localStorage.getItem(historyKey);
    setHistory(saved ? JSON.parse(saved) : []);
  }, [historyKey]);

  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 26,
    boxShadow: "0 14px 35px rgba(15,23,42,.07)",
  };

  const button = {
    padding: "12px 18px",
    borderRadius: 12,
    border: 0,
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };

  const getReviewEffort = (score) => {
    if (score >= 7) return "HIGH (~2–4h QA/RA review)";
    if (score >= 4) return "MEDIUM (~30–90m QA/RA review)";
    return "LOW (~10–30m QA/RA review)";
  };

  const getHoursSaved = (score) => {
    if (score >= 7) return 2.5;
    if (score >= 4) return 1;
    return 0.25;
  };

  const getCostSaved = (score) => Math.round(getHoursSaved(score) * 120);

  const getReadiness = (score) => Math.max(20, 100 - score * 6);

  const getRiskBadge = (score) => {
    if (score >= 7) return { label: "HIGH", icon: "🔴", color: "#fee2e2" };
    if (score >= 4) return { label: "MEDIUM", icon: "🟡", color: "#fef3c7" };
    return { label: "LOW", icon: "🟢", color: "#dcfce7" };
  };

  const totalAnalyses = history.length;
  const avgRisk =
    history.length > 0
      ? (history.reduce((sum, item) => sum + item.risk, 0) / history.length).toFixed(1)
      : "0.0";
  const highRisk = history.filter((item) => item.risk >= 7).length;
  const totalHoursSaved = history
    .reduce((sum, item) => sum + getHoursSaved(item.risk), 0)
    .toFixed(1);
  const totalCostSaved = history.reduce(
    (sum, item) => sum + getCostSaved(item.risk),
    0
  );

  const addToHistory = (data) => {
    const newHistory = [
      {
        doc: data.doc_type,
        risk: data.risk_score,
        riskLevel: data.risk_level,
        full: data,
        createdAt: new Date().toLocaleString(),
      },
      ...history.slice(0, 5),
    ];

    setHistory(newHistory);
    localStorage.setItem(historyKey, JSON.stringify(newHistory));
  };

  const createAccount = () => {
    if (!email.trim() || !password.trim()) {
      alert("Enter email and password");
      return;
    }

    localStorage.setItem(
      "mdr_account",
      JSON.stringify({ email: email.trim(), password: password.trim() })
    );
    localStorage.setItem("logged_in", "true");
    localStorage.setItem("mdr_user", email.trim());
    setIsLoggedIn(true);
  };

  const login = () => {
    const account = JSON.parse(localStorage.getItem("mdr_account") || "{}");

    if (email.trim() === account.email && password.trim() === account.password) {
      localStorage.setItem("logged_in", "true");
      localStorage.setItem("mdr_user", email.trim());
      setIsLoggedIn(true);
    } else {
      alert("Wrong email or password");
    }
  };

  const logout = () => {
    localStorage.removeItem("logged_in");
    setIsLoggedIn(false);
    setPassword("");
  };

  const uploadAndAnalyze = async () => {
    if (!file) return;

    setLoading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const up = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: form,
      });

      const uploadData = await up.json();

      const res = await fetch(`${API_BASE}/analyze/${uploadData.document_id}`);
      const data = await res.json();

      setResult(data);
      addToHistory(data);
    } catch (err) {
      console.error(err);
      alert("Backend failed");
    }

    setLoading(false);
  };

  const loadDemoAnalysis = () => {
    const demo = {
      doc_type: "IFU / Instructions for Use",
      confidence: 0.91,
      summary_one_liner:
        "The IFU describes a portable cooling therapy system, but several MDR traceability and evidence elements may require strengthening.",
      risk_score: 7,
      risk_level: "medium-high",
      potential_mdr_gaps: [
        "UDI information is not clearly identified.",
        "Clinical evidence references are limited or absent.",
        "Risk management linkage to residual risks may be incomplete.",
      ],
      priority_findings: [
        "Missing UDI / traceability information.",
        "No clear clinical evidence reference supporting performance claims.",
        "Warnings and contraindications could be more structured.",
      ],
      suggested_improvements: [
        "Add UDI and device identification information.",
        "Reference clinical evaluation or supporting clinical evidence.",
        "Add clearer residual risk, warnings, contraindications and revision information.",
      ],
    };

    setResult(demo);
    addToHistory(demo);
  };

  const downloadPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    const riskScore = result.risk_score || 0;

    doc.setFontSize(22);
    doc.text("MDR AI Compliance Report", 20, 20);

    doc.setFontSize(10);
    doc.text(`Generated: ${date}`, 20, 30);
    doc.text(`Generated by: ${email || "MDR AI Copilot"}`, 20, 36);
    doc.line(20, 42, 190, 42);

    doc.setFontSize(14);
    doc.text("Executive Summary", 20, 55);
    doc.setFontSize(11);
    doc.text(
      doc.splitTextToSize(result.summary_one_liner || "No summary available.", 170),
      20,
      65
    );

    doc.setFontSize(14);
    doc.text("Document Classification", 20, 95);
    doc.setFontSize(11);
    doc.text(`Document type: ${result.doc_type || "Unknown"}`, 20, 105);
    doc.text(`Confidence: ${result.confidence || "N/A"}`, 20, 113);

    doc.setFontSize(14);
    doc.text("Risk Assessment", 20, 130);
    doc.setFontSize(11);
    doc.text(`Risk score: ${riskScore}/10`, 20, 140);
    doc.text(`Risk level: ${result.risk_level || "N/A"}`, 20, 148);
    doc.text(`Compliance readiness: ${getReadiness(riskScore)}%`, 20, 156);
    doc.text(`Estimated review effort: ${getReviewEffort(riskScore)}`, 20, 164);
    doc.text(`Estimated hours saved: ${getHoursSaved(riskScore)}h`, 20, 172);
    doc.text(`Estimated QA cost saved: €${getCostSaved(riskScore)}`, 20, 180);
    doc.text(`Potential annual saving: €${getCostSaved(riskScore) * 12}`, 20, 188);
    doc.text(`Annual time recovered: ${getHoursSaved(riskScore) * 12}h`, 20, 196);

    doc.setFontSize(14);
    doc.text("Priority Findings", 20, 215);
    doc.setFontSize(11);
    (result.priority_findings || []).slice(0, 5).forEach((item, i) => {
      doc.text(doc.splitTextToSize(`- ${item}`, 160), 25, 225 + i * 10);
    });

    doc.addPage();

    doc.setFontSize(18);
    doc.text("Detailed MDR Review", 20, 20);

    doc.setFontSize(14);
    doc.text("Potential MDR Gaps", 20, 40);
    doc.setFontSize(11);
    (result.potential_mdr_gaps || []).slice(0, 8).forEach((item, i) => {
      doc.text(doc.splitTextToSize(`- ${item}`, 160), 25, 50 + i * 12);
    });

    doc.setFontSize(14);
    doc.text("Recommended Actions", 20, 155);
    doc.setFontSize(11);
    (result.suggested_improvements || []).slice(0, 8).forEach((item, i) => {
      doc.text(doc.splitTextToSize(`- ${item}`, 160), 25, 165 + i * 12);
    });

    doc.setFontSize(10);
    doc.text("Generated by MDR AI Copilot", 20, 285);
    doc.save("MDR_AI_Compliance_Report.pdf");
  };

  const copyEmail = () => {
    if (!result) return;

    const text = `
Subject:
MDR Compliance Review – ${result.doc_type}

Hi,

Attached is the MDR AI compliance review summary.

Document:
${result.doc_type}

Risk score:
${result.risk_score}/10

Risk level:
${result.risk_level}

Compliance readiness:
${getReadiness(result.risk_score)}%

Estimated review effort:
${getReviewEffort(result.risk_score)}

Estimated hours saved:
${getHoursSaved(result.risk_score)}h

Estimated QA cost saved:
€${getCostSaved(result.risk_score)}

Executive summary:
${result.summary_one_liner}

Priority findings:
${(result.priority_findings || []).map((x) => `- ${x}`).join("\n")}

Recommended actions:
${(result.suggested_improvements || []).map((x) => `- ${x}`).join("\n")}

Best,
MDR AI Copilot
`;

    navigator.clipboard.writeText(text);
    alert("Email copied");
  };

  const nav = (id, label) => (
    <div
      onClick={() => setActivePage(id)}
      style={{
        padding: 12,
        cursor: "pointer",
        borderRadius: 12,
        background: activePage === id ? "#eef2ff" : "transparent",
        fontWeight: activePage === id ? 700 : 500,
      }}
    >
      {label}
    </div>
  );

  const filteredHistory = history.filter((item) =>
    item.doc.toLowerCase().includes(search.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "Arial",
          padding: 16,
        }}
      >
        <div style={{ ...card, width: 390 }}>
          <h1>MDR AI Copilot</h1>
          <p>{authMode === "login" ? "Login to continue" : "Create account"}</p>

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              boxSizing: "border-box",
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              boxSizing: "border-box",
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />

          <button
            onClick={authMode === "login" ? login : createAccount}
            style={{ width: "100%", padding: 12 }}
          >
            {authMode === "login" ? "Login" : "Create account"}
          </button>

          <p style={{ marginTop: 20 }}>
            {authMode === "login" ? "No account?" : "Already have an account?"}{" "}
            <span
              onClick={() =>
                setAuthMode(authMode === "login" ? "register" : "login")
              }
              style={{ color: "#2563eb", cursor: "pointer" }}
            >
              {authMode === "login" ? "Create one" : "Login"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "Arial" }}>
      <aside style={{ width: 250, padding: 30, background: "#fff", borderRight: "1px solid #e5e7eb" }}>
        <h2>MDR AI</h2>

        {nav("dashboard", "Dashboard")}
        {nav("documents", "Documents")}
        {nav("reports", "Reports")}
        {nav("team", "Team")}
        {nav("billing", "Billing")}
        {nav("settings", "Settings")}

        <p style={{ marginTop: 50, color: "#666" }}>
          Workspace:<br />
          <b>{workspace}</b>
        </p>

        <p style={{ color: "#666" }}>
          Logged in as:<br />
          <b>{displayName}</b>
        </p>
      </aside>

      <main style={{ flex: 1, padding: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ marginBottom: 14, fontSize: 48, lineHeight: 1.1 }}>MDR AI Copilot</h1>
            <p style={{ color: "#64748b", marginTop: 0, fontSize: 18 }}>
              Welcome back, {displayName}. Review MDR documentation faster.
            </p>
          </div>

          <div style={{ ...card, padding: "12px 18px" }}>{workspace}</div>
        </div>

        {activePage === "dashboard" && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20, marginBottom: 25, marginTop: 25 }}>
              <div style={card}><h3>Total analyses</h3><h1>{totalAnalyses}</h1></div>
              <div style={card}><h3>Average risk</h3><h1>{avgRisk}</h1></div>
              <div style={card}><h3>High risk docs</h3><h1>{highRisk}</h1></div>
              <div style={card}>
                <h3>Annual time saved</h3>
                <h1>{(totalHoursSaved * 12).toFixed(0)}h</h1>
                <p style={{ color: "#64748b" }}>≈ 3 QA work weeks recovered</p>
              </div>
              <div style={card}>
                <h3>Annual QA saving</h3>
                <h1>€{totalCostSaved * 12}</h1>
                <p style={{ color: "#64748b" }}>≈ estimated per year</p>
              </div>
            </section>

            <section style={card}>
              <h2>Analyze document</h2>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />

              <button onClick={uploadAndAnalyze} style={{ ...button, marginLeft: 10 }}>
                {loading ? "Reviewing..." : "Analyze"}
              </button>

              <button onClick={loadDemoAnalysis} style={{ ...button, marginLeft: 10, background: "#2563eb" }}>
                Try sample IFU
              </button>
            </section>

            {result && (
              <section style={{ ...card, marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2>{result.doc_type}</h2>
                  <div style={{ background: getRiskBadge(result.risk_score).color, padding: "10px 14px", borderRadius: 999, fontWeight: 700 }}>
                    {getRiskBadge(result.risk_score).icon} {getRiskBadge(result.risk_score).label}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 20, marginBottom: 20 }}>
                  <div style={{ ...card, padding: 18 }}>
                    <h4>Compliance readiness</h4>
                    <h2>{getReadiness(result.risk_score)}%</h2>
                  </div>

                  <div style={{ ...card, padding: 18 }}>
                    <h4>Risk level</h4>
                    <h2>{getRiskBadge(result.risk_score).icon} {getRiskBadge(result.risk_score).label}</h2>
                  </div>

                  <div style={{ ...card, padding: 18 }}>
                    <h4>MDR gaps detected</h4>
                    <h2>{result.potential_mdr_gaps?.length || 0}</h2>
                  </div>

                  <div style={{ ...card, padding: 18 }}>
                    <h4>Recommended action</h4>
                    <p>Review critical MDR evidence before submission.</p>
                  </div>
                </div>

                <p>Estimated hours saved: <b>{getHoursSaved(result.risk_score)}h</b></p>
                <p>Estimated QA cost saved: <b>€{getCostSaved(result.risk_score)}</b></p>
                <p>{result.summary_one_liner}</p>

                <h3>MDR gaps</h3>
                <ul>{result.potential_mdr_gaps?.map((x, i) => <li key={i}>{x}</li>)}</ul>

                <h3>Recommended actions</h3>
                <ul>{result.suggested_improvements?.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </section>
            )}
          </>
        )}

        {activePage === "documents" && (
          <section style={card}>
            <h2>Documents</h2>
            <input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: 10, marginBottom: 15, width: "100%" }}
            />

            {filteredHistory.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  marginTop: 10,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => {
                  setSelectedAnalysis(item.full);
                  setResult(item.full);
                  setActivePage("detail");
                }}
              >
                <div>
                  <b>{item.doc}</b><br />
                  <small>{item.createdAt}</small>
                </div>

                <div style={{ background: getRiskBadge(item.risk).color, padding: "8px 12px", borderRadius: 999, fontWeight: 700 }}>
                  {getRiskBadge(item.risk).icon} Risk {item.risk}
                </div>
              </div>
            ))}
          </section>
        )}

        {activePage === "detail" && selectedAnalysis && (
          <section style={card}>
            <h2>Analysis Detail</h2>
            <p><b>Document:</b> {selectedAnalysis.doc_type}</p>
            <p><b>Risk:</b> {selectedAnalysis.risk_score}</p>
            <p><b>Risk level:</b> {selectedAnalysis.risk_level}</p>
            <p><b>Review effort:</b> {getReviewEffort(selectedAnalysis.risk_score)}</p>
            <p><b>Estimated hours saved:</b> {getHoursSaved(selectedAnalysis.risk_score)}h</p>
            <p><b>Estimated QA cost saved:</b> €{getCostSaved(selectedAnalysis.risk_score)}</p>

            <h3>Summary</h3>
            <p>{selectedAnalysis.summary_one_liner}</p>

            <h3>MDR gaps</h3>
            <ul>{selectedAnalysis.potential_mdr_gaps?.map((x, i) => <li key={i}>{x}</li>)}</ul>

            <h3>Recommended actions</h3>
            <ul>{selectedAnalysis.suggested_improvements?.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </section>
        )}

        {activePage === "reports" && (
          <section style={card}>
            <h2>Reports</h2>
            <button onClick={downloadPDF} style={button}>Download audit-ready report</button>
            <button onClick={copyEmail} style={{ ...button, marginLeft: 10, background: "#2563eb" }}>Copy email text</button>
          </section>
        )}

        {activePage === "team" && (
          <section style={card}>
            <h2>Team</h2>
            <p>Workspace members and reviewer roles.</p>

            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12, marginTop: 10 }}>
              <b>{displayName}</b><br />
              Admin / QA Lead
            </div>

            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12, marginTop: 10 }}>
              <b>Regulatory Affairs Reviewer</b><br />
              Pending invite
            </div>

            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12, marginTop: 10 }}>
              <b>Clinical Evaluation Specialist</b><br />
              Pending invite
            </div>
          </section>
        )}

        {activePage === "billing" && (
          <section style={card}>
            <h2>Billing</h2>
            <p><b>Current plan:</b> Starter</p>
            <p><b>Usage:</b> {totalAnalyses} / 50 analyses this month</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 20 }}>
              <div style={card}>
                <h3>Starter</h3>
                <h2>Free</h2>
                <p>5 analyses/month</p>
                <p>Basic PDF export</p>
              </div>

              <div style={{ ...card, border: "2px solid #2563eb" }}>
                <h3>Professional</h3>
                <h2>€299/mo</h2>
                <p>Unlimited analyses</p>
                <p>Team access</p>
                <p>Audit-ready exports</p>
              </div>

              <div style={card}>
                <h3>Enterprise</h3>
                <h2>Custom</h2>
                <p>Multi-site QA/RA teams</p>
                <p>API access</p>
                <p>Priority support</p>
              </div>
            </div>
          </section>
        )}

        {activePage === "settings" && (
          <section style={card}>
            <h2>Settings</h2>
            <button
              onClick={() => {
                localStorage.removeItem(historyKey);
                setHistory([]);
              }}
              style={button}
            >
              Clear history
            </button>
            <button onClick={logout} style={{ ...button, marginLeft: 10, background: "#ef4444" }}>
              Logout
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

