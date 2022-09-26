window.onscroll = function () { scrollFunction() };

const thresshold = 220;
function scrollFunction() {
  if (document.body.scrollTop > thresshold || document.documentElement.scrollTop > thresshold) {
    document.getElementsByTagName("header")[0].className = "scroll";
  } else {
    document.getElementsByTagName("header")[0].className = "";
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