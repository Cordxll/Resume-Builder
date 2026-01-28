"""Resume parser module to extract text from DOCX, PDF, or plain text"""
import re
from pathlib import Path
from typing import Dict, List, Union
from docx import Document
from PyPDF2 import PdfReader


def parse_resume(source: Union[str, Path], is_text: bool = False) -> Dict[str, any]:
    """
    Parse resume from file or text and extract sections
    
    Args:
        source: File path or text content
        is_text: True if source is text content, False if file path
    
    Returns:
        Dictionary with parsed sections
    """
    if is_text:
        text = source
    else:
        text = extract_text_from_file(source)
    
    return extract_sections(text)


def extract_text_from_file(file_path: Union[str, Path]) -> str:
    """Extract text from DOCX or PDF file"""
    file_path = Path(file_path)
    suffix = file_path.suffix.lower()
    
    if suffix == '.docx':
        return extract_from_docx(file_path)
    elif suffix == '.pdf':
        return extract_from_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file format: {suffix}")


def extract_from_docx(file_path: Path) -> str:
    """Extract text from DOCX file"""
    doc = Document(file_path)
    return '\n'.join([paragraph.text for paragraph in doc.paragraphs])


def extract_from_pdf(file_path: Path) -> str:
    """Extract text from PDF file"""
    reader = PdfReader(file_path)
    text = []
    for page in reader.pages:
        text.append(page.extract_text())
    return '\n'.join(text)


def extract_sections(text: str) -> Dict[str, any]:
    """
    Extract common resume sections from text
    
    Common sections: Contact Info, Summary, Experience, Education, Skills, etc.
    """
    sections = {
        "contact": extract_contact_info(text),
        "summary": extract_section(text, ["summary", "objective", "profile"]),
        "experience": extract_section(text, ["experience", "work experience", "employment", "work history"]),
        "education": extract_section(text, ["education", "academic background"]),
        "skills": extract_section(text, ["skills", "technical skills", "competencies"]),
        "certifications": extract_section(text, ["certifications", "certificates", "licenses"]),
        "projects": extract_section(text, ["projects", "personal projects"]),
        "raw_text": text
    }
    
    return sections


def extract_contact_info(text: str) -> Dict[str, str]:
    """Extract contact information from resume text"""
    contact = {}
    
    # Extract email
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    email_match = re.search(email_pattern, text)
    if email_match:
        contact['email'] = email_match.group()
    
    # Extract phone
    phone_pattern = r'[\+]?[(]?\d{1,3}[)]?[-\s\.]?\d{3}[-\s\.]?\d{4}'
    phone_match = re.search(phone_pattern, text)
    if phone_match:
        contact['phone'] = phone_match.group()
    
    # Extract LinkedIn
    linkedin_pattern = r'linkedin\.com/in/[\w-]+'
    linkedin_match = re.search(linkedin_pattern, text, re.IGNORECASE)
    if linkedin_match:
        contact['linkedin'] = linkedin_match.group()
    
    # Extract name (first line typically)
    lines = text.split('\n')
    if lines:
        contact['name'] = lines[0].strip()
    
    return contact


def extract_section(text: str, keywords: List[str]) -> Dict[str, any]:
    """
    Extract a section based on keywords
    
    Args:
        text: Full resume text
        keywords: List of possible section headers
    
    Returns:
        Dictionary with section content and bullets
    """
    lines = text.split('\n')
    section_start = -1
    section_end = len(lines)
    
    # Find section start
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if any(keyword in line_lower for keyword in keywords):
            # Check if line looks like a header (short, possibly with formatting)
            if len(line.strip()) < 50:
                section_start = i
                break
    
    if section_start == -1:
        return {"content": "", "bullets": []}
    
    # Find section end (next major header or end of document)
    common_headers = [
        "experience", "education", "skills", "summary", "objective",
        "certifications", "projects", "awards", "publications"
    ]
    
    for i in range(section_start + 1, len(lines)):
        line_lower = lines[i].lower().strip()
        if line_lower and len(lines[i].strip()) < 50:
            if any(header in line_lower for header in common_headers):
                if not any(keyword in line_lower for keyword in keywords):
                    section_end = i
                    break
    
    # Extract section content
    section_lines = lines[section_start:section_end]
    content = '\n'.join(section_lines).strip()
    
    # Extract bullet points
    bullets = []
    for line in section_lines:
        stripped = line.strip()
        if stripped and (stripped.startswith('•') or stripped.startswith('-') or stripped.startswith('*')):
            bullets.append(stripped.lstrip('•-* ').strip())
    
    return {
        "content": content,
        "bullets": bullets
    }
