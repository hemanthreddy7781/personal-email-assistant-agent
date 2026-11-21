# Personal Email Assistant Agent

A production-oriented, agentic email automation system built with Python and LangGraph. This project implements an LLM-powered assistant that can read unread emails from Gmail, categorize them, save structured records to a PostgreSQL database, draft replies for urgent messages, and pause for human approval before sending any response. The workflow is designed around tool-calling, memory-backed state, and safe human-in-the-loop control.

## Overview

This repository demonstrates how an LLM can be orchestrated as an autonomous agent that interacts with real-world tools rather than behaving as a standalone chatbot. The assistant is built around a stateful graph workflow where the model decides when to invoke tools such as reading emails, storing metadata, generating drafts, and sending replies.

The design emphasizes reliability, traceability, and practical utility in a real-world workflow:

- The agent reads unread Gmail messages and extracts sender, subject, and content.
- Each email is categorized as urgent, normal, or spam.
- Urgent messages can trigger a draft reply workflow.
- A human approval step prevents unreviewed email responses from being sent automatically.
- The system persists email information in a relational database for downstream analysis and workflow continuity.

## The project

This project is not just a demo of prompt engineering; it showcases a practical application of modern AI engineering patterns:

- Agentic workflow orchestration with LangGraph
- Tool-augmented reasoning with LangChain-style tool definitions
- Real external API integration through the Gmail API
- Stateful execution using checkpointing and memory persistence
- Human-in-the-loop safety controls for autonomous actions
- Database-backed persistence and structured data handling
- A strong foundation for observability, evaluation, and production hardening

## Technology Stack

This project combines a modern AI stack with practical backend integrations:

- Python
- LangGraph
- LangChain / LangChain Core
- LangChain Groq integration
- Groq LLMs
- Google Gmail API
- OAuth 2.0 authentication
- PostgreSQL
- psycopg
- python-dotenv
- REST APIs
- SQL and JSON-based data handling
- Optional future observability and evaluation tooling with LangSmith

## Core Features

### 1. Gmail Intelligence

The assistant connects to a user’s Gmail account using OAuth 2.0 and can:

- Retrieve unread emails
- Extract important metadata such as sender, subject, and body content
- Prepare messages for analysis and categorization

### 2. Structured Email Classification

Each email is categorized with a clear decision label:

- urgent
- normal
- spam

These labels are saved in the database so the workflow can reason over prior classifications and support future automation.

### 3. Tool-Enabled Agent Workflow

The workflow is implemented as a LangGraph state machine where the model can invoke tools in a controlled sequence. The assistant uses tools for:

- reading emails
- categorizing emails
- saving draft replies
- sending approved replies

### 4. Human-in-the-Loop Approval

A key design principle in this project is safety. The assistant does not send a reply blindly. Instead, it pauses before executing email-sending actions and waits for explicit human approval.

### 5. Database Persistence

The system stores email records in PostgreSQL, including:

- Gmail message ID
- Sender
- Subject
- Body content
- Category
- Draft reply
- Delivery status

## Architecture Overview

The project follows a simple but effective multi-step architecture:

1. The user prompts the assistant to review emails.
2. The LLM decides whether to invoke tools based on the workflow state.
3. Tool calls interact with Gmail and PostgreSQL.
4. The state graph continues reasoning until the workflow reaches a safe stopping point.
5. When a reply action is requested, the system pauses for human approval before continuing.

A high-level flow is:

User prompt -> LLM reasoning -> tool execution -> state update -> human approval gate -> send reply (if approved)

## Project Structure

- main.py: orchestrates the LangGraph workflow and handles agent execution
- tools.py: defines the email-related tools used by the agent
- gmail_service.py: manages Gmail authentication and API interaction
- database.py: handles PostgreSQL connection and table creation
- test_gmail.py: provides a basic Gmail API validation script
- credentials.json: Google OAuth client configuration
- token.json: temporary OAuth access token storage
- langgraph.json: LangGraph configuration metadata

## Setup Instructions

### Prerequisites

- Python 3.10 or later
- A Gmail account with API access enabled
- A PostgreSQL instance
- API keys for the LLM provider used by the workflow

### Installation

Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the required dependencies:

```bash
pip install python-dotenv langgraph langchain-groq langchain-core google-api-python-client google-auth-oauthlib google-auth-httplib2 psycopg[binary] langsmith
```

### Environment Variables

Create a .env file in the project root with the following variables:

```env
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://username:password@host:5432/database_name
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=your_project_name
```

### Initialize the Database

Run:

```bash
python database.py
```

This creates the email storage table used by the agent.

### Run the Assistant

```bash
python main.py
```

On first launch, the Gmail authentication flow may open a browser window so you can authorize the app. The access token will be saved locally for future runs.

## Planned Enhancements

This project is already functional, but it is also structured as a strong foundation for more advanced AI engineering work.

### Headroom for Token Efficiency

A future version of this project will include an input/output token reducer called headroom to improve inference efficiency and lower operational cost. This will be added as a runtime optimization layer and documented as part of the agent’s efficiency strategy.

### LangSmith Observability

The project is also designed to integrate with LangSmith for:

- tracing model calls and tool invocations
- monitoring token usage across runs
- visualizing the agent workflow in a debugging-friendly way

### Hallucination and Toxicity Evaluation

As the agent evolves, LangSmith-based evaluation workflows will be used to assess:

- hallucination rate
- toxicity risk
- answer safety and policy adherence
- factual consistency in generated replies

These evaluation practices make the project especially relevant for portfolio work in AI safety, trustworthy agent systems, and responsible LLM deployment.

## Skills Demonstrated

This repository highlights a broad set of practical skills relevant to modern AI engineering:

- LLM orchestration
- Tool calling and function calling
- Agent workflow design
- API integration
- Authentication and OAuth handling
- Relational database design
- State management in long-running agents
- Safe automation with human approval gates
- Observability and evaluation planning

## Portfolio Summary

This project represents a strong example of an applied AI agent built around real tools and real-world constraints. It is suitable for showcasing experience in:

- agentic AI systems
- LangGraph-based orchestration
- practical LLM application development
- safe automation pipelines
- API-connected intelligent workflows
- evaluation and observability for AI systems

It is positioned not only as an email assistant, but as a foundation for larger intelligent workflows involving search, retrieval, customer support, and enterprise automation.
