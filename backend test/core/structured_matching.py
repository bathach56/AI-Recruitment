"""Auditable requirement coverage and conservative explicit experience fields."""
import math
import re

from core.text_features import SkillEvidence

VERSION = 'structured-matching-v1'
# Only standalone, explicitly labelled fields. Narrative years and date ranges
# cannot establish total/relevant experience reliably without additional review.
EXPERIENCE = re.compile(
    r'\s*(?P<label>Số năm kinh nghiệm|Tổng kinh nghiệm|Kinh nghiệm liên quan|'
    r'Total experience|Relevant experience)\s*:\s*'
    r'(?P<years>\d+(?:[.,]\d+)?)\s*(?:năm|years?)\s*[.]?\s*', re.I)


def extract_experience(segments):
    evidence = []
    for index, segment in enumerate(segments):
        for match in EXPERIENCE.finditer(segment['text']):
            if match.span() != (0, len(segment['text'])):
                continue
            label = match['label'].casefold()
            scope = 'relevant' if label in {'kinh nghiệm liên quan', 'relevant experience'} else 'total'
            evidence.append({'scope': scope, 'years': float(match['years'].replace(',', '.')),
                             'segment_index': index, 'location': segment['location'],
                             'start': match.start(), 'end': match.end(),
                             'matched_text': match[0]})
    scopes = {}
    for scope in ('total', 'relevant'):
        values = {e['years'] for e in evidence if e['scope'] == scope}
        status = 'unknown' if not values else 'explicit' if len(values) == 1 else 'conflicting'
        scopes[scope] = {'status': status, 'years': next(iter(values)) if len(values) == 1 else None}
    total, relevant = scopes['total']['years'], scopes['relevant']['years']
    if total is not None and relevant is not None and relevant > total:
        for value in scopes.values():
            value.update(status='conflicting', years=None)
    return {'scopes': scopes, 'evidence': evidence,
            'warnings': ['Self-reported fields, not verified employment history.',
                         'Narratives, date intervals and overlapping jobs are not inferred.',
                         'Relevant experience has not been verified against this JD.']}


def experience_match(extracted, required_years, scope='total'):
    if scope not in extracted['scopes']:
        raise ValueError('Unsupported experience scope')
    if required_years is not None and (isinstance(required_years, bool) or
            not isinstance(required_years, (int, float)) or
            not math.isfinite(required_years) or required_years < 0):
        raise ValueError('Required years must be a finite nonnegative number or None')
    candidate = extracted['scopes'][scope]
    years = candidate['years']
    score = None
    status = 'no_requirement' if required_years in (None, 0) else candidate['status']
    if required_years and years is not None:
        score = 100 * min(years / required_years, 1)
    return {'scope': scope, 'required_years': required_years, 'candidate_years': years,
            'status': status, 'score': score, 'formula': '100 * min(candidate_years / required_years, 1)',
            'assumption': 'Years coverage only; total years do not establish job relevance.'}


def match_skills(extractor: SkillEvidence, segments, required, optional, required_weight=1.5, optional_weight=1.0):
    for weight in (required_weight, optional_weight):
        if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not math.isfinite(weight) or weight <= 0:
            raise ValueError('Weights must be finite and positive')
    features = extractor.extract(segments)
    canonical = {}
    for _, skill, _, _ in extractor.rules:
        for name in (skill['name'], skill['normalized']):
            canonical[name.casefold()] = skill['normalized']
    rows, seen = [], set()
    for names, group, weight in ((required, 'required', required_weight), (optional, 'optional', optional_weight)):
        if not isinstance(names, list):
            raise ValueError('Requirements must be lists of nonempty strings')
        for name in names:
            if not isinstance(name, str) or not name.strip():
                raise ValueError('Requirements must be nonempty strings')
            key = canonical.get(name.strip().casefold())
            identity = key or 'unknown:' + name.strip().casefold()
            if identity in seen:
                continue
            seen.add(identity)
            evidence = [e for e in features['evidence'] if e['normalized'] == key]
            positive = any(e['status'] == 'mentioned' for e in evidence)
            uncertain = any(e['status'] == 'needs_review' for e in evidence)
            # Conflicting/ambiguous evidence stays reviewable, never auto-approved.
            status = 'needs_review' if key is None or uncertain else 'matched' if positive else 'not_found'
            rows.append({'requirement': name, 'normalized': key, 'group': group,
                         'weight': weight, 'status': status, 'evidence': evidence,
                         'earned_weight': weight if status == 'matched' else 0})
    denominator = sum(row['weight'] for row in rows)
    numerator = sum(row['earned_weight'] for row in rows)
    return {'version': VERSION, 'requirements': rows, 'earned_weight': numerator,
            'total_weight': denominator, 'score': 100 * numerator / denominator if denominator else None,
            'weights': {'required': required_weight, 'optional': optional_weight},
            'taxonomy_sha256': features['taxonomy_sha256'],
            'formula': '100 * earned_weight / total_weight',
            'warnings': ['Weights are initial assumptions, not experimentally optimized.',
                         'Score measures explicit mention coverage, not proficiency.',
                         'Unknown requirements remain in denominator and require review.',
                         'Not found does not mean the candidate lacks that skill.']}
