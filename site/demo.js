const toggle = document.querySelector('#toggle')
const example = document.querySelector('#example')
const original = example.cloneNode(true)
toggle.addEventListener('click', () => {
  const applied = toggle.getAttribute('aria-pressed') === 'true'
  if (applied) example.replaceChildren(...original.cloneNode(true).childNodes)
  else example.textContent = 'Dosyayı bugün sana göndereceğim.'
  toggle.setAttribute('aria-pressed', String(!applied))
  toggle.textContent = applied ? 'Öneriyi uygula' : 'Geri al'
})
