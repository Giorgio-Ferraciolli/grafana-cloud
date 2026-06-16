from django.contrib import messages
from django.shortcuts import redirect, render

from .forms import ProposalForm
from .models import Car


def home(request):
    cars = Car.objects.filter(is_featured=True).order_by("price")
    selected_car_id = request.GET.get("car")

    if request.method == "POST":
        form = ProposalForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Proposta enviada com sucesso! Em um projeto real, o vendedor receberia essa lead.")
            return redirect("proposal_success")
    else:
        initial = {"car": selected_car_id} if selected_car_id else None
        form = ProposalForm(initial=initial)

    context = {
        "cars": cars,
        "form": form,
        "selected_car_id": selected_car_id,
    }
    return render(request, "marketplace/home.html", context)


def proposal_success(request):
    return render(request, "marketplace/proposal_success.html")
