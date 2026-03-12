from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import tempfile
import os
import logging
from logging.handlers import RotatingFileHandler
import traceback
from typing import Optional, List
from pathlib import Path

# Configure logging
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Create formatters and handlers
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# File handler with rotation (10MB max, keep 5 backups)
file_handler = RotatingFileHandler(
    LOG_DIR / "app.log",
    maxBytes=10*1024*1024,
    backupCount=5
)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# Configure root logger
logging.basicConfig(level=logging.INFO, handlers=[console_handler, file_handler])
logger = logging.getLogger(__name__)

from services.resume_parser import parse_resume_with_llm
from services.job_analyzer import analyze_job_description
from services.resume_tailor import tailor_resume, chat_with_assistant
from services.docx_exporter import export_to_docx

app = FastAPI(title="Resume Builder API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobDescriptionRequest(BaseModel):
    job_description: str


class ScrapeJobRequest(BaseModel):
    url: str


class TailorRequest(BaseModel):
    resume_text: str
    job_description: str


class ChatRequest(BaseModel):
    message: str
    resume_text: str
    job_description: str
    tailored_data: Optional[dict] = None
    chat_history: Optional[List[dict]] = None


class AcceptChangesRequest(BaseModel):
    resume: dict           # Full ParsedResume (contact + sections[])
    tailored_data: dict    # New TailoredData shape (summary/skills objects, jobs[], sections[])
    accepted_changes: dict # { summary: bool, experience: bool, skills: bool, ... }


from dotenv import load_dotenv

load_dotenv()


@app.get("/")
async def root():
    return {"message": "Resume Builder API is running"}


@app.get("/api/config")
async def get_config():
    """Check if server-side API key is configured"""
    has_server_key = bool(os.getenv('OPENAI_API_KEY'))
    return {"hasServerApiKey": has_server_key}


@app.get("/api/health")
async def health_check(x_openai_api_key: Optional[str] = Header(None)):
    """Ping the LLM with a tiny request to verify the key actually works."""
    from services.openai_client import get_openai_client, get_model
    client = get_openai_client(x_openai_api_key)
    if not client:
        return {"connected": False, "error": "No API key configured"}
    try:
        resp = await client.chat.completions.create(
            model=get_model(),
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=1,
        )
        return {"connected": True}
    except Exception as e:
        return {"connected": False, "error": str(e)}
    finally:
        await client.close()


@app.post("/api/parse-resume")
async def parse_resume_endpoint(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    x_openai_api_key: Optional[str] = Header(None),
):
    """Parse resume from uploaded file (DOCX/PDF) or pasted text"""
    try:
        logger.info(f"parse-resume called: file={file.filename if file else None}, text_len={len(text) if text else 0}")

        if text:
            # If text is provided directly
            sections_data = await parse_resume_with_llm(
                text, is_text=True, api_key=x_openai_api_key
            )
            resume_data = {
                "contact": sections_data.get("contact"),
                "sections": sections_data.get("sections", []),
                "raw_text": text,
            }
        elif file:
            # Read uploaded file
            content = await file.read()
            logger.info(f"File read: {len(content)} bytes, suffix={Path(file.filename).suffix}")

            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                sections_data = await parse_resume_with_llm(
                    tmp_path, is_text=False, api_key=x_openai_api_key
                )
                resume_data = {
                    "contact": sections_data.get("contact"),
                    "sections": sections_data.get("sections", []),
                    "raw_text": sections_data.get("raw_text", ""),
                    "filename": file.filename,
                }
            finally:
                os.unlink(tmp_path)
        else:
            raise HTTPException(status_code=400, detail="Either file or text must be provided")

        logger.info("parse-resume completed successfully")
        return resume_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"parse-resume failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-job")
async def analyze_job_endpoint(request: JobDescriptionRequest):
    """Analyze job description to extract keywords and requirements"""
    try:
        analysis = analyze_job_description(request.job_description)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tailor-resume")
async def tailor_resume_endpoint(
    request: TailorRequest,
    x_openai_api_key: Optional[str] = Header(None)
):
    """Generate tailored resume suggestions based on job description"""
    try:
        tailored_data = await tailor_resume(
            request.resume_text, 
            request.job_description,
            api_key=x_openai_api_key
        )
        return tailored_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat_endpoint(
    request: ChatRequest,
    x_openai_api_key: Optional[str] = Header(None)
):
    """Chat with the AI assistant about resume tailoring"""
    try:
        response = await chat_with_assistant(
            message=request.message,
            resume_text=request.resume_text,
            job_description=request.job_description,
            tailored_data=request.tailored_data,
            chat_history=request.chat_history,
            api_key=x_openai_api_key
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scrape-job")
async def scrape_job_endpoint(request: ScrapeJobRequest):
    """Scrape a job posting URL and extract the job description text"""
    import httpx
    import json as json_mod
    import re
    from bs4 import BeautifulSoup

    url = request.url.strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        logger.info(f"scrape-job: fetching {url}")
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            })
            resp.raise_for_status()

        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        text = ""
        title_found = ""
        company_found = ""

        # --- Strategy 1: JSON-LD structured data (LinkedIn, Indeed, etc.) ---
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json_mod.loads(script.string or "")
                if isinstance(data, list):
                    data = next((d for d in data if d.get("@type") in ("JobPosting", "JobListing")), None)
                if data and data.get("@type") in ("JobPosting", "JobListing"):
                    parts = []
                    if data.get("title"):
                        title_found = data["title"].strip()
                        parts.append(data["title"])
                    if data.get("hiringOrganization", {}).get("name"):
                        company_found = data["hiringOrganization"]["name"].strip()
                        parts.append(data["hiringOrganization"]["name"])
                    if data.get("description"):
                        desc_soup = BeautifulSoup(data["description"], "html.parser")
                        parts.append("")
                        parts.append(desc_soup.get_text(separator="\n", strip=True))
                    if data.get("qualifications"):
                        qual_soup = BeautifulSoup(str(data["qualifications"]), "html.parser")
                        parts.append("\nQualifications:")
                        parts.append(qual_soup.get_text(separator="\n", strip=True))
                    text = "\n".join(parts)
                    if len(text.strip()) > 50:
                        logger.info("scrape-job: extracted via JSON-LD")
                        break
            except (json_mod.JSONDecodeError, StopIteration):
                continue

        # --- Strategy 2: Embedded hydration JSON (React/Next SPAs like Apple, etc.) ---
        if not text.strip():
            hydration = _extract_from_hydration_json(html, soup)
            if hydration["text"]:
                text = hydration["text"]
                title_found = title_found or hydration["title"]
                company_found = company_found or hydration["company"]
                logger.info("scrape-job: extracted via hydration JSON")

        # --- Strategy 3: HTML content extraction ---
        if not text.strip():
            # Remove noise elements
            content_soup = BeautifulSoup(html, "html.parser")
            for tag in content_soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe"]):
                tag.decompose()

            main = (
                content_soup.find("article") or
                content_soup.find("main") or
                content_soup.find(class_=lambda c: c and any(
                    kw in str(c).lower() for kw in ["job-description", "jobdescription", "job_description", "posting", "job-details"]
                )) or
                content_soup.find(id=lambda i: i and any(
                    kw in str(i).lower() for kw in ["job-description", "jobdescription", "job_description", "posting", "job-details"]
                )) or
                content_soup.body
            )
            if main:
                text = main.get_text(separator="\n", strip=True)
                if text:
                    logger.info("scrape-job: extracted via HTML content")

        # --- Strategy 4: Meta tags as last resort ---
        if len(text.strip()) < 50:
            parts = []
            og_title = soup.find("meta", attrs={"property": "og:title"})
            if og_title and og_title.get("content"):
                parts.append(og_title["content"])
            meta_desc = soup.find("meta", attrs={"property": "og:description"}) or soup.find("meta", attrs={"name": "description"})
            if meta_desc and meta_desc.get("content"):
                parts.append(meta_desc["content"])
            if parts:
                text = "\n".join(parts)
                logger.info("scrape-job: extracted via meta tags (limited)")

        # Clean up
        lines = [line.strip() for line in text.split("\n")]
        lines = [line for line in lines if line]
        cleaned = "\n".join(lines)

        if len(cleaned) < 50:
            raise HTTPException(status_code=422, detail="Could not extract job description from this URL. The page may require JavaScript. Try pasting the text directly.")

        if len(cleaned) > 10000:
            cleaned = cleaned[:10000] + "\n\n[Truncated — paste manually for the full description]"

        logger.info(f"scrape-job: extracted {len(cleaned)} chars")
        return {"text": cleaned, "title": title_found, "company": company_found}

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL (HTTP {e.response.status_code})")
    except httpx.RequestError as e:
        raise HTTPException(status_code=422, detail=f"Could not reach URL: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"scrape-job failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to scrape job posting: {str(e)}")


def _extract_from_hydration_json(html: str, soup) -> dict:
    """Extract job data from JS hydration blobs (React/Next SPAs).
    Returns dict with keys: text, title, company."""
    import json as json_mod
    import re
    from bs4 import BeautifulSoup

    EMPTY_RESULT = {"text": "", "title": "", "company": ""}

    # Job-related field names to look for in any JSON blob
    JOB_FIELDS = {
        "postingTitle", "jobTitle", "title", "job_title",
    }
    DESC_FIELDS = {
        "description", "jobDescription", "job_description", "jobSummary",
        "job_summary", "postingDescription",
    }
    QUAL_FIELDS = {
        "minimumQualifications", "preferredQualifications", "qualifications",
        "requirements", "minimum_qualifications", "preferred_qualifications",
    }

    def _extract_job_text(data: dict) -> dict:
        """Given a dict that looks like job data, pull out readable text and structured fields."""
        parts = []
        found_title = ""
        found_company = ""
        # Title
        for f in JOB_FIELDS:
            if f in data and isinstance(data[f], str) and data[f].strip():
                found_title = data[f].strip()
                parts.append(found_title)
                break
        # Company / team
        for f in ("companyName", "company", "teamName", "teamNames", "hiringOrganization"):
            val = data.get(f)
            if isinstance(val, str) and val.strip():
                found_company = val.strip()
                parts.append(found_company)
                break
            if isinstance(val, list) and val:
                found_company = str(val[0]) if isinstance(val[0], str) else str(val[0].get("name", ""))
                parts.append(found_company)
                break
        # Location
        locs = data.get("locations") or data.get("location")
        if isinstance(locs, list) and locs:
            loc = locs[0]
            if isinstance(loc, dict):
                loc_str = ", ".join(filter(None, [loc.get("city", ""), loc.get("stateProvince", "")]))
                if loc_str:
                    parts.append(loc_str)
            elif isinstance(loc, str):
                parts.append(loc)
        elif isinstance(locs, str) and locs:
            parts.append(locs)

        parts.append("")  # blank line

        # Description fields
        for f in DESC_FIELDS:
            val = data.get(f)
            if isinstance(val, str) and len(val) > 30:
                desc_soup = BeautifulSoup(val, "html.parser")
                parts.append(desc_soup.get_text(separator="\n", strip=True))
                parts.append("")

        # Qualification fields
        for f in QUAL_FIELDS:
            val = data.get(f)
            if isinstance(val, str) and len(val) > 20:
                label = f.replace("_", " ").replace("m", "M", 1).replace("p", "P", 1)
                if "min" in f.lower():
                    label = "Minimum Qualifications"
                elif "pref" in f.lower():
                    label = "Preferred Qualifications"
                else:
                    label = "Qualifications"
                parts.append(f"\n{label}:")
                desc_soup = BeautifulSoup(val, "html.parser")
                parts.append(desc_soup.get_text(separator="\n", strip=True))

        return {"text": "\n".join(parts), "title": found_title, "company": found_company}

    def _search_dict(obj, depth=0):
        """Recursively search a JSON structure for job-like objects."""
        if depth > 8 or not isinstance(obj, (dict, list)):
            return None
        if isinstance(obj, list):
            for item in obj:
                result = _search_dict(item, depth + 1)
                if result:
                    return result
            return None
        # Check if this dict has job fields
        keys = set(obj.keys())
        has_desc = bool(keys & DESC_FIELDS)
        has_title = bool(keys & JOB_FIELDS)
        if has_desc and has_title:
            return _extract_job_text(obj)
        if has_desc and len(keys & DESC_FIELDS) >= 1:
            extracted = _extract_job_text(obj)
            if len(extracted["text"].strip()) > 100:
                return extracted
        # Recurse into values
        for val in obj.values():
            if isinstance(val, (dict, list)):
                result = _search_dict(val, depth + 1)
                if result:
                    return result
        return None

    # Try JSON.parse("...") pattern (React hydration like Apple)
    for match in re.finditer(r'JSON\.parse\("(.+?)"\);', html, re.DOTALL):
        try:
            raw = match.group(1)
            unescaped = raw.encode().decode('unicode_escape')
            data = json_mod.loads(unescaped)
            result = _search_dict(data)
            if result and len(result["text"].strip()) > 100:
                return result
        except Exception:
            continue

    # Try inline JSON objects in script tags
    for script in soup.find_all("script"):
        script_text = script.string or ""
        if len(script_text) < 200:
            continue
        # Look for large JSON objects that might contain job data
        for m in re.finditer(r'(?:window\.\w+\s*=\s*|var\s+\w+\s*=\s*)({.+?});?\s*(?:</script>|$)', script_text, re.DOTALL):
            try:
                data = json_mod.loads(m.group(1))
                result = _search_dict(data)
                if result and len(result["text"].strip()) > 100:
                    return result
            except (json_mod.JSONDecodeError, RecursionError):
                continue

    return EMPTY_RESULT


@app.post("/api/export-docx")
async def export_docx_endpoint(request: AcceptChangesRequest):
    """Export final resume as DOCX file"""
    try:
        # Create temporary file for export
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx", mode='wb') as tmp:
            tmp_path = tmp.name
        
        export_to_docx(
            request.resume,
            request.tailored_data,
            request.accepted_changes,
            tmp_path
        )
        
        return FileResponse(
            tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="tailored_resume.docx",
            background=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
