/**
 * De site wordt maar eens per dag gebouwd, dus de vervaldatum van de
 * initiatieles wordt ook in de browser gecontroleerd. Elementen met
 * [data-initiatie-cutoff] verdwijnen zodra die datum voorbij is; staat er ook
 * een [data-initiatie-redirect] op, dan gaat de bezoeker naar die pagina.
 */
(function () {
  var elements = document.querySelectorAll('[data-initiatie-cutoff]');
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    var cutoff = Date.parse(element.getAttribute('data-initiatie-cutoff'));
    if (isNaN(cutoff) || Date.now() <= cutoff) {
      continue;
    }
    var redirect = element.getAttribute('data-initiatie-redirect');
    if (redirect) {
      window.location.replace(redirect);
      return;
    }
    element.hidden = true;
    element.style.display = 'none';
  }
})();
