# Resume Builder - ATS-Friendly Resume Tailoring Tool

A web application that helps you tailor your resume to specific job descriptions by generating ATS-friendly suggestions. The tool analyzes your base resume and a target job description, then provides intelligent suggestions to rewrite and reorder content without inventing experience.

## Features

- **Multiple Input Methods**: Upload resumes in DOCX, PDF format, or paste text directly
- **Smart Resume Parsing**: Automatically extracts and structures resume sections
- **Job Description Analysis**: Identifies key requirements, skills, and keywords from job postings
- **AI-Powered Tailoring**: Uses LLM to generate suggestions that highlight relevant experience
- **Side-by-Side Comparison**: View original and tailored versions with clear diff highlighting
- **Accept/Reject Interface**: Toggle switches to accept or reject suggestions for each section
- **DOCX Export**: Export your final tailored resume as a professional DOCX document
- **No Fake Experience**: Only rewrites and reorders existing content, never invents qualifications

## Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **python-docx**: DOCX file parsing and generation
- **PyPDF2**: PDF text extraction
- **OpenAI API**: LLM integration for intelligent suggestions
- **Pydantic**: Data validation and settings management

### Frontend
- **React 18**: Modern UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Axios**: HTTP client for API communication

## Prerequisites

- Python 3.8+
- Node.js 16+ and npm
- OpenAI API key (optional, falls back to mock data if not provided)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Cordxll/Resume-Builder.git
cd Resume-Builder
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

### 4. Environment Configuration

Create a `.env` file in the project root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
```

**Note**: If you don't have an OpenAI API key, the application will still work with mock tailoring data for demonstration purposes.

## Running the Application

### Start the Backend Server

```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000`

### Start the Frontend Development Server

In a new terminal:

```bash
cd frontend
npm run dev
```

The web application will be available at `http://localhost:5173`

## Usage

1. **Upload Your Resume**
   - Click "Upload File" to select a DOCX or PDF file
   - Or click "Paste Text" to directly paste your resume content

2. **Enter Job Description**
   - Paste the full job description in the text area
   - Click "Analyze & Tailor Resume"

3. **Review Suggestions**
   - View side-by-side comparison of original and tailored content
   - See what changes were made in each section
   - Use toggle switches to accept or reject suggestions

4. **Export Final Resume**
   - Click "Export as DOCX" to download your tailored resume
   - The exported file will only include accepted changes

## Sample Files

Sample resume and job description files are provided in the `samples/` directory:
- `sample_resume.txt`: Example resume content
- `sample_job_description.txt`: Example job posting

## API Endpoints

### POST `/api/parse-resume`
Parse resume from uploaded file or text
- **Request**: `multipart/form-data` with `file` or `text`
- **Response**: Parsed resume sections

### POST `/api/tailor-resume`
Generate tailored resume suggestions
- **Request**: `{"resume_text": "...", "job_description": "..."}`
- **Response**: Original and tailored sections with change descriptions

### POST `/api/export-docx`
Export final resume as DOCX
- **Request**: Original sections, tailored sections, and accepted changes
- **Response**: DOCX file download

## Project Structure

```
Resume-Builder/
├── backend/
│   ├── main.py                 # FastAPI application entry point
│   ├── requirements.txt        # Python dependencies
│   └── services/
│       ├── resume_parser.py    # Resume parsing logic
│       ├── job_analyzer.py     # Job description analysis
│       ├── resume_tailor.py    # LLM-based tailoring
│       └── docx_exporter.py    # DOCX generation
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── services/           # API client
│   │   ├── types/              # TypeScript types
│   │   ├── App.tsx             # Main application
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   └── vite.config.ts
├── samples/                    # Sample files
├── .env.example               # Environment variables template
└── README.md
```

## Development

### Backend Development

The backend uses FastAPI with hot reload enabled by default:

```bash
cd backend
uvicorn main:app --reload
```

### Frontend Development

Vite provides hot module replacement (HMR):

```bash
cd frontend
npm run dev
```

### Building for Production

**Frontend**:
```bash
cd frontend
npm run build
```

The optimized build will be in `frontend/dist/`

## Customization

### Using Different LLM Models

Edit `.env` to use different OpenAI models:
```
OPENAI_MODEL=gpt-4  # For better results
OPENAI_MODEL=gpt-3.5-turbo  # Faster and cheaper
```

### Adding Custom Resume Sections

Edit `backend/services/resume_parser.py` to add more section detection:
```python
sections["custom_section"] = extract_section(text, ["custom", "keywords"])
```

## Troubleshooting

### CORS Issues
If you encounter CORS errors, verify that the frontend URL is listed in `backend/main.py`:
```python
allow_origins=["http://localhost:3000", "http://localhost:5173"]
```

### File Upload Issues
Ensure file sizes are within limits. Maximum file size depends on your FastAPI configuration.

### LLM Not Working
- Verify your OpenAI API key is correct in `.env`
- Check your OpenAI account has available credits
- The app will use mock data if the API key is missing or invalid

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built with FastAPI and React
- Powered by OpenAI GPT models
- Resume parsing with python-docx and PyPDF2