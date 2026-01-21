"""Job description analyzer to extract keywords and requirements"""
import re
from typing import Dict, List, Set


def analyze_job_description(job_description: str) -> Dict[str, any]:
    """
    Analyze job description to extract keywords, skills, and requirements
    
    Args:
        job_description: Full job description text
    
    Returns:
        Dictionary with extracted information
    """
    return {
        "keywords": extract_keywords(job_description),
        "required_skills": extract_skills(job_description, required=True),
        "preferred_skills": extract_skills(job_description, required=False),
        "experience_level": extract_experience_level(job_description),
        "key_responsibilities": extract_responsibilities(job_description)
    }


def extract_keywords(text: str) -> List[str]:
    """Extract important keywords from job description"""
    # Common stop words to exclude
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
        'that', 'these', 'those', 'their', 'our', 'your'
    }
    
    # Extract words (2+ chars, alphanumeric)
    words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9+#]{1,}\b', text.lower())
    
    # Count frequency
    word_freq = {}
    for word in words:
        if word not in stop_words and len(word) > 2:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    # Sort by frequency and return top keywords
    sorted_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_keywords[:30]]


def extract_skills(text: str, required: bool = True) -> List[str]:
    """Extract required or preferred skills from job description"""
    skills = []
    
    # Common technical skills patterns
    tech_skills = [
        'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
        'node', 'nodejs', 'express', 'django', 'flask', 'fastapi', 'sql', 'nosql',
        'mongodb', 'postgresql', 'mysql', 'redis', 'docker', 'kubernetes', 'aws',
        'azure', 'gcp', 'git', 'ci/cd', 'jenkins', 'terraform', 'ansible',
        'machine learning', 'deep learning', 'ai', 'data science', 'pandas',
        'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'api', 'rest', 'graphql',
        'microservices', 'agile', 'scrum', 'jira', 'linux', 'bash', 'shell'
    ]
    
    text_lower = text.lower()
    
    # Look for skills in requirements section
    if required:
        keywords = ['required', 'must have', 'qualifications', 'requirements']
    else:
        keywords = ['preferred', 'nice to have', 'bonus', 'plus']
    
    # Find relevant section
    section = ""
    for keyword in keywords:
        if keyword in text_lower:
            idx = text_lower.find(keyword)
            section = text_lower[idx:idx+500]  # Get next 500 chars
            break
    
    if not section:
        section = text_lower  # Use full text if no specific section found
    
    # Extract skills from section
    for skill in tech_skills:
        if skill in section:
            skills.append(skill)
    
    return skills


def extract_experience_level(text: str) -> str:
    """Extract required experience level"""
    text_lower = text.lower()
    
    if 'senior' in text_lower or '7+ years' in text_lower or '8+ years' in text_lower:
        return 'Senior'
    elif 'mid' in text_lower or '3-5 years' in text_lower or '4-6 years' in text_lower:
        return 'Mid-level'
    elif 'junior' in text_lower or 'entry' in text_lower or '0-2 years' in text_lower:
        return 'Junior'
    else:
        # Try to extract year patterns
        year_pattern = r'(\d+)\+?\s*years?'
        matches = re.findall(year_pattern, text_lower)
        if matches:
            years = int(matches[0])
            if years >= 7:
                return 'Senior'
            elif years >= 3:
                return 'Mid-level'
            else:
                return 'Junior'
    
    return 'Not specified'


def extract_responsibilities(text: str) -> List[str]:
    """Extract key responsibilities from job description"""
    responsibilities = []
    
    # Look for responsibilities section
    keywords = ['responsibilities', 'duties', 'you will', 'job description']
    text_lower = text.lower()
    
    for keyword in keywords:
        if keyword in text_lower:
            idx = text_lower.find(keyword)
            section = text[idx:idx+1000]  # Get next 1000 chars
            
            # Extract bullet points
            lines = section.split('\n')
            for line in lines:
                stripped = line.strip()
                if stripped and (stripped.startswith('•') or stripped.startswith('-') or stripped.startswith('*')):
                    responsibilities.append(stripped.lstrip('•-* ').strip())
            
            if responsibilities:
                break
    
    return responsibilities[:10]  # Return top 10
