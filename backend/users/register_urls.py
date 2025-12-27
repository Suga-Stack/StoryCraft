from django.urls import path

from .views import LoginView, LogoutView, RegisterView, SendEmailCodeView

urlpatterns = [
    path("send-email-code/", SendEmailCodeView.as_view(), name="send-email-code"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
