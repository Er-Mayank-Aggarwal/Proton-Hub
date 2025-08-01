document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  const header = document.getElementById("mainHeader");
  let lastScrollY = window.scrollY;

  // Hamburger toggle
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");

    // Toggle between ☰ and ✖
    if (hamburger.textContent === "☰" || hamburger.textContent === "≡") {
      hamburger.textContent = "✖";
    } else {
      hamburger.textContent = "☰";
    }
  });

  // Auto-hide header on scroll
  window.addEventListener("scroll", () => {
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
      header.classList.add("hidden");
    } else {
      header.classList.remove("hidden");
    }
    lastScrollY = window.scrollY;
  });

  // Close nav menu on link click (for mobile)
  document.querySelectorAll("#nav-links a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      hamburger.textContent = "☰"; // Reset hamburger icon
    });
  });
});
