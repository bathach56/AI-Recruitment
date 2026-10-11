"""Explicit weighted combination; missing active components prevent a total."""
import math
import time

from core.structured_matching import extract_experience, experience_match, match_skills

VERSION = 'hybrid-v1'
DEFAULT_WEIGHTS = {'semantic': 0.5, 'skills': 0.3, 'experience': 0.2}


def combine(scores, weights=None):
    weights = dict(DEFAULT_WEIGHTS if weights is None else weights)
    if set(scores) != set(DEFAULT_WEIGHTS) or set(weights) != set(DEFAULT_WEIGHTS):
        raise ValueError('Expected exactly semantic, skills and experience')
    for value in weights.values():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError('Weights must be finite nonnegative numbers')
    total = sum(weights.values())
    if not math.isfinite(total) or total <= 0:
        raise ValueError('Weight sum must be finite and positive')
    for value in scores.values():
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or
                                  not math.isfinite(value) or not 0 <= value <= 100):
            raise ValueError('Scores must be finite numbers in [0, 100] or None')
    normalized = {key: value / total for key, value in weights.items()}
    missing = [key for key in scores if scores[key] is None and weights[key] > 0]
    contributions = {key: (0.0 if weights[key] == 0 else None if value is None else value * normalized[key])
                     for key, value in scores.items()}
    return {'version': VERSION, 'scores': dict(scores), 'configured_weights': weights,
            'normalized_weights': normalized, 'contributions': contributions,
            'overall_score': None if missing else sum(contributions.values()),
            'status': 'incomplete' if missing else 'computed', 'missing_components': missing,
            'formula': 'sum(component_score * normalized_weight)',
            'missing_policy': 'No total when an active component is missing; no automatic reweighting.',
            'warnings': ['Weights are unvalidated assumptions, not research results.',
                         'This score is neither accuracy nor hiring probability.']}


def analyze(segments, jd_text, job, semantic_model, skill_extractor, weights=None):
    start = time.perf_counter()
    cv_text = '\n'.join(segment['text'] for segment in segments)
    semantic = semantic_model.explain(cv_text, jd_text)
    skills = match_skills(skill_extractor, segments, job['required_skills'], job['nice_to_have_skills'])
    evidence = extract_experience(segments)
    experience = experience_match(evidence, job.get('experience_years_required'))
    result = combine({'semantic': semantic['overall_score'], 'skills': skills['score'],
                      'experience': experience['score']}, weights)
    result.update(semantic=semantic, skills=skills, experience=experience,
                  experience_evidence=evidence, cv_segments=segments,
                  review_required=any(r['status'] == 'needs_review' for r in skills['requirements']),
                  processing_time_ms=(time.perf_counter() - start) * 1000)
    return result
