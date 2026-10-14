"""Tiny local web server for previewing the Hushwork page.

It serves the `hushwork` folder on http://localhost:5174 and tells the browser
never to cache files, so every edit shows up on the next reload.
"""
import functools
import http.server

PORT = 5174
FOLDER = "hushwork"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=FOLDER)
http.server.ThreadingHTTPServer(("", PORT), handler).serve_forever()
