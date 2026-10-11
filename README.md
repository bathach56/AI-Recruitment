# AI-Recruitment

AI Recruitment: CV–JD matching with TF-IDF, pretrained Sentence-BERT and Hybrid.

Start with [AI handoff](backend%20test/HANDOFF.md) and [API runbook](backend%20test/BACKEND_API.md).
The verified API entry point is `backend test/api.py`; the older `ai-service/app.py` is retained as legacy code and must not be used for the verified demo or research metrics.

## Local environment

From the repository root, with Python 3.14 and .NET 10 installed:

```powershell
python -m venv 'backend test/.venv'
& './backend test/.venv/Scripts/python.exe' -m pip install -r 'backend test/requirements-lock.txt'
& './backend test/.venv/Scripts/python.exe' 'backend test/scripts/download_sbert.py'
dotnet restore webAI/webAI.csproj
```

Dependencies were verified on Windows/Python 3.14.7; validate compatibility on another platform. Model weights and virtual environments are intentionally excluded from Git. Downloading the model requires internet access; inference is local.

## Status

- Verified AI core and ASP.NET API integration; 54 Python tests and 7 HTTP integration checks passed in the development workspace before handoff.
- Included CV/JD fixtures are synthetic development data, not a held-out evaluation set.
- No validated Precision/Recall/F1 results yet. Legacy evaluation scripts are not valid evidence of model performance.
- SQL persistence, authentication/authorization, real UI integration and production deployment remain to be completed by the backend team.
- Fine-tuning is future work.

External resume datasets with unverified provenance, machine-specific caches, logs, build outputs and secrets are not included.
Read AGENTS.md before making changes.
