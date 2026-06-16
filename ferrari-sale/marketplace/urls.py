from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("proposta/enviada/", views.proposal_success, name="proposal_success"),
]
