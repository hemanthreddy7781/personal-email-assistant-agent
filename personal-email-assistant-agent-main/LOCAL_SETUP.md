# Local setup: Personal Email Assistant

This setup uses MySQL, Gmail OAuth, Groq, Flask, and the React/Vite frontend.

## 1. Backend

Open a terminal in `personal-email-assistant-agent-main`.

### Create and activate the virtual environment (Windows PowerShell)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set your Groq key and MySQL credentials.

Create the MySQL database (run in MySQL Workbench or MySQL CLI):

```sql
CREATE DATABASE email_assistant;
```

Initialize the table:

```powershell
python database.py
```

## 2. Gmail OAuth

In Google Cloud Console:
1. Create/select a project.
2. Enable Gmail API.
3. Configure the OAuth consent screen for your account.
4. Create an OAuth client ID of type **Desktop app**.
5. Download the JSON and place it in this backend folder as `credentials.json`.

The first Gmail request opens the browser for authorization and creates `token.json`. Keep both files private; never commit them.

## 3. Run the Flask backend

```powershell
python api.py
```

Backend URL: http://localhost:5000

Health check: http://localhost:5000/api/health

## 4. Frontend

Open a second terminal in `frontend`.

```powershell
npm install
copy .env.example .env
npm run dev
```

Frontend URL: http://localhost:5173

## 5. Workflow

1. Open the frontend.
2. Click **Process Emails** to fetch unread emails, classify them, and generate drafts for urgent emails.
3. Select a draft, review and edit it.
4. Click **Save draft** to persist edits, or **Approve & Send** to send the edited content.
5. Use **Reject** to mark a draft rejected.

## API endpoints

- `GET /api/health`
- `POST /api/process`
- `GET /api/drafts`
- `PUT /api/drafts/{gmail_id}`
- `POST /api/drafts/{gmail_id}/approve` (requires `{"approved": true, "draft": "..."}`)
- `POST /api/drafts/{gmail_id}/reject`

**Safety:** Sending is only triggered by the explicit approve endpoint. Do not expose this local backend publicly without adding authentication and CSRF protections.
