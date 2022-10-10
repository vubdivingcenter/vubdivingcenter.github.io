window.onscroll = function () { scrollFunction() };

const thresshold = 220;
function scrollFunction() {
  const header = document.getElementsByTagName("header")[0];
  const scrolled = document.body.scrollTop > thresshold || document.documentElement.scrollTop > thresshold;
  const scrollClass = header.classList.contains("scroll");
  if (scrolled && !scrollClass) {
    header.classList.add("scroll");
  } else if (!scrolled && scrollClass) {
    header.classList.remove("scroll");
  }
}

document.getElementById("sidebar").addEventListener('touchmove', function (e) {
  e.preventDefault();
}, false);

function closeNav() {
  document.getElementById("sidebar").className = "";
}

function openNav() {
  document.getElementById("sidebar").className = "open";
}