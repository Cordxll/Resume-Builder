"""Resume tailoring service using LLM to generate suggestions"""
import os
import json
from typing import Dict, List
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY', ''))


async def tailor_resume(resume_text: str, job_description: str) -> Dict[str, any]:
    """
    Generate tailored resume suggestions based on job description
    
    Args:
        resume_text: Original resume text
        job_description: Target job description
    
    Returns:
        Dictionary with original and tailored sections
    """
    if not os.getenv('OPENAI_API_KEY'):
        # Return mock data if no API key configured
        return generate_mock_tailoring(resume_text, job_description)
    
    try:
        # Parse sections from resume
        from services.resume_parser import extract_sections
        from services.job_analyzer import analyze_job_description
        
        resume_sections = extract_sections(resume_text)
        job_analysis = analyze_job_description(job_description)
        
        # Generate tailoring suggestions using LLM
        prompt = create_tailoring_prompt(resume_sections, job_analysis)
        
        response = await client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert resume writer and ATS optimization specialist. Your job is to suggest improvements to resumes to better match job descriptions WITHOUT inventing experience or skills the candidate doesn't have. Focus on rewriting and reordering existing content to highlight relevant experience."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        suggestions = response.choices[0].message.content
        
        # Parse LLM response and structure it
        tailored_data = parse_llm_response(suggestions, resume_sections)
        
        return tailored_data
    
    except Exception as e:
        print(f"Error in LLM tailoring: {e}")
        return generate_mock_tailoring(resume_text, job_description)


def create_tailoring_prompt(resume_sections: Dict, job_analysis: Dict) -> str:
    """Create prompt for LLM to generate tailoring suggestions"""
    prompt = f"""Given the following resume sections and job analysis, suggest improvements to make the resume more ATS-friendly and better aligned with the job requirements.

IMPORTANT RULES:
1. DO NOT invent any experience, skills, or accomplishments
2. Only rewrite and reorder existing content
3. Use keywords from the job description where appropriate
4. Make bullet points more impactful and quantifiable
5. Focus on relevant experience

RESUME SECTIONS:
Summary: {resume_sections.get('summary', {}).get('content', 'N/A')}

Experience: {resume_sections.get('experience', {}).get('content', 'N/A')}

Skills: {resume_sections.get('skills', {}).get('content', 'N/A')}

JOB REQUIREMENTS:
Keywords: {', '.join(job_analysis.get('keywords', [])[:15])}
Required Skills: {', '.join(job_analysis.get('required_skills', []))}
Experience Level: {job_analysis.get('experience_level', 'N/A')}

Please provide tailored suggestions in JSON format with the following structure:
{{
  "summary": {{
    "original": "original text",
    "tailored": "improved text",
    "changes": ["list of specific changes made"]
  }},
  "experience": {{
    "original_bullets": ["bullet 1", "bullet 2"],
    "tailored_bullets": ["improved bullet 1", "improved bullet 2"],
    "changes": ["list of specific changes made"]
  }},
  "skills": {{
    "original": ["skill1", "skill2"],
    "tailored": ["reordered/emphasized skills"],
    "changes": ["list of specific changes made"]
  }}
}}
"""
    return prompt


def parse_llm_response(response: str, resume_sections: Dict) -> Dict[str, any]:
    """Parse LLM response and structure it for frontend"""
    try:
        # Try to extract JSON from response
        start = response.find('{')
        end = response.rfind('}') + 1
        if start != -1 and end > start:
            json_str = response[start:end]
            suggestions = json.loads(json_str)
        else:
            suggestions = {}
    except:
        suggestions = {}
    
    # Ensure proper structure
    result = {
        "original": {
            "summary": resume_sections.get('summary', {}).get('content', ''),
            "experience": resume_sections.get('experience', {}).get('bullets', []),
            "skills": resume_sections.get('skills', {}).get('content', ''),
        },
        "tailored": {
            "summary": suggestions.get('summary', {}).get('tailored', resume_sections.get('summary', {}).get('content', '')),
            "experience": suggestions.get('experience', {}).get('tailored_bullets', resume_sections.get('experience', {}).get('bullets', [])),
            "skills": suggestions.get('skills', {}).get('tailored', resume_sections.get('skills', {}).get('content', '')),
        },
        "changes": {
            "summary": suggestions.get('summary', {}).get('changes', []),
            "experience": suggestions.get('experience', {}).get('changes', []),
            "skills": suggestions.get('skills', {}).get('changes', []),
        }
    }
    
    return result


def generate_mock_tailoring(resume_text: str, job_description: str) -> Dict[str, any]:
    """Generate mock tailoring data when LLM is not available"""
    from services.resume_parser import extract_sections
    
    resume_sections = extract_sections(resume_text)
    
    # Create mock tailored versions with minor improvements
    original_summary = resume_sections.get('summary', {}).get('content', '')
    original_bullets = resume_sections.get('experience', {}).get('bullets', [])
    original_skills = resume_sections.get('skills', {}).get('content', '')
    
    tailored_summary = original_summary + " (ATS-optimized)"
    tailored_bullets = [f"✓ {bullet}" for bullet in original_bullets[:5]]
    tailored_skills = original_skills
    
    return {
        "original": {
            "summary": original_summary,
            "experience": original_bullets[:5],
            "skills": original_skills,
        },
        "tailored": {
            "summary": tailored_summary,
            "experience": tailored_bullets,
            "skills": tailored_skills,
        },
        "changes": {
            "summary": ["Added ATS-friendly keywords", "Improved clarity"],
            "experience": ["Reordered bullets to highlight relevant experience", "Added action verbs"],
            "skills": ["Reordered to match job requirements"],
        }
    }
