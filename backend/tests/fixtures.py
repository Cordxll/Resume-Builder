"""
Test fixtures: sample LLM response strings and expected output shapes
for parse_llm_response tests.
"""

import json

# ---------------------------------------------------------------------------
# SAMPLE_LLM_RESPONSE_FULL
# A valid JSON string that the LLM would return.
# Uses snake_case "section_type" keys as the LLM produces them.
# ---------------------------------------------------------------------------
SAMPLE_LLM_RESPONSE_FULL = json.dumps({
    "summary": {
        "original": "Experienced software engineer with 5 years in backend development.",
        "tailored": "Senior software engineer who shipped scalable backend systems serving 1M+ users.",
        "explanation": "Added ownership verb 'shipped' and quantified user scale."
    },
    "skills": {
        "original": "Python, Java, SQL",
        "tailored": "Python, Java, SQL, React, AWS",
        "explanation": "Added React and AWS to match JD requirements."
    },
    "jobs": [
        {
            "id": "job-0",
            "company": "Acme Corp",
            "title": "Software Engineer",
            "location": "New York, NY",
            "dates": "Jan 2020 – Present",
            "bullets": [
                {
                    "index": 0,
                    "original": "Built microservices using Java",
                    "tailored": "Engineered scalable microservices using Java and Spring Boot, reducing latency by 30%",
                    "explanation": "Added metric, stronger verb, added Spring Boot keyword from JD"
                },
                {
                    "index": 1,
                    "original": "Led team of 5 engineers",
                    "tailored": "Led cross-functional team of 5 engineers to deliver features on schedule",
                    "explanation": "Added delivery context to show ownership"
                }
            ]
        }
    ],
    "sections": [
        {
            "section_type": "projects",
            "entries": [
                {
                    "id": "proj-0",
                    "bullets": [
                        {
                            "index": 0,
                            "original": "Built a REST API",
                            "tailored": "Designed and deployed a RESTful API serving 10K daily requests",
                            "explanation": "Added scale metric and active verb"
                        }
                    ]
                }
            ]
        }
    ]
})

# ---------------------------------------------------------------------------
# SAMPLE_LLM_RESPONSE_MARKDOWN
# Same payload wrapped in markdown code fences (the LLM sometimes does this).
# ---------------------------------------------------------------------------
SAMPLE_LLM_RESPONSE_MARKDOWN = "```json\n" + SAMPLE_LLM_RESPONSE_FULL + "\n```"

# ---------------------------------------------------------------------------
# SAMPLE_LLM_RESPONSE_TRUNCATED
# JSON string cut off mid-way to simulate a truncated LLM response.
# ---------------------------------------------------------------------------
_full = json.dumps({
    "summary": {
        "original": "Experienced engineer.",
        "tailored": "Senior engineer who shipped scalable systems.",
        "explanation": "Added verb and impact."
    },
    "skills": {
        "original": "Python, Java",
        "tailored": "Python, Java, AWS",
        "explanation": "Added AWS."
    },
    "jobs": [
        {
            "id": "job-0",
            "company": "Acme Corp",
            "title": "Engineer",
            "location": None,
            "dates": None,
            "bullets": [
                {
                    "index": 0,
                    "original": "Built systems",
                    "tailored": "Engineered scalable systems",
                    "explanation": "Stronger verb"
                }
            ]
        }
    ],
    "sections": []
})
# Truncate roughly in the middle
SAMPLE_LLM_RESPONSE_TRUNCATED = _full[:len(_full) // 2]

# ---------------------------------------------------------------------------
# SAMPLE_LLM_RESPONSE_INVALID
# Not parseable JSON at all.
# ---------------------------------------------------------------------------
SAMPLE_LLM_RESPONSE_INVALID = "I'm sorry, I cannot process this request. Please try again later."

# ---------------------------------------------------------------------------
# DUMMY_RESUME
# A minimal resume string used as input to parse_llm_response in tests.
# ---------------------------------------------------------------------------
DUMMY_RESUME = "Experienced engineer with Python and Java skills."

# ---------------------------------------------------------------------------
# EXPECTED_TAILORED_DATA
# The expected TailoredData output dict for SAMPLE_LLM_RESPONSE_FULL.
# Note: section_type is mapped to sectionType in the output.
# ---------------------------------------------------------------------------
EXPECTED_TAILORED_DATA = {
    "summary": {
        "original": "Experienced software engineer with 5 years in backend development.",
        "tailored": "Senior software engineer who shipped scalable backend systems serving 1M+ users.",
        "explanation": "Added ownership verb 'shipped' and quantified user scale."
    },
    "skills": {
        "original": "Python, Java, SQL",
        "tailored": "Python, Java, SQL, React, AWS",
        "explanation": "Added React and AWS to match JD requirements."
    },
    "jobs": [
        {
            "id": "job-0",
            "company": "Acme Corp",
            "title": "Software Engineer",
            "location": "New York, NY",
            "dates": "Jan 2020 – Present",
            "bullets": [
                {
                    "index": 0,
                    "original": "Built microservices using Java",
                    "tailored": "Engineered scalable microservices using Java and Spring Boot, reducing latency by 30%",
                    "explanation": "Added metric, stronger verb, added Spring Boot keyword from JD"
                },
                {
                    "index": 1,
                    "original": "Led team of 5 engineers",
                    "tailored": "Led cross-functional team of 5 engineers to deliver features on schedule",
                    "explanation": "Added delivery context to show ownership"
                }
            ]
        }
    ],
    "sections": [
        {
            "sectionType": "projects",
            "entries": [
                {
                    "id": "proj-0",
                    "bullets": [
                        {
                            "index": 0,
                            "original": "Built a REST API",
                            "tailored": "Designed and deployed a RESTful API serving 10K daily requests",
                            "explanation": "Added scale metric and active verb"
                        }
                    ]
                }
            ]
        }
    ]
}
