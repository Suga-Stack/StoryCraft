import os
from django.http import HttpResponse


class CORSMiddleware:
    """Simple CORS middleware for local development.

    Injects Access-Control-Allow-* headers and responds to OPTIONS preflight.
    NOTE: Intended for local development only. For production, use django-cors-headers
    or a proper proxy with strict origin checks.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        # Allow overriding via environment variable for flexibility
        self.allowed_origin = os.getenv('VITE_DEV_URL', 'http://localhost:5173')

    def __call__(self, request):
        # Handle preflight
        if request.method == 'OPTIONS':
            response = HttpResponse()
            response['Access-Control-Allow-Origin'] = self.allowed_origin
            response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
            # 包含常见的自定义头以支持前端发送 X-CSRFToken 等
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, X-Requested-With, Accept'
            response['Access-Control-Allow-Credentials'] = 'true'
            return response

        response = self.get_response(request)

        # Add CORS headers to actual responses
        response['Access-Control-Allow-Origin'] = self.allowed_origin
        response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, X-Requested-With, Accept'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response
