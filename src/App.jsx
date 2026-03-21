import { useState, useEffect } from "react";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, logoutUser } from "./firebase.js";
import Login from "./Login.jsx";
import CustomerStore from "./CustomerStore.jsx";
import Pharmacist from "./Pharmacist.jsx";
import Dashboard from "./Dashboard.jsx";
import ActivityLog from "./ActivityLog.jsx";
import ReceiveStock from "./ReceiveStock.jsx";
import EditDatabase from "./EditDatabase.jsx";
import WasteAnalytics from "./WasteAnalytics.jsx";

const TABS = {
  pharmacist: [
    { id: "dispense", label: "Dispense" },
    { id: "log", label: "Activity Log" },
  ],
  manager: [
    { id: "stock", label: "Stock Overview" },
    { id: "receive", label: "Receive Stock" },
    { id: "waste", label: "Waste Analytics" },
    { id: "log", label: "Activity Log" },
  ],
  admin: [
    { id: "stock", label: "Dashboard" },
    { id: "receive", label: "Receive Stock" },
    { id: "waste", label: "Waste Analytics" },
    { id: "log", label: "Activity Log" },
    { id: "edit", label: "Edit Database" },
  ],
};

const ROLE_LABELS = { pharmacist: "Pharmacist", manager: "Store Manager", admin: "Administrator" };

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("");
  const [now, setNow] = useState(new Date());
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState({ alerts: 0, value: 0, dispensedToday: 0, medicines: 0 });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.email));
        if (userDoc.exists()) {
          const userData = { uid: firebaseUser.uid, email: firebaseUser.email, ...userDoc.data() };
          setUser(userData);
          if (userData.role !== "customer") {
            setTab(TABS[userData.role]?.[0]?.id || "");
            loadStats();
          }
        }
      } else { setUser(null); }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  function handleLogin(userData) {
    setUser(userData);
    if (userData.role !== "customer") {
      setTab(TABS[userData.role]?.[0]?.id || "");
      loadStats();
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null); setTab("");
  }

  async function loadStats() {
    try {
      const { getAllMedicines, getAllBatches, getAlerts, getDispenseLog } = await import("./db.js");
      const [meds, bats, alts, logs] = await Promise.all([getAllMedicines(), getAllBatches(), getAlerts(), getDispenseLog()]);
      const today = new Date().toDateString();
      const dispensedToday = logs.filter(l => {
        const t = l.dispensedAt?.toDate ? l.dispensedAt.toDate() : new Date(l.dispensedAt);
        return t.toDateString() === today;
      }).reduce((s, l) => s + (l.quantityDispensed || 0), 0);
      const totalValue = bats.reduce((s, b) => s + (b.quantity * (b.unitPrice || 0)), 0);
      setStats({ alerts: alts.length, value: totalValue, dispensedToday, medicines: meds.length });
    } catch {}
  }

  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  if (!authChecked) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid var(--border)", borderTopColor: "var(--teal)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: "13px" }}>Loading MedStock AI...</div>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;
  if (user.role === "customer") return <CustomerStore user={user} onLogout={handleLogout} />;

  const roleTabs = TABS[user.role] || [];

  // Stats bar items per role
  const statsItems = user.role === "admin"
    ? [
        { label: "Medicines", value: stats.medicines },
        { label: "Active alerts", value: stats.alerts, color: stats.alerts > 0 ? "var(--red)" : "var(--green)" },
        { label: "Dispensed today", value: stats.dispensedToday },
      ]
    : user.role === "manager"
    ? [
        { label: "Inventory value", value: `₹${stats.value.toLocaleString()}` },
        { label: "Active alerts", value: stats.alerts, color: stats.alerts > 0 ? "var(--red)" : "var(--green)" },
        { label: "Dispensed today", value: stats.dispensedToday },
      ]
    : [
        { label: "Dispensed today", value: stats.dispensedToday },
        { label: "Active alerts", value: stats.alerts, color: stats.alerts > 0 ? "var(--red)" : "var(--green)" },
      ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">✚</div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "-0.3px" }}>MedStock AI</div>
            <div style={{ fontSize: "10px", opacity: 0.5, fontWeight: "400", marginTop: "-1px" }}>Hospital Pharmacy System</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Stats inline in navbar */}
        <div style={{ display: "flex", gap: "0", borderLeft: "1px solid rgba(255,255,255,0.1)", marginLeft: "16px" }}>
          {statsItems.map((s, i) => (
            <div key={i} style={{ padding: "0 20px", borderRight: "1px solid rgba(255,255,255,0.1)", textAlign: "right" }}>
              <div style={{ fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-mono)", color: s.color || "white" }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Clock */}
        <div style={{ padding: "0 20px", borderRight: "1px solid rgba(255,255,255,0.1)", textAlign: "right" }}>
          <div style={{ fontSize: "14px", fontWeight: "500", fontFamily: "var(--font-mono)", color: "white" }}>{timeStr}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)" }}>{dateStr}</div>
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingLeft: "20px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: "white" }}>
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "white" }}>{user.name}</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)" }}>{ROLE_LABELS[user.role]}</div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ marginLeft: "8px", color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.15)" }}>
            Logout
          </button>
        </div>
      </nav>

      {/* TAB BAR */}
      <div className="tab-bar">
        {roleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn ${tab === t.id ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PAGE CONTENT */}
      <div className="page fade-in">
        {tab === "dispense" && <Pharmacist user={user} />}
        {tab === "stock" && <Dashboard role={user.role} />}
        {tab === "receive" && <ReceiveStock user={user} />}
        {tab === "log" && <ActivityLog />}
        {tab === "edit" && <EditDatabase />}
        {tab === "waste" && <WasteAnalytics />}
      </div>
    </div>
  );
}
