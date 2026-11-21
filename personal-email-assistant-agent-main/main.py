import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from tools import tools
from database import get_connection

load_dotenv()


SYSTEM_PROMPT = """
You are a personal email assistant.

Follow these steps in order:

1. FIRST call read_emails to retrieve unread emails.
2. Process every returned email individually. Do not skip any email.
3. For each email, call categorize_email with:
   - gmail_id
   - sender
   - subject
   - body
   - category

Categorization rules:
- urgent:
  Emails from real people that need a response, including
  deadlines, interview invitations, important requests,
  direct questions, and time-sensitive matters.
- normal:
  Job alerts, application status updates, account notifications,
  receipts, confirmations, newsletters the user may find useful,
  and other routine updates.
- spam:
  Unsolicited advertisements, irrelevant promotions, suspicious
  messages, and unwanted mass emails.

Do not classify an email as spam only because it comes from
an automated sender or contains HTML.

4. After categorizing an email:
   - If its category is urgent, call draft_reply for that email.
   - Create a professional, context-aware reply based on the
     actual email content.
   - Never use an empty draft or the word "None" as the draft.
   - End every draft with the signature:

     Best regards,
     Abdi

   - If the category is normal or spam, do not draft a reply.

5. Complete categorization for every email returned by
   read_emails before declaring the batch processed.

6. Never call send_reply unless the human explicitly approves
   sending the specific draft.

7. Never claim that an email was categorized or a draft was
   saved unless the corresponding tool call succeeded.

Always read emails before categorizing them.
Never send an email without human approval.
"""


llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b"
)

llm_with_tools = llm.bind_tools(tools)
tool_node = ToolNode(tools)



def call_llm(state: MessagesState):
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)

    print("\n--- Agent Debug ---")
    if response.tool_calls:
        for call in response.tool_calls:
            print("Tool:", call["name"])
            print("Arguments:", call["args"])
    else:
        print("Agent response:", response.content)

    return {"messages": [response]}



graph_builder = StateGraph(MessagesState)
graph_builder.add_node("call_llm", call_llm)
graph_builder.add_node("tools", tool_node)
graph_builder.add_edge(START, "call_llm")
graph_builder.add_conditional_edges("call_llm", tools_condition)
graph_builder.add_edge("tools", "call_llm")

memory = MemorySaver()
graph = graph_builder.compile(
        checkpointer=memory,
        interrupt_before=["tools"]
    )
    
config = {"configurable": {"thread_id": "email_session_2"}}


def run_agent():
    print("\nStarting email assistant...\n")

    graph.invoke({
        "messages": [
            ("system", SYSTEM_PROMPT),
            ("human", "check my emails")
        ]
    }, config)

    while True:
        state = graph.get_state(config)

        if not state.next:
            print("\nAll emails processed.")
            break

        last_message = state.values["messages"][-1]
        tool_call = last_message.tool_calls[0]
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        if tool_name == "send_reply":
            print(f"\nAgent wants to send a reply:")
            print(f"To email ID : {tool_args.get('gmail_id')}")
            print(f"To address  : {tool_args.get('to')}")

            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT draft FROM emails WHERE gmail_id = %s",
                (tool_args.get("gmail_id"),)
            )
            row = cursor.fetchone()
            cursor.close()
            conn.close()

            if row:
                print(f"\nDraft:\n{row[0]}")

            approval = input("\nApprove sending? (yes/no): ").strip().lower()

            if approval == "yes":
                graph.invoke(None, config)
            else:
                print("Skipped.")
                graph.invoke(
                    {"messages": [("human", "skip this email, move to the next")]},
                    config
                )
        else:
            graph.invoke(None, config)


if __name__ == "__main__":
    run_agent()
    
from langsmith import Client
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGSMITH_API_KEY", "")
os.environ["LANGSMITH_PROJECT"] = os.getenv("LANGSMITH_PROJECT", "")

client = Client()
print("Connected:", client.list_projects())