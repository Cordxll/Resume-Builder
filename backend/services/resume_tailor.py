"""Resume tailoring service using LLM to generate suggestions"""
import os
import json
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client lazily
_client: Optional[any] = None


def get_openai_client():
    """Get or create OpenAI client"""
    global _client
    if _client is None:
        try:
            from openai import AsyncOpenAI
            api_key = os.getenv('OPENAI_API_KEY', '')
            if api_key:
                _client = AsyncOpenAI(api_key=api_key)
        except Exception as e:
            print(f"Failed to initialize OpenAI client: {e}")
            _client = None
    return _client


async def tailor_resume(resume_text: str, job_description: str) -> Dict[str, any]:
    """
    Generate tailored resume suggestions based on job description
    
    Args:
        resume_text: Original resume text
        job_description: Target job description
    
    Returns:
        Dictionary with original and tailored sections
    """
    client = get_openai_client()
    
    if not client or not os.getenv('OPENAI_API_KEY'):
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
                    "content": "You are an expert resume writer specializing in human-readable, impact-focused content. Your job is to transform resumes to emphasize business outcomes and ownership WITHOUT inventing experience. Focus on: 1) Human readability (clear, scannable), 2) Business impact over tasks, 3) Strong ownership verbs (built, led, shipped, improved), 4) Eliminating passive phrases, 5) Quantifying with metrics, 6) Bridging title gaps with context, 7) Prioritizing JD keywords and relevant experience."
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
    prompt = f"""Given the following resume sections and job analysis, suggest improvements to make the resume more impactful for human readers and aligned with the job requirements.

IMPORTANT TAILORING RULES:
1. DO NOT invent any experience, skills, or accomplishments
2. Rewrite bullets for HUMAN READABILITY - make them clear, scannable, and easy to understand
3. EMPHASIZE BUSINESS IMPACT over tasks - show results, outcomes, and value delivered
4. USE STRONG OWNERSHIP VERBS: built, led, shipped, improved, architected, delivered, achieved, drove, transformed
5. ELIMINATE PASSIVE PHRASES: remove "assisted with", "helped with", "worked on", "was responsible for"
6. QUANTIFY RESULTS with specific metrics, percentages, dollar amounts, or user counts wherever possible
7. BRIDGE TITLE GAPS by adding context about scope, team size, or technical complexity
8. PRIORITIZE JD KEYWORDS, tools, and responsibilities - surface the most relevant experience first
9. Reorder bullets to put the most impressive and relevant achievements at the top
10. Keep the candidate's authentic voice while making the content more powerful

RESUME SECTIONS:
Summary: {resume_sections.get('summary', {}).get('content', 'N/A')}

Experience: {resume_sections.get('experience', {}).get('content', 'N/A')}

Skills: {resume_sections.get('skills', {}).get('content', 'N/A')}

JOB REQUIREMENTS:
Keywords: {', '.join(job_analysis.get('keywords', [])[:15])}
Required Skills: {', '.join(job_analysis.get('required_skills', []))}
Experience Level: {job_analysis.get('experience_level', 'N/A')}
Key Responsibilities: {', '.join(job_analysis.get('key_responsibilities', [])[:5])}

Please provide tailored suggestions in JSON format with the following structure:
{{
  "summary": {{
    "original": "original text",
    "tailored": "improved text with stronger ownership language and impact focus",
    "changes": ["specific explanation of what was changed and WHY (e.g., 'Changed passive 'was responsible for' to active 'Led' to show ownership')", "another change with reasoning"]
  }},
  "experience": {{
    "original_bullets": ["bullet 1", "bullet 2"],
    "tailored_bullets": ["improved bullet 1 with metrics and impact", "improved bullet 2 with strong verbs"],
    "changes": ["Reordered to prioritize [specific keyword] experience matching JD", "Added metric to quantify impact", "Changed 'helped' to 'drove' to show ownership", "Bridged gap by adding team size context"]
  }},
  "skills": {{
    "original": ["skill1", "skill2"],
    "tailored": ["reordered skills matching JD priorities"],
    "changes": ["Moved [skill] to top to match JD requirements", "Added context about proficiency level"]
  }}
}}

For each change, explain the reasoning in terms of human readability, business impact, or JD alignment.
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
