from django import forms


class ContatoForm(forms.Form):
    nome = forms.CharField(
        label='Nome',
        max_length=100,
        widget=forms.TextInput(attrs={'placeholder': 'Digite seu nome'})
    )
    email = forms.EmailField(
        label='E-mail',
        widget=forms.EmailInput(attrs={'placeholder': 'seuemail@exemplo.com'})
    )
    assunto = forms.CharField(
        label='Assunto',
        max_length=120,
        widget=forms.TextInput(attrs={'placeholder': 'Ex: Testando Django'})
    )
    mensagem = forms.CharField(
        label='Mensagem',
        widget=forms.Textarea(attrs={
            'placeholder': 'Escreva uma mensagem...',
            'rows': 5,
        })
    )
