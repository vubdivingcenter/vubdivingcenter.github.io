window.onscroll = function () { scrollFunction() };

const header_height = 330;
const header_height_mobile = 230;
const header_large_offset = 100;
const header_height_scroll = 110;
const header_height_scroll_mobile = 70;

function scrollFunction() {
  const isMobile = window.innerWidth < 1100;
  // Header element
  const header = document.getElementsByTagName("header")[0];
  // Header element has a different size for mobile and desktop
  const thresshold = (isMobile ? header_height_mobile : header_height) -
    (isMobile ? header_height_scroll_mobile : header_height_scroll) +
    (header.classList.contains("large") ? header_large_offset : 0);
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