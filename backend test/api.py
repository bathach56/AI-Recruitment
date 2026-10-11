"""Local AI API backed exclusively by the verified lab core."""
import logging
import hashlib
import json
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from starlette.concurrency import run_in_threadpool

from core.document_parser import MAX_BYTES, ParseError, parse_bytes
from core.hybrid import analyze
from core.sbert_baseline import SbertBaseline
from core.text_features import SkillEvidence
from core.tfidf_baseline import TfidfBaseline

LAB = Path(__file__).resolve().parent
LOG = logging.getLogger(__name__)


class Weights(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    semantic_weight: float = Field(default=.5, ge=0, le=1)
    skill_weight: float = Field(default=.3, ge=0, le=1)
    experience_weight: float = Field(default=.2, ge=0, le=1)

    @model_validator(mode='after')
    def positive_sum(self):
        if self.semantic_weight + self.skill_weight + self.experience_weight <= 0:
            raise ValueError('At least one weight must be positive')
        return self


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)
    cv_id: int = Field(default=0, ge=0)
    job_id: int = Field(default=0, ge=0)
    cv_text: str = Field(default='', max_length=100000)
    job_title: str = Field(default='', max_length=500)
    job_description: str = Field(min_length=1, max_length=100000)
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    nice_to_have_skills: list[str] = Field(default_factory=list, max_length=100)
    job_experience_years_required: float | None = Field(default=None, ge=0, le=100)
    # Legacy caller fields retained for compatibility; extraction uses CV text only.
    cv_skills: list[str] = Field(default_factory=list, max_length=100)
    cv_experience_years: float | None = Field(default=None, ge=0, le=100)
    model_type: Literal['TF-IDF', 'Sentence-BERT', 'Hybrid'] = 'Hybrid'
    weights: Weights = Field(default_factory=Weights)

    @model_validator(mode='after')
    def skill_names(self):
        if any(not s.strip() or len(s) > 200 for s in self.required_skills + self.nice_to_have_skills + self.cv_skills):
            raise ValueError('Skill names must contain 1 to 200 characters')
        return self


class Engine:
    def __init__(self):
        self.lock = threading.Lock()
        self.skills = SkillEvidence(LAB.parent / 'data/skills_taxonomy.json')
        self.sbert = SbertBaseline(LAB / '.cache/sbert')
        corpus = sorted((LAB.parent / 'data/development_v1/cvs').glob('*.txt')) + sorted(
            (LAB.parent / 'data/development_v1/jds').glob('*.txt'))
        dataset = LAB.parent / 'data/development_v1'
        manifest = json.loads((dataset / 'manifest.json').read_text(encoding='utf-8'))
        if {p.relative_to(dataset).as_posix() for p in corpus} != set(manifest['text_hashes']):
            raise ValueError('TF-IDF corpus differs from manifest')
        for path in corpus:
            if hashlib.sha256(path.read_bytes()).hexdigest() != manifest['text_hashes'][path.relative_to(dataset).as_posix()]:
                raise ValueError('TF-IDF corpus hash mismatch')
        self.tfidf = TfidfBaseline().fit(p.read_text(encoding='utf-8') for p in corpus)

    def match(self, request, segments):
        if not self.lock.acquire(blocking=False):
            raise HTTPException(503, 'AI is busy; retry later')
        try:
            text = '\n'.join(s['text'] for s in segments)
            if not text.strip() or len(text) > 100000:
                raise ValueError('CV must contain 1 to 100000 characters')
            if request.model_type == 'Hybrid':
                job = {'required_skills': request.required_skills,
                       'nice_to_have_skills': request.nice_to_have_skills,
                       'experience_years_required': request.job_experience_years_required}
                w = request.weights
                detail = analyze(segments, request.job_description, job, self.sbert, self.skills,
                                 dict(semantic=w.semantic_weight, skills=w.skill_weight, experience=w.experience_weight))
                scores = detail['scores']
            else:
                model = self.tfidf if request.model_type == 'TF-IDF' else self.sbert
                detail = model.explain(text, request.job_description)
                if request.model_type == 'TF-IDF':
                    detail['fit_metadata'] = self.tfidf.metadata()
                scores = dict(semantic=detail['overall_score'], skills=None, experience=None)
            return {'success': True, 'cv_id': request.cv_id, 'job_id': request.job_id,
                    'model_used': request.model_type, 'overall_score': detail['overall_score'],
                    'status': detail.get('status', 'computed'),
                    'breakdown': {'semantic_score': scores['semantic'], 'skill_score': scores['skills'],
                                  'experience_score': scores['experience']},
                    'processing_time_ms': detail['processing_time_ms'], 'explanation': detail,
                    'warnings': ['Development corpus; not validated for hiring decisions.',
                                 'CV skills/years supplied by caller are ignored; evidence is extracted from text.']}
        finally:
            self.lock.release()


def create_app(engine_factory=Engine):
    @asynccontextmanager
    async def lifespan(app):
        app.state.engine = None
        try:
            app.state.engine = await run_in_threadpool(engine_factory)
        except Exception:
            LOG.exception('AI initialization failed')
        yield
        app.state.engine = None

    app = FastAPI(title='RecruitAI verified matching API', version='2.0', lifespan=lifespan)

    def engine():
        value = app.state.engine
        if value is None:
            raise HTTPException(503, 'AI model is unavailable')
        return value

    @app.get('/health')
    def health():
        engine()
        return {'status': 'healthy', 'models': ['TF-IDF', 'Sentence-BERT', 'Hybrid']}

    async def parse(file):
        try:
            content = await file.read(MAX_BYTES + 1)
            return await run_in_threadpool(parse_bytes, content, file.filename or '')
        except ParseError as exc:
            code = 413 if exc.code == 'file_too_large' else 415 if exc.code == 'unsupported_type' else 422
            raise HTTPException(code, {'code': exc.code, 'message': str(exc)}) from exc
        finally:
            await file.close()

    async def execute(request, segments):
        try:
            return await run_in_threadpool(engine().match, request, segments)
        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(422, 'Input cannot be analyzed; check text and requirements') from exc
        except Exception as exc:
            LOG.exception('AI inference failed')
            raise HTTPException(503, 'AI inference failed; no fallback score was generated') from exc

    @app.post('/api/ai/parse-cv')
    async def parse_cv(file: UploadFile = File(...)):
        return await parse(file)

    @app.post('/api/ai/match')
    async def match(request: MatchRequest):
        segments = [{'location': f'line:{i + 1}', 'text': line}
                    for i, line in enumerate(request.cv_text.splitlines()) if line.strip()]
        return await execute(request, segments)

    @app.post('/api/ai/match-file')
    async def match_file(file: UploadFile = File(...), request_json: str = Form(..., max_length=150000)):
        try:
            request = MatchRequest.model_validate_json(request_json)
        except ValidationError as exc:
            await file.close()
            raise HTTPException(422, 'Invalid request_json') from exc
        parsed = await parse(file)
        result = await execute(request, parsed['segments'])
        result['document'] = parsed
        return result

    @app.post('/api/ai/benchmark')
    def benchmark():
        raise HTTPException(409, 'Evaluation requires reviewed labels and a frozen test set; synthetic metrics are disabled')

    return app


app = create_app()
