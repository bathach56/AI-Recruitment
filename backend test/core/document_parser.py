"""Extract source text only. No OCR, matching score or experience inference."""
import hashlib
import io
import time
import zipfile
from importlib.metadata import version
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024
MAX_UNPACKED = 50 * 1024 * 1024


class ParseError(ValueError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def parse_bytes(content: bytes, filename: str) -> dict:
    started = time.perf_counter()
    suffix = Path(filename).suffix.lower()
    if suffix not in ('.pdf', '.docx'):
        raise ParseError('unsupported_type', 'Chỉ hỗ trợ PDF và DOCX; không hỗ trợ DOC cũ.')
    if not content:
        raise ParseError('empty_file', 'Tệp rỗng.')
    if len(content) > MAX_BYTES:
        raise ParseError('file_too_large', 'Tệp vượt quá 10 MiB.')
    segments, warnings = [], []
    try:
        if suffix == '.pdf':
            import pymupdf
            if not content.startswith(b'%PDF-'):
                raise ParseError('invalid_file', 'Nội dung không có chữ ký PDF hợp lệ.')
            with pymupdf.open(stream=content, filetype='pdf') as document:
                if document.needs_pass:
                    raise ParseError('encrypted_pdf', 'PDF yêu cầu mật khẩu.')
                if len(document) > 200:
                    raise ParseError('too_many_pages', 'PDF vượt quá 200 trang.')
                for number, page in enumerate(document, 1):
                    text = page.get_text('text', sort=True).strip()
                    if text:
                        segments.append({'location': f'page:{number}', 'text': text})
                    else:
                        warnings.append(f'Trang {number} không có text đọc được; có thể cần OCR.')
            engine = {'name': 'PyMuPDF', 'version': version('PyMuPDF')}
            warnings.append('Chưa OCR; thứ tự đọc PDF nhiều cột cần đối chiếu bản gốc.')
        else:
            from docx import Document
            from docx.text.paragraph import Paragraph
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                infos = archive.infolist()
                if len(infos) > 2000 or sum(i.file_size for i in infos) > MAX_UNPACKED:
                    raise ParseError('archive_too_large', 'DOCX giải nén vượt giới hạn cho phép.')
                if 'word/document.xml' not in archive.namelist():
                    raise ParseError('invalid_file', 'ZIP không phải tài liệu DOCX.')
            document = Document(io.BytesIO(content))

            def visit(container, location):
                for index, block in enumerate(container.iter_inner_content(), 1):
                    loc = f'{location}/block:{index}'
                    if isinstance(block, Paragraph):
                        if block.text.strip():
                            segments.append({'location': loc, 'text': block.text.strip()})
                    else:
                        seen = set()
                        for row_index, row in enumerate(block.rows, 1):
                            for col_index, cell in enumerate(row.cells, 1):
                                # Merged cells are exposed repeatedly by python-docx.
                                if cell._tc not in seen:
                                    seen.add(cell._tc)
                                    visit(cell, f'{loc}/row:{row_index}/cell:{col_index}')
            visit(document, 'body')
            engine = {'name': 'python-docx', 'version': version('python-docx')}
            warnings.append('Chỉ đọc thân tài liệu và bảng; chưa đọc header/footer, textbox, ảnh hoặc tracked changes.')
    except ParseError:
        raise
    except ImportError as exc:
        raise ParseError('missing_dependency', 'Thiếu thư viện parser; cài requirements.txt của backend test.') from exc
    except Exception as exc:
        raise ParseError('invalid_file', 'Không thể đọc tài liệu; file có thể hỏng hoặc sai định dạng.') from exc
    text = '\n'.join(segment['text'] for segment in segments)
    if not text.strip():
        raise ParseError('no_text', 'Không có văn bản đọc được. PDF scan/ảnh cần OCR; chưa được hỗ trợ.')
    return {'source_name': filename.replace('\\', '/').rsplit('/', 1)[-1],
            'sha256': hashlib.sha256(content).hexdigest(), 'size_bytes': len(content),
            'parser': engine, 'raw_text': text, 'segments': segments, 'warnings': warnings,
            'processing_time_ms': round((time.perf_counter() - started) * 1000, 3)}


def parse_file(path: Path) -> dict:
    # Local trusted path only; an eventual upload API should call parse_bytes.
    with Path(path).open('rb') as stream:
        content = stream.read(MAX_BYTES + 1)
    return parse_bytes(content, Path(path).name)
