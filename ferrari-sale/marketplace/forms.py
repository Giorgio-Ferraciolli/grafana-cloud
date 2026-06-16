from django import forms

from .models import Car, Proposal


class ProposalForm(forms.ModelForm):
    class Meta:
        model = Proposal
        fields = ["car", "name", "email", "phone", "offered_price", "message"]
        labels = {
            "car": "Ferrari desejada",
            "name": "Seu nome",
            "email": "Seu e-mail",
            "phone": "Telefone/WhatsApp",
            "offered_price": "Sua proposta em US$",
            "message": "Mensagem",
        }
        widgets = {
            "name": forms.TextInput(attrs={"placeholder": "Ex: Giorgio Tadeu"}),
            "email": forms.EmailInput(attrs={"placeholder": "voce@email.com"}),
            "phone": forms.TextInput(attrs={"placeholder": "+55 11 99999-9999"}),
            "offered_price": forms.NumberInput(attrs={"placeholder": "250000", "min": "1", "step": "100"}),
            "message": forms.Textarea(attrs={"placeholder": "Conte sua proposta ou condição de pagamento", "rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["car"].queryset = Car.objects.filter(is_featured=True)
        for field in self.fields.values():
            css = field.widget.attrs.get("class", "")
            field.widget.attrs["class"] = f"{css} form-control".strip()

    def clean_offered_price(self):
        value = self.cleaned_data["offered_price"]
        if value <= 0:
            raise forms.ValidationError("Informe um valor de proposta maior que zero.")
        return value
