window.onscroll = function () { scrollFunction() };

const thresshold = 220;
function scrollFunction() {
  const header = document.getElementsByTagName("header")[0];
  if (document.body.scrollTop > thresshold || document.documentElement.scrollTop > thresshold) {
    header.classList.add("scroll");
  } else {
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