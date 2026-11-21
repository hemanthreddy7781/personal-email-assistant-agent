
import { useState } from "react";
import {
  Mail,
  Inbox,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Send,
  ShieldCheck,
  FileText,
} from "lucide-react";
import "./App.css";

type EmailDraft = {
  id: number;
  sender: string;
  email: string;
  subject: string;
  received: string;
  category: "Urgent";
  body: string;
  draft: string;
  status: "Waiting for approval" | "Approved" | "Rejected";
};

const initialDrafts: EmailDraft[] = [
  {
    id: 1,
    sender: "Recruitment Team",
    email: "recruitment@example.com",
    subject: "Technical Interview Invitation",
    received: "10 minutes ago",
    category: "Urgent",
    body: "Hello, we would like to schedule your technical interview. Please confirm your availability.",
    draft:
      "Hello Recruitment Team,\n\nThank you for the interview invitation. I am interested in proceeding with the technical interview. Please share the available time slots so I can confirm my availability.\n\nBest regards,\nAbdi",
    status: "Waiting for approval",
  },
  {
    id: 2,
    sender: "Hiring Manager",
    email: "manager@example.com",
    subject: "Request for Project Details",
    received: "35 minutes ago",
    category: "Urgent",
    body: "Could you share the details of your recent projects before our discussion?",
    draft:
      "Hello,\n\nThank you for reaching out. I would be happy to share details of my recent projects ahead of our discussion. I will include the project objectives, technologies used, and key outcomes.\n\nBest regards,\nAbdi",
    status: "Waiting for approval",
  },
];

function App() {
  const [drafts, setDrafts] = useState<EmailDraft[]>(initialDrafts);
  const [selectedId, setSelectedId] = useState<number>(initialDrafts[0].id);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const selectedDraft = drafts.find((draft) => draft.id === selectedId);

  const filteredDrafts = drafts.filter((draft) => {
    const query = search.toLowerCase();
    return (
      draft.sender.toLowerCase().includes(query) ||
      draft.subject.toLowerCase().includes(query) ||
      draft.email.toLowerCase().includes(query)
    );
  });

  function updateDraftText(value: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selectedId ? { ...draft, draft: value } : draft
      )
    );
    setNotice("Draft edits are currently stored in this page only.");
  }

  function updateStatus(status: EmailDraft["status"]) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selectedId ? { ...draft, status } : draft
      )
    );

    setNotice(
      status === "Approved"
        ? "Marked approved in this demo. No email was sent."
        : "Draft rejected in this demo."
    );
  }

  const pendingCount = drafts.filter(
    (draft) => draft.status === "Waiting for approval"
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Mail size={23} />
          </div>
          <div>
            <h2>MailPilot</h2>
            <p>Personal Email Assistant</p>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <button className="nav-item active">
          <Inbox size={18} />
          <span>Draft Inbox</span>
          <span className="nav-count">{pendingCount}</span>
        </button>

        <div className="sidebar-card">
          <ShieldCheck size={21} />
          <h3>You are in control</h3>
          <p>Emails require your review before they can be sent.</p>
        </div>

        <div className="sidebar-footer">
          <div className="avatar">EA</div>
          <div>
            <strong>Email Assistant</strong>
            <p>Local demo</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Draft Inbox</p>
            <h1>Email Drafts</h1>
            <p className="subtitle">
              Review AI-generated replies before sending them.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => setNotice("Demo refreshed. No backend is connected yet.")}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon orange">
              <AlertCircle size={20} />
            </div>
            <div>
              <p>Urgent emails</p>
              <h2>{drafts.length}</h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">
              <Clock size={20} />
            </div>
            <div>
              <p>Awaiting approval</p>
              <h2>{pendingCount}</h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p>Approved</p>
              <h2>
                {drafts.filter((draft) => draft.status === "Approved").length}
              </h2>
            </div>
          </div>
        </section>

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}

        <section className="inbox-layout">
          <div className="email-list-panel">
            <div className="panel-heading">
              <div>
                <h2>Urgent emails</h2>
                <p>Select an email to review its draft.</p>
              </div>
              <span className="total-pill">{filteredDrafts.length}</span>
            </div>

            <label className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search emails..."
              />
            </label>

            <div className="email-list">
              {filteredDrafts.map((draft) => (
                <button
                  key={draft.id}
                  className={`email-item ${
                    selectedId === draft.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedId(draft.id)}
                >
                  <div className="email-item-top">
                    <strong>{draft.sender}</strong>
                    <span className="email-time">{draft.received}</span>
                  </div>
                  <p className="email-subject">{draft.subject}</p>
                  <div className="email-item-bottom">
                    <span className="urgent-tag">Urgent</span>
                    <span className="mini-status">{draft.status}</span>
                  </div>
                </button>
              ))}

              {filteredDrafts.length === 0 && (
                <p className="empty-state">No matching emails found.</p>
              )}
            </div>
          </div>

          <div className="draft-panel">
            {selectedDraft ? (
              <>
                <div className="draft-header">
                  <div className="draft-title">
                    <div className="document-icon">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2>Review draft</h2>
                      <p>AI-generated reply · Edit before approving</p>
                    </div>
                  </div>
                  <span
                    className={`status-pill ${
                      selectedDraft.status === "Waiting for approval"
                        ? "pending"
                        : selectedDraft.status === "Approved"
                          ? "approved"
                          : "rejected"
                    }`}
                  >
                    {selectedDraft.status}
                  </span>
                </div>

                <div className="original-email">
                  <p className="section-label">ORIGINAL EMAIL</p>
                  <h3>{selectedDraft.subject}</h3>
                  <p>
                    <strong>From:</strong> {selectedDraft.sender} (
                    {selectedDraft.email})
                  </p>
                  <p className="original-body">{selectedDraft.body}</p>
                </div>

                <div className="reply-section">
                  <label htmlFor="reply-draft" className="section-label">
                    YOUR REPLY
                  </label>
                  <textarea
                    id="reply-draft"
                    value={selectedDraft.draft}
                    onChange={(event) => updateDraftText(event.target.value)}
                    rows={11}
                    disabled={selectedDraft.status !== "Waiting for approval"}
                  />
                  <p className="editor-hint">
                    Review names, dates, facts, and tone before approval.
                  </p>
                </div>

                <div className="draft-actions">
                  <button
                    className="reject-button"
                    onClick={() => updateStatus("Rejected")}
                    disabled={selectedDraft.status !== "Waiting for approval"}
                  >
                    <XCircle size={17} />
                    Reject
                  </button>

                  <button
                    className="approve-button"
                    onClick={() => updateStatus("Approved")}
                    disabled={
                      selectedDraft.status !== "Waiting for approval" ||
                      !selectedDraft.draft.trim()
                    }
                  >
                    <Send size={17} />
                    Approve draft
                  </button>
                </div>

                <p className="safety-note">
                  <ShieldCheck size={16} />
                  Demo only: approving does not send an email.
                </p>
              </>
            ) : (
              <div className="empty-detail">
                <Mail size={34} />
                <h2>No email selected</h2>
                <p>Choose an email from the list to review its draft.</p>
              </div>
            )}
          </div>
        </section>

        <footer className="page-footer">
          <span>MailPilot · Personal Email Assistant</span>
          <span>Frontend demo · Backend connection pending</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
