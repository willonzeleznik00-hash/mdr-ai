from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, Response
from pathlib import Path
import uuid
import os
import json

import pdfplumber
from docx import Document

from dotenv import load_dotenv
from openai import OpenAI

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


load_dotenv()

BASE_DIR = Path(__file__).parent

# --- Storage ---
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# --- Frontend ---
FRONTEND_DIR = BASE_DIR / "frontend"
app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="app")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/app/")


@app.get("/health")
def health():
    return {"ok": True}


# --- Helpers ---
def extract_text_from_pdf(path: Path) -> str:
    text = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text.append(t)
    return "\n".join(text)


def extract_text_from_docx(path: Path) -> str:
    doc = Document(str(path))
    return "\n".join([p.text for p in doc.paragraphs if p.text])


# --- Upload ---
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix.lower()

    if ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Only PDF or DOCX allowed")

    save_path = UPLOAD_DIR / f"{file_id}{ext}"
    content = await file.read()
    save_path.write_bytes(content)

    return {"document_id": file_id}


# --- Analyze ---
@app.get("/analyze/{document_id}")
def analyze(document_id: str):
    file_path = None

    for f in UPLOAD_DIR.glob(f"{document_id}.*"):
        file_path = f
        break

    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")

    if file_path.suffix == ".pdf":
        text = extract_text_from_pdf(file_path)
    elif file_path.suffix == ".docx":
        text = extract_text_from_docx(file_path)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file")

    if len(text) < 20:
        raise HTTPException(status_code=400, detail="No text extracted")

    snippet = text[:8000]

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    system = """
You are a senior EU MDR regulatory affairs expert.
You analyze medical device documentation.

Return ONLY valid JSON.
"""

    user = f"""
Analyze this medical device regulatory document.

Return JSON with exactly these keys:
{{
  "doc_type": "one of: IFU / Instructions for Use, Clinical Evaluation Report (CER), Risk Management File (RMF), Summary of Safety and Clinical Performance (SSCP), Technical Documentation, Test / Verification Report, Other / Unknown",
  "confidence": 0.85,
  "summary_one_liner": "string",
  "summary_bullets": ["string"],
  "potential_mdr_gaps": ["string"],
  "suggested_improvements": ["string"],
  "missing_sections": ["string"],
  "evidence_quotes": ["string"],
  "mrd_structure_check": {{
    "has_udi": false,
    "has_risk_management": false,
    "has_clinical_evidence": false,
    "has_revision_date": false,
    "has_pms_or_pmcf": false,
    "has_intended_use": false,
    "has_benefit_risk": false
  }},
  "priority_findings": ["string"],
  "risk_score": 7,
  "risk_level": "low|medium|medium-high|high"
}}

Use document-type-specific MDR expectations:
- IFU: intended use, contraindications, warnings, residual risks, UDI, revision info.
- CER: clinical evidence, benefit-risk, clinical claims, PMCF/PMS references.
- RMF: hazards, risk controls, residual risks, benefit-risk linkage.
- SSCP: patient/user summary, clinical benefits, risks, revision/version, readability.
- Technical Documentation: device description, GSPR/Annex I mapping, verification/validation, labeling, PMS.

DOCUMENT:
{snippet}

"""

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            temperature=0.2
        )

        return json.loads(resp.choices[0].message.content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

