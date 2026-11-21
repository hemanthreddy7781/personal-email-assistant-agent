
import os
import json
import base64
from email.message import EmailMessage
from email.utils import parseaddr

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from langchain_core.tools import tool
from database import get_connection

load_dotenv()

# Gmail permissions required for reading and sending emails.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]


# --------------------------------------------------
# GMAIL AUTHENTICATION
# --------------------------------------------------

def get_gmail_service():
    """Authenticate with Gmail and return the API service."""

    creds = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file(
            "token.json", SCOPES
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists("credentials.json"):
                raise FileNotFoundError(
                    "credentials.json not found. "
                    "Download your Gmail OAuth credentials."
                )

            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open("token.json", "w", encoding="utf-8") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


# --------------------------------------------------
# EMAIL HELPERS
# --------------------------------------------------

def decode_body(data):
    """Decode a Gmail base64url message body."""

    if not data:
        return ""

    decoded = base64.urlsafe_b64decode(
        data + "=" * (-len(data) % 4)
    )

    return decoded.decode("utf-8", errors="replace")


def extract_email_body(payload):
    """Extract the plain-text body from a Gmail message."""

    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data")

    if mime_type == "text/plain" and body_data:
        return decode_body(body_data)

    # Prefer plain text in multipart messages.
    for part in payload.get("parts", []):
        result = extract_email_body(part)

        if result:
            return result

    # Fall back to HTML content if plain text is unavailable.
    if mime_type == "text/html" and body_data:
        return decode_body(body_data)

    return ""


def get_header(headers, name):
    """Return a Gmail header value, ignoring case."""

    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")

    return ""


# --------------------------------------------------
# MYSQL HELPERS
# --------------------------------------------------

def save_email_record(
    gmail_id, sender, subject, body, category=None
):
    """Insert or update an email record in MySQL."""

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO emails
                (gmail_id, sender, subject, body, category)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                sender = VALUES(sender),
                subject = VALUES(subject),
                body = VALUES(body),
                category = COALESCE(
                    VALUES(category), category
                )
            """,
            (gmail_id, sender, subject, body, category),
        )

        conn.commit()

    finally:
        cursor.close()
        conn.close()


# --------------------------------------------------
# TOOL 1: READ UNREAD EMAILS
# --------------------------------------------------


@tool
def read_emails():
    """
    Read up to 3 unread Gmail messages.
    Save full email bodies to MySQL, but return
    limited body text to the LLM.
    """
    try:
        service = get_gmail_service()

        response = service.users().messages().list(
            userId="me",
            q="is:unread",
            maxResults=3,
        ).execute()

        messages = response.get("messages", [])
        print(f"Unread emails found: {len(messages)}")
        emails = []

        for message in messages:
            gmail_id = message["id"]

            details = service.users().messages().get(
                userId="me",
                id=gmail_id,
                format="full",
            ).execute()

            payload = details.get("payload", {})
            headers = payload.get("headers", [])

            sender = get_header(headers, "From")
            subject = get_header(headers, "Subject")
            body = extract_email_body(payload)

            # Save the full email in MySQL.
            save_email_record(
                gmail_id=gmail_id,
                sender=sender,
                subject=subject,
                body=body,
            )

            # Send only a limited body to the LLM.
            email_data = {
                "gmail_id": gmail_id,
                "sender": sender[:300],
                "subject": subject[:500],
                "body": body[:2000],
            }

            emails.append(email_data)

        return json.dumps(emails, ensure_ascii=False)

    except (HttpError, OSError, ValueError, RuntimeError) as exc:
        return f"Failed to read emails: {exc}"

# --------------------------------------------------
# TOOL 2: CATEGORIZE EMAIL
# --------------------------------------------------

@tool
def categorize_email(
    gmail_id: str,
    sender: str,
    subject: str,
    body: str,
    category: str,
):
    """
    Categorize an email as urgent, normal, or spam
    and save the classification in MySQL.
    """

    category = category.strip().lower()

    if category not in {"urgent", "normal", "spam"}:
        return (
            "Invalid category. Use urgent, normal, or spam."
        )

    try:
        save_email_record(
            gmail_id=gmail_id,
            sender=sender,
            subject=subject,
            body=body,
            category=category,
        )

        return (
            f"Email {gmail_id} categorized as {category} "
            "and saved in MySQL."
        )

    except Exception as exc:
        return f"Failed to categorize email: {exc}"


# --------------------------------------------------
# TOOL 3: DRAFT REPLY
# --------------------------------------------------

@tool
def draft_reply(
    gmail_id: str,
    draft: str,
):
    """
    Save a professional reply draft in MySQL.
    This tool does not send the email.
    """

    if not draft or not draft.strip():
        return "Draft cannot be empty. Provide a reply draft."

    # Add the requested signature if it is not already present.
    draft = draft.strip()

    signature = "Best regards,\\nAbdi"
    if not draft.endswith(signature):
        draft = draft.rstrip() + "\\n\\n" + signature

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE emails
            SET draft = %s,
                status = 'drafted'
            WHERE gmail_id = %s
            """,
            (draft, gmail_id),
        )

        if cursor.rowcount == 0:
            conn.rollback()
            return (
                f"Email {gmail_id} was not found. "
                "Read and categorize it before drafting."
            )

        conn.commit()

        return (
            f"Reply draft saved for email {gmail_id}. "
            "The email has NOT been sent."
        )

    except Exception as exc:
        conn.rollback()
        return f"Failed to save draft: {exc}"

    finally:
        cursor.close()
        conn.close()


# --------------------------------------------------
# TOOL 4: SEND APPROVED REPLY
# --------------------------------------------------

@tool
def send_reply(gmail_id: str, to: str):
    """
    Send a previously saved reply.
    The application must obtain human approval before
    allowing this tool to execute.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT subject, draft, status
            FROM emails
            WHERE gmail_id = %s
            """,
            (gmail_id,),
        )

        row = cursor.fetchone()

        if not row:
            return f"Email {gmail_id} was not found."

        subject, draft, status = row

        if not draft or not draft.strip():
            return (
                "No saved draft exists. Draft the reply first."
            )

        if status == "sent":
            return (
                f"Email {gmail_id} has already been sent. "
                "No duplicate email was sent."
            )

        recipient = parseaddr(to)[1]

        if not recipient:
            return "A valid recipient email address is required."

        service = get_gmail_service()

        # Fetch the original message to preserve its thread.
        original = service.users().messages().get(
            userId="me",
            id=gmail_id,
            format="full",
        ).execute()

        headers = original.get("payload", {}).get(
            "headers", []
        )

        original_message_id = get_header(
            headers, "Message-ID"
        )
        references = get_header(headers, "References")

        message = EmailMessage()
        message["To"] = recipient
        message["Subject"] = (
            subject
            if subject.lower().startswith("re:")
            else f"Re: {subject}"
        )

        if original_message_id:
            message["In-Reply-To"] = original_message_id
            message["References"] = (
                f"{references} {original_message_id}".strip()
            )

        message.set_content(draft)

        raw_message = base64.urlsafe_b64encode(
            message.as_bytes()
        ).decode("utf-8")

        payload = {"raw": raw_message}

        if original.get("threadId"):
            payload["threadId"] = original["threadId"]

        service.users().messages().send(
            userId="me",
            body=payload,
        ).execute()

        cursor.execute(
            """
            UPDATE emails
            SET status = 'sent'
            WHERE gmail_id = %s
            """,
            (gmail_id,),
        )

        conn.commit()

        return f"Reply sent successfully to {recipient}."

    except Exception as exc:
        conn.rollback()
        return f"Failed to send reply: {exc}"

    finally:
        cursor.close()
        conn.close()


# Tools exposed to LangGraph.
tools = [
    read_emails,
    categorize_email,
    draft_reply,
    send_reply,
]
