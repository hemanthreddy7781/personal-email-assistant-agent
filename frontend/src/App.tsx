import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail, Inbox, AlertCircle, Clock, CheckCircle2, XCircle, Search,
  RefreshCw, Send, ShieldCheck, FileText,
} from "lucide-react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

type EmailDraft = {
  id: string;
  sender: string;
  email: string;
  subject: string;
  received: string;
  category: "Urgent";
  body: string;
  draft: string;
  status: "Waiting for approval" | "Approved" | "Rejected";
};

type ApiDraft = {
  gmail_id: string;
  sender?: string;
  subject?: string;
  body?: string;
  draft?: string;
  status?: string;
  created_at?: string;
};

function senderParts(sender: string) {
  const match = sender.match(/<([^>]+)>/);
  return { email: match?.[1] ?? sender, name: sender.replace(/<[^>]+>/, "").trim() || sender };
}

function relativeDate(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " hr ago";
  return Math.floor(hours / 24) + " day ago";
}

function mapDraft(row: ApiDraft): EmailDraft {
  const sender = row.sender ?? "Unknown sender";
  const parsed = senderParts(sender);
  return {
    id: String(row.gmail_id),
    sender: parsed.name,
    email: parsed.email,
    subject: row.subject ?? "(No subject)",
    received: relativeDate(row.created_at),
    category: "Urgent",
    body: row.body ?? "",
    draft: row.draft ?? "",
    status: row.status === "rejected" ? "Rejected" : row.status === "sent" ? "Approved" : "Waiting for approval",
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed (" + response.status + ")");
  return data as T;
}

function App() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);

  const loadDrafts = useCallback(async () => {
    const rows = await apiRequest<ApiDraft[]>("/api/drafts");
    const mapped = rows.map(mapDraft);
    setDrafts(mapped);
    setSelectedId((current) => current && mapped.some((d) => d.id === current) ? current : mapped[0]?.id ?? null);
    setDirtyIds([]);
  }, []);

  useEffect(() => {
    loadDrafts()
      .then(() => setNotice("Draft inbox synced with backend."))
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [loadDrafts]);

  const selectedDraft = drafts.find((draft) => draft.id === selectedId);
  const filteredDrafts = useMemo(() => drafts.filter((draft) => {
    const query = search.toLowerCase();
    return draft.sender.toLowerCase().includes(query) ||
      draft.subject.toLowerCase().includes(query) ||
      draft.email.toLowerCase().includes(query);
  }), [drafts, search]);

  const pendingCount = drafts.filter((draft) => draft.status === "Waiting for approval").length;
  const approvedCount = drafts.filter((draft) => draft.status === "Approved").length;

  function updateDraftText(value: string) {
    if (!selectedId) return;
    setDrafts((current) => current.map((draft) => draft.id === selectedId ? { ...draft, draft: value } : draft));
    setDirtyIds((current) => current.includes(selectedId) ? current : [...current, selectedId]);
    setNotice("Draft has unsaved edits.");
  }

  async function refresh() {
    setBusy(true);
    try {
      await loadDrafts();
      setNotice("Draft inbox refreshed from MySQL.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not refresh drafts.");
    } finally {
      setBusy(false);
    }
  }

  async function processEmails() {
    setBusy(true);
    setNotice("Fetching unread Gmail messages and processing them...");
    try {
      const result = await apiRequest<{ message?: string; errors?: { gmail_id: string; error: string }[] }>("/api/process", { method: "POST" });
      await loadDrafts();
      const issueCount = result.errors?.length ?? 0;
      setNotice((result.message ?? "Email processing completed.") + (issueCount ? " " + issueCount + " processing error(s) occurred." : ""));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Email processing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!selectedDraft) return;
    setBusy(true);
    try {
      await apiRequest("/api/drafts/" + encodeURIComponent(selectedDraft.id), {
        method: "PUT",
        body: JSON.stringify({ draft: selectedDraft.draft }),
      });
      setDirtyIds((current) => current.filter((id) => id !== selectedDraft.id));
      setNotice("Draft saved to MySQL.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectDraft() {
    if (!selectedDraft) return;
    setBusy(true);
    try {
      await apiRequest("/api/drafts/" + encodeURIComponent(selectedDraft.id) + "/reject", { method: "POST", body: JSON.stringify({}) });
      setDrafts((current) => current.filter((draft) => draft.id !== selectedDraft.id));
      setSelectedId(null);
      setNotice("Draft rejected and recorded in MySQL.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Draft rejection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndSend() {
    if (!selectedDraft || !selectedDraft.draft.trim()) return;
    setBusy(true);
    try {
      await apiRequest("/api/drafts/" + encodeURIComponent(selectedDraft.id) + "/approve", {
        method: "POST",
        body: JSON.stringify({ approved: true, draft: selectedDraft.draft }),
      });
      setDrafts((current) => current.filter((draft) => draft.id !== selectedDraft.id));
      setSelectedId(null);
      setNotice("Reply sent through Gmail successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sending failed. Check backend logs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Mail size={23} /></div>
          <div><h2>MailPilot</h2><p>Personal Email Assistant</p></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active">
          <Inbox size={18} /><span>Draft Inbox</span><span className="nav-count">{pendingCount}</span>
        </button>
        <div className="sidebar-card">
          <ShieldCheck size={21} /><h3>You are in control</h3>
          <p>Emails require your review before they can be sent.</p>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">EA</div><div><strong>Email Assistant</strong><p>Local development</p></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="breadcrumb">Workspace / Draft Inbox</p><h1>Email Drafts</h1><p className="subtitle">Review AI-generated replies before sending them.</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={refresh} disabled={busy}><RefreshCw size={16} /> Refresh</button>
            <button className="approve-button" onClick={processEmails} disabled={busy}><Inbox size={16} /> Process Emails</button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card"><div className="stat-icon orange"><AlertCircle size={20} /></div><div><p>Urgent drafts</p><h2>{drafts.length}</h2></div></div>
          <div className="stat-card"><div className="stat-icon blue"><Clock size={20} /></div><div><p>Awaiting approval</p><h2>{pendingCount}</h2></div></div>
          <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={20} /></div><div><p>Sent this session</p><h2>{approvedCount}</h2></div></div>
        </section>

        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}

        <section className="inbox-layout">
          <div className="email-list-panel">
            <div className="panel-heading"><div><h2>Urgent emails</h2><p>Select an email to review its draft.</p></div><span className="total-pill">{filteredDrafts.length}</span></div>
            <label className="search-box"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search emails..."/></label>
            <div className="email-list">
              {loading ? <p className="empty-state">Loading drafts...</p> : filteredDrafts.map((draft) => (
                <button key={draft.id} className={`email-item ${selectedId === draft.id ? "selected" : ""}`} onClick={() => setSelectedId(draft.id)}>
                  <div className="email-item-top"><strong>{draft.sender}</strong><span className="email-time">{draft.received}</span></div>
                  <p className="email-subject">{draft.subject}</p>
                  <div className="email-item-bottom"><span className="urgent-tag">Urgent</span><span className="mini-status">{dirtyIds.includes(draft.id) ? "Unsaved edits" : draft.status}</span></div>
                </button>
              ))}
              {!loading && filteredDrafts.length === 0 && <p className="empty-state">No pending drafts. Click Process Emails to check Gmail.</p>}
            </div>
          </div>

          <div className="draft-panel">
            {selectedDraft ? <>
              <div className="draft-header"><div className="draft-title"><div className="document-icon"><FileText size={20}/></div><div><h2>Review draft</h2><p>AI-generated reply · Edit before approving</p></div></div><span className="status-pill pending">{dirtyIds.includes(selectedDraft.id) ? "Unsaved edits" : selectedDraft.status}</span></div>
              <div className="original-email"><p className="section-label">ORIGINAL EMAIL</p><h3>{selectedDraft.subject}</h3><p><strong>From:</strong> {selectedDraft.sender} ({selectedDraft.email})</p><p className="original-body">{selectedDraft.body}</p></div>
              <div className="reply-section"><label htmlFor="reply-draft" className="section-label">YOUR REPLY</label><textarea id="reply-draft" value={selectedDraft.draft} onChange={(event) => updateDraftText(event.target.value)} rows={11} disabled={busy}/><p className="editor-hint">Review names, dates, facts, and tone before sending.</p></div>
              <div className="draft-actions">
                <button className="reject-button" onClick={rejectDraft} disabled={busy}><XCircle size={17}/> Reject</button>
                <button className="secondary-button" onClick={saveDraft} disabled={busy || !dirtyIds.includes(selectedDraft.id)}><FileText size={17}/> Save draft</button>
                <button className="approve-button" onClick={approveAndSend} disabled={busy || !selectedDraft.draft.trim()}><Send size={17}/> Approve & Send</button>
              </div>
              <p className="safety-note"><ShieldCheck size={16}/> Gmail sending occurs only after you explicitly click Approve & Send.</p>
            </> : <div className="empty-detail"><Mail size={34}/><h2>No email selected</h2><p>Choose an email from the list to review its draft.</p></div>}
          </div>
        </section>
        <footer className="page-footer"><span>MailPilot · Personal Email Assistant</span><span>Connected to local Flask API</span></footer>
      </main>
    </div>
  );
}

export default App;
