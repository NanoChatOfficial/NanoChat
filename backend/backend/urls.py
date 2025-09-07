from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import View
from django.http import FileResponse, Http404
from pathlib import Path
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

class FrontendAppView(View):
    def get(self, request, *args, **kwargs):
        index_path = Path(settings.BASE_DIR) / "static" / "index.html"
        if not index_path.exists():
            raise Http404("index.html not found in static folder")
        return FileResponse(open(index_path, 'rb'), content_type='text/html')

urlpatterns += [
    re_path(r'^.*$', FrontendAppView.as_view()),
]
