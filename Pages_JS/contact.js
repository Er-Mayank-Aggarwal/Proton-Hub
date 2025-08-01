document.addEventListener("DOMContentLoaded", function () {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach(item => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    question.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");

      // Close all
      faqItems.forEach(el => {
        el.classList.remove("open");
        el.querySelector(".faq-answer").style.maxHeight = null;
        el.querySelector(".faq-question i").classList.remove("fa-chevron-up");
        el.querySelector(".faq-question i").classList.add("fa-chevron-down");
      });

      // Toggle current
      if (!isOpen) {
        item.classList.add("open");
        answer.style.maxHeight = answer.scrollHeight + "px";
        question.querySelector("i").classList.remove("fa-chevron-down");
        question.querySelector("i").classList.add("fa-chevron-up");
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("whatsappForm");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const email = document.getElementById("email").value.trim();
      const message = document.getElementById("message").value.trim();

      const phonePattern = /^\d{10}$/;
      if (!phonePattern.test(phone)) {
        alert("Please enter a valid 10-digit phone number.");
        return;
      }

      const whatsappNumber = "+918005581985";
      
      const text =
        `Hello, I would like to make an enquiry.\n\n` +
        `Name: ${name}\n` +
        `Phone: ${phone}\n` + 
        `Email: ${email}\n` +
        `Message: ${message}\n\n` +
        `Please get back to me at your earliest convenience. Thank you!`;
      const encoded = encodeURIComponent(text);

      const url = `https://wa.me/${whatsappNumber}?text=${encoded}`;
      window.open(url, "_blank");
    });
  }
});