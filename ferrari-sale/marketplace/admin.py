from django.contrib import admin

from .models import Car, Proposal


@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ("title", "model_year", "price", "location", "is_featured")
    list_filter = ("is_featured", "model_year", "transmission")
    search_fields = ("title", "slug", "engine", "location")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "car", "offered_price", "created_at")
    list_filter = ("car", "created_at")
    search_fields = ("name", "email", "phone", "message")
    readonly_fields = ("created_at",)
