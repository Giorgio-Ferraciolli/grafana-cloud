from django.shortcuts import render
from .forms import ContatoForm


def home(request):
    if request.method == 'POST':
        form = ContatoForm(request.POST)
        if form.is_valid():
            dados = form.cleaned_data
            return render(request, 'formulario/sucesso.html', {'dados': dados})
    else:
        form = ContatoForm()

    return render(request, 'formulario/home.html', {'form': form})
