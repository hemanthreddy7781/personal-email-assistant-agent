import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify"
]

def get_gmail_service():
    creds = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
        # reads token.json if it exists
        # creds = the access token Google gave us before

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # token expired → refresh it silently, no browser needed
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
            # first time → opens browser → you approve → saves token
        
        with open("token.json", "w") as token:
            token.write(creds.to_json())
            # saves token to disk for next time

    service = build("gmail", "v1", credentials=creds)
    
    return service

import base64
from email.mime.text import MIMEText

from gmail_service import get_gmail_service


def send_gmail_message(
    recipient: str,
    subject: str,
    body: str,
    thread_id: str | None = None,
):
    """Send an email using the existing Gmail OAuth authorization."""

    if not recipient or not recipient.strip():
        raise ValueError("Recipient email is required.")

    if not subject or not subject.strip():
        raise ValueError("Email subject is required.")

    if not body or not body.strip():
        raise ValueError("Email body cannot be empty.")

    message = MIMEText(body, "plain", "utf-8")
    message["to"] = recipient
    message["subject"] = subject

    raw_message = base64.urlsafe_b64encode(
        message.as_bytes()
    ).decode("utf-8")

    service = get_gmail_service()

    request_body = {"raw": raw_message}

    if thread_id:
        request_body["threadId"] = thread_id

    result = (
        service.users()
        .messages()
        .send(userId="me", body=request_body)
        .execute()
    )

    return result["id"]
