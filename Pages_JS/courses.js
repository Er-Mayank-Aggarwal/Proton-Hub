// Intersection Observer for animations
const animatedElements = document.querySelectorAll('.animate__animated');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const element = entry.target;
      element.style.opacity = '1';
      
      // Remove the animate__animated class after animation completes
      setTimeout(() => {
        element.classList.remove('animate__animated');
      }, 1000);
      
      observer.unobserve(element);
    }
  });
}, {
  threshold: 0.1
});

animatedElements.forEach(el => {
  observer.observe(el);
});

// Fallback for teacher photos
document.querySelectorAll('.teacher-photo').forEach(img => {
  img.onerror = function() {
    const initials = this.alt.split(' ').map(name => name[0]).join('');
    this.src = `https://placehold.co/128x128/e0f2fe/3b82f6?text=${initials}`;
  };
});

document.addEventListener("DOMContentLoaded", () => {
  const contactButton = document.querySelector(".contact-button");

  contactButton.addEventListener("click", () => {
    const phoneNumber = "8005581985";
    const message = encodeURIComponent("Hi Proton Hub! 👋 I’m interested in joining your coaching. Could you please share more details about your courses?");
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  });
});
