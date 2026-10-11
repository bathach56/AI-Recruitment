"""Download a pinned public model; no project documents are uploaded."""
import json
import os
import sys
from pathlib import Path
# Standard HTTP avoids the Xet transfer stall observed on this Windows machine.
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
from huggingface_hub import HfApi, snapshot_download

MODEL_ID = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
DEST = Path(__file__).resolve().parents[1] / '.cache/sbert'


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    marker = DEST / 'provenance.json'
    if marker.exists():
        print('Pinned model already downloaded: ' + str(DEST))
        return
    revision = HfApi().model_info(MODEL_ID).sha
    snapshot_download(MODEL_ID, revision=revision, local_dir=DEST,
        allow_patterns=['*.json', 'model.safetensors', 'tokenizer.model', 'sentencepiece.bpe.model', '*.txt'],
        ignore_patterns=['onnx/*', 'openvino/*'])
    marker.write_text(json.dumps({'model_id': MODEL_ID, 'revision': revision}, indent=2), encoding='utf-8')
    print(f'Downloaded {MODEL_ID} @ {revision}')


if __name__ == '__main__':
    main()
