import { useState, useEffect } from "react";
import jsPDF from "jspdf";

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

  const userName = email || "guest";
  const historyKey = `mdr_history_${userName}`;

  useEffect(() => {
    const h = localStorage.getItem(historyKey);
    setHistory(h ? JSON.parse(h) : []);
  }, [historyKey]);

  const card = {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 20,
    padding: 24,
  };

  const createAccount = () => {
    if (!email.trim() || !password.trim()) {
      alert("Enter email and password");
      return;
    }

    localStorage.setItem(
      "mdr_account",
      JSON.stringify({
        email: email.trim(),
        password: password.trim(),
      })
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
      const up = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: form,
      });

      const uploadData = await up.json();

      const res = await fetch(
        `http://127.0.0.1:8000/analyze/${uploadData.document_id}`
      );

      const data = await res.json();

      setResult(data);

      const newHistory = [
        {
          doc: data.doc_type,
          risk: data.risk_score,
          full: data,
        },
        ...history.slice(0, 5),
      ];

      setHistory(newHistory);
      localStorage.setItem(historyKey, JSON.stringify(newHistory));
    } catch (err) {
      console.error(err);
      alert("Backend failed");
    }

    setLoading(false);
  };

  const downloadPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    doc.text("MDR Compliance Report", 20, 20);
    doc.text(`Document: ${result.doc_type}`, 20, 40);
    doc.text(`Risk: ${result.risk_score}`, 20, 60);
    doc.text(`Summary: ${result.summary_one_liner}`, 20, 80);
    doc.save("MDR_Report.pdf");
  };

  const copyEmail = () => {
    if (!result) return;

    const text = `
Subject:
MDR Compliance Review

Document:
${result.doc_type}

Risk:
${result.risk_score}

Summary:
${result.summary_one_liner}

Recommended:
${result.suggested_improvements?.join("\n")}
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
      }}
    >
      {label}
    </div>
  );

  const filteredHistory = history.filter((x) =>
    x.doc.toLowerCase().includes(search.toLowerCase())
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
        }}
      >
        <div style={{ ...card, width: 380 }}>
          <h1>MDR AI Copilot</h1>

          <p>{authMode === "login" ? "Login to continue" : "Create account"}</p>

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
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
      <aside style={{ width: 250, padding: 30, background: "#fff" }}>
        <h2>MDR AI</h2>

        {nav("dashboard", "Dashboard")}
        {nav("documents", "Documents")}
        {nav("reports", "Reports")}
        {nav("settings", "Settings")}

        <p style={{ marginTop: 50, color: "#666" }}>
          Logged in as:<br />
          <b>{email}</b>
        </p>
      </aside>

      <main style={{ flex: 1, padding: 40 }}>
        <h1>MDR AI Copilot</h1>

        {activePage === "dashboard" && (
          <>
            <section style={card}>
              <h2>Analyze document</h2>

              <input type="file" onChange={(e) => setFile(e.target.files[0])} />

              <button onClick={uploadAndAnalyze} style={{ marginLeft: 10 }}>
                {loading ? "Reviewing..." : "Analyze"}
              </button>
            </section>

            {result && (
              <section style={{ ...card, marginTop: 20 }}>
                <h2>{result.doc_type}</h2>
                <p>Risk: {result.risk_score}</p>
                <p>{result.summary_one_liner}</p>

                <h3>MDR gaps</h3>
                <ul>
                  {result.potential_mdr_gaps?.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>

                <h3>Recommended actions</h3>
                <ul>
                  {result.suggested_improvements?.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
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
            />

            {filteredHistory.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  border: "1px solid #eee",
                  marginTop: 10,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setSelectedAnalysis(item.full);
                  setActivePage("detail");
                }}
              >
                <b>{item.doc}</b>
                <br />
                Risk: {item.risk}
              </div>
            ))}
          </section>
        )}

        {activePage === "detail" && selectedAnalysis && (
          <section style={card}>
            <h2>Analysis Detail</h2>
            <p>Document: {selectedAnalysis.doc_type}</p>
            <p>Risk: {selectedAnalysis.risk_score}</p>
            <p>{selectedAnalysis.summary_one_liner}</p>
          </section>
        )}

        {activePage === "reports" && (
          <section style={card}>
            <h2>Reports</h2>

            <button onClick={downloadPDF}>Download Compliance Report</button>

            <button onClick={copyEmail} style={{ marginLeft: 10 }}>
              Copy email text
            </button>
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
            >
              Clear history
            </button>

            <button onClick={logout} style={{ marginLeft: 10 }}>
              Logout
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

