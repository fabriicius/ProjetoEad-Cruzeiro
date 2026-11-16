from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/state/", views.state, name="state"),
    path("api/orders/", views.create_order, name="create-order"),
    path("api/orders/<int:pk>/", views.order_detail, name="order-detail"),
    path("api/orders/<int:pk>/status/", views.order_status, name="order-status"),
]
