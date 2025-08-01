 // === Auto-Scrolling Slider ===
  const slider = document.getElementById("resultsSlider");
  const container = document.getElementById("sliderContainer");

  if (slider && container) {
    let scrollPosition = 0;
    const scrollSpeed = 1;
    let isPaused = false;

    container.addEventListener("mouseenter", () => isPaused = true);
    container.addEventListener("mouseleave", () => isPaused = false);

    function autoScroll() {
      if (!isPaused) {
        scrollPosition += scrollSpeed;
        slider.style.transform = `translateX(-${scrollPosition}px)`;

        if (scrollPosition >= slider.scrollWidth / 2) {
          scrollPosition = 0;
        }
      }
      requestAnimationFrame(autoScroll);
    }

    autoScroll();
  }

  const popup = document.getElementById('whatsappPopup');
    const closeBtn = document.getElementById('closePopup');

    closeBtn.addEventListener('click', () => {
      popup.style.display = 'none';
    });

    // Show the popup after 3 seconds
    popup.style.display = 'none';
    setTimeout(() => {
      popup.style.display = 'block';
    }, 3000);


