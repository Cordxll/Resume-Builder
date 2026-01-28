from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import tempfile
import os
from typing import Optional, List
from pathlib import Path

from services.resume_parser import parse_resume
from services.job_analyzer import analyze_job_description
from services.resume_tailor import tailor_resume
from services.docx_exporter import export_to_docx

app = FastAPI(title="Resume Builder API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobDescriptionRequest(BaseModel):
    job_description: str


class TailorRequest(BaseModel):
    resume_text: str
    job_description: str


class AcceptChangesRequest(BaseModel):
    original_sections: dict
    tailored_sections: dict
    accepted_changes: dict


@app.get("/")
async def root():
    return {"message": "Resume Builder API is running"}


@app.post("/api/parse-resume")
async def parse_resume_endpoint(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None)
):
    """Parse resume from uploaded file (DOCX/PDF) or pasted text"""
    try:
        if text:
            # If text is provided directly
            resume_data = {
                "raw_text": text,
                "sections": parse_resume(text, is_text=True)
            }
        elif file:
            # Read uploaded file
            content = await file.read()
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            try:
                resume_data = {
                    "filename": file.filename,
                    "sections": parse_resume(tmp_path, is_text=False)
                }
            finally:
                os.unlink(tmp_path)
        else:
            raise HTTPException(status_code=400, detail="Either file or text must be provided")
        
        return resume_data
    except Exception as e:
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
async def tailor_resume_endpoint(request: TailorRequest):
    """Generate tailored resume suggestions based on job description"""
    try:
        tailored_data = await tailor_resume(request.resume_text, request.job_description)
        return tailored_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/export-docx")
async def export_docx_endpoint(request: AcceptChangesRequest):
    """Export final resume as DOCX file"""
    try:
        # Create temporary file for export
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx", mode='wb') as tmp:
            tmp_path = tmp.name
        
        export_to_docx(
            request.original_sections,
            request.tailored_sections,
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
