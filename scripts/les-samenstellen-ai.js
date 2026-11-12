(function () {
  "use strict";

  var statusEl = document.getElementById("ai-copy-status");
  var buttons = document.querySelectorAll("[data-copy-target]");

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || "";
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) resolve();
        else reject(new Error("Kopiëren niet ondersteund"));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function (event) {
      var button = event.currentTarget;
      var target = document.getElementById(button.dataset.copyTarget);
      if (!target) return;
      copyText(target.textContent).then(function () {
        setStatus("Opdracht gekopieerd. Plak hem in je favoriete AI.");
      }).catch(function () {
        setStatus("Kopiëren lukte niet. Selecteer de tekst handmatig.");
      });
    });
  }
})();
