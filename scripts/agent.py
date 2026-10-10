#!/usr/bin/env python3
"""
Grant & Internship AI Scout - Automated Pipeline Agent
Searches for student opportunities via Tavily API, synthesizes & structures them via Gemini 2.5 Flash,
stores them into Supabase PostgreSQL, and emails a daily digest summary via Gmail SMTP.
"""

import os
import sys
import json
import re
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any
import requests
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("GrantScoutAgent")

# Required Environment Variables
ENV_VARS = [
    "TAVILY_API_KEY",
    "GEMINI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "SMTP_USER",
    "SMTP_PASSWORD"
]

def check_environment() -> Dict[str, str]:
    """Validate and fetch all required environment variables."""
    missing = [var for var in ENV_VARS if not os.environ.get(var)]
    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set all required environment variables before running.")
        sys.exit(1)
    
    return {var: os.environ[var] for var in ENV_VARS}


def search_tavily(api_key: str) -> List[Dict[str, Any]]:
    """Query Tavily Search API for recent software engineering & electronics opportunities."""
    url = "https://api.tavily.com/search"
    query = (
        "latest software engineering internship hardware electronics student grant "
        "fellowship application 2025 2026"
    )
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "time_range": "w",
        "max_results": 15,
        "include_answer": False,
        "include_raw_content": False
    }
    
    logger.info("Executing Tavily advanced search query...")
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])
        logger.info(f"Retrieved {len(results)} search results from Tavily.")
        return results
    except Exception as e:
        logger.error(f"Error executing Tavily search: {e}")
        return []


def synthesize_with_gemini(api_key: str, search_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Synthesize raw search results into structured opportunity records using Gemini 2.5 Flash."""
    if not search_results:
        logger.warning("No search results provided to Gemini synthesis.")
        return []

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    prompt = f"""
You are an expert tech career scout and data extractor.
Analyze the following raw web search results containing student software engineering internships, electronics/hardware opportunities, student grants, and tech fellowships.

Extract distinct, real opportunities from these search results. Return ONLY a valid JSON array of objects.
Each object in the JSON array MUST strictly contain the following fields:
- "title": Job/Grant title (string, e.g. "Software Engineering Intern 2025" or "Hardware Innovation Student Grant")
- "company": Organization or company name (string)
- "description": Concise summary (2-3 sentences max) detailing key role responsibilities, target audience, or eligibility requirements.
- "link": Direct application URL or source URL (string)
- "tags": Array of string tags categorized from: ["Software", "Electronics", "Hardware", "Grant", "Fellowship", "React", "AI", "Embedded", "Python"]
- "deadline": Application deadline date if available, or "TBD" (string)

Raw Search Results:
{json.dumps(search_results, indent=2)}

Output ONLY valid JSON string array without conversational prefix or suffix.
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2
        }
    }

    logger.info("Sending search payload to Gemini 2.5 Flash for JSON structuring...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        res_json = response.json()
        
        candidates = res_json.get("candidates", [])
        if not candidates:
            logger.error("Gemini returned empty candidates.")
            return []
            
        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        
        # Defensive cleanup of markdown code fences if present
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r"\s*```$", "", cleaned_text, flags=re.MULTILINE).strip()
        
        parsed_opportunities = json.loads(cleaned_text)
        if isinstance(parsed_opportunities, list):
            logger.info(f"Successfully extracted {len(parsed_opportunities)} structured opportunities from Gemini.")
            return parsed_opportunities
        else:
            logger.error(f"Unexpected JSON format returned from Gemini: {type(parsed_opportunities)}")
            return []
            
    except json.JSONDecodeError as json_err:
        logger.error(f"Failed to parse JSON response from Gemini: {json_err}")
        return []
    except Exception as e:
        logger.error(f"Error during Gemini synthesis: {e}")
        return []


def store_in_supabase(supabase_url: str, supabase_key: str, opportunities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Store extracted opportunities into Supabase PostgreSQL table."""
    if not opportunities:
        logger.warning("No opportunities to insert into Supabase.")
        return []

    logger.info("Connecting to Supabase...")
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Prepare valid records matching schema
        records_to_insert = []
        for item in opportunities:
            record = {
                "title": str(item.get("title", "Untitled Opportunity")),
                "company": str(item.get("company", "Unknown Organization")),
                "description": str(item.get("description", "")),
                "link": str(item.get("link", "#")),
                "tags": item.get("tags") if isinstance(item.get("tags"), list) else ["Software"],
                "deadline": str(item.get("deadline", "TBD"))
            }
            records_to_insert.append(record)

        response = supabase.table("opportunities").insert(records_to_insert).execute()
        inserted_data = response.data if hasattr(response, "data") else []
        logger.info(f"Successfully stored {len(inserted_data)} records in Supabase 'opportunities' table.")
        return inserted_data
    except Exception as e:
        logger.error(f"Error inserting records into Supabase: {e}")
        return []


def send_email_notification(smtp_user: str, smtp_pass: str, count: int, top_items: List[Dict[str, Any]]):
    """Dispatch daily summary email digest via Gmail SMTP over SSL (port 465)."""
    logger.info(f"Preparing daily digest email for {smtp_user}...")
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🚀 Grant & Internship AI Scout Digest - {count} New Opportunities Found!"
    msg["From"] = smtp_user
    msg["To"] = smtp_user

    # Text content
    text_content = f"Grant & Internship AI Scout Digest\n\nScraped {count} new opportunities today.\n\nTop Featured Opportunities:\n"
    for idx, item in enumerate(top_items[:3], 1):
        text_content += f"{idx}. {item.get('title')} at {item.get('company')}\n"
        text_content += f"   Tags: {', '.join(item.get('tags', []))}\n"
        text_content += f"   Deadline: {item.get('deadline')}\n"
        text_content += f"   Link: {item.get('link')}\n\n"

    # HTML content
    items_html = ""
    for item in top_items[:3]:
        tags_badge = "".join([f'<span style="background-color: #EEF2FF; color: #4F46E5; padding: 2px 8px; border-radius: 9999px; font-size: 12px; margin-right: 4px; font-weight: 600;">{t}</span>' for t in item.get('tags', [])])
        items_html += f"""
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 4px 0; color: #0F172A; font-size: 18px;">{item.get('title')}</h3>
            <p style="margin: 0 0 8px 0; color: #64748B; font-weight: 600; font-size: 14px;">{item.get('company')} &bull; <span style="color: #D97706;">Deadline: {item.get('deadline')}</span></p>
            <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; line-height: 1.5;">{item.get('description')}</p>
            <div style="margin-bottom: 12px;">{tags_badge}</div>
            <a href="{item.get('link')}" style="display: inline-block; background-color: #2563EB; color: #FFFFFF; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">Apply Now &rarr;</a>
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Grant & Internship AI Scout Digest</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; margin: 0; padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 24px; text-align: center; color: #FFFFFF;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🤖 Grant & Internship AI Scout</h1>
                <p style="margin: 8px 0 0 0; color: #94A3B8; font-size: 14px;">Daily Automated Ingestion Summary</p>
            </div>
            <div style="padding: 24px;">
                <div style="background-color: #F0FDF4; border-left: 4px solid #16A34A; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #15803D; font-weight: 600; font-size: 15px;">
                        ✨ Scraped &amp; Ingested {count} new opportunities today!
                    </p>
                </div>
                <h2 style="font-size: 18px; color: #0F172A; margin-bottom: 16px;">Top Featured Opportunities</h2>
                {items_html}
            </div>
            <div style="background-color: #F8FAFC; padding: 16px; text-align: center; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 12px;">
                Grant &amp; Internship AI Scout Automation &bull; Powered by Tavily, Gemini 2.5 &amp; Supabase
            </div>
        </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        logger.info(f"Successfully dispatched summary digest email to {smtp_user}.")
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")


def main():
    logger.info("==========================================")
    logger.info("Starting Grant & Internship AI Scout Pipeline")
    logger.info("==========================================")
    
    env = check_environment()
    
    # Step A: Tavily Search
    search_results = search_tavily(env["TAVILY_API_KEY"])
    
    # Step B: Gemini Synthesis
    opportunities = synthesize_with_gemini(env["GEMINI_API_KEY"], search_results)
    
    # Step C: Database Storage
    inserted_items = store_in_supabase(env["SUPABASE_URL"], env["SUPABASE_KEY"], opportunities)
    
    # Fallback count if response doesn't list exact inserts
    item_count = len(inserted_items) if inserted_items else len(opportunities)
    
    # Step D: Email Digest Dispatch
    if item_count > 0:
        send_email_notification(
            env["SMTP_USER"],
            env["SMTP_PASSWORD"],
            item_count,
            opportunities
        )
    else:
        logger.warning("No new opportunities processed. Skipping email notification.")

    logger.info("Pipeline execution completed successfully!")

if __name__ == "__main__":
    main()
