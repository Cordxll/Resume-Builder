"""DOCX export functionality to create tailored resume documents"""
from typing import Dict
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH


def export_to_docx(
    original_sections: Dict,
    tailored_sections: Dict,
    accepted_changes: Dict,
    output_path: str
) -> None:
    """
    Export resume to DOCX format with accepted changes
    
    Args:
        original_sections: Original resume sections
        tailored_sections: Tailored resume sections
        accepted_changes: Dictionary indicating which changes were accepted
        output_path: Path to save the DOCX file
    """
    doc = Document()
    
    # Set document margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
    
    # Add contact information if available
    if 'contact' in original_sections:
        add_contact_section(doc, original_sections['contact'])
    
    # Add Summary section
    if accepted_changes.get('summary', False):
        content = tailored_sections.get('summary', '')
    else:
        content = original_sections.get('summary', '')
    
    if content:
        add_section(doc, "PROFESSIONAL SUMMARY", content)
    
    # Add Experience section
    experience_content = []
    if accepted_changes.get('experience', False):
        experience_content = tailored_sections.get('experience', [])
    else:
        experience_content = original_sections.get('experience', [])
    
    if experience_content:
        add_bullet_section(doc, "PROFESSIONAL EXPERIENCE", experience_content)
    
    # Add Skills section
    if accepted_changes.get('skills', False):
        skills_content = tailored_sections.get('skills', '')
    else:
        skills_content = original_sections.get('skills', '')
    
    if skills_content:
        add_section(doc, "SKILLS", skills_content)
    
    # Add Education section if available
    if 'education' in original_sections:
        education_content = original_sections['education']
        if isinstance(education_content, dict):
            education_content = education_content.get('content', '')
        if education_content:
            add_section(doc, "EDUCATION", education_content)
    
    # Add Certifications section if available
    if 'certifications' in original_sections:
        cert_content = original_sections['certifications']
        if isinstance(cert_content, dict):
            cert_content = cert_content.get('content', '')
        if cert_content:
            add_section(doc, "CERTIFICATIONS", cert_content)
    
    # Save document
    doc.save(output_path)


def add_contact_section(doc: Document, contact: Dict) -> None:
    """Add contact information to document"""
    if not contact:
        return
    
    # Add name as title
    if 'name' in contact:
        heading = doc.add_heading(contact['name'], level=1)
        heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in heading.runs:
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(0, 0, 0)
    
    # Add contact details
    contact_parts = []
    if 'email' in contact:
        contact_parts.append(contact['email'])
    if 'phone' in contact:
        contact_parts.append(contact['phone'])
    if 'linkedin' in contact:
        contact_parts.append(contact['linkedin'])
    
    if contact_parts:
        p = doc.add_paragraph(' | '.join(contact_parts))
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.font.size = Pt(10)
    
    doc.add_paragraph()  # Add spacing


def add_section(doc: Document, title: str, content: str) -> None:
    """Add a section with title and content"""
    if not content or not content.strip():
        return
    
    # Add section title
    heading = doc.add_heading(title, level=2)
    for run in heading.runs:
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0, 0, 0)
    
    # Add horizontal line
    p = doc.add_paragraph()
    p.add_run('_' * 80)
    for run in p.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(100, 100, 100)
    
    # Add content
    if isinstance(content, str):
        lines = content.split('\n')
        for line in lines:
            if line.strip():
                doc.add_paragraph(line.strip())
    
    doc.add_paragraph()  # Add spacing


def add_bullet_section(doc: Document, title: str, bullets: list) -> None:
    """Add a section with bullet points"""
    if not bullets:
        return
    
    # Add section title
    heading = doc.add_heading(title, level=2)
    for run in heading.runs:
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0, 0, 0)
    
    # Add horizontal line
    p = doc.add_paragraph()
    p.add_run('_' * 80)
    for run in p.runs:
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(100, 100, 100)
    
    # Add bullet points
    for bullet in bullets:
        if bullet and bullet.strip():
            doc.add_paragraph(bullet.strip(), style='List Bullet')
    
    doc.add_paragraph()  # Add spacing
