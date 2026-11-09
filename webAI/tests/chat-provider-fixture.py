"""Loopback-only Ollama transport fixture for the chat failure integration checks."""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class ChatProviderFixture(BaseHTTPRequestHandler):
    def read_body(self):
        if self.headers.get("Transfer-Encoding", "").lower() != "chunked":
            return self.rfile.read(int(self.headers["Content-Length"]))
        chunks = []
        while size := int(self.rfile.readline().strip(), 16):
            chunks.append(self.rfile.read(size))
            self.rfile.readline()
        self.rfile.readline()
        return b"".join(chunks)

    def do_POST(self):
        request = json.loads(self.read_body())
        prompt = request["messages"][-1]["content"]
        if prompt == "delay":
            time.sleep(50)
            return
        if prompt == "bad-json":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b"broken response")
            return
        self.send_error(503)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), ChatProviderFixture).serve_forever()
