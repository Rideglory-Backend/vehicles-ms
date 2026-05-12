#!/usr/bin/env python3
"""
Solo-mode dashboard server
Serves static files + provides API endpoint to write PLAN_FEEDBACK.md
"""
import errno
import http.server
import socketserver
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

def _default_port() -> int:
    raw = os.environ.get("PORT") or os.environ.get("SOLO_PORT") or "8765"
    try:
        return int(raw)
    except ValueError:
        return 8765


PORT = _default_port()
REPO_ROOT = Path(__file__).parent.absolute()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class SoloModeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def do_POST(self):
        """Handle POST requests to /api/feedback"""
        parsed = urlparse(self.path)
        
        if parsed.path == "/api/feedback":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8')
                data = json.loads(body)
                
                markdown = data.get('markdown', '')
                if not markdown:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "No markdown provided"}).encode())
                    return
                
                feedback_path = REPO_ROOT / 'docs' / 'PLAN_FEEDBACK.md'
                feedback_path.write_text(markdown, encoding='utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "path": str(feedback_path.relative_to(REPO_ROOT))
                }).encode())
                
                print(f"✓ Wrote {feedback_path.relative_to(REPO_ROOT)}")
            
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
                print(f"✗ Error writing feedback: {e}", file=sys.stderr)
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress default logging for static files; log only feedback writes"""
        if '/api/' in self.path:
            super().log_message(format, *args)

def main():
    try:
        httpd = ReusableTCPServer(("", PORT), SoloModeHandler)
    except OSError as e:
        if e.errno == errno.EADDRINUSE:
            print(
                f"Port {PORT} is already in use. Stop the other server on this port "
                f"(e.g. the terminal running `python3 -m http.server {PORT}` — Ctrl+C), "
                f"or use another port: PORT=8766 python3 server.py",
                file=sys.stderr,
            )
            raise SystemExit(1) from e
        raise
    with httpd:
        print(f"Solo-mode dashboard server running at http://127.0.0.1:{PORT}")
        print(f"  → Dashboard: http://127.0.0.1:{PORT}/dashboard/index.html")
        print(f"  → Feedback writes to: {REPO_ROOT / 'docs' / 'PLAN_FEEDBACK.md'}")
        print(f"Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")

if __name__ == "__main__":
    main()
