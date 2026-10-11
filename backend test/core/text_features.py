"""Deterministic preprocessing and auditable taxonomy mentions; no skill score."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

VERSION = 'text-features-v1'
CONTACT = re.compile(r'https?://\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', re.I)
TOKEN = re.compile(r'(?u)(?:\.[^\W_]+|[^\W_]+)(?:[.+/#-][^\W_]+)*(?:\+\+|#|\+)?')
CLAUSE = re.compile(r'\n|[;!?]|\.(?=\s|$)|\b(?:but|however|nhưng|tuy nhiên)\b', re.I)
UNCERTAIN = re.compile(
    r"\b(?:chưa|không|no|not|never|without|lack|lacking|don't|doesn't|haven't|hasn't)\b"
    r'|\b(?:đang học|muốn học|dự định|learning|plan to|want to)\b', re.I)
AMBIGUOUS = {'go', 'rust', 'swift', 'dart', 'node', 'container', 'communication', 'english'}


def preprocess(raw_text: str) -> dict:
    if not isinstance(raw_text, str):
        raise TypeError('raw_text must be a string')
    text = unicodedata.normalize('NFC', raw_text)
    text = CONTACT.sub(' ', text)
    # Preserve accents, punctuation and negation. No stemming or stopword deletion.
    semantic = '\n'.join(re.sub(r'[^\S\n]+', ' ', line).strip()
                         for line in text.replace('\r\n', '\n').replace('\r', '\n').split('\n'))
    semantic = re.sub(r'\n{3,}', '\n\n', semantic).strip()
    tokens = TOKEN.findall(semantic.lower())
    return {'version': VERSION, 'semantic_text': semantic, 'tfidf_tokens': tokens,
            'tfidf_text': ' '.join(tokens),
            'operations': ['Unicode NFC', 'remove URL/email', 'normalize whitespace',
                           'TF-IDF only: lowercase and technology-aware tokens'],
            'stopwords_removed': False}


class SkillEvidence:
    def __init__(self, taxonomy_path: Path):
        content = Path(taxonomy_path).read_bytes()
        self.sha256 = hashlib.sha256(content).hexdigest()
        data = json.loads(content.decode('utf-8-sig'))
        self.version = data.get('version', 'unknown')
        self.rules = []
        seen = set()
        for category, skills in data['taxonomy'].items():
            for skill in skills:
                key = skill['normalized']
                if key in seen:
                    raise ValueError(f'Duplicate canonical skill: {key}')
                seen.add(key)
                aliases = set(skill['aliases']) | {skill['name'], key}
                for alias in sorted(aliases):
                    if not isinstance(alias, str) or not alias.strip():
                        raise ValueError(f'Invalid alias for {key}')
                    # Avoid Java inside JavaScript and C++ inside C+++.
                    pattern = re.compile(r'(?<![\w+#])' + re.escape(alias) + r'(?![\w+#])', re.I)
                    self.rules.append((pattern, skill, category, alias))
        if not self.rules:
            raise ValueError('Taxonomy contains no skills')

    def extract(self, segments: list[dict]) -> dict:
        evidence = []
        for segment_index, segment in enumerate(segments):
            text = segment['text']
            excluded = [m.span() for m in CONTACT.finditer(text)]
            matches = []
            for pattern, skill, category, alias in self.rules:
                for match in pattern.finditer(text):
                    if any(match.start() < end and match.end() > start for start, end in excluded):
                        continue
                    matches.append((match.start(), match.end(), skill, category, alias))
            # Prefer the longest alias at a location; suppress contained aliases.
            kept = []
            for start, end, skill, category, alias in sorted(matches, key=lambda m: (m[0], -(m[1]-m[0]), m[2]['normalized'], m[4])):
                if any(start < previous[1] and end > previous[0] for previous in kept):
                    continue
                kept.append((start, end))
                boundaries = list(CLAUSE.finditer(text))
                left = max([0] + [m.end() for m in boundaries if m.end() <= start])
                right = min([len(text)] + [m.start() for m in boundaries if m.start() >= end])
                context = text[left:right].strip()
                reasons = []
                if UNCERTAIN.search(context):
                    reasons.append('negation_or_learning_context')
                if alias.casefold() in AMBIGUOUS:
                    reasons.append('ambiguous_term')
                if alias.casefold() not in {skill['name'].casefold(), skill['normalized'].casefold()}:
                    reasons.append('taxonomy_alias_requires_review')
                evidence.append({'normalized': skill['normalized'], 'name': skill['name'],
                    'category': category, 'matched_text': text[start:end],
                    'segment_index': segment_index, 'location': segment['location'],
                    'start': start, 'end': end, 'context': context,
                    'status': 'needs_review' if reasons else 'mentioned', 'reasons': reasons})
        return {'version': VERSION, 'taxonomy_version': self.version, 'taxonomy_sha256': self.sha256,
                'mentioned_skills': sorted({e['normalized'] for e in evidence if e['status'] == 'mentioned'}),
                'review_skills': sorted({e['normalized'] for e in evidence if e['status'] == 'needs_review'}),
                'evidence': evidence,
                'warnings': ['A mention is not verified proficiency. Rule-based context checks are incomplete.',
                             'Offsets refer to the original segment text, not cleaned text.',
                             'Aliases follow the existing taxonomy; non-canonical aliases require review.']}
